import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * ⚠️ **AS DUAS LEITURAS DE `rede_conversas` JÁ TINHAM DIVERGIDO.**
 *
 * `minhaConversa` (a singular) descia do topo direto para
 * `silenciada+saiu`, **pulando `fixada_*`** — enquanto `minhasConversas` (a
 * plural) descia de um em um. E o comentário da singular mandava "ver
 * `minhasConversas`", afirmando uma coisa que o código não fazia.
 *
 * Nada lia `fixada_*` daquela função, então o defeito era LATENTE — e latente é
 * como um defeito sobrevive à revisão. Ele acordaria no dia em que o dono
 * rodasse `APLICAR_DIRECT_COMPLETO` sem `APLICAR_NOVE_DA_REDE`, ou no dia em
 * que alguém lesse `c.fixada_a`.
 *
 * Uma lista só para as duas torna a divergência impossível — e esta catraca
 * existe para ninguém reintroduzir uma segunda.
 */
const FONTE = readFileSync("src/lib/conversa.functions.ts", "utf8");
/* ⚠️ Sem a prosa: este arquivo CITA as colunas para explicar a régua. */
const semProsa = FONTE.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

const ESCADA = (() => {
  const i = semProsa.indexOf("const DEGRAUS_DA_CONVERSA");
  return semProsa.slice(i, semProsa.indexOf("] as const;", i));
})();

describe("⚠️ uma escada só, e um degrau por SQL", () => {
  test("a âncora existe (senão o describe passa em vazio)", () => {
    expect(ESCADA.length).toBeGreaterThan(200);
  });

  test("⚠️ QUATRO degraus, e nenhum salta uma leva de colunas", () => {
    /* `arquivada_*` no APLICAR_NOVE_DA_REDE, `fixada_*` no
       APLICAR_DIRECT_COMPLETO, `silenciada_*`/`saiu_*` no
       APLICAR_CONVERSA_SILENCIAR — três arquivos, e o piso. */
    /* ⚠️ Um `BASE_DA_CONVERSA` por degrau — a fatia começa DEPOIS da definição
       dele, então quatro é quatro. A primeira versão desta asserção contava
       cinco (somando a definição) e reprovava sobre a escada certa. */
    const degraus = ESCADA.split("BASE_DA_CONVERSA").length - 1;
    expect(degraus).toBe(4);
    expect(ESCADA).toContain("arquivada_a, arquivada_b");
    expect(ESCADA).toContain("fixada_a, fixada_b`");
    expect(ESCADA).toContain("saiu_a, saiu_b`");
  });

  test("⚠️ cada degrau é PREFIXO do de cima — nunca uma lista à parte", () => {
    /* É o que garante que descer só TIRA colunas. Uma lista escrita à mão podia
       trocar uma coluna por outra sem ninguém ver. */
    const degraus = [...ESCADA.matchAll(/`\$\{BASE_DA_CONVERSA\}([^`]*)`/g)].map((m) => m[1]);
    expect(degraus.length).toBe(3);
    for (let i = 1; i < degraus.length; i++) {
      expect(degraus[i - 1].startsWith(degraus[i])).toBe(true);
    }
  });

  test("⚠️ as DUAS leituras usam a MESMA escada", () => {
    /* A divergência que motivou este arquivo. */
    const i = semProsa.indexOf("async function minhaConversa");
    const singular = semProsa.slice(i, semProsa.indexOf("\n}", i));
    expect(singular).toContain("for (const colunas of DEGRAUS_DA_CONVERSA)");

    const j = semProsa.indexOf("export const minhasConversas");
    const plural = semProsa.slice(j, semProsa.indexOf("\nexport const ", j + 10));
    for (const n of [0, 1, 2, 3]) {
      expect(plural).toContain(`DEGRAUS_DA_CONVERSA[${n}]`);
    }
  });

  test("⚠️ e nenhuma das duas escreve a lista de colunas à mão", () => {
    const i = semProsa.indexOf("async function minhaConversa");
    const singular = semProsa.slice(i, semProsa.indexOf("\n}", i));
    const j = semProsa.indexOf("export const minhasConversas");
    const plural = semProsa.slice(j, semProsa.indexOf("\nexport const ", j + 10));
    for (const corpo of [singular, plural]) {
      expect(corpo).not.toContain("silenciada_a, silenciada_b");
      expect(corpo).not.toContain("id, a_id, b_id, iniciada_por");
    }
  });
});
