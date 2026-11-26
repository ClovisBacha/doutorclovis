/**
 * OS MARCOS, MEDIDOS.
 *
 * Duas afirmações valem mais que as outras: nenhum marco é BLOQUEADO fora da
 * faixa, e o mesversário funciona para quem nasceu no dia 31.
 */

import { describe, expect, test } from "bun:test";
import { MARCOS, MARCO_POR_ID, marcosSugeridos, mesversarioDeHoje, textoDoMarco } from "./marcos";

describe("o catálogo", () => {
  test("os ids são únicos — eles vão para o banco", () => {
    expect(new Set(MARCOS.map((m) => m.id)).size).toBe(MARCOS.length);
  });

  test("⚠️ nada comparativo, nada clínico", () => {
    /* A diferença entre celebrar e avaliar é a diferença entre esta aba ser um
       álbum ou virar régua de desenvolvimento — que é do pediatra, não nossa. */
    const proibido = /atras|deveria|normal|esperad|percentil|adiantad|no tempo cert/i;
    for (const m of MARCOS) {
      expect({ id: m.id, ok: !proibido.test(m.titulo) }).toEqual({ id: m.id, ok: true });
    }
  });

  test("toda faixa é coerente", () => {
    for (const m of MARCOS) expect({ id: m.id, ok: m.de <= m.ate }).toEqual({ id: m.id, ok: true });
  });
});

describe("⚠️ sugerir sem bloquear", () => {
  test("NENHUM marco some, em idade nenhuma", () => {
    /* Bebê prematuro, bebê com síndrome, bebê que andou aos vinte meses. Um app
       que recusasse "primeiros passos" ali estaria dizendo à mãe que o filho
       está errado. */
    for (const meses of [0, 1, 6, 12, 20, 36]) {
      expect({ meses, n: marcosSugeridos(meses).length }).toEqual({ meses, n: MARCOS.length });
    }
  });

  test("os da faixa vêm na frente", () => {
    const aos6 = marcosSugeridos(6);
    const primeiros = aos6.slice(0, 5).map((m) => m.id);
    expect(primeiros).toContain("sentou");
    /* "Primeiro aniversário" (12–12) não tem nada a ver com um bebê de 6 meses. */
    expect(primeiros).not.toContain("aniversario");
  });

  test("dentro da faixa, o palpite mais estreito primeiro", () => {
    /* "sentou" (5–9) é aposta melhor que "dente" (4–12) para um bebê de 6. */
    const aos6 = marcosSugeridos(6).map((m) => m.id);
    expect(aos6.indexOf("sentou")).toBeLessThan(aos6.indexOf("dente"));
  });
});

describe("⚠️ o mesversário, e o bebê do dia 31", () => {
  test("cai no mesmo dia do mês", () => {
    expect(mesversarioDeHoje("2026-03-10", "2026-08-10")).toBe(5);
    expect(mesversarioDeHoje("2026-03-10", "2026-08-11")).toBe(null);
  });

  test("⚠️ nasceu em 31 de janeiro: fevereiro vale no dia 28", () => {
    /* Sem isto, esse bebê ficaria sem mesversário em CINCO meses do ano — e a
       mãe repararia. O último dia do mês vale. */
    expect(mesversarioDeHoje("2026-01-31", "2026-02-28")).toBe(1);
    expect(mesversarioDeHoje("2026-01-31", "2026-04-30")).toBe(3);
    /* E em março, que tem 31, é o 31 mesmo. */
    expect(mesversarioDeHoje("2026-01-31", "2026-03-31")).toBe(2);
    expect(mesversarioDeHoje("2026-01-31", "2026-03-30")).toBe(null);
  });

  test("ano bissexto não muda a régua", () => {
    expect(mesversarioDeHoje("2024-01-31", "2024-02-29")).toBe(1);
  });

  test("o dia do nascimento não é mesversário, e para depois de 24 meses", () => {
    expect(mesversarioDeHoje("2026-08-10", "2026-08-10")).toBe(null);
    expect(mesversarioDeHoje("2020-01-10", "2026-01-10")).toBe(null);
  });
});

describe("o texto não envelhece", () => {
  test("⚠️ a idade sai dos DIAS, não de um texto guardado", () => {
    /* "3 meses" gravado continuaria dizendo "3 meses" daqui a um ano. */
    expect(textoDoMarco("mesversario", 91)).toBe("🎂 3 meses");
    expect(textoDoMarco("mesversario", 30)).toBe("🎂 1 mês");
  });

  test("os outros marcos levam título e idade", () => {
    expect(textoDoMarco("sorriso", 61)).toBe("😊 Primeiro sorriso · 2 meses");
    expect(textoDoMarco("coto", 9)).toBe("🩹 O coto caiu · 9 dias");
  });

  test("sem idade, só o título — e id desconhecido não inventa", () => {
    expect(textoDoMarco("dente", null)).toBe("🦷 Primeiro dente");
    expect(textoDoMarco("inexistente", 30)).toBe(null);
  });

  test("o mapa por id cobre o catálogo", () => {
    expect(Object.keys(MARCO_POR_ID).length).toBe(MARCOS.length);
  });
});
