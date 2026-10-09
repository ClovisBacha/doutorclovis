import { describe, expect, test } from "bun:test";
import { mesclarBlob, mesclarValor } from "./sincronia";

describe("a régua de mescla (a mesma de mergeJourneyValue do site)", () => {
  test("listas de progresso: união ordenada", () => {
    expect(mesclarValor("dc-path-done-days", [171, 160], [165, 160])).toEqual([160, 165, 171]);
    expect(mesclarValor("dc-path-stickers", [24], [22])).toEqual([22, 24]);
    expect(mesclarValor("dc-path-pos-done-days", [9], [8])).toEqual([8, 9]);
  });

  test("lista corrompida de um lado: a nuvem vence", () => {
    expect(mesclarValor("dc-path-done-days", "lixo", [1])).toEqual([1]);
  });

  test("o dia: OU das flags — uma vez feito, feito", () => {
    expect(
      mesclarValor("dc-path-day-171", { w_movement: true, w_bonding: false }, { desafio: true }),
    ).toEqual({ desafio: true, w_movement: true });
    expect(mesclarValor("dc-path-pos-day-9", { desafio: true }, {})).toEqual({ desafio: true });
  });

  test("notas das lições: a maior vence", () => {
    expect(mesclarValor("dc-path-lessons", { "3": 80, "4": 10 }, { "3": 60, "4": 90 })).toEqual({
      "3": 80,
      "4": 90,
    });
  });

  test("o resto é estado mutável: a nuvem vence", () => {
    expect(mesclarValor("dc-path-decor", { a: 1 }, { b: 2 })).toEqual({ b: 2 });
    expect(mesclarValor("dc-path-med-log", { minutos: 9 }, { minutos: 4 })).toEqual({ minutos: 4 });
  });
});

describe("mesclar o blob inteiro", () => {
  test("chave só local fica, e avisa que é preciso empurrar", () => {
    const r = mesclarBlob({ "dc-path-day-171": { w_gratitude: true } }, { "dc-path-decor": "x" });
    expect(r.blob).toEqual({ "dc-path-day-171": { w_gratitude: true }, "dc-path-decor": "x" });
    expect(r.localTinhaExtra).toBe(true);
  });

  test("local igual à nuvem: nada a empurrar", () => {
    const n = { "dc-path-done-days": [1, 2], "dc-path-day-2": { desafio: true } };
    const r = mesclarBlob({ "dc-path-done-days": [2, 1] }, n);
    expect(r.blob).toEqual(n);
    expect(r.localTinhaExtra).toBe(false);
  });

  test("um aparelho novo (local vazio) recebe a jornada da nuvem inteira", () => {
    const n = { "dc-path-done-days": [160], "dc-path-skin": "nuvem", "dc-path-day-160": { desafio: true } };
    const r = mesclarBlob({}, n);
    expect(r.blob).toEqual(n);
    expect(r.localTinhaExtra).toBe(false);
  });

  test("chave fora do prefixo dc-path- nunca entra", () => {
    const r = mesclarBlob({ outra: 1 }, { "dc-path-x": 1, lixo: 2 });
    expect(r.blob).toEqual({ "dc-path-x": 1 });
  });
});
