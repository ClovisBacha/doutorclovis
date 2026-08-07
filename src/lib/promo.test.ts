/**
 * OS PREÇOS DA PACIENTE — a conta que a tela promete.
 *
 * ─── O QUE ESTE ARQUIVO PROTEGE ─────────────────────────────────────────────
 *
 * Não é aritmética por esporte. Cada teste aqui guarda uma frase que aparece na
 * tela de uma pessoa que vai pagar, e a lei brasileira cobra que ela seja
 * verdadeira. O defeito que este arquivo existe para impedir não é um número
 * errado — é um número PLAUSÍVEL que promete mais do que a fatura entrega.
 *
 * ─── O CASO QUE MOTIVOU O `floor` ───────────────────────────────────────────
 *
 * O anual passou a custar R$ 109,90 e o desconto real contra pagar mês a mês
 * ficou em 53,98%. A tentação — e o que eu mesmo escrevi antes de fazer a
 * conta — é anunciar **54%**, que é o arredondamento normal:
 *
 *   · anunciando 54%, a promessa é R$ 238,80 × 0,46 = R$ 109,85, e ela paga
 *     R$ 109,90 — CINCO CENTAVOS A MAIS do que o anúncio prometeu;
 *   · anunciando 53%, a promessa é R$ 112,24, e ela paga menos.
 *
 * São cinco centavos e é a diferença entre propaganda verdadeira e enganosa.
 */

import { describe, expect, test } from "bun:test";
import {
  ANUAL_CENTAVOS,
  ANUAL_MENSAL_EQUIV_CENTAVOS,
  CUPOM_MEDICO_ID,
  CUPOM_MEDICO_PCT,
  DESCONTO_ANUAL_COM_CUPOM_PCT,
  DESCONTO_ANUAL_PCT,
  ECONOMIA_ANUAL_CENTAVOS,
  MENSAL_CENTAVOS,
  PRECOS_PREMIUM,
  REFERENCIA_CENTAVOS,
  brl,
  comDesconto,
  descontoPct,
} from "./promo";

describe("1. os preços decididos pelo dono", () => {
  /* Números literais de propósito: um teste escrito sobre a própria constante
     que ele protege passa quando a constante muda. */
  test("mensal é R$ 19,90", () => {
    expect(MENSAL_CENTAVOS).toBe(1_990);
  });

  test("anual é R$ 109,90 — cobrado de uma vez", () => {
    expect(ANUAL_CENTAVOS).toBe(10_990);
  });

  test("o cupom do médico é 20%", () => {
    expect(CUPOM_MEDICO_PCT).toBe(20);
  });

  test("a referência é um ano pagando mês a mês: R$ 238,80", () => {
    /* Precisa ser um preço REAL para poder ser riscado na tela. R$ 19,90 × 12
       é o que ela paga de verdade se escolher o mensal e ficar doze meses. */
    expect(REFERENCIA_CENTAVOS).toBe(23_880);
  });
});

describe("2. o desconto anunciado nunca promete mais do que a fatura dá", () => {
  test("o anual anuncia 53%, e não 54%", () => {
    expect(DESCONTO_ANUAL_PCT).toBe(53);
  });

  test("e a prova de por quê: 54% prometeria menos do que é cobrado", () => {
    /* A asserção que descreve o defeito. Se alguém trocar o `floor` por
       `round`, este teste diz exatamente qual é o dano. */
    const prometidoCom54 = Math.round(REFERENCIA_CENTAVOS * 0.46);
    expect(prometidoCom54).toBe(10_985);
    expect(prometidoCom54).toBeLessThan(ANUAL_CENTAVOS); // ela pagaria MAIS
  });

  test("com 53%, o anunciado é mais caro que o cobrado — a direção segura", () => {
    const prometidoCom53 = Math.round(REFERENCIA_CENTAVOS * 0.47);
    expect(prometidoCom53).toBeGreaterThan(ANUAL_CENTAVOS);
  });

  test("`descontoPct` arredonda SEMPRE para baixo", () => {
    /* 53,98% → 53. Nunca 54. */
    expect(descontoPct(10_990, 23_880)).toBe(53);
    /* E o caso limite: exatamente 50% continua 50, não 49. */
    expect(descontoPct(1_000, 2_000)).toBe(50);
  });

  test("anual + cupom anuncia 63%", () => {
    expect(DESCONTO_ANUAL_COM_CUPOM_PCT).toBe(63);
  });

  test("e o de 63% também é conservador", () => {
    const prometido = Math.round(REFERENCIA_CENTAVOS * 0.37);
    expect(prometido).toBeGreaterThan(PRECOS_PREMIUM.anualComCupom);
  });
});

