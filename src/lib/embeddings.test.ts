/**
 * A busca semântica estava MORTA, e ninguém via.
 *
 * O modelo padrão era `text-embedding-004`, aposentado pelo Google. Toda
 * chamada voltava erro, `embedText` devolvia null, e a filosofia "best-effort"
 * do arquivo — a mesma que protege o chat de cair — engolia a falha inteira:
 *
 *   · nenhum vetor era gravado, em lugar nenhum;
 *   · nenhum erro aparecia em log nenhum;
 *   · a busca caía no ranking por palavras SEMPRE.
 *
 * De fora, um cérebro que nunca entendeu sinônimos era indistinguível de um
 * cérebro que só não achou nada parecido.
 *
 * Descoberto porque as lacunas não agrupavam: `embedding IS NULL` em todas as
 * linhas, inclusive nas criadas minutos antes.
 *
 * A lição não é o nome do modelo. É que "silêncio por design" mais "modelo que
 * some" produzem um recurso morto que ninguém vê morrer — e a única defesa é
 * a falha DEIXAR RASTRO.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/lib/embeddings.server.ts", "utf8");
/* Sem comentários: o cabeçalho deste arquivo e o daquele CITAM o modelo morto
   para explicar o defeito. O que se cobra é o código. */
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

describe("o modelo de embedding existe de verdade", () => {
  test("o padrão não é nenhum modelo aposentado", () => {
    /* Lista dos que a API não atende mais. Um deles voltando como padrão
       ressuscita o mesmo defeito, com o mesmo silêncio. */
    for (const morto of ["text-embedding-004", "embedding-001", "textembedding-gecko"]) {
      expect(codigo).not.toContain(`"${morto}"`);
    }
  });

  test("o padrão é um modelo de embedding atual", () => {
    expect(codigo).toMatch(
      /EMBEDDING_MODEL\s*=\s*process\.env\.EMBEDDING_MODEL\s*\|\|\s*"gemini-embedding-/,
    );
  });

  test("continua trocável por variável de ambiente", () => {
    /* Quando o próximo for aposentado, a saída tem que ser uma env var — não
       um deploy. */
    expect(codigo).toContain("process.env.EMBEDDING_MODEL");
  });
});

describe("o tamanho pedido bate com a coluna do banco", () => {
  test("pede 768 dimensões explicitamente", () => {
    /* O padrão de `gemini-embedding-001` é 3072. Sem pedir 768, o vetor volta
       grande demais, a guarda de tamanho o rejeita, e voltaríamos a gravar
       nada — o mesmo defeito com outra causa. */
    expect(codigo).toContain("outputDimensionality: EMBEDDING_DIMS");
    expect(codigo).toMatch(/EMBEDDING_DIMS\s*=\s*768/);
  });

  test("o pedido vai na RAIZ do corpo, não aninhado", () => {
    /* MEDIDO em produção: com `embedContentConfig: { outputDimensionality }` a
       API respondeu com 3072 dimensões — o campo aninhado é a forma dos SDKs
       oficiais, aceito pelo parser da REST e IGNORADO na geração. Nenhum vetor
       chegava a ser gravado. */
    expect(codigo).toContain("outputDimensionality: EMBEDDING_DIMS,");
    expect(codigo).not.toContain("embedContentConfig:");
  });

  test("vetor GRANDE demais é cortado, não recusado", () => {
    /* `gemini-embedding-001` é Matryoshka: as primeiras dimensões carregam a
       maior parte do significado, e pedir menos que 3072 devolve justamente o
       vetor truncado. Cortar aqui dá o MESMO vetor que o parâmetro daria.
       Recusar era o comportamento antigo — e transformava um campo ignorado em
       recurso morto, sem ninguém conseguir adivinhar por quê. */
    expect(codigo).toContain("normalizar(values.slice(0, EMBEDDING_DIMS))");
    expect(codigo).toContain("values.length < EMBEDDING_DIMS");
  });
});

describe("a falha deixa rastro", () => {
  /* ESTE É O TESTE QUE IMPORTA. O conserto de hoje é trocar um nome de modelo;
     o que impede a próxima morte silenciosa é o aviso. */
  test("resposta de erro da API é registrada", () => {
    expect(codigo).toContain("avisarFalha(`HTTP ${res.status}`)");
  });

  test("o aviso diz QUAL modelo falhou", () => {
    /* Sem o nome, o log manda procurar em todo lugar. Com o nome, quem lê
       compara com a documentação do Google em dez segundos. */
    expect(fonte).toMatch(/console\.error\([\s\S]{0,300}\$\{EMBEDDING_MODEL\}/);
  });

  test("o aviso não vira enxurrada", () => {
    /* Uma linha por mensagem de paciente afogaria o log e esconderia o
       problema por excesso, que é o mesmo fim do silêncio. */
    expect(codigo).toContain("if (jaAvisouDaFalha) return;");
  });

  test("dimensão errada e resposta vazia também avisam", () => {
    expect((codigo.match(/avisarFalha\(/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  test("o chat NÃO quebra quando o embedding falha", () => {
    /* O aviso não pode ter virado exceção: sem vetor, a busca por palavras
       assume e a paciente recebe resposta do mesmo jeito. */
    expect(codigo).toContain("return null;");
    expect(codigo).not.toMatch(/throw new Error\([^)]*embed/i);
  });
});

describe("o vetor sai normalizado", () => {
  test("existe a normalização", () => {
    /* Pedindo menos de 3072, o Google devolve o vetor TRUNCADO e sem
       renormalizar. Cosseno ignora magnitude, então o ranking não muda — mas o
       NÚMERO de similaridade muda, e é ele que calibra o corte de agrupamento
       das lacunas. Um corte calibrado em cima de número torto erra duas vezes. */
    expect(codigo).toContain("return normalizar(values.slice(0, EMBEDDING_DIMS));");
  });

  test("norma zero não vira divisão por zero", () => {
    expect(codigo).toContain("if (!norma || !Number.isFinite(norma)) return v;");
  });
});

describe("trocar de modelo obriga a regerar tudo", () => {
  test("a nota de migração está no arquivo", () => {
    /* Espaços de modelos diferentes não são comparáveis: misturar produz uma
       similaridade que PARECE número normal e não significa nada. Quem trocar
       o modelo sem limpar herda isso sem aviso. */
    expect(fonte).toContain("UPDATE public.brain_entries SET embedding = NULL;");
    expect(fonte).toContain("UPDATE public.brain_gaps    SET embedding = NULL;");
  });

  test("backfill e cura só olham linha sem vetor — é o que as reconstrói", () => {
    expect(codigo).toContain('.is("embedding", null)');
    const cura = readFileSync("src/lib/secondbrain.server.ts", "utf8");
    expect(cura).toContain('.is("embedding", null)');
  });
});
