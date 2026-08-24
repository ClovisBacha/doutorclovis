/**
 * A MINIATURA DA GRADE.
 *
 * A grade do perfil desenhava células de 130×173 baixando a foto de 1080px para
 * cada uma: 2,67 MB e 21 requisições numa abertura de perfil — o caminho exato
 * que o dono descreveu como "demora cinco segundos".
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CELULA_DA_GRADE, LADO_DA_MINIATURA, urlDaGrade, valeMiniatura } from "./miniatura";

describe("o tamanho sai de conta, não de gosto", () => {
  /**
   * ⚠️ A célula é (393 − 2×2)/3 ≈ 129,7 de largura, e 3:4 → ~173 de altura.
   * Num aparelho de densidade 3 são 519 pixels reais no lado maior. A miniatura
   * precisa cobrir isso sem ficar mole.
   */
  test("⚠️ cobre a célula num aparelho de densidade 3", () => {
    const larguraDaCelula = (393 - 2 * 2) / 3;
    const alturaReal = larguraDaCelula * (4 / 3) * 3;
    /* 92% já é imperceptível; abaixo de 85% a foto fica visivelmente mole. */
    expect(LADO_DA_MINIATURA / alturaReal).toBeGreaterThan(0.85);
  });

  /* ⚠️ E continua sendo MUITO menor que a original — senão não há economia. */
  test("⚠️ é bem menor que os 1080 da foto do post", () => {
    expect(LADO_DA_MINIATURA).toBeLessThan(1080 / 2);
  });

  /* A proporção da célula é a mesma de `medidas-instagram.ts`: 3:4, que é o
     que o modelo passou a usar em 2025. Quadrada cortaria a foto vertical, que
     é a maioria. */
  test("a célula declarada é 3:4", () => {
    expect(CELULA_DA_GRADE.largura / CELULA_DA_GRADE.altura).toBeCloseTo(0.75, 2);
  });
});

/**
 * ⚠️ O RECUO É POR PUBLICAÇÃO, E NÃO É TEMPORÁRIO.
 *
 * Toda publicação anterior a este recurso não tem miniatura, e gerá-las em lote
 * exigiria baixar, reduzir e subir de novo o acervo inteiro — trabalho grande
 * sobre dado de paciente para economizar byte numa foto que ela talvez nunca
 * mais abra.
 */
describe("a grade escolhe por publicação", () => {
  test("com miniatura, usa a miniatura", () => {
    expect(urlDaGrade({ imagemUrl: "grande.jpg", miniaturaUrl: "peq.jpg" })).toBe("peq.jpg");
  });

  test("⚠️ sem miniatura, cai na foto cheia — nunca num vazio", () => {
    expect(urlDaGrade({ imagemUrl: "grande.jpg", miniaturaUrl: null })).toBe("grande.jpg");
    expect(urlDaGrade({ imagemUrl: "grande.jpg" })).toBe("grande.jpg");
  });

  /* Publicação só de texto não tem foto nenhuma, e isso não é erro. */
  test("sem foto nenhuma, devolve null", () => {
    expect(urlDaGrade({ imagemUrl: null, miniaturaUrl: null })).toBeNull();
  });

  /**
   * ⚠️ E a miniatura NUNCA substitui a foto grande na tela do post.
   *
   * Esta função é da GRADE. Se ela fosse usada na tela que abre ao tocar,
   * a paciente veria a versão de 480px em tela cheia — uma foto mole no único
   * lugar onde ela quer ver a foto de verdade.
   */
  test("⚠️ a função é da grade, e o nome diz isso", () => {
    expect(urlDaGrade.name).toBe("urlDaGrade");
  });
});

/**
 * ⚠️ Foto que já é pequena não ganha miniatura: seria um segundo arquivo do
 * mesmo peso — mais um upload, mais uma assinatura, mais uma linha para limpar
 * na exclusão de conta — e zero byte economizado.
 */
describe("quando não vale gerar", () => {
  test("⚠️ original pequena não vira dois arquivos", () => {
    expect(valeMiniatura(LADO_DA_MINIATURA)).toBe(false);
    expect(valeMiniatura(LADO_DA_MINIATURA * 1.1)).toBe(false);
  });

  test("original grande vale", () => {
    expect(valeMiniatura(1080)).toBe(true);
    expect(valeMiniatura(LADO_DA_MINIATURA * 2)).toBe(true);
  });
});

