/**
 * O número que o dono lê para decidir se repete a campanha. Os casos aqui são
 * os que já enganaram alguém antes: o login do próprio resgate contando como
 * retorno, e a data inválida virando "voltou".
 */

import { describe, expect, test } from "bun:test";
import { MARGEM_VOLTOU_MS, voltouDepoisDoResgate } from "./cupons";

const RESGATE = "2026-07-01T12:00:00.000Z";
const depois = (ms: number) => new Date(new Date(RESGATE).getTime() + ms).toISOString();

describe("voltouDepoisDoResgate", () => {
  test("o login do próprio resgate não conta como retorno", () => {
    expect(voltouDepoisDoResgate(RESGATE, RESGATE)).toBe(false);
    expect(voltouDepoisDoResgate(RESGATE, depois(90_000))).toBe(false);
  });

  test("no mesmo dia ainda não conta — a margem é de 24h", () => {
    expect(voltouDepoisDoResgate(RESGATE, depois(MARGEM_VOLTOU_MS - 1))).toBe(false);
    expect(voltouDepoisDoResgate(RESGATE, depois(MARGEM_VOLTOU_MS))).toBe(false);
  });

  test("um segundo além da margem conta", () => {
    expect(voltouDepoisDoResgate(RESGATE, depois(MARGEM_VOLTOU_MS + 1000))).toBe(true);
  });

  test("voltar semanas depois conta", () => {
    expect(voltouDepoisDoResgate(RESGATE, depois(21 * MARGEM_VOLTOU_MS))).toBe(true);
  });

  test("sem último acesso não conta", () => {
    expect(voltouDepoisDoResgate(RESGATE, null)).toBe(false);
    expect(voltouDepoisDoResgate(RESGATE, undefined)).toBe(false);
    expect(voltouDepoisDoResgate(RESGATE, "")).toBe(false);
  });

  test("data inválida não vira retorno", () => {
    expect(voltouDepoisDoResgate(RESGATE, "ontem")).toBe(false);
    expect(voltouDepoisDoResgate("ontem", depois(30 * MARGEM_VOLTOU_MS))).toBe(false);
  });

  test("último acesso ANTES do resgate não conta (relógio torto)", () => {
    expect(voltouDepoisDoResgate(RESGATE, depois(-30 * MARGEM_VOLTOU_MS))).toBe(false);
  });
});
