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
import { readFileSync } from "node:fs";
import {
  ANUAL_CENTAVOS,
  ANUAL_MENSAL_EQUIV_CENTAVOS,
  DESCONTO_ANUAL_PCT,
  ECONOMIA_ANUAL_CENTAVOS,
  MENSAL_CENTAVOS,
  PRECOS_PREMIUM,
  REFERENCIA_CENTAVOS,
  brl,
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
});

describe("3. o cupom do médico está APOSENTADO — e não deixou promessa na tela", () => {
  /**
   * ─── O QUE ESTE BLOCO PROVAVA ANTES ───────────────────────────────────────
   *
   * Que os 20% do médico fechavam exato em centavos (1990 × 0,8 = 1592;
   * 10990 × 0,8 = 8792), que era o argumento para usar porcentagem no Stripe em
   * vez de valor fixo.
   *
   * O cupom saiu inteiro por decisão do dono: **o médico não dá mais desconto,
   * dá Sementinhas.** O motivo que fecha o assunto é operacional — a paciente
   * compra DENTRO do app iOS/Android, e cupom de Stripe não existe ali. A tela
   * prometia um desconto que a loja não tinha como dar.
   *
   * ─── E POR QUE O BLOCO NÃO FOI SÓ APAGADO ─────────────────────────────────
   *
   * Apagar deixaria o repositório sem nada dizendo que aquilo acabou, e é
   * assim que uma promessa morta volta: alguém acha `mensalComCupom` num
   * componente antigo e "conserta" reintroduzindo a constante. Estes testes
   * cobram a AUSÊNCIA, que é a única forma de a remoção ficar de pé.
   */
  const fonte = readFileSync("src/lib/promo.ts", "utf8");
  const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  test("as constantes do cupom não existem mais", () => {
    for (const morta of [
      "CUPOM_MEDICO_PCT",
      "CUPOM_MEDICO_ID",
      "DESCONTO_ANUAL_COM_CUPOM_PCT",
      "comDesconto",
    ]) {
      expect(codigo).not.toContain(morta);
    }
  });

  test("há DOIS preços, não quatro", () => {
    /* Eram `mensal`, `mensalComCupom`, `anual`, `anualComCupom`. Um preço "com
       desconto" que nada aplica é a promessa morta que fica na tela. */
    expect(Object.keys(PRECOS_PREMIUM).sort()).toEqual(["anual", "mensal"]);
  });

  test("e o motivo está escrito onde quem for mexer vai ler", () => {
    /* Sem o porquê registrado, a próxima pessoa reintroduz o cupom achando que
       foi esquecimento. */
    expect(fonte).toContain("APOSENTADO");
    expect(fonte).toContain("SEMENTINHAS");
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
  /* Os DOIS preços que a paciente pode ver, comparados entre si. É o teste que
     pega uma edição que mexe num e esquece o outro. */
  test("o anual é sempre mais barato que doze mensais", () => {
    expect(ANUAL_CENTAVOS).toBeLessThan(MENSAL_CENTAVOS * 12);
  });

  test("e é ele o melhor negócio do quadro", () => {
    expect(PRECOS_PREMIUM.anual).toBeLessThan(PRECOS_PREMIUM.mensal * 12);
    expect(PRECOS_PREMIUM.anual).toBe(ANUAL_CENTAVOS);
    expect(PRECOS_PREMIUM.mensal).toBe(MENSAL_CENTAVOS);
  });

  test("o desconto anunciado é positivo e menor que o real", () => {
    /* Um desconto de 0% ou negativo significaria que o anual deixou de ser
       vantagem — e a tela continuaria anunciando "plano anual" mesmo assim. */
    expect(DESCONTO_ANUAL_PCT).toBeGreaterThan(0);
    expect(DESCONTO_ANUAL_PCT).toBeLessThanOrEqual(
      (1 - ANUAL_CENTAVOS / REFERENCIA_CENTAVOS) * 100,
    );
  });
});