/**
 * ⚠️ A CORRENTE INTEIRA — cada elo, e onde ele está.
 *
 * Uma coluna nova neste projeto morre de três jeitos, todos silenciosos: o
 * `select` sem recuo apaga a tela inteira num banco que ainda não rodou o SQL;
 * a coluna nascida dentro de um `CREATE TABLE IF NOT EXISTS` nunca nasce; e a
 * régua escrita e nunca chamada por tela nenhuma. Este bloco cobra os três.
 */
describe("a corrente da miniatura", () => {
  const semComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

  const SQL = readFileSync("supabase/APLICAR_REDE_SOCIAL.sql", "utf8");
  const SERVIDOR = semComentarios(readFileSync("src/lib/rede-social.functions.ts", "utf8"));
  const TELA = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));

  /* ⚠️ Por ALTER, e nunca dentro de um `CREATE TABLE IF NOT EXISTS`: num banco
     que já tem a tabela o CREATE é no-op e a coluna NUNCA nasce. Foi isso que
     deixou `carimbo_semana` impossível de criar por uma leva inteira. */
  test("⚠️ a coluna nasce por ALTER", () => {
    expect(SQL).toMatch(
      /ALTER TABLE public\.rede_posts ADD COLUMN IF NOT EXISTS miniatura_path text/,
    );
  });

  /* ⚠️ E o recuo: sem ele, o `select` com a coluna nova falha inteiro e a aba
     Comunidade fica preta na janela entre o deploy e o SQL do dono. */
  test("⚠️ a leitura tem recuo para banco sem a coluna", () => {
    expect(SERVIDOR).toContain("miniatura_path");
    /* `postsCrus` devolve `miniatura_path: null` no caminho antigo. */
    expect(SERVIDOR).toContain("miniatura_path: null");
  });

  /* ⚠️ E a capa da Atividade tem recuo PRÓPRIO — ela não passa por `postsCrus`. */
  test("⚠️ a capa da Atividade também recua", () => {
    const i = SERVIDOR.indexOf("const capas = new Map<string, string>()");
    expect(i).toBeGreaterThan(-1);
    const bloco = SERVIDOR.slice(i, i + 1400);
    expect(bloco).toContain("miniatura_path");
    expect(bloco).toContain("miniatura_path: null");
  });

  /* A tela pede a miniatura pela régua, e não por um `??` escrito à mão em cada
     lugar — duas cópias divergiriam no primeiro ajuste. */
  test("⚠️ a grade usa `urlDaGrade`, e não a foto cheia direto", () => {
    expect(TELA).toContain("urlDaGrade(p)");
  });

  /* ⚠️ Sem `width`/`height` o `loading="lazy"` é inerte: o navegador não sabe a
     altura das células e pede as vinte de uma vez. */
  test("⚠️ a célula da grade declara as dimensões", () => {
    expect(TELA).toContain("width={CELULA_DA_GRADE.largura}");
    expect(TELA).toContain("height={CELULA_DA_GRADE.altura}");
  });

  /* ⚠️ E a miniatura é GERADA em algum lugar — sem isso a coluna nasceria
     sempre nula e todo o resto seria decoração. */
  test("⚠️ o compositor gera e envia a miniatura", () => {
    expect(TELA).toContain("prepararMiniatura");
    expect(TELA).toContain("setMiniatura(await prepararMiniatura(f))");
    expect(TELA).toContain("miniatura: p.miniatura ?? null");
  });

  /**
   * ⚠️ E A MINIATURA NÃO PODE DERRUBAR A PUBLICAÇÃO.
   *
   * As fotos do carrossel recusam o post quando falham — elas são o conteúdo.
   * A miniatura não é: ela é economia de byte, e `urlDaGrade` já sabe cair na
   * foto cheia. Recusar a publicação por causa dela seria trocar um problema de
   * desempenho por um de produto.
   */
  test("⚠️ falhar a miniatura NÃO recusa o post", () => {
    const i = SERVIDOR.indexOf("if (data.miniatura)");
    expect(i).toBeGreaterThan(-1);
    const bloco = SERVIDOR.slice(i, i + 260);
    expect(bloco).not.toContain('motivo: "imagem"');
  });
});
