/**
 * Duas pacientes, a mesma dúvida, palavras diferentes.
 *
 *   "é normal sentir enjoo?"
 *   "enjoo é normal na gravidez?"
 *
 * Até aqui isso virava DUAS linhas na fila do médico, porque a lacuna era
 * deduplicada por TEXTO normalizado. Ele respondia duas vezes a mesma coisa —
 * e é esse caminho, não o volume de dúvidas diferentes, que faz o Segundo
 * Cérebro parecer trabalhoso.
 *
 * A LEITURA já entendia sinônimos (busca por vetor nas entradas aprovadas). A
 * ESCRITA da lacuna, não. Estes testes prendem a ponte entre as duas.
 *
 * O erro que este arquivo mais protege é de SCOPE, e ele é mudo: o vetor da
 * pergunta é calculado dentro do `try` da busca semântica e usado depois que o
 * `try` fechou. Declarado no lugar errado, o agrupamento não quebra — ele
 * simplesmente nunca acontece, e as lacunas nascem todas sem vetor exatamente
 * como antes. Nenhum erro, nenhum log, nenhuma diferença visível até o médico
 * reclamar da fila meses depois.
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";

/** Fonte sem comentários: o cabeçalho acima explica o defeito citando os
    próprios nomes que os testes cobram. O que vale é o código. */
function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Um Supabase de mentira, o suficiente para o caminho da lacuna
// ─────────────────────────────────────────────────────────────────────────────

type Registro = {
  inserts: any[];
  updates: any[];
  rpc: { nome: string; args: any }[];
  askers: any[];
  /** Textos mandados ao `embedText` — é o que custa dinheiro. */
  embeds: string[];
  /** Resolve quando a lacuna termina — a gravação é fire-and-forget. */
  fim: Promise<void>;
};

function supabaseDeMentira(opts: {
  existente?: any;
  parecidas?: any[];
  /** Simula o banco SEM a coluna `embedding` (SQL ainda não aplicado). */
  semColunaEmbedding?: boolean;
}): {
  sb: any;
  reg: Registro;
} {
  let terminou!: () => void;
  const fim = new Promise<void>((r) => {
    terminou = r;
  });
  const reg: Registro = { inserts: [], updates: [], rpc: [], askers: [], embeds: [], fim };

  const sb: any = {
    from(_tabela: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gte() {
          return this;
        },
        maybeSingle: async () => ({ data: opts.existente ?? null }),
        update(patch: any) {
          reg.updates.push(patch);
          return {
            eq: async (_col: string, valor: string) => {
              patch.__id = valor;
              terminou();
              return {};
            },
          };
        },
        insert(linha: any) {
          reg.inserts.push(linha);
          /* Igual ao PostgREST: coluna desconhecida recusa a LINHA INTEIRA e
             devolve `error` — não estoura. */
          const recusa = opts.semColunaEmbedding && linha.embedding !== undefined;
          if (!recusa) terminou();
          return {
            select: () => ({
              maybeSingle: async () =>
                recusa
                  ? { data: null, error: { code: "PGRST204", message: "column not found" } }
                  : { data: { id: "lacuna-nova" }, error: null },
            }),
          };
        },
        upsert: async (linha: any) => {
          reg.askers.push(linha);
          return {};
        },
      };
    },
    rpc: async (nome: string, args: any) => {
      reg.rpc.push({ nome, args });
      return { data: opts.parecidas ?? [] };
    },
  };
  return { sb, reg };
}

const VETOR = Array.from({ length: 768 }, (_, i) => (i % 7) / 7);

/**
 * Um banco de mentira para a CURA — outra forma de uso: aqui o que importa é
 * a varredura das lacunas cegas, não a gravação de uma nova.
 */
