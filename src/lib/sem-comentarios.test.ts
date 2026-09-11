/**
 * A RÉGUA QUE APAGA COMENTÁRIO — e as duas formas ingênuas que ela substitui.
 *
 * ⚠️ Os casos abaixo NÃO são hipóteses: são os dois defeitos que este
 * repositório pagou, escritos como teste para não voltarem. Um apagador que
 * engole código faz um teste mentir nas DUAS direções — vermelho sobre código
 * certo, e verde sobre um defeito quando a asserção é negativa.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { semComentarios } from "./sem-comentarios";

/** O apagador ingênuo, aqui só para PROVAR que a régua conserta o que ele quebra. */
const ingenuo = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

describe("apaga o que é comentário", () => {
  test("bloco de doc, bloco de JSX e comentário de linha", () => {
    const fonte = [
      "/** um bloco de doc */",
      "const a = 1; // uma linha",
      "  {/* um comentário de JSX */}",
      "  /* um bloco comum */",
      "const b = 2;",
    ].join("\n");
    const r = semComentarios(fonte);
    expect(r).not.toMatch(/bloco de doc|uma linha|comentário de JSX|bloco comum/);
    expect(r).toContain("const a = 1;");
    expect(r).toContain("const b = 2;");
  });

  test("bloco de várias linhas some inteiro", () => {
    const fonte = ["/**", " * primeira", " * segunda", " */", "const vivo = 1;"].join("\n");
    const r = semComentarios(fonte);
    expect(r).not.toMatch(/primeira|segunda/);
    expect(r).toContain("const vivo = 1;");
  });
});

describe("⚠️ e NÃO engole código — os dois defeitos pagos", () => {
  test("barra-asterisco dentro de uma string não abre comentário", () => {
    /* O caso real: `accept="image/(estrela)"` em `nutricao-tab.tsx`. O
       apagador ingênuo abre um comentário ali e o fecha no próximo fechamento
       de verdade — centenas de linhas abaixo. */
    /* ⚠️ A ORDEM É O CASO: o código que se perde é o que fica ENTRE a
       barra-asterisco da string e o próximo fechamento de verdade. Com o
       comentário antes dele, nada se perde — e a primeira redação deste teste
       montou justamente esse arranjo inofensivo e ficou vermelha. */
    const fonte = [
      'const aceito = "image/*";',
      "const importante = 42;",
      "/* um comentário qualquer bem depois */",
      "const depois = 7;",
    ].join("\n");
    expect(ingenuo(fonte)).not.toContain("const importante = 42;"); // a prova do defeito
    expect(semComentarios(fonte)).toContain("const importante = 42;");
    expect(semComentarios(fonte)).toContain("const depois = 7;");
    expect(semComentarios(fonte)).toContain('const aceito = "image/*";');
    expect(semComentarios(fonte)).not.toContain("um comentário qualquer");
  });

  test("aspas em prosa de JSX não abrem string — a segunda forma ingênua", () => {
    /* Um varredor que conhece strings abre uma no apóstrofo de "a capa é o
       primeiro quadro" e engole o que vier até a próxima aspa. A âncora de
       linha não conhece string nenhuma, então o caso não existe. */
    const fonte = ["<p>a capa é o primeiro quadro; não o do zero</p>", "const vivo = 7;"].join(
      "\n",
    );
    expect(semComentarios(fonte)).toContain("const vivo = 7;");
    expect(semComentarios(fonte)).toContain("primeiro quadro");
  });

  test("⚠️ endereço numa string não vira comentário de linha", () => {
    /* `https://exemplo.com` tem duas barras: um `//` sem âncora come o resto
       da linha e leva o fecho da chamada junto. */
    const fonte = 'const url = "https://exemplo.com/x"; const depois = 1;';
    expect(semComentarios(fonte)).toContain("https://exemplo.com/x");
    expect(semComentarios(fonte)).toContain("const depois = 1;");
  });

  test("divisão não é comentário", () => {
    expect(semComentarios("const meio = total / 2;")).toContain("total / 2");
  });
});

describe("a tela que motivou a régua", () => {
  const CAMINHO = "src/components/nutricao-tab.tsx";
  test("⚠️ o apagador ingênuo engole código dela; a régua não", () => {
    const cru = readFileSync(CAMINHO, "utf8");
    /* Âncora de CÓDIGO que vive depois do seletor de foto. Se um dia o
       `accept` sair da tela, este teste fica vermelho — e aí a régua se revê
       com uma medição nova, nunca por conveniência. */
    const DEPOIS = "const a = limparAlimento(alimento);";
    expect(cru).toContain(DEPOIS);
    expect(ingenuo(cru)).not.toContain(DEPOIS);
    expect(semComentarios(cru)).toContain(DEPOIS);
  });
  test("e a prosa dela some de verdade", () => {
    /* `visualViewport` aparece SÓ em comentário nesta tela — é o que permite a
       um teste vizinho cobrar, por asserção negativa, que ela não meça a
       janela por conta própria. */
    const r = semComentarios(readFileSync(CAMINHO, "utf8"));
    expect(r).not.toContain("visualViewport");
    expect(r).toContain("useJanelaDoTeclado");
  });
});
