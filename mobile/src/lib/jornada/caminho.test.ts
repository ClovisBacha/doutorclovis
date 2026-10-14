import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALTURA,
  coresDaSemana,
  degradeDaMoeda,
  FASE_BONUS,
  FASES,
  HUMORES,
  MARCOS,
  marcouHumorHoje,
  montarCaminho,
  novoCheckin,
  tomFuturo,
  tomPerdido,
  xDoPasso,
} from "~/lib/jornada/caminho";

/* O fonte do Caminho do site — a referência que esta régua copia. */
const SITE = readFileSync(
  join(import.meta.dir, "..", "..", "..", "..", "src", "components", "gestacao-path.tsx"),
  "utf8",
);

function canal(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Igual ao hex do site com no máximo 1 de diferença por canal (arredondamento). */
function quase(obtido: string, esperado: string) {
  const a = canal(obtido);
  const b = canal(esperado);
  for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(1);
}

describe("o Caminho do app é o mesmo do site", () => {
  test("as fases são as mesmas, com os mesmos nomes e semanas", () => {
    for (const f of [...FASES, FASE_BONUS]) {
      const linha = `{ n: ${f.n}, from: ${f.from}, to: ${f.to}, emoji: "${f.emoji}", name: "${f.name}" }`;
      expect(SITE).toContain(linha);
    }
  });

  test("os marcos das semanas são os mesmos", () => {
    for (const [semana, m] of Object.entries(MARCOS)) {
      expect(SITE).toContain(`${semana}: { emoji: "${m.emoji}", label: "${m.label}" }`);
    }
  });

  test("os humores do check-in são os mesmos", () => {
    for (const h of HUMORES) expect(SITE).toContain(`{ emoji: "${h.emoji}", label: "${h.label}" }`);
  });

  test("as alturas da trilha são as do site", () => {
    expect(SITE).toContain(`const IDAY_ROW = ${ALTURA.dia};`);
    expect(SITE).toContain(`const TODAY_BUBBLE_ROOM = ${ALTURA.folgaDeHoje};`);
    expect(SITE).toContain(`const IWEEK_HEADER = ${ALTURA.semana};`);
    expect(SITE).toContain(`const IBANNER_ROW = ${ALTURA.fase};`);
  });

  test("a onda das bolinhas é a do site", () => {
    expect(SITE).toContain("casaDoDesenho(50 + 26 * Math.sin((r * Math.PI) / 4))");
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(xDoPasso)).toEqual([
      50, 68.385, 76, 68.385, 50, 31.615, 24, 31.615,
    ]);
  });
});

describe("as cores das semanas", () => {
  /* Os hex de referência saem das fórmulas do site (oklch e color-mix em
     oklab), convertidos para sRGB. */
  test("semana 1: rosé da marca, nos três estados", () => {
    const c = coresDaSemana(1);
    quase(c.main, "#d15d9d");
    quase(c.lip, "#903169");
    quase(tomFuturo(c).main, "#f9dfeb");
    quase(tomFuturo(c).lip, "#e3c4d3");
    quase(tomPerdido(c).main, "#dda5c1");
    quase(tomPerdido(c).lip, "#b07e98");
    const d = degradeDaMoeda(c, 0.55, 0.82);
    quase(d.brilho, "#eaa7c9");
    quase(d.borda, "#a04578");
  });

  test("o matiz gira pela gestação: violeta, verde, âmbar", () => {
    quase(coresDaSemana(8).main, "#9873e2");
    quase(coresDaSemana(8).lip, "#65459f");
    quase(coresDaSemana(29).main, "#44a443");
    quase(coresDaSemana(29).lip, "#186e1a");
    quase(coresDaSemana(42).main, "#d8671c");
  });
});

describe("a montagem da trilha", () => {
  test("uma faixa por fase e um bloco por semana, com a folga só no dia de hoje", () => {
    const blocos = montarCaminho(FASES, 139);
    expect(blocos.filter((b) => b.tipo === "fase")).toHaveLength(6);
    const semanas = blocos.filter((b) => b.tipo === "semana");
    expect(semanas).toHaveLength(40);
    const comHoje = semanas.find((b) => b.tipo === "semana" && b.dias.some((d) => d.hoje));
    expect(comHoje?.tipo === "semana" ? comHoje.semana : null).toBe(19);
    expect(comHoje?.altura).toBe(ALTURA.semana + 7 * ALTURA.dia + ALTURA.folgaDeHoje);
    const outra = semanas.find((b) => b.tipo === "semana" && b.semana === 18);
    expect(outra?.altura).toBe(ALTURA.semana + 7 * ALTURA.dia);
  });

  test("a altura total é a mesma do site (buildFullJourney)", () => {
    const blocos = montarCaminho(FASES, 139);
    const total = blocos.reduce((s, b) => s + b.altura, 0);
    // y começa em 8 no site e termina com +40 de respiro: o miolo é o mesmo.
    expect(total).toBe(
      6 * ALTURA.fase + 40 * ALTURA.semana + 280 * ALTURA.dia + ALTURA.folgaDeHoje,
    );
  });

  test("a fase que ainda não começou fica travada", () => {
    const blocos = montarCaminho(FASES, 139);
    const fases = blocos.filter((b) => b.tipo === "fase");
    expect(fases.map((f) => (f.tipo === "fase" ? f.travada : null))).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
  });
});

describe("o check-in do humor", () => {
  const hoje = new Date(2026, 9, 14, 10);
  test("a sequência cresce só quando o último foi ontem", () => {
    expect(novoCheckin({ last: "2026-10-13", streak: 4 }, "Bem", hoje)).toEqual({
      last: "2026-10-14",
      streak: 5,
      mood: "Bem",
    });
    expect(novoCheckin({ last: "2026-10-10", streak: 4 }, "Bem", hoje).streak).toBe(1);
  });
  test("o cartão some depois do check-in de hoje", () => {
    expect(marcouHumorHoje({ last: "2026-10-14", streak: 1 }, hoje)).toBe(true);
    expect(marcouHumorHoje({ last: "2026-10-13", streak: 1 }, hoje)).toBe(false);
  });
});