function bancoDeCura(opts: { cegas?: any[]; erro?: any; embedTextDevolve?: (i: number) => any }) {
  const reg = {
    filtros: [] as [string, any][],
    limite: null as number | null,
    embeds: [] as string[],
    updates: [] as { id: string; embedding: any }[],
    passos: 0,
  };
  let terminou!: () => void;
  const fim = new Promise<void>((r) => {
    terminou = r;
  });
  const sb: any = {
    from() {
      const q: any = {
        select: () => q,
        eq: (col: string, v: any) => {
          reg.filtros.push([col, v]);
          return q;
        },
        is: (col: string, v: any) => {
          reg.filtros.push([col, v]);
          return q;
        },
        limit: async (n: number) => {
          reg.limite = n;
          return { data: opts.cegas ?? [], error: opts.erro ?? null };
        },
        update: (patch: any) => ({
          eq: async (_c: string, id: string) => {
            reg.updates.push({ id, embedding: patch.embedding });
            if (reg.updates.length === (opts.cegas ?? []).length) terminou();
            return {};
          },
        }),
      };
      return q;
    },
  };
  return { sb, reg, fim, terminou };
}

async function rodarCura(opts: {
  cegas?: any[];
  erro?: any;
  embedTextDevolve?: (i: number) => any;
}) {
  const { sb, reg, fim, terminou } = bancoDeCura(opts);
  mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: sb }));
  mock.module("./embeddings.server", () => ({
    embedText: async (texto: string) => {
      const i = reg.embeds.length;
      reg.embeds.push(texto);
      const v = opts.embedTextDevolve ? opts.embedTextDevolve(i) : VETOR;
      if (!v) terminou(); // desistiu: é aqui que a cura para
      return v;
    },
  }));
  const { curarLacunasSemVetor } = await import("./secondbrain.server");
  curarLacunasSemVetor("doutor-1");
  /* Sem lacuna cega nenhuma (ou com erro), nada mais acontece — dar uns
     tiques ao laço de eventos é o bastante para provar isso. */
  if (!opts.cegas?.length || opts.erro) {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  } else {
    await fim;
  }
  return reg;
}

async function rodarLacuna(opts: {
  existente?: any;
  parecidas?: any[];
  /** O vetor que quem chama passa. `undefined` = não passou (caminho raro). */
  embedding?: number[] | null;
  /** O que o `embedText` de reserva devolve. `null` = sem chave de IA. */
  embedTextDevolve?: number[] | null;
  semColunaEmbedding?: boolean;
}) {
  const { sb, reg } = supabaseDeMentira(opts);
  mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: sb }));
  mock.module("./embeddings.server", () => ({
    embedText: async (texto: string) => {
      reg.embeds.push(texto);
      return opts.embedTextDevolve ?? null;
    },
  }));
  const { logBrainGap } = await import("./secondbrain.server");
  logBrainGap(
    "doutor-1",
    "é normal sentir enjoo na gravidez?",
    "app",
    "paciente-1",
    opts.embedding,
  );
  await reg.fim;
  return reg;
}

afterEach(() => {
  mock.restore();
});

describe("a mesma pergunta com outras palavras vira UMA linha na fila", () => {
  test("acima do corte, a lacuna parecida recebe o hit em vez de nascer outra", async () => {
    const reg = await rodarLacuna({
      parecidas: [{ id: "lacuna-do-enjoo", hits: 3, similarity: 0.91 }],
      embedding: VETOR,
    });
    expect(reg.inserts).toHaveLength(0);
    expect(reg.updates).toHaveLength(1);
    expect(reg.updates[0].hits).toBe(4);
    expect(reg.updates[0].__id).toBe("lacuna-do-enjoo");
  });

  test("quem perguntou depois também fica registrado como esperando", async () => {
    /* Sem isto, a segunda paciente some: o médico responde a lacuna, o push sai
       para a primeira, e a segunda nunca fica sabendo — tendo perguntado. */
    const reg = await rodarLacuna({
      parecidas: [{ id: "lacuna-do-enjoo", hits: 1, similarity: 0.93 }],
      embedding: VETOR,
    });
    expect(reg.askers).toHaveLength(1);
    expect(reg.askers[0]).toEqual({ gap_id: "lacuna-do-enjoo", user_id: "paciente-1" });
  });
});

