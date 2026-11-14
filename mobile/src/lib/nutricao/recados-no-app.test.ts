import { describe, expect, test } from "bun:test";
import { recadoDaAmostraNoApp, recadoDoBloqueioNoApp } from "./recados-no-app";

const PROIBIDAS = /premium|grátis|gratis|assin|plano|compr|pag/i;

describe("os recados da nutricionista no app não vendem nada", () => {
  test("bloqueio", () => {
    for (const m of ["teto_diario", "sem_premium"] as const) {
      const r = recadoDoBloqueioNoApp(m);
      expect(`${r.titulo} ${r.texto}`).not.toMatch(PROIBIDAS);
    }
  });
  test("amostra", () => {
    for (const n of [0, 1, 2]) expect(recadoDaAmostraNoApp(n)).not.toMatch(PROIBIDAS);
    expect(recadoDaAmostraNoApp(null)).toBeNull();
  });
});
