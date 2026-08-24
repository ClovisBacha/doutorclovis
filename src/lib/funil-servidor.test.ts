import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** Sem comentários antes de procurar — a prosa cita as palavras proibidas. */
function semComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}
const TODO = semComentarios(readFileSync("src/lib/insights.functions.ts", "utf8"));
const CORPO = TODO.slice(TODO.indexOf("export const getFunilDeIndicacao"));

describe("o funil da indicação", () => {
  /* ⚠️ É o retrato do crescimento da plataforma inteira: nenhum médico e
     nenhuma criadora vê isto. */
  test("⚠️ é super-admin", () => {
    expect(CORPO).toContain("requireSuperAdmin(data.accessToken)");
    expect(CORPO).toContain("if (!user) return { ok: false as const };");
  });

  /* ⚠️ Carregar as linhas traria para a memória do servidor os nomes de todas
     as pacientes indicadas, para desenhar quatro barras. */
  test("⚠️ conta com `head: true`, e nunca lê nome de paciente", () => {
    expect(CORPO).toContain('{ count: "exact", head: true }');
    expect(CORPO).not.toContain("display_name");
    expect(CORPO).not.toContain("baby_name");
    expect(CORPO).not.toContain("avatar_url");
  });

  /* O cruzamento precisa dos ids — e o `select` é de UMA coluna só. */
  test("⚠️ o cruzamento lê só `id`, e nada mais", () => {
    const i = CORPO.indexOf("const indicadas = new Set<string>()");
    expect(i).toBeGreaterThan(-1);
    const bloco = CORPO.slice(i, CORPO.indexOf("const comAlgum", i));
    expect(bloco).toContain('.select("id")');
  });

  /* ⚠️ Um degrau a menos é melhor que a tela inteira em branco — e o
     `comoFoiContado` já diz o que cada número significa. */
  test("⚠️ falha ao contar não derruba o painel", () => {
    expect(CORPO).toContain("await safe(");
    expect(CORPO).toContain("{ count: 0 }");
  });

  /* ⚠️ A montagem dos degraus é a régua pura — nenhum texto de degrau escrito
     aqui, senão a tela e o teste passariam a discordar. */
  test("⚠️ os degraus vêm de `montarFunil`", () => {
    expect(CORPO).toContain("montarFunil({");
    expect(CORPO).not.toContain("Abriram o link");
    expect(CORPO).not.toContain("rotulo:");
  });
});

describe("a tela do funil", () => {
  const TELA = semComentarios(readFileSync("src/routes/_authenticated/admin-sections.tsx", "utf8"));
  const painel = TELA.slice(TELA.indexOf("function FunilDaIndicacao"));

  /* ⚠️ "Não medido" NÃO pode virar zero: um número inventado no topo do funil
     faria todas as taxas abaixo mentirem juntas. */
  test("⚠️ o degrau não medido mostra `SEM_MEDIDA`, e não 0", () => {
    expect(painel).toContain("d.quantos === null");
    expect(painel).toContain("{SEM_MEDIDA}");
    expect(painel).not.toContain("d.quantos ?? 0");
  });

  /* ⚠️ Sem esta linha alguém lê "publicaram: 12" como "12 posts". */
  test("⚠️ todo degrau desenha o `comoFoiContado`", () => {
    expect(painel).toContain("{d.comoFoiContado}");
  });

  /* ⚠️ A taxa sai da régua, que devolve `null` sobre não medido e sobre zero. */
  test("⚠️ a porcentagem vem de `taxa`, e só aparece quando existe", () => {
    expect(painel).toContain("taxa(criaram, d.quantos)");
    expect(painel).toContain("t !== null &&");
  });
});
