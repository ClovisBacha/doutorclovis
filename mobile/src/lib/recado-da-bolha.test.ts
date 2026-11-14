import { describe, expect, test } from "bun:test";
import { recadoDaBolha, TODAS_AS_FRASES } from "@/lib/recado-da-bolha";
import { RECADOS_NO_APP, recadoDaBolhaNoApp } from "~/lib/recado-da-bolha";

/** Todos os estados que a bolha conhece: dia, hora, nome, fase e o que já foi feito. */
function* estados() {
  for (const posParto of [false, true])
    for (const bebe of [undefined, "Helena"])
      for (const hora of [null, 3, 6, 10, 13, 16, 19, 22])
        for (const feitos of [0, 1, 3, 5])
          for (let dia = 0; dia < 24; dia++)
            yield { feitos, total: posParto ? 3 : 5, dia, hora, bebe, semana: 20, posParto };
}

describe("o recado da bolha no app", () => {
  test("as trocadas ainda são, no site, frases da lista (se o site mudar, a catraca avisa)", () => {
    for (const t of RECADOS_NO_APP)
      expect(TODAS_AS_FRASES.some((f) => f.texto === t.site)).toBe(true);
  });

  test("nunca dá gênero ao bebê, nem exercício, nem afirmação sobre o bebê, nem o corpo", () => {
    const fora = new Set<string>();
    for (const e of estados()) {
      const t = recadoDaBolhaNoApp(e);
      if (/\b(dele|dela)\b|alongar|se mexe|desacelera, .+ sente|corpo pesa|\{bebe\}/i.test(t))
        fora.add(t);
    }
    expect([...fora]).toEqual([]);
  });

  test("a troca ocupa o lugar da frase do site e leva o nome junto", () => {
    let trocou = 0;
    for (const e of estados()) {
      const site = recadoDaBolha(e);
      const app = recadoDaBolhaNoApp(e);
      if (site === app) continue;
      trocou++;
      if (site.includes("alongar")) {
        expect(app).toBe("🌤️ Tarde boa pra conversar um pouquinho com Helena. 💜");
      }
    }
    expect(trocou).toBeGreaterThan(0);
  });
});
