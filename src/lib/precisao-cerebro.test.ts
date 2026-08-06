/**
 * "POSSO COMER SUSHI?" TEM QUE ENCONTRAR "POSSO COMER COMIDA JAPONESA?".
 *
 * O caso concreto do produto: o médico já respondeu sobre sushi. A paciente
 * pergunta com outras palavras. A IA precisa reconhecer que é a mesma dúvida —
 * e, quando NÃO for, precisa não fingir que é.
 *
 * A auditoria achou três causas, e a terceira é a perigosa:
 *
 *   1. a entrada indexa `pergunta + resposta` CRU; a consulta indexa só a
 *      pergunta LIMPA. A limpeza de saudação valia só de um lado.
 *   2. nenhum `taskType` era enviado — o Gemini tem `RETRIEVAL_QUERY` e
 *      `RETRIEVAL_DOCUMENT` exatamente para esse desequilíbrio de tamanho, e
 *      estava sendo jogado fora de graça.
 *   3. o corte de 0,55 estava perto do PISO DE RUÍDO. A escala real deste
 *      espaço foi medida na própria fila: paráfrase da mesma pergunta vive
 *      entre 0,82 e 0,86. Com o topo em ~0,85, "0,55" quer dizer apenas "é
 *      português, é clínico e tem formato de pergunta".
 *
 * A consequência de (3) é o erro mais caro de um app clínico: a IA dizendo
 * "a sua médica orienta que…" sobre uma entrada que não responde à pergunta.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

const cerebro = codigoDe("src/lib/secondbrain.server.ts");
const emb = codigoDe("src/lib/embeddings.server.ts");
const chat = codigoDe("src/routes/api/chat.ts");

const corte = (nome: string, fonte = cerebro) =>
  Number(fonte.match(new RegExp(`${nome} = ([\\d.]+)`))?.[1]);

describe("o desequilíbrio entre pergunta e documento é corrigido", () => {
  test("os três papéis do vetor existem e são distintos", () => {
    expect(emb).toContain('consulta: "RETRIEVAL_QUERY"');
    expect(emb).toContain('documento: "RETRIEVAL_DOCUMENT"');
    expect(emb).toContain('semelhanca: "SEMANTIC_SIMILARITY"');
  });

  test("o taskType é realmente enviado ao modelo", () => {
    /* Declarar o mapa e não mandar o campo seria pior que não ter: pareceria
       resolvido. */
    expect(emb).toContain("taskType: TASK_TYPE[uso]");
  });

  test("comparação simétrica NÃO usa consulta/documento", () => {
    /* Entre duas perguntas de paciente não há lado curto e lado longo.
       Aplicar a correção de desequilíbrio ali piora em vez de melhorar. */
    expect(cerebro).toContain('4000, "semelhanca")');
    expect(cerebro).toContain('"semelhanca",');
  });
});

describe("os dois cortes, e por que não é um só", () => {
  test("usar o conhecimento do médico exige mais que ruído", () => {
    /* 0,55 ficava a ~0,15 do chão de similaridade entre frases não
       relacionadas em português. */
    expect(corte("SEMANTIC_MIN_SIMILARITY")).toBeGreaterThan(0.55);
  });

  test("ATRIBUIR ao médico exige mais que usar", () => {
    /* Usar o material dele numa resposta parecida: no pior caso, contexto a
       mais. Pôr o nome dele em algo que ele não disse para AQUELA pergunta:
       quebra a confiança e pode virar conduta errada. Custos diferentes,
       cortes diferentes. */
    expect(corte("ATRIBUICAO_MIN_SIMILARITY")).toBeGreaterThan(corte("SEMANTIC_MIN_SIMILARITY"));
  });

  test("nenhum dos dois chega ao corte de junção de lacunas", () => {
    /* Juntar duas lacunas é a decisão mais irreversível das três: o médico
       responde uma achando que respondeu a outra. */
    expect(corte("GAP_MERGE_MIN_SIMILARITY")).toBeGreaterThan(corte("ATRIBUICAO_MIN_SIMILARITY"));
  });

  test("a faixa do meio existe de verdade", () => {
    /* Se os dois cortes fossem iguais, a faixa intermediária sumiria e a
       divisão seria decorativa. */
    const folga = corte("ATRIBUICAO_MIN_SIMILARITY") - corte("SEMANTIC_MIN_SIMILARITY");
    expect(folga).toBeGreaterThanOrEqual(0.08);
  });
});

