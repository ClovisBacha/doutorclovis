/**
 * OS DOIS CORTES, EXERCITADOS — sem uma única chamada ao Gemini.
 *
 * `SEMANTIC_MIN_SIMILARITY` (0,62) decide se o conhecimento do médico ENTRA na
 * resposta. `ATRIBUICAO_MIN_SIMILARITY` (0,74) decide se a resposta pode levar
 * o NOME dele. São as duas réguas mais importantes do produto, e um avaliador
 * mediu que trocar as duas por 0,99 mantinha a suíte inteira verde: os testes
 * que existiam só afirmavam que um número era maior que o outro.
 *
 * O jeito de testar isto sem API é o que `lacunas-parecidas.test.ts` já provou:
 * um Supabase de mentira devolvendo similaridades escolhidas a dedo. O vetor em
 * si não importa — quem decide é o corte, e é o corte que está sob teste.
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
/* O `emLotes` REAL, capturado antes de qualquer `mock.module`.
   Uma reimplementação aqui vazaria para os outros arquivos de teste — o
   registro de módulos é compartilhado — e foi exatamente o que aconteceu: um
   stub que rodava tudo de uma vez fez o teste de LOTES do vizinho falhar. */
import { emLotes as emLotesReal } from "./embeddings.server";

const VETOR = Array.from({ length: 768 }, (_, i) => (i % 7) / 7);

/**
 * Roda `getBrainContext` com uma similaridade escolhida.
 *
 * `similaridade: null` = a busca vetorial não devolve nada, então o caminho cai
 * no ranking por palavras — que é o estado de todo médico novo, cujas entradas
 * ainda não têm vetor.
 */
async function rodar(opts: {
  similaridade: number | null;
  /** As entradas aprovadas do médico. */
  entradas?: { question: string; answer: string }[];
  pergunta?: string;
}) {
  const entradas = opts.entradas ?? [
    {
      question: "Posso comer sushi na gravidez?",
      answer: "Peixe cru não, pelo risco de listeria.",
    },
  ];
  const lacunas: { pergunta: string }[] = [];

  const sb: any = {
    from(tabela: string) {
      const q: any = {
        select: () => q,
        eq: () => q,
        is: () => q,
        order: () => q,
        gte: () => q,
        limit: async () => ({
          data: tabela === "brain_entries" ? entradas.map((e, i) => ({ id: `e${i}`, ...e })) : [],
          error: null,
        }),
        maybeSingle: async () => ({
          data: tabela === "brain_settings" ? { enabled_app: true, persona: "Dra. Teste" } : null,
          error: null,
        }),
        insert: (linha: any) => {
          if (tabela === "brain_gaps") lacunas.push({ pergunta: linha.question });
          return { select: () => ({ maybeSingle: async () => ({ data: { id: "g1" } }) }) };
        },
        update: () => q,
        upsert: async () => ({}),
      };
      /* `select` de `brain_entries` resolve direto (sem `.limit`) em alguns
         caminhos; devolver o thenable cobre os dois. */
      q.then = (r: any) =>
        r({
          data: tabela === "brain_entries" ? entradas.map((e, i) => ({ id: `e${i}`, ...e })) : [],
          error: null,
        });
      return q;
    },
    rpc: async (nome: string) => {
      if (nome === "match_brain_entries" && opts.similaridade !== null) {
        return {
          data: entradas.map((e) => ({ ...e, similarity: opts.similaridade })),
          error: null,
        };
      }
      return { data: [], error: null };
    },
  };

  mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: sb }));
  /* Espalha o real e sobrescreve o que interessa — ver o comentário do dublê
     de `entitlements.server` logo abaixo: um objeto literal APAGA os outros
     exports (`embedBrainEntry`, `priorizarAprovadas`, `backfillBrainEmbeddings`)
     no registro compartilhado entre arquivos de teste. */
  const embeddingsReal = await import("./embeddings.server");
  mock.module("./embeddings.server", () => ({
    ...embeddingsReal,
    embedText: async () => VETOR,
    emLotes: emLotesReal,
  }));
  /* ─── O DUBLÊ SUBSTITUI O MÓDULO INTEIRO, NÃO A FUNÇÃO ────────────────────
     O mesmo defeito que o comentário logo abaixo descreve para `cota-ia.server`
     — e que voltou a acontecer, com `entitlements.server`, quando o arquivo
     ganhou exports novos (`planoVigente`, `vencimentoDaConcessao`,
     `planoEfetivo`). Um dublê feito de um objeto literal APAGA todo o resto do
     módulo no registro compartilhado entre arquivos de teste: quem importasse
     qualquer outro export depois estourava com "Export named 'X' not found" no
     escopo de módulo, e os 23 testes daquele arquivo SUMIAM da contagem — não
     falhavam, desapareciam.
     Espalhar o módulo real e sobrescrever só o que interessa mata a classe
     inteira do problema: nenhum export futuro precisa ser lembrado aqui. */
  const entitlementsReal = await import("./entitlements.server");
  mock.module("./entitlements.server", () => ({
    ...entitlementsReal,
    getEntitlementsByDoctorId: async () => ({
      aiApp: true,
      aiWhatsapp: true,
      aiRepliesPerCycle: 500,
    }),
  }));
  /* `./cota-ia.server` NÃO é mockado — e isto é conserto de um defeito que só
     aparecia no CI.
     `mock.module` substitui o módulo no registro COMPARTILHADO entre arquivos
     de teste. Quando este rodava antes de `cota-ia.test.ts`, aquele importava o
     dublê: `situacaoDaCota` chegava `undefined`, o arquivo estourava no escopo
     de módulo e os **57 testes dele desapareciam** — não falhavam, sumiam da
     contagem. Localmente a ordem dos arquivos era outra e nunca acontecia.
     Não precisa de dublê: com o banco falso devolvendo `count` indefinido,
     `respostasNoCiclo` dá 0, a cota fica `ok`, e `avisarMedicoDaCota` retorna
     na primeira linha sem tocar em nada. O caminho real é inofensivo aqui. */

  const anterior = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "chave-de-teste";
  const { getBrainContext } = await import("./secondbrain.server");
  const ctx = await getBrainContext(
    opts.pergunta ?? "posso comer comida japonesa?",
    "doc-1",
    "app",
    "pac-1",
  );
  if (ctx.gravacaoDaLacuna) await ctx.gravacaoDaLacuna;
  if (anterior === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  else process.env.GOOGLE_GENERATIVE_AI_API_KEY = anterior;
  return { ctx, lacunas };
}

