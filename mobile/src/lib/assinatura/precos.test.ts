import { describe, expect, test } from "bun:test";
import { PRODUTOS, type Plano } from "~/lib/assinatura/plano";
import {
  duracao,
  economiaDoAnual,
  emOrdem,
  faixaDoAnual,
  formatarComoALoja,
  letraPequena,
  ofertaIntrodutoria,
  planoPadrao,
  porPeriodo,
  precoPorMesDoAnual,
  subDoCartao,
  textoDaOferta,
  textoDoBotao,
  type OfertaIntro,
  type ProdutoDaLoja,
} from "~/lib/assinatura/precos";

/* Os preços de exemplo (sugestão do dono). Nos TESTES pode: a catraca da loja
   proíbe preço escrito à mão só nas telas. */
function produto(
  plano: Plano,
  precoTexto: string,
  preco: number,
  oferta: OfertaIntro | null = null,
) {
  return {
    plano,
    id: PRODUTOS[plano],
    precoTexto,
    preco,
    moeda: "BRL",
    oferta,
  } satisfies ProdutoDaLoja;
}
const ANUAL = produto("anual", "R$ 99,90", 99.9);
const MENSAL = produto("mensal", "R$ 34,90", 34.9);
const VITALICIO = produto("vitalicio", "R$ 249,90", 249.9);
const SETE_DIAS: OfertaIntro = {
  modo: "gratis",
  precoTexto: "",
  periodo: { unidade: "dia", quantidade: 7 },
  repeticoes: 1,
};

describe("a economia do anual", () => {
  test("99,90 por ano contra 12 × 34,90 economiza 76% (arredondado para baixo)", () => {
    expect(economiaDoAnual(ANUAL, MENSAL)).toBe(76);
    expect(faixaDoAnual([ANUAL, MENSAL, VITALICIO])).toBe("ECONOMIZE 76%");
  });

  test("abaixo de 10% não há faixa; exatamente 10% há", () => {
    /* 12 × 10,00 = 120,00: 109,00 economiza 9,17%; 108,00, 10%. */
    const mensal = produto("mensal", "R$ 10,00", 10);
    expect(economiaDoAnual(produto("anual", "R$ 109,00", 109), mensal)).toBeNull();
    expect(economiaDoAnual(produto("anual", "R$ 108,00", 108), mensal)).toBe(10);
  });

  test("sem um dos preços, preço zero, mais caro ou moedas diferentes: sem faixa", () => {
    expect(economiaDoAnual(ANUAL, null)).toBeNull();
    expect(economiaDoAnual({ preco: null, moeda: "BRL" }, MENSAL)).toBeNull();
    expect(economiaDoAnual({ preco: 0, moeda: "BRL" }, MENSAL)).toBeNull();
    expect(economiaDoAnual({ preco: 500, moeda: "BRL" }, MENSAL)).toBeNull();
    expect(economiaDoAnual({ preco: 99.9, moeda: "USD" }, MENSAL)).toBeNull();
    expect(faixaDoAnual([ANUAL, VITALICIO])).toBeNull();
  });
});

describe("o por mês do anual, no formato da loja", () => {
  test("99,90 / 12 = 8,33 (centavos arredondados)", () => {
    expect(precoPorMesDoAnual(ANUAL)).toBe(8.33);
    expect(precoPorMesDoAnual({ preco: null })).toBeNull();
  });

  test("escreve o número com o símbolo, o lugar e os separadores do preço da Apple", () => {
    expect(formatarComoALoja("R$ 99,90", 8.33)).toBe("R$ 8,33");
    expect(formatarComoALoja("R$ 99,90", 8.33)).toBe("R$ 8,33");
    expect(formatarComoALoja("$99.99", 8.33)).toBe("$8.33");
    expect(formatarComoALoja("12,99 €", 1.08)).toBe("1,08 €");
    expect(formatarComoALoja("R$ 1.299,90", 108.33)).toBe("R$ 108,33");
    expect(formatarComoALoja("R$ 1.299,90", 1299.9)).toBe("R$ 1.299,90");
    expect(formatarComoALoja("$1,299.99", 1234.5)).toBe("$1,234.50");
    expect(formatarComoALoja("¥12,000", 1000)).toBe("¥1,000");
  });

  test("sem número no modelo, ou valor estranho: nada", () => {
    expect(formatarComoALoja("Grátis", 1)).toBeNull();
    expect(formatarComoALoja("R$ 99,90", Number.NaN)).toBeNull();
    expect(formatarComoALoja("R$ 99,90", -1)).toBeNull();
  });

  test("o cartão do anual diz quanto equivale por mês", () => {
    expect(subDoCartao(ANUAL)).toBe("Equivale a R$ 8,33 por mês");
    expect(subDoCartao(MENSAL)).toBe("Cobrado todo mês");
    expect(subDoCartao(VITALICIO)).toBe("Pague uma vez, use para sempre");
  });
});

