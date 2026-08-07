/**
 * QUANDO O BANCO RECUSA, QUEM MENTE?
 *
 * A catraca de `travas-do-servidor.test.ts` CONTA escritas que ignoram
 * `{ error }`. Contar é o que faz a dívida não voltar a crescer — e é tudo o
 * que ela faz. Um número não sabe dizer se, ao falhar, a função devolve
 * "entreguei" ou "não entreguei"; nem se a marca de "já avisei" é gravada
 * antes ou depois da entrega. É justamente aí que mora o defeito caro:
 *
 *   · `entregarRespostaDaLacuna` carimbava `avisada_em` mesmo com a inserção
 *     recusada. A paciente nunca recebia a resposta, e o filtro
 *     `.is("avisada_em", null)` nunca mais a selecionava — o silêncio virava
 *     permanente. Nenhuma contagem de escritas enxerga isso: as duas escritas
 *     passariam a checar `error` e o carimbo continuaria saindo, porque o
 *     problema é a ORDEM.
 *   · `entregarCorrecao` devolvia `true` ("ela foi avisada") sem ter avisado,
 *     e é esse `true` que a tela do médico mostra.
 *
 * Os dois caminhos recebem `sb` como primeiro argumento, então dá para
 * exercitá-los com um banco de mentira — sem rede, sem Supabase, sem Gemini.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { entregarCorrecao, entregarRespostaDaLacuna } from "./secondbrain.functions";
import { grantSementinhas } from "./sementinhas.functions";

type Escrita = { tabela: string; op: "insert" | "update" | "upsert"; payload: unknown };

/**
 * Banco de mentira que registra tudo o que foi escrito e recusa as tabelas
 * listadas em `falham`.
 *
 * Registrar a ORDEM é o ponto: é a sequência das escritas, não a presença
 * delas, que diz se o sistema pode passar a acreditar numa entrega que não
 * aconteceu.
 */
function bancoFalso(opts: {
  falham?: string[];
  esperando?: { user_id: string; pergunta?: string | null }[];
  atuais?: { id: string }[];
}) {
  const falham = new Set(opts.falham ?? []);
  const escritas: Escrita[] = [];
  const erro = (t: string) => (falham.has(t) ? { code: "42P01", message: `sem ${t}` } : null);

  const sb: any = {
    from(tabela: string) {
      const leitura = async () => {
        if (tabela === "brain_gap_askers") return { data: opts.esperando ?? [], error: null };
        if (tabela === "patient_profiles") return { data: opts.atuais ?? [], error: null };
        return { data: [], error: null };
      };
      const q: any = {
        select: () => q,
        eq: () => q,
        is: () => q,
        in: () => q,
        limit: leitura,
        maybeSingle: async () => {
          const r = await leitura();
          return { data: (r.data as unknown[])[0] ?? null, error: null };
        },
        insert: async (payload: unknown) => {
          escritas.push({ tabela, op: "insert", payload });
          return { data: null, error: erro(tabela) };
        },
        update: (payload: unknown) => {
          escritas.push({ tabela, op: "update", payload });
          const u: any = {
            eq: () => u,
            in: () => u,
            then: (r: any) => r({ data: null, error: erro(tabela) }),
          };
          return u;
        },
        upsert: async (payload: unknown) => {
          escritas.push({ tabela, op: "upsert", payload });
          return { data: null, error: erro(tabela) };
        },
      };
      // Alguns caminhos resolvem o `select` direto, sem `.limit`/`.maybeSingle`.
      q.then = (r: any) => leitura().then(r);
      return q;
    },
  };
  return { sb, escritas };
}

const UMA_PACIENTE = { esperando: [{ user_id: "p1" }], atuais: [{ id: "p1" }] };

