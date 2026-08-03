/**
 * Preço é a parte do app que a paciente confere com o extrato do cartão, e
 * este arquivo calcula um preço COM DESCONTO — a conta mais fácil de errar por
 * um centavo e a mais cara de errar.
 *
 * O segundo grupo de testes é sobre a promessa: "depois que passar, passou".
 * Uma janela que reabre é o contador falso que estes testes existem para
 * impedir.
 */

import { describe, expect, test } from "bun:test";
import {
  ANUAL_CENTAVOS,
  DESCONTO_PCT,
  JANELA_MS,
  brl,
  comDesconto,
  economia,
  estaAberta,
  formataRestante,
  restanteMs,
} from "./promo";

describe("a conta do desconto", () => {
  test("61% sobre o anual dá R$ 46,33", () => {
    expect(comDesconto(ANUAL_CENTAVOS)).toBe(4633);
    expect(brl(comDesconto(ANUAL_CENTAVOS))).toBe("R$ 46,33");
  });

  test("a economia fecha com o preço cheio — sem centavo sumindo", () => {
    expect(comDesconto(ANUAL_CENTAVOS) + economia(ANUAL_CENTAVOS)).toBe(ANUAL_CENTAVOS);
    expect(brl(economia(ANUAL_CENTAVOS))).toBe("R$ 72,47");
  });

  test("o preço cheio é R$ 118,80 (9,90 × 12)", () => {
    expect(ANUAL_CENTAVOS).toBe(990 * 12);
    expect(brl(ANUAL_CENTAVOS)).toBe("R$ 118,80");
  });

  test("desconto de 0% e de 100% são os extremos coerentes", () => {
    expect(comDesconto(ANUAL_CENTAVOS, 0)).toBe(ANUAL_CENTAVOS);
    expect(comDesconto(ANUAL_CENTAVOS, 100)).toBe(0);
  });

  test("o resultado é sempre centavo inteiro", () => {
    for (const c of [11880, 1990, 9999, 3, 1]) {
      expect(Number.isInteger(comDesconto(c))).toBe(true);
      expect(Number.isInteger(economia(c))).toBe(true);
    }
  });

  test("nunca cobra mais que o preço cheio", () => {
    for (const c of [11880, 1990, 9999, 1]) expect(comDesconto(c)).toBeLessThanOrEqual(c);
  });

  test("o desconto anunciado é o que o Stripe vai aplicar", () => {
    /* O Stripe calcula `percent_off` sobre o total da fatura, em centavos.
       Se as duas contas divergirem, a tela mente sobre a fatura. */
    const stripe = ANUAL_CENTAVOS - Math.round((ANUAL_CENTAVOS * DESCONTO_PCT) / 100);
    expect(comDesconto(ANUAL_CENTAVOS)).toBe(stripe);
  });
});

describe("a janela dos 2h59", () => {
  const T0 = 1_700_000_000_000;

  test("dura exatamente 2h59", () => {
    expect(JANELA_MS).toBe(10_740_000);
    expect(formataRestante(JANELA_MS)).toBe("2:59:00");
  });

  test("aberta no começo, fechada no fim", () => {
    expect(estaAberta(T0, T0)).toBe(true);
    expect(estaAberta(T0, T0 + JANELA_MS - 1)).toBe(true);
    expect(estaAberta(T0, T0 + JANELA_MS)).toBe(false);
  });

  /* A promessa que o Clóvis fez: "depois que passar, passou". */
  test("uma vez fechada, NUNCA reabre", () => {
    for (const depois of [1, 60_000, 86_400_000, 365 * 86_400_000]) {
      expect(estaAberta(T0, T0 + JANELA_MS + depois)).toBe(false);
      expect(restanteMs(T0, T0 + JANELA_MS + depois)).toBe(0);
    }
  });

  test("relógio adiantado não estende — só encurta", () => {
    /* Se o aparelho dela estiver adiantado, ela vê MENOS tempo, nunca mais.
       (O tempo autoritativo é o do servidor; isto trava a direção do erro.) */
    expect(restanteMs(T0, T0 + 3_600_000)).toBeLessThan(JANELA_MS);
  });

  test("relógio atrasado não passa do teto da janela", () => {
    expect(restanteMs(T0, T0 - 999_999)).toBeLessThanOrEqual(JANELA_MS + 999_999);
    expect(restanteMs(T0, T0)).toBe(JANELA_MS);
  });

  test("data inválida fecha a janela em vez de abrir para sempre", () => {
    expect(estaAberta(NaN, T0)).toBe(false);
    expect(estaAberta(T0, NaN)).toBe(false);
    expect(restanteMs(NaN, NaN)).toBe(0);
  });
});

describe("o contador não dança na tela", () => {
  test("minutos e segundos sempre com dois dígitos", () => {
    expect(formataRestante(3_600_000)).toBe("1:00:00");
    expect(formataRestante(61_000)).toBe("0:01:01");
    expect(formataRestante(9_000)).toBe("0:00:09");
  });

  test("zero e negativo mostram zero, não texto quebrado", () => {
    expect(formataRestante(0)).toBe("0:00:00");
    expect(formataRestante(-5000)).toBe("0:00:00");
  });
});
