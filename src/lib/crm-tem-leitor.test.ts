/**
 * ⚠️ A CONFERÊNCIA NO CONSELHO ERA GRAVADA E LIDA POR NINGUÉM.
 *
 * `conferirMeuCrm` consulta o CFM e grava três colunas — `crm_conferido_em`,
 * `crm_conferido_nome`, `crm_conferido_situacao`. **Nenhum `select` do
 * repositório pedia qualquer uma delas.** Enquanto isso, o selo "verificado",
 * que ORDENA a busca de médicos que a paciente usa, é um booleano que alguém
 * aperta à mão e que ninguém liga à resposta do conselho.
 *
 * Ou seja: a plataforma pagava a consulta e mostrava como "verificado" quem
 * ninguém verificou. É a mesma família de `denunciado_em` — escrita sem leitor
 * — no lugar onde ela custa confiança da paciente ao escolher um obstetra.
 *
 * ⚠️ **E `verified` continua sendo apertado à mão, de propósito.** Casá-lo com
 * a resposta do CFM é decisão do dono: situação regular no conselho não é a
 * mesma coisa que aprovado nesta plataforma. Este teste cobra que a
 * conferência seja VISÍVEL, nunca que ela decida o selo.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

const PLAT = semComentarios(readFileSync("src/lib/platform.functions.ts", "utf8"));
const ADMIN = semComentarios(readFileSync("src/routes/_authenticated/admin.tsx", "utf8"));

describe("a conferência do CRM tem leitor", () => {
  test("⚠️ o painel da plataforma PEDE as três colunas", () => {
    /* ⚠️ Ancorado no VALOR de `colunas`, e não no arquivo: os três nomes
       aparecem também no tipo `DocRow` e no `.map()`, então a mutação que os
       tirava do SELECT passava verde. Décima terceira vez que "outra
       ocorrência do mesmo nome" engana um teste nesta base. */
    const i = PLAT.indexOf("const colunas =");
    expect(i).toBeGreaterThan(-1);
    const valor = PLAT.slice(i, PLAT.indexOf(";", i));
    expect(valor).toContain("crm_conferido_em");
    expect(valor).toContain("crm_conferido_nome");
    expect(valor).toContain("crm_conferido_situacao");
  });

  test("⚠️ e a tela DESENHA o resultado", () => {
    /* Pedir e descartar no `.map()` funcionaria hoje e viraria coluna morta
       amanhã — o que não é desenhado não é lido por ninguém. */
    /* ⚠️ A CONDIÇÃO, e não a menção: com `{false ? (` os dois ramos continuam
       citando `d.crm`, e a asserção solta ficava verde sobre uma tela morta. */
    expect(ADMIN).toMatch(/\{d\.crm (\?|&&)/);
    expect(ADMIN).toMatch(/CFM:/);
    /* O estado "nunca conferido" existe: sem ele, a ausência de linha seria
       indistinguível de uma conferência que falhou. */
    expect(ADMIN).toMatch(/nunca conferido/i);
  });

  test("⚠️ o selo e o conselho continuam SEPARADOS", () => {
    /* Se alguém casar os dois, é decisão do dono — e este teste fica vermelho
       para que a decisão seja deliberada, e não um efeito colateral. */
    const i = PLAT.indexOf("if (data.verified !== undefined) patch.verified");
    expect(i).toBeGreaterThan(-1);
    const trecho = PLAT.slice(i, i + 200);
    expect(trecho).not.toContain("crm_conferido");
  });

  test("⚠️ e as colunas têm degrau — a lista de médicos não pode cair por elas", () => {
    /* Elas nascem em `APLICAR_MEDICO.sql`; num banco que ainda não o rodou,
       pedi-las derrubaria o painel inteiro por causa de um campo informativo. */
    const i = PLAT.indexOf("const semCrm = await sb");
    expect(i).toBeGreaterThan(-1);
    const degrau = PLAT.slice(i, PLAT.indexOf("as DocRow[];", i));
    expect(degrau).not.toContain("crm_conferido");
    expect(degrau).toContain("verified");
  });
});
