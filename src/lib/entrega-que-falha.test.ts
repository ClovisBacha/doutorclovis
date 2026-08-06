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
  esperando?: { user_id: string }[];
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
      perguntaDela: "Posso comer sushi?",
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
      perguntaDela: "Posso comer sushi?",
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
      perguntaDela: "Posso comer sushi?",
      resposta: "Peixe cru não.",
    });
    expect(n).toBe(1);
  });

  test("quem trocou de médico não recebe resposta do consultório anterior", async () => {
    const { sb, escritas } = bancoFalso({ esperando: [{ user_id: "p1" }], atuais: [] });
    const n = await entregarRespostaDaLacuna(sb, {
      gapId: "g1",
      doctorId: "d1",
      perguntaDela: "Posso comer sushi?",
      resposta: "Peixe cru não.",
    });
    expect(n).toBe(0);
    expect(escritas).toEqual([]);
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
