import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { semComentarios } from "@/lib/sem-comentarios";
import { ordemDoRitual, revelaOBebe, semanaDaRevelacao } from "~/lib/ritual";

/**
 * O RITUAL DE BOAS-VINDAS (18/11/2026, a vistoria): no mesmo céu da entrada,
 * um passo por tela, sem o médico quando o SOS está desligado, e com a
 * revelação do bebê da semana no fim do primeiro ritual.
 */

const RAIZ = join(import.meta.dir, "..");
const fonte = (...p: string[]) => semComentarios(readFileSync(join(RAIZ, ...p), "utf8"));

describe("os passos do ritual", () => {
  test("com o SOS desligado, o contato e o médico saem; a amiga só no primeiro ritual", () => {
    expect(ordemDoRitual(6, false)).toEqual([0, 1, 2, 5]);
    expect(ordemDoRitual(5, false)).toEqual([0, 1, 2]);
  });

  test("com o SOS ligado, os seis passos voltam", () => {
    expect(ordemDoRitual(6, true)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ordemDoRitual(5, true)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("a revelação do bebê no fim do primeiro ritual", () => {
  test("só no primeiro ritual da gestação, e nunca no Modo Cuidado", () => {
    expect(revelaOBebe({ editar: false, modo: "dum", cuidado: false })).toBe(true);
    expect(revelaOBebe({ editar: false, modo: "us", cuidado: false })).toBe(true);
    expect(revelaOBebe({ editar: true, modo: "dum", cuidado: false })).toBe(false);
    expect(revelaOBebe({ editar: false, modo: "nasceu", cuidado: false })).toBe(false);
    expect(revelaOBebe({ editar: false, modo: "dum", cuidado: true })).toBe(false);
  });

  test("a semana sai da mesma régua da trilha (DUM ou ultrassom)", () => {
    const hoje = new Date(2026, 10, 18);
    /* 172 dias desde a DUM: 24 semanas e 4 dias. */
    expect(semanaDaRevelacao({ modo: "dum", ymd: "2026-05-30" }, hoje)).toBe(24);
    /* O ultrassom de 1º de outubro dizia 12s2d: 48 dias depois, 19s1d. */
    expect(
      semanaDaRevelacao({ modo: "us", ymd: "2026-10-01", semanasUs: 12, diasUs: 2 }, hoje),
    ).toBe(19);
    /* Bem no começo, a trilha começa na semana 1. */
    expect(semanaDaRevelacao({ modo: "dum", ymd: "2026-11-15" }, hoje)).toBe(1);
  });

  test("sem data, ou depois do parto, não há o que revelar", () => {
    expect(semanaDaRevelacao({ modo: "dum", ymd: null })).toBeNull();
    expect(semanaDaRevelacao({ modo: "nasceu", ymd: "2026-10-01" })).toBeNull();
  });

  test("o ritual pergunta pela regra antes de revelar, e a revelação mora no céu da entrada", () => {
    const ritual = fonte("app", "ritual.tsx");
    expect(ritual).toContain("revelaOBebe({");
    expect(ritual).toContain("<RevelacaoDoBebe");
    expect(ritual).toContain("<FundoDaEntrada");
    expect(ritual).toContain("ordemDoRitual(total, SOS_NO_APP)");
    /* O bebê aparece só na revelação, num arquivo que a entrada não importa. */
    expect(ritual).not.toMatch(/arte-do-bebe|ceu-do-bebe/);
    expect(fonte("componentes", "revelacao-do-bebe.tsx")).toMatch(/arteDoBebe\(semana\)/);
  });

  test("o aceite mora no mesmo céu, sem a página clara", () => {
    const aceite = fonte("app", "aceite.tsx");
    expect(aceite).toContain("<FundoDaEntrada");
    expect(aceite).not.toMatch(/<Tela\b/);
  });
});