describe("a resposta da lacuna só é dada por entregue se foi entregue", () => {
  test("com o banco são: entrega, marca avisada e conta a paciente", async () => {
    const { sb, escritas } = bancoFalso(UMA_PACIENTE);
    const n = await entregarRespostaDaLacuna(sb, {
      gapId: "g1",
      doctorId: "d1",
      perguntaGeneralizada: "Posso comer sushi?",
      resposta: "Peixe cru não.",
    });
    expect(n).toBe(1);
    expect(escritas.map((e) => `${e.tabela}.${e.op}`)).toEqual([
      "doctor_questions.insert",
      "brain_gap_askers.update",
    ]);
  });

  test("insert recusado: devolve 0 e NÃO carimba avisada_em", async () => {
    /* O teste que este arquivo existe para ter. Se alguém trocar a ordem de
       volta, ou remover o `return 0`, a marca aparece aqui — e ela é o que
       torna o silêncio permanente. */
    const { sb, escritas } = bancoFalso({ ...UMA_PACIENTE, falham: ["doctor_questions"] });
    const n = await entregarRespostaDaLacuna(sb, {
      gapId: "g1",
      doctorId: "d1",
      perguntaGeneralizada: "Posso comer sushi?",
      resposta: "Peixe cru não.",
    });
    expect(n).toBe(0);
    expect(escritas.some((e) => e.tabela === "brain_gap_askers")).toBe(false);
  });

  test("marca recusada: a entrega vale, porque ela JÁ recebeu", async () => {
    /* O lado seguro é o oposto aqui: sem a marca, a próxima execução entrega de
       novo — chato, não perigoso. Devolver 0 faria o chamador tratar uma
       entrega boa como fracasso. */
    const { sb } = bancoFalso({ ...UMA_PACIENTE, falham: ["brain_gap_askers"] });
    const n = await entregarRespostaDaLacuna(sb, {
      gapId: "g1",
      doctorId: "d1",
      perguntaGeneralizada: "Posso comer sushi?",
      resposta: "Peixe cru não.",
    });
    expect(n).toBe(1);
  });

  test("quem trocou de médico não recebe resposta do consultório anterior", async () => {
    const { sb, escritas } = bancoFalso({ esperando: [{ user_id: "p1" }], atuais: [] });
    const n = await entregarRespostaDaLacuna(sb, {
      gapId: "g1",
      doctorId: "d1",
      perguntaGeneralizada: "Posso comer sushi?",
      resposta: "Peixe cru não.",
    });
    expect(n).toBe(0);
    expect(escritas).toEqual([]);
  });
});

