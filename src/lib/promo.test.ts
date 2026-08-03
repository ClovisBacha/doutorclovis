/**
 * Preço é a parte do app que a paciente confere com o extrato do cartão, e
 * este arquivo calcula um preço COM DESCONTO — a conta mais fácil de errar por
 * um centavo e a mais cara de errar.
 *
 * Dois grupos importam mais que os outros:
 *
 * · **o abatimento do Stripe.** A tela promete R$ 93,13 e o Stripe cobra o
 *   Price do anual menos o cupom. Se as duas contas divergirem, a fatura não
 *   bate com a tela — e é a paciente que descobre, depois de pagar.
 * · **a janela.** "Depois que passar, passou" foi promessa explícita. Uma
 *   janela que reabre é o contador falso que estes testes existem para
 *   impedir.
 */

import { describe, expect, test } from "bun:test";
import {
  ABATIMENTO_CENTAVOS,
  ANUAL_LISTA_CENTAVOS,
  CUPOM_ID,
  DESCONTO_PCT,
  ECONOMIA_CENTAVOS,
  JANELA_MS,
  MENSAL_CENTAVOS,
  PROMO_CENTAVOS,
  PROMO_MENSAL_CENTAVOS,
  REFERENCIA_CENTAVOS,
  brl,
  comDesconto,
  estaAberta,
  formataRestante,
  restanteMs,
} from "./promo";

describe("a base do desconto é pagar mês a mês por um ano", () => {
  test("R$ 19,90 × 12 = R$ 238,80", () => {
    expect(MENSAL_CENTAVOS).toBe(1990);
    expect(REFERENCIA_CENTAVOS).toBe(23880);
    expect(brl(REFERENCIA_CENTAVOS)).toBe("R$ 238,80");
  });

  test("o primeiro ano sai por R$ 89,90", () => {
    expect(PROMO_CENTAVOS).toBe(8990);
    expect(brl(PROMO_CENTAVOS)).toBe("R$ 89,90");
  });

  test("o equivalente mensal é R$ 7,49 — e a tela nunca promete que ×12 fecha", () => {
    expect(brl(PROMO_MENSAL_CENTAVOS)).toBe("R$ 7,49");
    /* 7,49 × 12 = 89,88, dois centavos abaixo do cobrado. É por isso que o
       texto diz "equivale a" e não "R$ 7,49 × 12". */
    expect(PROMO_MENSAL_CENTAVOS * 12).not.toBe(PROMO_CENTAVOS);
    expect(PROMO_MENSAL_CENTAVOS * 12).toBeLessThan(PROMO_CENTAVOS);
  });

  /* A invariante que mais protege o negócio: nunca anunciar mais desconto do
     que se dá. O real é 62,35%; anunciamos 62%. */
  test("o desconto ANUNCIADO nunca é maior que o dado", () => {
    const pagariaComOAnunciado = comDesconto(REFERENCIA_CENTAVOS, DESCONTO_PCT);
    expect(PROMO_CENTAVOS).toBeLessThanOrEqual(pagariaComOAnunciado);
  });

  test("a economia fecha com a referência — sem centavo sumindo", () => {
    expect(PROMO_CENTAVOS + ECONOMIA_CENTAVOS).toBe(REFERENCIA_CENTAVOS);
    expect(brl(ECONOMIA_CENTAVOS)).toBe("R$ 148,90");
  });

  test("o preço riscado é um preço REAL, não inflado", () => {
    /* R$ 238,80 é o que ela paga de verdade escolhendo o plano mensal e
       ficando doze meses. É isso que permite riscá-lo — com a legenda. */
    expect(REFERENCIA_CENTAVOS).toBe(MENSAL_CENTAVOS * 12);
  });
});

describe("o que o Stripe vai cobrar", () => {
  test("o abatimento leva o preço de lista a exatamente o preço da tela", () => {
    expect(ANUAL_LISTA_CENTAVOS - ABATIMENTO_CENTAVOS).toBe(PROMO_CENTAVOS);
    expect(brl(ABATIMENTO_CENTAVOS)).toBe("R$ 28,90");
  });

  test("valor fixo, não porcentagem — não há arredondamento no meio", () => {
    /* Com valor fixo em centavos inteiros, tela e fatura são o mesmo número
       por construção; com porcentagem, quem arredondaria seria o Stripe. */
    expect(Number.isInteger(ABATIMENTO_CENTAVOS)).toBe(true);
  });

  test("o id do cupom carrega o preço — preço novo, cupom novo", () => {
    /* Cupom no Stripe é IMUTÁVEL. Sem o preço no id, mexer no valor aqui
       continuaria aplicando o cupom antigo em silêncio, e isso só apareceria
       na fatura de alguém. */
    expect(CUPOM_ID).toContain(String(PROMO_CENTAVOS));
  });

  test("a promoção nunca sai mais cara que o preço de lista", () => {
    expect(PROMO_CENTAVOS).toBeLessThan(ANUAL_LISTA_CENTAVOS);
    expect(ABATIMENTO_CENTAVOS).toBeGreaterThan(0);
  });

  test("a renovação volta ao preço de lista, e ele é menor que a referência", () => {
    /* Se a lista fosse maior que a referência, a tela estaria dizendo que
       pagar anual é pior que pagar mensal. */
    expect(ANUAL_LISTA_CENTAVOS).toBeLessThan(REFERENCIA_CENTAVOS);
    expect(brl(ANUAL_LISTA_CENTAVOS)).toBe("R$ 118,80");
  });
});

describe("a conta do desconto", () => {
  test("0% e 100% são os extremos coerentes", () => {
    expect(comDesconto(REFERENCIA_CENTAVOS, 0)).toBe(REFERENCIA_CENTAVOS);
    expect(comDesconto(REFERENCIA_CENTAVOS, 100)).toBe(0);
  });

  test("o resultado é sempre centavo inteiro e nunca passa do original", () => {
    for (const c of [23880, 11880, 1990, 9999, 3, 1]) {
      expect(Number.isInteger(comDesconto(c, DESCONTO_PCT))).toBe(true);
      expect(comDesconto(c, DESCONTO_PCT)).toBeLessThanOrEqual(c);
    }
  });

  test("o desconto anunciado é 62, arredondado para baixo", () => {
    expect(DESCONTO_PCT).toBe(62);
    /* O real é 62,35% — arredondar para cima daria 62 também aqui, mas a
       regra é `floor` e o teste guarda a regra, não a coincidência. */
    expect(DESCONTO_PCT).toBeLessThanOrEqual((1 - PROMO_CENTAVOS / REFERENCIA_CENTAVOS) * 100);
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

  test("uma vez fechada, NUNCA reabre", () => {
    for (const depois of [1, 60_000, 86_400_000, 365 * 86_400_000]) {
      expect(estaAberta(T0, T0 + JANELA_MS + depois)).toBe(false);
      expect(restanteMs(T0, T0 + JANELA_MS + depois)).toBe(0);
    }
  });

  test("relógio adiantado não estende — só encurta", () => {
    expect(restanteMs(T0, T0 + 3_600_000)).toBeLessThan(JANELA_MS);
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