describe("o plano escolhido e o botão", () => {
  test("o anual nasce escolhido; sem ele, o primeiro que veio", () => {
    expect(planoPadrao([VITALICIO, MENSAL, ANUAL])).toBe("anual");
    expect(planoPadrao([VITALICIO, MENSAL])).toBe("mensal");
    expect(planoPadrao([])).toBeNull();
    expect(emOrdem([VITALICIO, ANUAL, MENSAL]).map((p) => p.plano)).toEqual([
      "anual",
      "mensal",
      "vitalicio",
    ]);
  });

  test("o texto do botão por plano", () => {
    expect(textoDoBotao("anual")).toBe("Assinar plano anual");
    expect(textoDoBotao("mensal")).toBe("Assinar plano mensal");
    expect(textoDoBotao("vitalicio")).toBe("Comprar o vitalício");
    expect(porPeriodo("anual")).toBe("por ano");
    expect(porPeriodo("vitalicio")).toBe("uma vez");
  });
});

describe("a letra pequena (visível antes do botão)", () => {
  test("as assinaturas dizem o preço, a renovação automática e como cancelar", () => {
    expect(letraPequena(ANUAL)).toBe(
      "Você paga R$ 99,90 hoje. Renovação anual automática até você cancelar. Cancele quando quiser nos Ajustes do iPhone, até 24 horas antes da renovação.",
    );
    const mensal = letraPequena(MENSAL);
    expect(mensal).toContain("R$ 34,90");
    expect(mensal).toContain("Renovação mensal automática");
    expect(mensal).toContain("Cancele quando quiser");
  });

  test("o vitalício é pagamento único, sem renovação", () => {
    expect(letraPequena(VITALICIO)).toBe(
      "Você paga R$ 249,90 uma vez. Pagamento único, sem renovação.",
    );
  });

  test("com dias grátis: hoje nada, depois o preço, e cancelar antes do fim", () => {
    const comOferta = { ...ANUAL, oferta: SETE_DIAS };
    expect(textoDaOferta(comOferta)).toBe("7 dias grátis, depois R$ 99,90 por ano");
    expect(subDoCartao(comOferta)).toBe("7 dias grátis\nDepois, R$ 99,90 por ano");
    const letra = letraPequena(comOferta);
    expect(letra).toMatch(
      /^Hoje você não paga nada\. Depois de 7 dias grátis, R\$ 99,90 por ano\./,
    );
    expect(letra).toContain("Renovação anual automática");
    expect(letra).toContain("antes do fim do período grátis");
  });

  test("oferta paga por período e adiantada", () => {
    const porMes = {
      ...MENSAL,
      oferta: {
        modo: "por-periodo",
        precoTexto: "R$ 9,90",
        periodo: { unidade: "mes", quantidade: 1 },
        repeticoes: 3,
      } satisfies OfertaIntro,
    };
    expect(textoDaOferta(porMes)).toBe(
      "R$ 9,90 por mês nos primeiros 3 meses, depois R$ 34,90 por mês",
    );
    expect(letraPequena(porMes)).toMatch(
      /^R\$ 9,90 por mês nos primeiros 3 meses.*Renovação mensal automática/,
    );
    const adiantado = {
      ...ANUAL,
      oferta: {
        modo: "adiantado",
        precoTexto: "R$ 49,90",
        periodo: { unidade: "mes", quantidade: 6 },
        repeticoes: 1,
      } satisfies OfertaIntro,
    };
    expect(textoDaOferta(adiantado)).toBe(
      "R$ 49,90 pelos primeiros 6 meses, depois R$ 99,90 por ano",
    );
  });

  test("sem oferta, não inventa nenhuma", () => {
    expect(textoDaOferta(ANUAL)).toBeNull();
    expect(textoDaOferta({ ...VITALICIO, oferta: SETE_DIAS })).toBeNull();
  });
});

describe("a oferta introdutória como o StoreKit a devolve", () => {
  test("7 dias grátis (por dia ou por semana)", () => {
    expect(
      ofertaIntrodutoria({
        subscriptionOffers: [
          {
            type: "introductory",
            paymentMode: "free-trial",
            displayPrice: "R$ 0,00",
            period: { unit: "day", value: 7 },
            periodCount: 1,
          },
        ],
      }),
    ).toEqual(SETE_DIAS);
    const semana = ofertaIntrodutoria({
      subscriptionOffers: [
        { type: "introductory", paymentMode: "free-trial", period: { unit: "week", value: 1 } },
      ],
    });
    expect(semana && duracao(semana.periodo, semana.repeticoes)).toBe("7 dias");
  });

  test("a promocional não é a introdutória; o que não se entende fica de fora", () => {
    expect(
      ofertaIntrodutoria({
        subscriptionOffers: [
          { type: "promotional", paymentMode: "free-trial", period: { unit: "day", value: 7 } },
        ],
      }),
    ).toBeNull();
    expect(
      ofertaIntrodutoria({
        subscriptionOffers: [
          { type: "introductory", paymentMode: "unknown", period: { unit: "day", value: 7 } },
        ],
      }),
    ).toBeNull();
    expect(
      ofertaIntrodutoria({
        subscriptionOffers: [
          {
            type: "introductory",
            paymentMode: "pay-as-you-go",
            period: { unit: "month", value: 1 },
          },
        ],
      }),
    ).toBeNull();
    expect(ofertaIntrodutoria({})).toBeNull();
  });

  test("as durações", () => {
    expect(duracao({ unidade: "dia", quantidade: 1 })).toBe("1 dia");
    expect(duracao({ unidade: "semana", quantidade: 2 })).toBe("14 dias");
    expect(duracao({ unidade: "mes", quantidade: 1 }, 3)).toBe("3 meses");
    expect(duracao({ unidade: "ano", quantidade: 1 })).toBe("1 ano");
  });
});