describe("cada paciente recebe a PRÓPRIA pergunta", () => {
  /* ─── O DEFEITO MAIS SÉRIO DESTA BASE ──────────────────────────────────────
   *
   * `brain_gaps` é deduplicada por texto normalizado E por semelhança de vetor
   * (≥0,82). Isso é de propósito e é bom: impede o médico de responder "é
   * normal sentir enjoo?" três vezes. O efeito colateral é que perguntas
   * ESCRITAS DE FORMAS DIFERENTES viram uma linha só — cujo texto é o da
   * PRIMEIRA paciente.
   *
   * A entrega mandava esse texto para TODAS: como `doctor_questions.question`,
   * na aba Perguntas de cada uma, e como CORPO DO PUSH, na tela de bloqueio do
   * celular delas.
   *
   * Paciente A escreve "estou com corrimento com cheiro depois da relação".
   * Paciente B pergunta algo parecido com outras palavras. B recebe no celular
   * "Seu médico respondeu — estou com corrimento com cheiro depois da relação".
   */
  const RESPOSTA = "Vamos avaliar na consulta.";

  test("quem tem texto guardado recebe o texto DELA", async () => {
    const { sb, escritas } = bancoFalso({
      esperando: [
        { user_id: "p1", pergunta: "minha pergunta" },
        { user_id: "p2", pergunta: "a pergunta MUITO pessoal da p2" },
      ],
      atuais: [{ id: "p1" }, { id: "p2" }],
    });
    await entregarRespostaDaLacuna(sb, {
      gapId: "g1",
      doctorId: "d1",
      perguntaGeneralizada: "versão do médico",
      resposta: RESPOSTA,
    });
    const linhas = escritas.find((e) => e.tabela === "doctor_questions")!.payload as {
      user_id: string;
      question: string;
    }[];
    expect(linhas.find((l) => l.user_id === "p1")?.question).toBe("minha pergunta");
    expect(linhas.find((l) => l.user_id === "p2")?.question).toBe("a pergunta MUITO pessoal da p2");
  });

  test("o texto de uma NUNCA aparece na linha da outra", async () => {
    /* A asserção que descreve o vazamento, e não só o conserto. */
    const { sb, escritas } = bancoFalso({
      esperando: [
        { user_id: "p1", pergunta: "segredo da p1" },
        { user_id: "p2", pergunta: "segredo da p2" },
      ],
      atuais: [{ id: "p1" }, { id: "p2" }],
    });
    await entregarRespostaDaLacuna(sb, {
      gapId: "g1",
      doctorId: "d1",
      perguntaGeneralizada: "versão do médico",
      resposta: RESPOSTA,
    });
    const linhas = escritas.find((e) => e.tabela === "doctor_questions")!.payload as {
      user_id: string;
      question: string;
    }[];
    expect(linhas.find((l) => l.user_id === "p1")?.question).not.toContain("p2");
    expect(linhas.find((l) => l.user_id === "p2")?.question).not.toContain("p1");
  });

  test("sem texto guardado, vai a versão do MÉDICO — nunca a de outra", async () => {
    /* O banco antes da migration. A troca é deliberada: ela reconhece menos a
       própria dúvida, e não recebe a intimidade de outra pessoa. Não há
       meio-termo — o meio-termo era o defeito. */
    const { sb, escritas } = bancoFalso({
      esperando: [
        { user_id: "p1", pergunta: null },
        { user_id: "p2", pergunta: null },
      ],
      atuais: [{ id: "p1" }, { id: "p2" }],
    });
    await entregarRespostaDaLacuna(sb, {
      gapId: "g1",
      doctorId: "d1",
      perguntaGeneralizada: "É normal sentir enjoo?",
      resposta: RESPOSTA,
    });
    const linhas = escritas.find((e) => e.tabela === "doctor_questions")!.payload as {
      question: string;
    }[];
    expect(linhas.every((l) => l.question === "É normal sentir enjoo?")).toBe(true);
  });

  test("uma com texto e outra sem — cada uma no seu caso", async () => {
    const { sb, escritas } = bancoFalso({
      esperando: [{ user_id: "p1", pergunta: "o que eu escrevi" }, { user_id: "p2" }],
      atuais: [{ id: "p1" }, { id: "p2" }],
    });
    await entregarRespostaDaLacuna(sb, {
      gapId: "g1",
      doctorId: "d1",
      perguntaGeneralizada: "versão do médico",
      resposta: RESPOSTA,
    });
    const linhas = escritas.find((e) => e.tabela === "doctor_questions")!.payload as {
      user_id: string;
      question: string;
    }[];
    expect(linhas.find((l) => l.user_id === "p1")?.question).toBe("o que eu escrevi");
    expect(linhas.find((l) => l.user_id === "p2")?.question).toBe("versão do médico");
  });
});

describe("a correção só é dada por avisada se chegou", () => {
  const ARGS = {
    doctorId: "d1",
    userId: "p1",
    pergunta: "Posso comer sushi?",
    resposta: "Resposta corrigida.",
  };

  test("com o banco são: grava na aba dela e devolve true", async () => {
    const { sb, escritas } = bancoFalso({ atuais: [{ id: "p1" }] });
    expect(await entregarCorrecao(sb, ARGS)).toBe(true);
    expect(escritas.map((e) => e.tabela)).toEqual(["doctor_questions"]);
  });

  test("insert recusado: devolve false — a tela do médico não pode mentir", async () => {
    const { sb } = bancoFalso({ atuais: [{ id: "p1" }], falham: ["doctor_questions"] });
    expect(await entregarCorrecao(sb, ARGS)).toBe(false);
  });

  test('"está certa, manter" não avisa ninguém', async () => {
    /* Sem edição não houve mudança, e dizer à paciente que algo mudou quando
       nada mudou é pior que o silêncio. */
    const { sb, escritas } = bancoFalso({ atuais: [{ id: "p1" }] });
    expect(await entregarCorrecao(sb, { ...ARGS, resposta: null })).toBe(false);
    expect(escritas).toEqual([]);
  });

  test("paciente que saiu do consultório não recebe correção", async () => {
    const { sb, escritas } = bancoFalso({ atuais: [] });
    expect(await entregarCorrecao(sb, ARGS)).toBe(false);
    expect(escritas).toEqual([]);
  });
});

