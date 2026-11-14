import { describe, expect, test } from "bun:test";
import { casalAberto, SEMANA_DO_CASAL } from "~/lib/jornada/casal";

describe("quando 'Para vocês dois' abre", () => {
  test("só na gestação, fora do luto, a partir da 28ª semana", () => {
    expect(SEMANA_DO_CASAL).toBe(28);
    expect(casalAberto({ cuidado: false, posParto: false, semana: 27 })).toBe(false);
    expect(casalAberto({ cuidado: false, posParto: false, semana: 28 })).toBe(true);
    expect(casalAberto({ cuidado: false, posParto: false, semana: 41 })).toBe(true);
    /* No 1º trimestre a voz diria que o bebê "já reconhece a sua voz há semanas". */
    expect(casalAberto({ cuidado: false, posParto: false, semana: 10 })).toBe(false);
    expect(casalAberto({ cuidado: true, posParto: false, semana: 34 })).toBe(false);
    expect(casalAberto({ cuidado: false, posParto: true, semana: 34 })).toBe(false);
    /* Sem a data, não se sabe a semana: não abre. */
    expect(casalAberto({ cuidado: false, posParto: false, semana: null })).toBe(false);
  });
});