describe("o que a IA pode dizer em cada faixa", () => {
  test("acima do corte de atribuição, cita o médico", () => {
    expect(chat).toContain("brain.podeAtribuir");
    expect(chat).toContain("a orientação é do próprio médico");
  });

  test("na faixa do meio, usa o material SEM assinar o nome dele", () => {
    expect(chat).toContain("NÃO diga que a orientação é dele nem cite o nome dele como fonte");
  });

  test("na faixa do meio, a dúvida ainda vai para ele confirmar", () => {
    /* É o que transforma uma incerteza da máquina em revisão de quem sabe. */
    expect(chat).toContain("registrou a dúvida para ${medico} confirmar");
  });

  test("`podeAtribuir` exige número medido, não fallback por palavras", () => {
    /* O ranking por palavras não produz similaridade nenhuma. Sem número não
       há como afirmar que a orientação é dele. */
    expect(cerebro).toContain("melhorSimilaridade !== null &&");
    expect(cerebro).toContain("melhorSimilaridade >= ATRIBUICAO_MIN_SIMILARITY");
  });
});

describe("a decisão continua auditável", () => {
  test("a similaridade de cada resposta é gravada", () => {
    /* Os dois cortes são estimativa informada, não medição. É a distribuição
       real que vai corrigi-los — e ela só existe se for guardada. */
    expect(chat).toContain("similaridade = brain.melhorSimilaridade;");
    expect(chat).toContain("similaridade,");
  });
});

/**
 * O VETOR TEM QUE CHEGAR NA TABELA — senão o resto deste arquivo não vale nada.
 *
 * `match_brain_entries` exige `embedding IS NOT NULL`. Com a coluna nula, a
 * busca semântica não devolve NADA: os cortes de 0,62 e 0,74 estão certos e
 * nunca são exercitados, e o chat cai calado no ranking por palavras. "Posso
 * comer comida japonesa?" volta a não encontrar a orientação sobre sushi.
 *
 * E nascem sem vetor: o kit de partida, tudo o que foi salvo antes da
 * migration, e tudo o que foi salvo com a chave de IA fora do ar.
 */
describe("as entradas do cérebro ganham vetor de verdade", () => {
  /* SEM COMENTÁRIOS: a docstring do `embedBrainEntry` cita o padrão antigo
     (`void (async () => {`) para explicar por que ele foi removido — e um
     `not.toContain` cru casaria com a própria explicação. É o terceiro teste
     desta sessão a cair nessa; medir o texto que descreve o código em vez do
     código é o erro que mais me custou aqui. */
  const emb = codigoDe("src/lib/embeddings.server.ts");
  const fns = readFileSync("src/lib/secondbrain.functions.ts", "utf8");
  const painel = readFileSync("src/routes/_authenticated/painel.tsx", "utf8");

  test("o backfill é aguardável, não dispare-e-esqueça", () => {
    /* Era `void (async () => {…})()` — o mesmo padrão que `curarLacunasSemVetor`
       diagnosticou, e cujo comentário aponta ESTE arquivo como origem.
       Consertaram o lado que copiou e deixaram o original. Em serverless a
       invocação congela com a resposta: o laço morria antes do primeiro
       embedding, sem erro nenhum. */
    expect(emb).toContain("export async function backfillBrainEmbeddings(");
    expect(emb).not.toContain("void (async () => {");
  });

  test("uma falha não leva as outras entradas junto", () => {
    /* Era `if (!vec) return` dentro do laço: um estouro de tempo na terceira
       jogava fora as dezessete seguintes. */
    expect(emb).toContain("const vetores = await emLotes(linhas, BACKFILL_POR_LOTE");
    expect(emb).toContain(".filter((e): e is { id: string; vetor: number[] } => !!e.vetor)");
  });

  test("o backfill confere o que gravou, em vez de só disparar", () => {
    /* Com a coluna ausente ou a RLS no caminho, "embedei 20" tendo gravado
       zero — um número que mente sobre o próprio trabalho. */
    expect(emb).toContain("const falhas = gravacoes.filter((r: any) => r?.error);");
    expect(emb).toContain("return prontas.length - falhas.length;");
  });

  test("existe requisição própria para ele", () => {
    expect(fns).toContain("export const embedarEntradasDoMedico");
    expect(fns).toContain("await backfillBrainEmbeddings(target.doctorId)");
  });

  test("E O PAINEL A CHAMA — a ponta que faz tudo isso valer", () => {
    /* Sem esta linha, o conserto fica pior que o defeito: antes o backfill ao
       menos TENTAVA e morria; tirar o disparo de dentro do `listBrainEntries`
       sem ligar a função nova faria ele não rodar nunca mais. */
    expect(painel).toContain("void embedarEntradasDoMedico({");
    expect(painel).toContain("embedarEntradasDoMedico,");
  });

  test("o `listBrainEntries` não dispara mais nada por dentro", () => {
    const trecho = fns.slice(
      fns.indexOf("export const listBrainEntries"),
      fns.indexOf("export const embedarEntradasDoMedico"),
    );
    expect(trecho).not.toContain("backfillBrainEmbeddings(doctorId);");
  });
});