describe("sementinhas: falhar não pode derrubar quem chamou", () => {
  /* Todo chamador ignora o retorno (é `Promise<void>`), então o único desfecho
     inaceitável é lançar no meio do fluxo da paciente — ela cumpre o desafio e
     a tela quebra. O log é o que existe para o saldo parado não virar mistério. */
  test("upsert recusado: não lança", async () => {
    const { sb } = bancoFalso({ falham: ["sementinhas_ledger"] });
    await grantSementinhas(sb, "p1", [{ amount: 100, reason: "teste", dedupeKey: "k1" }]);
  });

  test("concessão de valor zero não vira linha no ledger", async () => {
    const { sb, escritas } = bancoFalso({});
    await grantSementinhas(sb, "p1", [{ amount: 0, reason: "nada", dedupeKey: "k0" }]);
    expect(escritas).toEqual([]);
  });
});

describe("o vazamento tinha QUATRO superfícies, não uma", () => {
  /**
   * A entrega (doctor_questions + push) foi consertada primeiro. Uma varredura
   * encontrou o MESMO texto — o enunciado da lacuna, que é o que a PRIMEIRA
   * paciente escreveu — vazando por mais três lugares:
   *
   *  · o bloco de pendências, dentro do system prompt da conversa de outra
   *    paciente, na forma "você perguntou X";
   *  · a aba "sua dúvida está com o seu médico" — a tela que eu criei para
   *    consertar a entrega repetia o defeito da entrega;
   *  · o campo pré-preenchido no painel do médico (esse é dele, e ele pode ver
   *    a pergunta da própria paciente — não é vazamento).
   *
   * Consertar a entrega e deixar as leituras é consertar o cano e deixar a
   * torneira aberta.
   */
  const chat = readFileSync("src/routes/api/chat.ts", "utf8");
  const fns = readFileSync("src/lib/secondbrain.functions.ts", "utf8");

  test("o bloco de pendências lê o texto DELA", () => {
    const i = chat.indexOf('.from("brain_gap_askers")');
    expect(i).toBeGreaterThan(-1);
    expect(chat.slice(i, i + 400)).toContain('.select("gap_id,pergunta")');
  });

  test("e nunca cai para o enunciado da lacuna", () => {
    /* O fallback tem que ser a AUSÊNCIA da citação, não o texto de outra. */
    const i = chat.indexOf("const minha = textoDela.get(g.id)");
    expect(i).toBeGreaterThan(-1);
    expect(chat.slice(i, i + 500)).toContain("Uma dúvida que ela encaminhou");
  });

  test("a aba da paciente lê o texto DELA", () => {
    const i = fns.indexOf("minhasDuvidasRegistradas");
    expect(i).toBeGreaterThan(-1);
    const janela = fns.slice(i, i + 2500);
    expect(janela).toContain('.select("gap_id,created_at,pergunta,brain_gaps(question,status)")');
    expect(janela).toContain('pergunta: String(l.pergunta ?? "").trim()');
  });

  test("nenhuma das duas leituras usa brain_gaps.question como texto da paciente", () => {
    /* A asserção que descreve o defeito: `l.brain_gaps.question` como valor de
       `pergunta` foi exatamente o que eu escrevi ontem. */
    expect(fns).not.toContain("pergunta: String(l.brain_gaps.question");
    expect(chat).not.toContain('`- "${g.question}" — JÁ RESPONDIDA');
  });
});
