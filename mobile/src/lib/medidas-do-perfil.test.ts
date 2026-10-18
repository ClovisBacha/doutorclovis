import { describe, expect, test } from "bun:test";
import { lerAltura, lerPeso, mostrarMedida } from "./medidas-do-perfil";

describe("a altura e o peso de antes da gestação", () => {
  test("a altura em centímetros — e em metros, que é como muita gente escreve", () => {
    expect(lerAltura("165")).toEqual({ ok: true, valor: 165 });
    expect(lerAltura("1,65")).toEqual({ ok: true, valor: 165 });
    expect(lerAltura("1.58")).toEqual({ ok: true, valor: 158 });
    expect(lerAltura("")).toEqual({ ok: true, valor: null });
  });

  test("fora da faixa da curva, recusa em vez de gravar um número que ela não usa", () => {
    expect(lerAltura("16")).toEqual({ ok: false });
    expect(lerAltura("300")).toEqual({ ok: false });
    expect(lerAltura("um e sessenta")).toEqual({ ok: false });
  });

  test("o peso com uma casa, vírgula ou ponto", () => {
    expect(lerPeso("62,5")).toEqual({ ok: true, valor: 62.5 });
    expect(lerPeso("70")).toEqual({ ok: true, valor: 70 });
    expect(lerPeso("58.25")).toEqual({ ok: true, valor: 58.3 });
    expect(lerPeso(" ")).toEqual({ ok: true, valor: null });
    expect(lerPeso("12")).toEqual({ ok: false });
  });

  test("de volta ao campo: vírgula e sem casa à toa", () => {
    expect(mostrarMedida(62.5)).toBe("62,5");
    expect(mostrarMedida("70.0")).toBe("70");
    expect(mostrarMedida(null)).toBe("");
  });
});
