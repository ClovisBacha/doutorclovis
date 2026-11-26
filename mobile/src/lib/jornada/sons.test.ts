import { describe, expect, test } from "bun:test";
import { ROTULO_DO_SOM, type SomKey } from "@/lib/som-receitas";
import { LEGENDA_DO_SOM_NO_APP, ROTULO_DO_SOM_NO_APP } from "~/lib/jornada/sons";

describe("os rótulos dos sons no app", () => {
  test("as trocadas ainda são, no site, a legenda que foi trocada", () => {
    for (const [k, t] of Object.entries(LEGENDA_DO_SOM_NO_APP))
      expect(ROTULO_DO_SOM[k as SomKey].sub).toBe(t!.site);
  });

  test("nenhuma legenda acalma recém-nascido, dá gênero ao bebê ou cita o batimento do pré-natal", () => {
    for (const r of Object.values(ROTULO_DO_SOM_NO_APP))
      expect(r.sub).not.toMatch(/recém-nascid|\b(ele|ela)\b|por minuto|doppler/i);
    expect(Object.keys(ROTULO_DO_SOM_NO_APP).sort()).toEqual(Object.keys(ROTULO_DO_SOM).sort());
  });
});