describe("3. o cupom fecha exato em centavos — por isso é porcentagem no Stripe", () => {
  /**
   * A oferta antiga usava cupom de VALOR FIXO de propósito: os 62% incidiam
   * sobre R$ 238,80 enquanto o Stripe cobrava o Price de R$ 118,80, e uma
   * porcentagem obrigaria o Stripe a arredondar — um centavo de diferença
   * entre a tela e a fatura é uma reclamação.
   *
   * Aqui os 20% incidem sobre o PRÓPRIO preço cobrado, e as duas contas fecham
   * exatas. É o que autoriza usar `ensurePercentCoupon` com um cupom só para os
   * dois planos.
   */
  test("mensal com cupom: R$ 15,92, sem fração de centavo", () => {
    expect(PRECOS_PREMIUM.mensalComCupom).toBe(1_592);
    expect((MENSAL_CENTAVOS * 80) % 100).toBe(0);
  });

  test("anual com cupom: R$ 87,92, sem fração de centavo", () => {
    expect(PRECOS_PREMIUM.anualComCupom).toBe(8_792);
    expect((ANUAL_CENTAVOS * 80) % 100).toBe(0);
  });

  test("o id do cupom carrega a porcentagem", () => {
    /* Sem isso, mudar `CUPOM_MEDICO_PCT` faria o Stripe reaproveitar o cupom
       ANTIGO — a tela prometeria um desconto que a fatura não daria. */
    expect(CUPOM_MEDICO_ID).toContain(String(CUPOM_MEDICO_PCT));
  });
});

describe("4. o equivalente mensal é comparação, nunca preço", () => {
  test("R$ 109,90 / 12 = R$ 9,16", () => {
    expect(ANUAL_MENSAL_EQUIV_CENTAVOS).toBe(916);
  });

  test('por isso a tela diz "equivale a" e nunca "12×"', () => {
    /* 9,16 × 12 = 109,92, dois centavos ACIMA do cobrado. Quem fizer a conta
       encontra o texto certo em vez de uma diferença inexplicada. */
    expect(ANUAL_MENSAL_EQUIV_CENTAVOS * 12).not.toBe(ANUAL_CENTAVOS);
    expect(ANUAL_MENSAL_EQUIV_CENTAVOS * 12).toBe(10_992);
  });

  test("a economia do anual é R$ 128,90", () => {
    expect(ECONOMIA_ANUAL_CENTAVOS).toBe(12_890);
    expect(ECONOMIA_ANUAL_CENTAVOS).toBe(REFERENCIA_CENTAVOS - ANUAL_CENTAVOS);
  });
});

describe("5. `comDesconto` arredonda uma vez, no fim, em centavos", () => {
  test("20% de R$ 19,90 = R$ 15,92", () => {
    expect(comDesconto(1_990, 20)).toBe(1_592);
  });

  test("desconto de 0% não muda nada", () => {
    expect(comDesconto(10_990, 0)).toBe(10_990);
  });

  test("desconto de 100% zera", () => {
    expect(comDesconto(10_990, 100)).toBe(0);
  });

  test("nunca devolve fração de centavo", () => {
    for (const pct of [7, 13, 17, 33, 67]) {
      expect(Number.isInteger(comDesconto(10_990, pct))).toBe(true);
    }
  });
});

describe("6. `brl` formata em português", () => {
  test("centavos viram vírgula", () => {
    expect(brl(10_990)).toBe("R$ 109,90");
    expect(brl(1_990)).toBe("R$ 19,90");
    expect(brl(916)).toBe("R$ 9,16");
  });

  test("zero não vira vazio", () => {
    expect(brl(0)).toBe("R$ 0,00");
  });
});

describe("7. a escada de preços é coerente", () => {
  /* Os quatro preços que a paciente pode ver, comparados entre si. É o teste
     que pega uma edição que mexe num e esquece o outro. */
  test("o anual é sempre mais barato que doze mensais", () => {
    expect(ANUAL_CENTAVOS).toBeLessThan(MENSAL_CENTAVOS * 12);
  });

  test("o cupom sempre desconta, nunca aumenta", () => {
    expect(PRECOS_PREMIUM.mensalComCupom).toBeLessThan(PRECOS_PREMIUM.mensal);
    expect(PRECOS_PREMIUM.anualComCupom).toBeLessThan(PRECOS_PREMIUM.anual);
  });

  test("o anual com cupom continua sendo o melhor negócio do quadro", () => {
    expect(PRECOS_PREMIUM.anualComCupom).toBeLessThan(PRECOS_PREMIUM.mensalComCupom * 12);
  });

  test("e o desconto com cupom é maior que o sem", () => {
    expect(DESCONTO_ANUAL_COM_CUPOM_PCT).toBeGreaterThan(DESCONTO_ANUAL_PCT);
  });
});
