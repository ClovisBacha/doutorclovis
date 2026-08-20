import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * AS TRAVAS DO RESUMO SEMANAL DA CRIADORA, lidas na fonte.
 *
 * ⚠️ Sem comentários antes de procurar — a prosa que explica uma decisão contém
 * as palavras que o teste proíbe.
 */
function semComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}
const TICK = semComentarios(readFileSync("src/routes/api/push-weekly-tick.ts", "utf8"));
const CORPO = TICK.slice(TICK.indexOf("async function resumoSemanalDasCriadoras"));

describe("o resumo da criadora", () => {
  /* ⚠️ **NÚMEROS, e nunca a LISTA.** Trazer as linhas seria carregar para a
     memória do servidor exatamente os nomes que o e-mail não pode conter. */
  test("⚠️ conta com `head: true`, e não lê as pacientes", () => {
    expect(CORPO).toContain('{ count: "exact", head: true }');
    expect(CORPO).not.toContain("display_name");
    expect(CORPO).not.toContain("baby_name");
    expect(CORPO).not.toContain("lmp_date");
  });

  /* ⚠️ Um código desligado não atribui nada, e sem e-mail não há para onde
     mandar. */
  test("⚠️ só afiliada ATIVA e com e-mail", () => {
    expect(CORPO).toContain('.eq("active", true)');
    expect(CORPO).toContain('.not("email", "is", null)');
  });

  /* ⚠️ A decisão de mandar sai da régua pura, com o silêncio da semana vazia
     dentro dela. */
  test("⚠️ a decisão é `valeMandarResumo`, e não um `if` local", () => {
    expect(CORPO).toContain("if (!valeMandarResumo(numeros)) continue;");
    expect(CORPO).not.toContain("novas > 0");
  });

  /* ⚠️ Segunda, e pela régua — não por um número escrito aqui. */
  test("⚠️ o dia sai de `DIA_DO_RESUMO`", () => {
    expect(CORPO).toContain("hojeBR.getDay() !== DIA_DO_RESUMO");
  });

  /* ⚠️ Fuso de Brasília, e não do processo — o mesmo defeito de três horas que
     os dois trabalhos vizinhos já evitam. */
  test("⚠️ o dia é o de São Paulo", () => {
    expect(CORPO).toContain('timeZone: "America/Sao_Paulo"');
  });

  /* ⚠️ E-mail, e nunca push: ela pode não ter o app, e o push deste app é o
     canal do aviso de emergência. */
  test("⚠️ manda e-mail, e não push", () => {
    expect(CORPO).toContain("sendEmail({");
    expect(CORPO).not.toContain("sendPushToUser");
  });

  /* Uma criadora que falha não pode derrubar o resumo das outras. */
  test("cada criadora tem o próprio try/catch", () => {
    const i = CORPO.indexOf("for (const a of");
    const laco = CORPO.slice(i, CORPO.indexOf("return mandados"));
    expect(laco).toContain("try {");
    expect(laco).toContain("catch (e)");
  });

  /* ⚠️ Um `<` num nome viraria marcação no cliente de e-mail dela. */
  test("⚠️ o corpo é escapado antes de virar HTML", () => {
    expect(TICK).toContain("function comoHtml");
    const f = TICK.slice(TICK.indexOf("function comoHtml"));
    expect(f.indexOf('replace(/</g, "&lt;")')).toBeLessThan(f.indexOf("<br/>"));
  });
});
