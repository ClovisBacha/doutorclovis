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
        order() {
          return this;
        },
        limit: async () => ({ data: opts.existente ? [opts.existente] : [] }),
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
function bancoDeCura(opts: { cegas?: any[]; erro?: any }) {
  const reg = {
    filtros: [] as [string, any][],
    limite: null as number | null,
    embeds: [] as string[],
    updates: [] as { id: string; embedding: any }[],
    curadas: 0,
    maxSimultaneos: 0,
  };
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
            return {};
          },
        }),
      };
      return q;
    },
  };
  return { sb, reg };
}

async function rodarCura(opts: {
  cegas?: any[];
  erro?: any;
  embedTextDevolve?: (i: number) => any;
  semChave?: boolean;
}) {
  const { sb, reg } = bancoDeCura(opts);
  mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: sb }));
  let ativos = 0;
  mock.module("./embeddings.server", () => ({
    embedText: async (texto: string) => {
      const i = reg.embeds.length;
      reg.embeds.push(texto);
      /* Contar quantos estao no ar AO MESMO TEMPO e a unica forma honesta de
         provar paralelismo: ler `Promise.all` no fonte passa igual se o
         `Promise.all` que existe for o das gravacoes. */
      ativos++;
      reg.maxSimultaneos = Math.max(reg.maxSimultaneos, ativos);
      await new Promise((r) => setTimeout(r, 5));
      ativos--;
      return opts.embedTextDevolve ? opts.embedTextDevolve(i) : VETOR;
    },
  }));
  const anterior = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = opts.semChave ? "" : "chave-de-teste";
  const { curarLacunasSemVetor } = await import("./secondbrain.server");
  /* Aguardar aqui e' o teste: se a funcao voltasse a ser dispare-e-esqueca,
     nada teria acontecido quando esta linha terminasse. */
  reg.curadas = await curarLacunasSemVetor("doutor-1");
  if (anterior === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  else process.env.GOOGLE_GENERATIVE_AI_API_KEY = anterior;
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
      parecidas: [{ id: "outra-coisa", hits: 2, similarity: 0.79 }],
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
    /* Condicionado ao tamanho: acima de 300 caracteres os dois lados tratam o
       texto de formas diferentes, e reaproveitar gravaria um vetor que a
       consulta seguinte não procuraria. */
    expect(fonte).toContain("cabeNoCorteDaLacuna ? vetorDaPergunta : null,");
  });

  test("é o MESMO vetor da busca — não um embedding novo", () => {
    /* Um segundo `embedText` aqui funcionaria e ninguém notaria: mesma
       resposta, mesmo agrupamento. Só a conta no fim do mês — uma chamada a
       mais por pergunta sem cobertura, que é justamente a mais comum enquanto
       o cérebro do médico está pequeno. */
    expect(fonte.match(/embedText\(textoParaVetor\(userMessage/g) ?? []).toHaveLength(1);
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
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.match_brain_gaps[^;]*anon/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.match_brain_gaps[^;]*authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.match_brain_gaps[^;]*service_role/);
  });

  /**
   * OS DOIS DEFEITOS QUE CUSTARAM QUATRO RODADAS DE TESTE.
   *
   * A função existia, era chamada, e devolvia vazio — sem erro visível. As
   * causas eram duas divergências que EU introduzi em relação à
   * `match_brain_entries`, que funciona há meses:
   *
   *   · `SET search_path = public` — no Supabase a extensão `vector` vive em
   *     `extensions`. Fixar o caminho em `public` deixa o operador `<=>`
   *     invisível dentro do corpo da função.
   *   · índice `ivfflat` criado com a tabela VAZIA — os centroides são
   *     calculados na criação, e com `probes = 1` a busca passa ao largo das
   *     linhas que existem.
   *
   * A lição não é o detalhe do pgvector. É que havia uma função equivalente,
   * provada em produção, e eu escrevi outra forma.
   */
  test("nunca fixa o search_path só em `public`", () => {
    /* Este era o defeito: `SET search_path = public` sem `extensions`. No
       Supabase a extensão `vector` vive em `extensions`, então o operador
       `<=>` fica invisível dentro do corpo da função. Reproduzido com pgvector
       de verdade: `operator does not exist: extensions.vector <=> extensions.vector`.
       Fixar o caminho é BOM — desde que `extensions` esteja nele. */
    expect(sql).not.toMatch(/SET search_path = public\s*[;\n]/);
    expect(sql).not.toMatch(/SET search_path = public\s+AS/);
  });

  test("NÃO usa SECURITY DEFINER — a chave de serviço já passa pela RLS", () => {
    expect(sql).not.toContain("SECURITY DEFINER");
  });

  test("o índice é hnsw, nunca ivfflat", () => {
    /* `hnsw` se constrói a cada linha inserida; `ivfflat` depende de haver
       dados no momento da criação, e aqui não havia nenhum. */
    expect(sql).toContain("USING hnsw (embedding vector_cosine_ops)");
    expect(sql).not.toMatch(/USING ivfflat/);
  });

  test("derruba o índice velho antes de criar o novo", () => {
    /* `CREATE INDEX IF NOT EXISTS` sozinho não troca nada: o ivfflat quebrado
       continuaria lá, e rodar o arquivo de novo não consertaria nada. */
    const posDrop = sql.indexOf("DROP INDEX IF EXISTS public.idx_brain_gaps_embedding");
    const posCreate = sql.indexOf("CREATE INDEX IF NOT EXISTS idx_brain_gaps_embedding");
    expect(posDrop).toBeGreaterThan(0);
    expect(posDrop).toBeLessThan(posCreate);
  });

  test("derruba a função velha antes de recriar", () => {
    /* `CREATE OR REPLACE` não remove `SECURITY DEFINER` nem `SET search_path`
       de uma função que já os tem — o defeito sobreviveria a rodar o arquivo
       outra vez, que é exatamente o que se pede ao usuário. */
    const posDrop = sql.indexOf("DROP FUNCTION IF EXISTS public.match_brain_gaps");
    const posCreate = sql.indexOf("CREATE OR REPLACE FUNCTION public.match_brain_gaps");
    expect(posDrop).toBeGreaterThan(0);
    expect(posDrop).toBeLessThan(posCreate);
  });

  test("a chave única que impede a bola de neve", () => {
    /* Sem ela, uma duplicata faz o código inserir a terceira, a quarta… */
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_brain_gaps_doctor_question");
  });

  test("zera os vetores antigos, gerados com texto sujo", () => {
    expect(sql).toContain("UPDATE public.brain_gaps SET embedding = NULL");
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

  test("uma pergunta que falha não leva as outras junto", async () => {
    /* Em paralelo, um vetor vazio no meio não pode abortar o lote — o que
       falhou fica cego e tenta na próxima abertura. */
    const reg = await rodarCura({
      cegas: [
        { id: "g1", question: "a" },
        { id: "g2", question: "b" },
        { id: "g3", question: "c" },
      ],
      embedTextDevolve: (i) => (i === 1 ? null : VETOR),
    });
    expect(reg.updates.map((u) => u.id)).toEqual(["g1", "g3"]);
    expect(reg.curadas).toBe(2);
  });

  test("sem chave de IA, não chega nem a consultar o banco", async () => {
    /* Nenhuma das vinte teria vetor — a consulta seria uma ida ao banco por
       abertura de painel, sem nada em troca. */
    const reg = await rodarCura({ semChave: true, cegas: [{ id: "g1", question: "x" }] });
    expect(reg.filtros).toHaveLength(0);
    expect(reg.embeds).toHaveLength(0);
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

  /**
   * ESTE É O TESTE QUE FALTAVA — e a versão anterior dele cobrava o CONTRÁRIO.
   *
   * A cura foi escrita como `void (async () => {…})()`, disparar e esquecer,
   * para o painel não esperar. Não curou nada: em serverless a invocação
   * congela assim que a resposta sai, e `listBrainGaps` devolve a lista na
   * hora — o trabalho solto morria antes do primeiro embedding.
   *
   * O defeito não deixou rastro nenhum. A fila aparecia certa, sem erro, e a
   * consulta no banco seguia mostrando as mesmas lacunas cegas. Só apareceu
   * porque alguém rodou o `count(*)` duas vezes e viu o mesmo número.
   */
  test("com `await` — sem ele o trabalho morre com a resposta", () => {
    expect(codigo).toMatch(/await\s+curarLacunasSemVetor/);
  });

  test("a função é async de verdade, não `void` disfarçado", () => {
    /* `await` sobre uma função que devolve `void` aguarda `undefined` e
       resolve no microtask seguinte — parece certo e não é. */
    const fonteServer = readFileSync("src/lib/secondbrain.server.ts", "utf8");
    expect(fonteServer).toMatch(
      /export async function curarLacunasSemVetor\([^)]*\): Promise<number>/,
    );
  });

  test("os embeddings saem juntos, para o `await` ser curto", async () => {
    /* Sequencial, vinte perguntas seriam vinte idas ao Gemini EM FILA — e o
       médico esperaria por todas antes de ver a própria fila. Agora que a cura
       é aguardada, isso deixou de ser detalhe de custo e virou tempo de tela.

       Medido pela simultaneidade real, e não lendo `Promise.all` no fonte:
       a primeira versão deste teste lia o fonte, casava com o `Promise.all`
       das GRAVAÇÕES, e continuava passando com os embeddings em fila. */
    const reg = await rodarCura({
      cegas: [
        { id: "g1", question: "a" },
        { id: "g2", question: "b" },
        { id: "g3", question: "c" },
      ],
    });
    expect(reg.maxSimultaneos).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A saudação não pode separar duas perguntas iguais
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CASO REAL, medido na fila de verdade.
 *
 * Estas duas são a MESMA pergunta:
 *
 *   "A doutora já respondeu minha dúvida"
 *   "Olá tudo bem a doutora já chegou a aprovar e responder as dúvidas"
 *
 * A primeira juntou com uma paráfrase curta; a segunda abriu linha nova. A
 * diferença não é o assunto — é que metade da segunda é protocolo social, e
 * saudação entra no vetor com o mesmo peso do conteúdo.
 *
 * O que o médico VÊ continua sendo o texto cru da paciente. Só a comparação
 * usa a versão enxuta.
 */
describe("o texto que vira vetor é enxuto; o que ele lê, não", () => {
  test("tira a saudação da frente", async () => {
    const { textoParaVetor } = await import("./secondbrain.server");
    expect(textoParaVetor("Olá tudo bem a doutora já chegou a responder as dúvidas")).toBe(
      "a doutora já chegou a responder as dúvidas",
    );
    expect(textoParaVetor("Oi, bom dia! posso tomar dipirona na gravidez?")).toBe(
      "posso tomar dipirona na gravidez?",
    );
  });

  test("aproxima as duas formas da mesma pergunta", async () => {
    /* O teste do vetor em si depende do modelo; o que se pode prender aqui é
       que, depois da limpeza, as duas frases passam a compartilhar quase todo
       o vocabulário — que é a causa da distância. */
    const { textoParaVetor } = await import("./secondbrain.server");
    const a = textoParaVetor("A doutora já respondeu minha dúvida");
    const b = textoParaVetor("Olá tudo bem a doutora já chegou a aprovar e responder as dúvidas");
    expect(b.toLowerCase().startsWith("a doutora")).toBe(true);
    expect(a.toLowerCase().startsWith("a doutora")).toBe(true);
  });

  test("não come conteúdo quando a mensagem é curta", async () => {
    /* "Oi, dor?" limpo vira "dor?" — sobra de frase, e comparar sobra produz
       semelhança sem sentido. Abaixo do piso, devolve o original. */
    const { textoParaVetor } = await import("./secondbrain.server");
    expect(textoParaVetor("oi, e a dor?")).toBe("oi, e a dor?");
    expect(textoParaVetor("bom dia")).toBe("bom dia");
  });

  test("mensagem sem saudação passa intacta", async () => {
    const { textoParaVetor } = await import("./secondbrain.server");
    const t = "posso tomar dipirona na gravidez?";
    expect(textoParaVetor(t)).toBe(t);
  });

  test("a limpeza vale nos TRÊS caminhos que geram vetor", () => {
    /* Vetores de tratamentos diferentes não se comparam. Limpar só uma ponta
       seria pior que não limpar nenhuma: a lacuna gravada e a consulta
       passariam a viver em espaços distintos. */
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    expect(fonte).toContain("embedText(textoParaVetor(clean)");
    expect(fonte).toContain("embedText(textoParaVetor(userMessage)");
    expect(fonte).toContain("embedText(textoParaVetor(String(g.question");
  });

  test("o texto GRAVADO na lacuna continua sendo o da paciente", () => {
    /* O médico precisa ler o que ela escreveu, com saudação e tudo — é o que
       dá o tom e mostra quem está do outro lado. */
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    expect(fonte).toContain("question: clean,");
    expect(fonte).not.toContain("question: textoParaVetor(");
  });
});

describe("o corte de junção foi corrigido por medida, não por palpite", () => {
  test("desceu de 0,86 para 0,82", async () => {
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    const juncao = Number(fonte.match(/GAP_MERGE_MIN_SIMILARITY = ([\d.]+)/)?.[1]);
    expect(juncao).toBe(0.82);
  });

  test("continua MUITO acima do corte de leitura", () => {
    /* Afrouxar é aceitável; chegar perto do 0,55 da leitura não é. Juntar duas
       perguntas diferentes faz o médico responder uma achando que respondeu as
       duas — e a paciente da segunda recebe orientação que não era dela. */
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    const juncao = Number(fonte.match(/GAP_MERGE_MIN_SIMILARITY = ([\d.]+)/)?.[1]);
    const leitura = Number(fonte.match(/SEMANTIC_MIN_SIMILARITY = ([\d.]+)/)?.[1]);
    expect(juncao).toBeGreaterThan(leitura + 0.2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Três desfechos que pareciam um só
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O `error` da RPC era ignorado. Isso tornou INDISTINGUÍVEIS três situações
 * que exigem consertos completamente diferentes:
 *
 *   · a função não existe no banco → aplicar o SQL;
 *   · existe e não achou candidata → problema de vetor, não de corte;
 *   · achou abaixo do corte        → aí sim, é o corte.
 *
 * Todas terminavam igual: uma linha nova na fila. Ajustar o corte sem separar
 * os três é chute — e foi exatamente o que aconteceu, por três rodadas.
 */
describe("o agrupamento diz por que não juntou", () => {
  const fonte = codigoDe("src/lib/secondbrain.server.ts");

  test("o erro da RPC deixou de ser descartado", () => {
    expect(fonte).toContain("error: erroRpc } = await sb.rpc(");
  });

  test("função ausente aponta o arquivo que resolve", () => {
    /* Quem lê o log tem que saber o que FAZER, não só que algo falhou. */
    expect(fonte).toContain("APLICAR_LACUNAS_PARECIDAS.sql");
  });

  test("os três desfechos têm mensagens distintas", () => {
    expect(fonte).toContain("agrupamento INDISPONÍVEL");
    expect(fonte).toContain("nenhuma lacuna aberta com vetor para comparar");
    expect(fonte).toContain("mais parecida:");
  });

  test("a similaridade sai com o corte ao lado", () => {
    /* Número sozinho não decide nada: é a distância ATÉ o corte que diz se a
       régua está errada ou se as perguntas eram mesmo diferentes. */
    expect(fonte).toContain("perto.similarity.toFixed(4)");
    expect(fonte).toContain("(corte ${GAP_MERGE_MIN_SIMILARITY})");
  });

  test("nada disso quebra o registro da lacuna", () => {
    /* Diagnóstico é observação, nunca decisão: a pergunta da paciente entra na
       fila mesmo com o agrupamento fora do ar. */
    expect(fonte).not.toMatch(/if \(erroRpc\) (return|throw)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A bola de neve do `maybeSingle()`
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `.maybeSingle()` tolera zero linhas — e devolve ERRO quando acha mais de
 * uma. O erro caía no chão do destructuring, então `data` vinha nulo e o
 * código concluía "não existe": inseria MAIS uma duplicata.
 *
 * Bastava uma duplicata nascer — corrida entre duas pacientes, ou índice único
 * ausente no banco — para aquela pergunta nunca mais juntar. Nem repetida com
 * o texto byte a byte idêntico. Cada repetição empilhava outra linha.
 *
 * É um defeito que se ALIMENTA: quanto mais acontece, mais provável fica.
 */
describe("duplicata existente não vira duplicata nova", () => {
  test("a busca por texto pega a primeira, em vez de exigir exatamente uma", () => {
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    const trecho = fonte.slice(fonte.indexOf("export function logBrainGap"));
    const buscaPorTexto = trecho.slice(0, trecho.indexOf("match_brain_gaps"));
    expect(buscaPorTexto).toContain('.eq("norm_question", norm)');
    expect(buscaPorTexto).toContain(".limit(1)");
    expect(buscaPorTexto).not.toContain(".maybeSingle()");
  });

  test("pega a MAIS ANTIGA — a que já tem os hits e quem perguntou", () => {
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    expect(fonte).toContain('.order("created_at", { ascending: true })');
  });

  test("achando pelo texto, junta em vez de inserir", async () => {
    const reg = await rodarLacuna({
      existente: { id: "ja-existe", hits: 4, status: "aberta" },
      embedding: VETOR,
    });
    expect(reg.inserts).toHaveLength(0);
    expect(reg.updates[0].hits).toBe(5);
  });
});

describe("e-mail de lacuna só quando a lacuna existe", () => {
  test("insert que falhou não avisa o médico", () => {
    /* Sem a guarda, uma corrida perdida mandava "sua IA recebeu uma pergunta
       que não soube responder" — e ele abria o painel para procurar uma lacuna
       que não estava lá. */
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    expect(fonte).toContain("if (nova?.id) notifyDoctorOfGap(doctorId, sb);");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dois vetores da mesma pergunta, em espaços diferentes
// ─────────────────────────────────────────────────────────────────────────────

describe("o vetor reaproveitado só vale quando o tratamento é o mesmo", () => {
  /* A lacuna embeda `question.trim().slice(0, 300)`; a consulta embeda a
     mensagem INTEIRA. Para mensagem curta as duas strings coincidem e
     reaproveitar é de graça. Passando de 300 caracteres são strings
     diferentes — e o vetor GRAVADO na lacuna deixa de ser o que a próxima
     consulta vai procurar. Dois vetores da mesma pergunta em espaços
     distintos: exatamente o defeito que este arquivo existe para consertar. */
  test("mensagem longa não reaproveita o vetor da consulta", () => {
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    expect(fonte).toContain("const cabeNoCorteDaLacuna = userMessage.trim().length <= 300;");
    expect(fonte).toContain("cabeNoCorteDaLacuna ? vetorDaPergunta : null,");
  });

  test("o limite bate com o corte que a lacuna usa", () => {
    /* Se um lado mudar sem o outro, a assimetria volta calada. */
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    expect(fonte).toContain("question.trim().slice(0, 300)");
    expect(fonte).toContain("userMessage.trim().length <= 300");
  });
});

describe("o reset dos vetores sujos alcança TODAS as lacunas", () => {
  const sql = readFileSync("supabase/APLICAR_LACUNAS_PARECIDAS.sql", "utf8").replace(
    /^\s*--.*$/gm,
    "",
  );

  test("zera sem filtrar por status", () => {
    /* Lacuna `respondida` é REABERTA quando o texto exato repete, e voltaria
       para a busca com o vetor sujo — que a cura nunca mais alcança, porque
       ela só enxerga vetor nulo. Vetor nulo é inerte; sujo é ativo e errado. */
    expect(sql).toContain("UPDATE public.brain_gaps SET embedding = NULL;");
    expect(sql).not.toMatch(/SET embedding = NULL WHERE status/);
  });

  test("as duplicatas são fundidas ANTES do índice único", () => {
    /* No editor do Supabase o arquivo roda numa transação só: se o CREATE
       UNIQUE INDEX estourar por duplicata, ele desfaz TUDO — inclusive o
       reset acima. O arquivo passaria a não conseguir consertar nada. */
    const posMerge = sql.indexOf("DELETE FROM public.brain_gaps g");
    const posIndice = sql.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS uq_brain_gaps");
    expect(posMerge).toBeGreaterThan(0);
    expect(posMerge).toBeLessThan(posIndice);
  });

  test("fundir duplicata não perde quem perguntou nem os hits", () => {
    expect(sql).toContain("UPDATE public.brain_gap_askers a");
    expect(sql).toContain("sum(hits)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Endurecimentos vindos da auditoria com pgvector real
// ─────────────────────────────────────────────────────────────────────────────

describe("o SQL não depende de como a sessão foi aberta", () => {
  const sql = readFileSync("supabase/APLICAR_LACUNAS_PARECIDAS.sql", "utf8");

  test("fixa o search_path da SESSÃO antes de tudo", () => {
    /* `CREATE EXTENSION IF NOT EXISTS vector` é NO-OP quando a extensão já
       vive em `extensions` — ele não a move para `public`. Sem `extensions` no
       caminho, o `ADD COLUMN ... vector(768)` falha com "type vector does not
       exist" e, como o editor roda tudo numa transação, o arquivo INTEIRO
       reverte. */
    const posPath = sql.indexOf("SET search_path = public, extensions;");
    const posColuna = sql.indexOf("ADD COLUMN IF NOT EXISTS embedding");
    expect(posPath).toBeGreaterThan(0);
    expect(posPath).toBeLessThan(posColuna);
  });

  test("a função declara o caminho, em vez de herdar", () => {
    /* Sem declarar, ela depende do `db-extra-search-path` do PostgREST. O
       Supabase acrescenta `extensions` — mas o padrão do PostgREST é só
       `public`, e aí o `<=>` sumiria de novo, calado. */
    expect(sql).toMatch(/STABLE\n(--[^\n]*\n)*SET search_path = public, extensions\nAS \$\$/);
  });

  test("a migration carrega o reset dos vetores sujos", () => {
    /* Um banco reconstruído só das migrations herdaria vetores gerados antes
       da limpeza de saudação — e a cura nunca os alcança, porque ela só
       enxerga vetor nulo. */
    const mig = readFileSync("supabase/migrations/20260805130000_lacunas_parecidas.sql", "utf8");
    expect(mig).toContain("UPDATE public.brain_gaps SET embedding = NULL;");
  });
});

describe("a cura não mente sobre o que gravou", () => {
  test("confere o erro de cada update", () => {
    /* Antes devolvia `curadas.length` sem olhar nada: com a coluna ausente ou
       a RLS no caminho, relatava "curei 20" tendo gravado zero. */
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    expect(fonte).toContain("const falhas = gravacoes.filter((r: any) => r?.error);");
    expect(fonte).toContain("return curadas.length - falhas.length;");
  });

  test("falha de gravação aparece no log", () => {
    const fonte = codigoDe("src/lib/secondbrain.server.ts");
    expect(fonte).toContain("updates falharam");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// O agrupamento que vale mais: na RESPOSTA, não na chegada
// ─────────────────────────────────────────────────────────────────────────────

/**
 * "Como reduzir o estresse", "Como reduzir o MEU estresse" e "Como consigo
 * controlar o estresse" são três linhas na fila e UMA pergunta.
 *
 * Juntá-las quando NASCEM é adivinhação — ninguém escreveu a resposta ainda, e
 * errar significa o médico responder uma achando que respondeu as outras.
 * Juntá-las quando ele RESPONDE não é: a resposta existe, ele acabou de
 * escrevê-la, e o número volta na tela para ele conferir o que foi fechado.
 *
 * E o ganho é maior. Não economiza uma linha na fila — economiza as OUTRAS
 * respostas que ele escreveria, e cada paciente das parecidas recebe a
 * orientação dele em vez de continuar esperando.
 */
describe("responder uma lacuna fecha as parecidas", () => {
  const fonte = codigoDe("src/lib/secondbrain.functions.ts");

  test("`resolveBrainGap` fecha as parecidas e devolve quantas", () => {
    expect(fonte).toContain("const parecidas = await fecharLacunasParecidas(sb, {");
    expect(fonte).toContain("return { ok: true as const, avisadas, parecidas };");
  });

  test("compara o vetor da PERGUNTA, não o da entrada", () => {
    /* As lacunas guardam vetor de pergunta; a entrada do cérebro é indexada
       por pergunta + resposta. Comparar conteúdos diferentes produz um número
       que parece similaridade e não é. */
    expect(fonte).toContain("embedText(textoParaVetor(args.pergunta.slice(0, 300))");
  });

  test("usa o MESMO corte do agrupamento na chegada", () => {
    /* Dois cortes para a mesma decisão divergem com o tempo, e ninguém percebe
       porque os dois "funcionam". */
    expect(fonte).toContain("c.similarity >= GAP_MERGE_MIN_SIMILARITY");
  });

  test("nunca fecha a própria lacuna que acabou de ser respondida", () => {
    expect(fonte).toContain("c.id !== args.gapIdRespondida");
  });

  test("só fecha o que ainda está ABERTO, e só do próprio médico", () => {
    /* Entre a busca e a escrita ele pode ter respondido ou ignorado outra numa
       segunda aba — e escopo por médico nunca é opcional aqui. */
    expect(fonte).toMatch(
      /\.eq\("doctor_id", args\.doctorId\)[\s\S]{0,80}\.eq\("status", "aberta"\)/,
    );
  });

  test("quem perguntou a parecida também recebe a resposta", () => {
    /* Sem isto, a paciente da lacuna fechada some: a linha sai da fila e ela
       continua esperando uma resposta que já existe. */
    const trecho = fonte.slice(fonte.indexOf("async function fecharLacunasParecidas"));
    expect(trecho).toContain("await entregarRespostaDaLacuna(sb, {");
    expect(trecho).toContain("perguntaDela: linha.question as string,");
  });

  test("falhar aqui não desfaz a resposta principal", () => {
    /* A lacuna respondida e o conhecimento novo já existem. Uma falha no
       fechamento das parecidas só significa fila mais cheia — nunca resposta
       perdida. */
    const trecho = fonte.slice(fonte.indexOf("async function fecharLacunasParecidas"));
    expect(trecho).toContain("return 0;");
    expect(trecho).not.toMatch(/throw /);
  });

  test("o médico VÊ quantas saíram junto", () => {
    /* Três linhas sumindo da fila sem explicação é pior que fila cheia: ele
       fica sem saber se respondeu ou se perdeu alguma. */
    const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");
    expect(painel).toContain("parecida");
    expect(painel).toMatch(/juntas > 0/);
  });
});
