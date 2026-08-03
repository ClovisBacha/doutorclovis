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
 * · **o arredondamento do desconto anunciado.** Anunciar mais desconto do que
 *   se dá é propaganda enganosa ainda que por centavos, e é um erro de uma
 *   linha só.
 */

import { describe, expect, test } from "bun:test";
import {
  ABATIMENTO_CENTAVOS,
  ANUAL_LISTA_CENTAVOS,
  CUPOM_ID,
  DESCONTO_PCT,
  ECONOMIA_CENTAVOS,
  MENSAL_CENTAVOS,
  PROMO_CENTAVOS,
  PROMO_MENSAL_CENTAVOS,
  REFERENCIA_CENTAVOS,
  brl,
  comDesconto,
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