describe("o corte alto é o que protege a paciente", () => {
  /* Juntar duas perguntas DIFERENTES é o erro caro: o médico responde uma,
     acha que respondeu as duas, e a paciente da segunda recebe uma orientação
     que não era para ela. Por isso o corte da JUNÇÃO é muito mais alto que o
     0,55 da leitura — errar para o lado de duas linhas na fila é barato. */
  test("perto, mas não igual, continua sendo lacuna separada", async () => {
    const reg = await rodarLacuna({
      parecidas: [{ id: "outra-coisa", hits: 2, similarity: 0.85 }],
      embedding: VETOR,
    });
    expect(reg.updates).toHaveLength(0);
    expect(reg.inserts).toHaveLength(1);
  });

  test("o corte da junção é bem mais alto que o corte da leitura", () => {
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    const juncao = Number(fonte.match(/GAP_MERGE_MIN_SIMILARITY = ([\d.]+)/)?.[1]);
    const leitura = Number(fonte.match(/SEMANTIC_MIN_SIMILARITY = ([\d.]+)/)?.[1]);
    expect(juncao).toBeGreaterThan(leitura + 0.2);
  });
});

describe("sem chave de IA, o comportamento é o de antes — nunca pior", () => {
  test("a lacuna é registrada de qualquer jeito, só não agrupa", async () => {
    /* Cair aqui significaria perder a pergunta da paciente justamente quando a
       IA está mais fraca — o pior momento possível para ela sumir. */
    const reg = await rodarLacuna({ embedding: null, embedTextDevolve: null });
    expect(reg.rpc).toHaveLength(0);
    expect(reg.inserts).toHaveLength(1);
    expect(reg.inserts[0].embedding).toBeUndefined();
    expect(reg.inserts[0].question).toContain("enjoo");
  });
});

