/**
 * A VARREDURA DE INTERAÇÃO TEM A MESMA SEGUNDA CHANCE DA DE BANCADAS.
 *
 * ⚠️ Medido no runner (set/2026): um roteiro caiu com "Failed to fetch
 * dynamically imported module" — o servidor de dev do Vite recarregando a
 * entrada no meio da navegação — num commit que só mudava Markdown, e o mesmo
 * job tinha passado cinco minutos antes com código idêntico. A de bancadas já
 * repetia uma vez, sozinha; a de interação reprovava na primeira.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const FONTE = readFileSync("scripts/varrer-interacao.mjs", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("⚠️ a varredura de interação repete uma vez o que falhou", () => {
  test("cada roteiro roda numa função, e os que falham voltam para uma segunda passada", () => {
    expect(FONTE).toContain("async function rodar(t)");
    expect(FONTE).toContain("return { erros, toques };");
    expect(FONTE).toMatch(/suspeitos\.push\(\{ t, primeira: erros \}\)/);
    expect(FONTE).toMatch(/for \(const \{ t, primeira \} of suspeitos\)/);
  });

  test("⚠️ e é UMA só — a segunda passada é a que conta, para os dois lados", () => {
    /* Passou na segunda: avisa e não reprova. Falhou de novo: reprova. Não há
       terceira, porque três tentativas escondem corrida de verdade. */
    expect(FONTE).toContain("passou sozinha na segunda");
    const segunda = FONTE.slice(FONTE.indexOf("for (const { t, primeira } of suspeitos)"));
    expect(segunda).toContain("ruins++;");
    expect((FONTE.match(/await rodar\(t\)/g) ?? []).length).toBe(2);
  });
});