afterEach(() => {
  mock.restore();
});

describe("as três faixas de similaridade", () => {
  test("ABAIXO de 0,62 — o conhecimento dele não entra", async () => {
    /* Pergunta SEM palavra em comum com a entrada, de propósito: senão o
       fallback por palavras resgataria o caso e o teste passaria mesmo com o
       corte de cobertura destruído. Aqui só o vetor pode decidir — e 0,4 não
       chega. */
    const { ctx } = await rodar({
      similaridade: 0.4,
      pergunta: "quantas semanas eu tenho hoje?",
    });
    expect(ctx.hadCoverage).toBe(false);
    expect(ctx.podeAtribuir).toBe(false);
  });

  test("ENTRE 0,62 e 0,74 — usa o material, NÃO assina o nome dele", async () => {
    const { ctx } = await rodar({ similaridade: 0.68 });
    expect(ctx.hadCoverage).toBe(true);
    expect(ctx.podeAtribuir).toBe(false);
  });

  test("ACIMA de 0,74 — pode dizer 'sua médica orienta'", async () => {
    const { ctx } = await rodar({ similaridade: 0.9 });
    expect(ctx.hadCoverage).toBe(true);
    expect(ctx.podeAtribuir).toBe(true);
  });

  test("A FAIXA DO MEIO REGISTRA LACUNA — a promessa que era falsa", async () => {
    /* O `chat.ts` instrui a IA a dizer que "registrou a dúvida para a médica
       confirmar" sempre que não pode atribuir. A gravação só acontecia quando
       NADA era encontrado, então em toda a faixa 0,62–0,74 a IA prometia à
       gestante uma confirmação que o médico jamais veria pedida. */
    const { lacunas } = await rodar({ similaridade: 0.68 });
    expect(lacunas.length).toBe(1);
  });

  test("acima de 0,74 NÃO registra lacuna — ele já respondeu isso", async () => {
    const { lacunas } = await rodar({ similaridade: 0.9 });
    expect(lacunas.length).toBe(0);
  });
});

describe("o fallback por palavras não pode contornar o corte", () => {
  test("uma palavra em comum NÃO é cobertura", async () => {
    /* Medido antes do conserto: "posso tomar dipirona para dor de cabeça?"
       selecionava "Posso comer sushi na gravidez?" — as duas têm "posso" — e o
       sushi entrava no prompt sob o rótulo "Respostas reais do médico". Era o
       corte de 0,62 sendo contornado pela porta dos fundos, no caminho de quem
       ainda não tem vetor: todo médico novo. */
    const { ctx } = await rodar({
      similaridade: null,
      pergunta: "posso tomar dipirona para dor de cabeça?",
    });
    expect(ctx.hadCoverage).toBe(false);
  });

  test("mas o assunto de verdade continua casando", async () => {
    const { ctx } = await rodar({
      similaridade: null,
      pergunta: "posso comer sushi?",
      entradas: [
        { question: "Posso comer sushi na gravidez?", answer: "Peixe cru não, risco de listeria." },
      ],
    });
    expect(ctx.hadCoverage).toBe(true);
    /* E sem número medido, nunca assina o nome dele. */
    expect(ctx.podeAtribuir).toBe(false);
  });
});