describe("a lacuna nova nasce com o vetor", () => {
  test("sem isso, a PRIMEIRA nunca agruparia a segunda", async () => {
    const reg = await rodarLacuna({ embedding: VETOR });
    expect(reg.inserts[0].embedding).toEqual(VETOR);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A janela entre o deploy e o SQL — onde a lacuna sumia calada
// ─────────────────────────────────────────────────────────────────────────────

describe("com o banco ainda sem a coluna, a pergunta não se perde", () => {
  /* O código sobe pela Vercel a cada push; o SQL é aplicado à mão, depois.
     Nessa janela o PostgREST recusa a linha inteira por causa de uma coluna
     que ele não conhece — e recusa devolvendo `error`, sem estourar. Ignorar
     esse `error` fazia TODA lacuna nova sumir em silêncio, enquanto a IA
     continuava prometendo à paciente "registrei aqui para ele ver".
     É o pior tipo de defeito deste projeto: some a pergunta de alguém, não
     deixa rastro, e só aparece quando o médico estranha a fila vazia. */
  test("a segunda tentativa vai sem o vetor e a lacuna entra", async () => {
    const reg = await rodarLacuna({ embedding: VETOR, semColunaEmbedding: true });
    expect(reg.inserts).toHaveLength(2);
    expect(reg.inserts[0].embedding).toEqual(VETOR); // tentou agrupar
    expect(reg.inserts[1].embedding).toBeUndefined(); // desistiu do vetor
    expect(reg.inserts[1].question).toContain("enjoo"); // a pergunta sobreviveu
  });

  test("quem perguntou continua sendo registrado como esperando", async () => {
    /* Sem o id da lacuna, a paciente não recebe o push quando o médico
       responder — ela some junto com o vetor. */
    const reg = await rodarLacuna({ embedding: VETOR, semColunaEmbedding: true });
    expect(reg.askers[0]).toEqual({ gap_id: "lacuna-nova", user_id: "paciente-1" });
  });

  test("com a coluna existindo, não há segunda tentativa", async () => {
    const reg = await rodarLacuna({ embedding: VETOR });
    expect(reg.inserts).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quem NÃO tem vetor à mão — e quanto isso custa
// ─────────────────────────────────────────────────────────────────────────────

describe("os caminhos raros calculam o vetor; o caminho do volume, nunca", () => {
  /* Duas outras portas criam lacuna sem vetor nenhum: o polegar para baixo no
     app e a API do DoctorThink (cuja interface `BrainStore` não carrega
     vetor). Sem a reserva, as lacunas dessas portas nasciam cegas e ficavam
     para sempre fora do agrupamento — e as do polegar para baixo são
     justamente as mais valiosas de agrupar, porque são as que a IA já tentou
     responder e errou. */
  test("sem vetor à mão, a função calcula o dela e agrupa igual", async () => {
    const reg = await rodarLacuna({
      embedTextDevolve: VETOR,
      parecidas: [{ id: "lacuna-do-enjoo", hits: 5, similarity: 0.9 }],
    });
    expect(reg.embeds).toHaveLength(1);
    expect(reg.updates[0].hits).toBe(6);
    expect(reg.inserts).toHaveLength(0);
  });

  test("com vetor à mão, NENHUM embedding novo é pedido", async () => {
    /* Esta é a conta do mês. O chat passa por aqui em toda pergunta sem
       cobertura — que é a mais comum enquanto o cérebro do médico é pequeno.
       Um embedding a mais aqui seria invisível no comportamento e visível só
       na fatura. */
    const reg = await rodarLacuna({ embedding: VETOR });
    expect(reg.embeds).toHaveLength(0);
  });

  test("se o texto exato já bateu, não se gasta embedding nenhum", async () => {
    /* Achou pela chave de texto: não há o que agrupar, e calcular o vetor
       seria dinheiro no lixo. */
    const reg = await rodarLacuna({
      existente: { id: "ja-existe", hits: 9, status: "aberta" },
      embedTextDevolve: VETOR,
    });
    expect(reg.embeds).toHaveLength(0);
    expect(reg.rpc).toHaveLength(0);
    expect(reg.updates[0].hits).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// O vetor precisa CHEGAR até aqui — é a parte que falha em silêncio
// ─────────────────────────────────────────────────────────────────────────────

describe("o vetor da pergunta sobrevive ao bloco onde foi calculado", () => {
  const fonte = codigoDe("src/lib/secondbrain.server.ts");

  test("é declarado fora do bloco onde é preenchido", () => {
    /* Âncora no `entries.length` e não no `import` do `embedText`: a reserva
       dos caminhos raros também importa `embedText`, e mais acima no arquivo —
       ancorar nele fazia o teste medir a distância errada e passar sempre. */
    const declaracao = fonte.indexOf("let vetorDaPergunta");
    const blocoDaBusca = fonte.indexOf("if (entries.length > 0)");
    const atribuicao = fonte.indexOf("vetorDaPergunta = qvec");
    expect(declaracao).toBeGreaterThan(0);
    expect(declaracao).toBeLessThan(blocoDaBusca);
    expect(atribuicao).toBeGreaterThan(blocoDaBusca);
  });

  test("é o vetor que a lacuna recebe", () => {
    expect(fonte).toContain(
      "logBrainGap(target, userMessage, channel, patientId, vetorDaPergunta)",
    );
  });

  test("é o MESMO vetor da busca — não um embedding novo", () => {
    /* Um segundo `embedText` aqui funcionaria e ninguém notaria: mesma
       resposta, mesmo agrupamento. Só a conta no fim do mês — uma chamada a
       mais por pergunta sem cobertura, que é justamente a mais comum enquanto
       o cérebro do médico está pequeno. */
    expect(fonte.match(/embedText\(userMessage/g) ?? []).toHaveLength(1);
    expect(fonte).toContain("vetorDaPergunta = qvec");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// O SQL
// ─────────────────────────────────────────────────────────────────────────────

describe("a busca no banco", () => {
  /* Sem os comentários: metade do arquivo EXPLICA a regra citando o próprio
     SQL que ela usa — inclusive uma consulta de conferência com
     `WHERE status = 'aberta'` no rodapé. Apagar o filtro de dentro da função
     deixava o teste passando pelo comentário, que foi exatamente o que
     aconteceu ao tentar quebrá-lo de propósito. */
  const sql = readFileSync("supabase/APLICAR_LACUNAS_PARECIDAS.sql", "utf8").replace(
    /^\s*--.*$/gm,
    "",
  );

  test("só procura entre as lacunas ABERTAS", () => {
    /* Uma lacuna respondida virou entrada do cérebro e já é achada pela busca
       normal. Reabri-la por semelhança devolveria ao médico algo que ele
       resolveu — a fila voltaria a crescer sozinha. */
    expect(sql).toMatch(/status = 'aberta'/);
  });

  test("ignora lacunas antigas, sem vetor, em vez de ordená-las como nulo", () => {
    expect(sql).toContain("g.embedding IS NOT NULL");
  });

  test("a coluna e o índice entram sem quebrar quem já rodou o arquivo", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS embedding");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_brain_gaps_embedding");
  });

  test("a função é do serviço, não do navegador", () => {
    /* `security definer` sobre uma tabela com RLS: exposta ao `anon`, ela
       deixaria qualquer visitante ler a fila de dúvidas de qualquer médico. */
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.match_brain_gaps[^;]*anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.match_brain_gaps[^;]*service_role/);
  });

  test("a migration e o arquivo de aplicar contam a mesma história", () => {
    const mig = readFileSync(
      "supabase/migrations/20260805130000_lacunas_parecidas.sql",
      "utf8",
    ).replace(/^\s*--.*$/gm, "");
    for (const pedaco of ["match_brain_gaps", "vector(768)", "status = 'aberta'"]) {
      expect(mig).toContain(pedaco);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A cura das lacunas que nasceram cegas
// ─────────────────────────────────────────────────────────────────────────────

describe("as lacunas antigas ganham vetor sozinhas", () => {
  /* Toda lacuna anterior à migration é cega, e cega não agrupa NEM é agrupada.
     Sem a cura, a fila que o médico tem hoje nunca passa a agrupar: uma
     paciente nova perguntando a mesma coisa que uma lacuna antiga abre uma
     linha nova, e o recurso só valeria quando a fila inteira girasse. */
  test("cada lacuna cega recebe o vetor da própria pergunta", async () => {
    const reg = await rodarCura({
      cegas: [
        { id: "g1", question: "é normal sentir enjoo?" },
        { id: "g2", question: "posso tomar dipirona?" },
      ],
    });
    expect(reg.embeds).toEqual(["é normal sentir enjoo?", "posso tomar dipirona?"]);
    expect(reg.updates.map((u) => u.id)).toEqual(["g1", "g2"]);
    expect(reg.updates[0].embedding).toEqual(VETOR);
  });

  test("procura só as ABERTAS do médico, e só as sem vetor", async () => {
    /* Curar as respondidas seria gastar embedding em algo que já virou entrada
       do cérebro; curar as de outro médico seria gastar o dinheiro dele. */
    const reg = await rodarCura({ cegas: [{ id: "g1", question: "enjoo?" }] });
    expect(reg.filtros).toEqual([
      ["doctor_id", "doutor-1"],
      ["status", "aberta"],
      ["embedding", null],
    ]);
  });

  test("tem teto por abertura", async () => {
    /* Sem teto, um médico com trezentas lacunas antigas dispara trezentos
       embeddings de uma vez só por ter aberto o painel. */
    const reg = await rodarCura({ cegas: [{ id: "g1", question: "enjoo?" }] });
    expect(reg.limite).toBeGreaterThan(0);
    expect(reg.limite).toBeLessThanOrEqual(25);
  });

  test("sem chave de IA, para na primeira e não insiste", async () => {
    /* Vazio quer dizer sem chave ou sem quota — as outras dezenove vão falhar
       igual. Insistir seria vinte chamadas perdidas por abertura de painel. */
    const reg = await rodarCura({
      cegas: [
        { id: "g1", question: "a" },
        { id: "g2", question: "b" },
        { id: "g3", question: "c" },
      ],
      embedTextDevolve: () => null,
    });
    expect(reg.embeds).toHaveLength(1);
    expect(reg.updates).toHaveLength(0);
  });

  test("com a coluna ainda inexistente, não faz nada", async () => {
    const reg = await rodarCura({ erro: { code: "42703" }, cegas: [{ id: "g1", question: "x" }] });
    expect(reg.embeds).toHaveLength(0);
    expect(reg.updates).toHaveLength(0);
  });

  test("nada cego, nada gasto", async () => {
    const reg = await rodarCura({ cegas: [] });
    expect(reg.embeds).toHaveLength(0);
  });
});

describe("a cura é disparada por quem abre a fila", () => {
  const fonte = readFileSync("src/lib/secondbrain.functions.ts", "utf8");
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

  test("`listBrainGaps` chama a cura", () => {
    expect(codigo).toContain("curarLacunasSemVetor(doctorId)");
  });

  test("sem `await` — a lista do médico não espera por embedding nenhum", () => {
    /* Com `await`, abrir o painel passaria a custar até vinte chamadas de
       modelo ANTES de a fila aparecer na tela. */
    expect(codigo).not.toMatch(/await\s+curarLacunasSemVetor/);
  });
});
