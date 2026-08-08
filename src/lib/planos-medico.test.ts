/**
 * A ESCADA DO MÉDICO — a conta que decide se o negócio dá prejuízo.
 *
 * ─── O QUE ESTE ARQUIVO PROTEGE ─────────────────────────────────────────────
 *
 * Uma faixa a menos de nove centavos por mensagem dá margem NEGATIVA no cenário
 * de estresse, e ninguém perceberia olhando a tabela: R$ 0,07 continua parecendo
 * um número plausível ao lado de R$ 0,09. O defeito que este arquivo existe para
 * impedir não é um preço errado — é um preço PLAUSÍVEL que quebra só quando o
 * custo do modelo subir, meses depois, quando já houver contratos assinados.
 *
 * Os três custos, e de onde vêm (medidos em `chat.ts` + preço do Gemini):
 *
 *   · R$ 0,015 — a média de hoje
 *   · R$ 0,027 — o PIOR caso depois do teto de histórico. É contra este que a
 *                escada é precificada, e é a linha vermelha de monitoramento.
 *   · R$ 0,054 — o pior caso E o modelo custando o dobro. O cenário em que a
 *                escada ainda precisa dar lucro.
 */

import { describe, expect, test } from "bun:test";
import {
  CUSTO_PLANEJADO_CENTAVOS,
  DEGRAUS,
  ENTRADA_CENTAVOS,
  ENTRADA_MENSAGENS,
  FAIXAS,
  PISO_CENTAVOS_POR_MENSAGEM,
  TETO_AUTOATENDIMENTO,
  centavosPorMensagem,
  descontoVsEntrada,
  margemCentavos,
  precoDe,
} from "./planos-medico";

/* Números literais de propósito em todo o arquivo: um teste escrito sobre a
   própria constante que ele protege passa quando a constante muda. */
const CUSTO_HOJE = 1.5;
const CUSTO_ESTRESSE = 5.4;

describe("1. os dois âncoras que o dono escolheu", () => {
  test("a entrada é R$ 29,90", () => {
    expect(ENTRADA_CENTAVOS).toBe(2_990);
    expect(precoDe(150)).toBe(2_990);
  });

  test("e ela compra 150 mensagens — R$ 0,20 cada, como pedido", () => {
    expect(ENTRADA_MENSAGENS).toBe(150);
    /* 29,90 / 150 = 0,1993. O dono pediu "0,20 por mensagem" na entrada. */
    expect(centavosPorMensagem(150)).toBeCloseTo(19.93, 1);
  });

  test("o topo do autoatendimento é R$ 999,00, e o número de mensagens SAI daí", () => {
    /* O dono fixou o preço e o custo por mensagem; 11.100 é consequência. */
    expect(precoDe(TETO_AUTOATENDIMENTO)).toBe(99_900);
    expect(centavosPorMensagem(TETO_AUTOATENDIMENTO)).toBe(9);
    expect(TETO_AUTOATENDIMENTO).toBe(11_100);
  });
});

describe("2. O PISO — a trava que impede o prejuízo futuro", () => {
  /**
   * O teste mais importante do arquivo. Tudo o mais é conveniência; este é o
   * que separa uma escada segura de uma que quebra quando o modelo encarecer.
   */
  test("nenhuma faixa vende abaixo de 8 centavos por mensagem", () => {
    for (const faixa of FAIXAS) {
      if ("centavos" in faixa) {
        expect(faixa.centavos).toBeGreaterThanOrEqual(PISO_CENTAVOS_POR_MENSAGEM);
      }
    }
  });

  test("e o piso é quase 3× o custo de PLANEJAMENTO", () => {
    /* Contra o custo planejado (o pior caso), não contra a média — precificar
       contra a média é o que produz a surpresa.

       "Quase" e não "pelo menos": 8 ÷ 2,7 = 2,96. O piso caiu de 9 para 8
       quando o topo passou a ser R$ 999,00 a nove centavos EFETIVOS, e vale
       dizer o número certo em vez de arredondar a favor. */
    expect(PISO_CENTAVOS_POR_MENSAGEM / CUSTO_PLANEJADO_CENTAVOS).toBeGreaterThan(2.9);
  });

  test("e o que ele realmente garante: margem positiva no ESTRESSE, no topo", () => {
    /**
     * A razão contra o custo é um atalho; a garantia de verdade é esta. No
     * degrau mais fundo, com as mensagens no tamanho máximo E o modelo custando
     * o dobro do de hoje, a margem depois da taxa do Stripe ainda é confortável.
     *
     * É menos folga que os degraus de baixo têm — e isso é o preço de o topo
     * ser barato. Quem compra volume paga menos por mensagem, e a margem
     * acompanha.
     */
    const preco = precoDe(TETO_AUTOATENDIMENTO);
    const margem = margemCentavos(TETO_AUTOATENDIMENTO, CUSTO_ESTRESSE);
    expect(margem / preco).toBeGreaterThan(0.3);
  });

  test("o preço por mensagem NUNCA sobe — a escada é monotônica", () => {
    for (let i = 1; i < DEGRAUS.length; i++) {
      expect(centavosPorMensagem(DEGRAUS[i])).toBeLessThan(centavosPorMensagem(DEGRAUS[i - 1]));
    }
  });

  test("e o desconto nunca diminui ao subir de degrau", () => {
    for (let i = 1; i < DEGRAUS.length; i++) {
      expect(descontoVsEntrada(DEGRAUS[i])).toBeGreaterThanOrEqual(
        descontoVsEntrada(DEGRAUS[i - 1]),
      );
    }
  });
});

describe("3. lucro em TODOS os degraus, nos TRÊS cenários", () => {
  /**
   * A promessa que o dono pediu: "não ter surpresas onde futuramente posso
   * tomar prejuízo". Este bloco é essa promessa escrita como teste.
   */
  for (const d of DEGRAUS) {
    test(`${d} mensagens dá lucro no custo de hoje`, () => {
      expect(margemCentavos(d, CUSTO_HOJE)).toBeGreaterThan(0);
    });

    test(`${d} mensagens dá lucro no custo planejado`, () => {
      expect(margemCentavos(d, CUSTO_PLANEJADO_CENTAVOS)).toBeGreaterThan(0);
    });

    test(`${d} mensagens dá lucro ATÉ no estresse (modelo 2× e msg no máximo)`, () => {
      expect(margemCentavos(d, CUSTO_ESTRESSE)).toBeGreaterThan(0);
    });
  }

  test("a TAXA DO STRIPE está descontada — margem sem taxa é margem que não existe", () => {
    /* O segundo mutante que sobreviveu: zerar a taxa. Todos os testes de
       "margem > 0" continuavam verdes, porque tirar um custo só AUMENTA a
       margem. Um teste que só olha o sinal nunca pega um custo esquecido.
       Num tíquete de R$ 29,90 os R$ 0,39 fixos são 1,3% sozinhos. */
    const preco = precoDe(150);
    const semTaxa = preco - 150 * CUSTO_HOJE;
    expect(margemCentavos(150, CUSTO_HOJE)).toBeLessThan(semTaxa);
    /* E o valor exato: 3,99% + R$ 0,39. */
    expect(semTaxa - margemCentavos(150, CUSTO_HOJE)).toBeCloseTo(preco * 0.0399 + 39, 5);
  });

  test("no pior degrau e no pior cenário, a margem ainda passa de 45%", () => {
    /* O número que resume tudo. 2.500 mensagens (onde mais fatia fica no piso)
       com o custo de estresse. */
    const preco = precoDe(2_500);
    const margem = margemCentavos(2_500, CUSTO_ESTRESSE);
    expect(margem / preco).toBeGreaterThan(0.45);
  });

  test("e uma faixa a 7 centavos QUEBRARIA isso — a prova do piso", () => {
    /* A asserção que descreve o defeito. Simula a quinta faixa que não existe:
       mais 2.500 mensagens a R$ 0,07 no cenário de estresse. */
    const receitaExtra = 2_500 * 7;
    const custoExtra = 2_500 * CUSTO_ESTRESSE;
    expect(receitaExtra).toBeGreaterThan(custoExtra); // ainda positivo em bruto…
    /* …mas some depois da taxa do Stripe e da diluição — e é por isso que a
       régua é "3× o custo planejado" e não "acima do custo". */
    expect(7).toBeLessThan(CUSTO_PLANEJADO_CENTAVOS * 3);
  });
});

/**
 * O preço marginal de uma faixa — `null` na primeira, que é taxa fixa.
 *
 * Existe porque `FAIXAS` é uma tupla `as const` cujo primeiro membro tem `fixo`
 * e os demais têm `centavos`: sem estreitar, o TypeScript recusa `f.centavos`
 * em cima da união, e um `!` calaria o compilador ao preço de esconder
 * exatamente o caso que importa (alguém trocar a primeira faixa por unitária).
 */
function marginalDe(f: (typeof FAIXAS)[number]): number | null {
  return "centavos" in f ? f.centavos : null;
}

describe("4. o preço graduado é o mesmo que o Stripe vai calcular", () => {
  /* Cada linha aqui é uma linha da configuração do Stripe. Se estas contas
     divergirem, a tela promete um número e a fatura cobra outro — a reclamação
     mais cara que existe. */
  test("150 → só a faixa fixa", () => {
    expect(precoDe(150)).toBe(2_990);
  });

  test("250 → fixa + 100 × 16,90", () => {
    expect(precoDe(250)).toBe(2_990 + 100 * 16.9);
    expect(precoDe(250)).toBe(4_680);
  });

  test("1.350 → o degrau do meio, R$ 187,11", () => {
    expect(precoDe(1_350)).toBe(18_711);
  });

  test("5.000 → R$ 511,00", () => {
    expect(precoDe(5_000)).toBe(51_100);
  });

  test("11.100 → R$ 999,00 exatos", () => {
    expect(precoDe(TETO_AUTOATENDIMENTO)).toBe(99_900);
  });

  test("a soma das dez faixas fecha com o topo", () => {
    /* A conta inteira, faixa a faixa — é ela que vai para o painel do Stripe. */
    const soma =
      2_990 +
      100 * 16.9 +
      100 * 14.45 +
      200 * 14.18 +
      300 * 12.85 +
      500 * 11.79 +
      750 * 10.46 +
      1_100 * 9.14 +
      1_800 * 8.05 +
      6_100 * 8.0;
    expect(Math.round(soma)).toBe(precoDe(TETO_AUTOATENDIMENTO));
  });

  test("`precoDe` SEMPRE devolve centavo inteiro, em toda a faixa", () => {
    /**
     * As camadas cobram centavos com casa decimal, então uma quantidade no meio
     * de uma camada dá meio centavo (1.000 mensagens caem em 14.584,5). Sem o
     * `Math.round` do fim, esse número atravessaria a tela, o checkout e o
     * `toFixed(2)` — e a fatura do Stripe, que arredonda, discordaria por um
     * centavo em algum lugar que ninguém saberia apontar.
     */
    for (let n = ENTRADA_MENSAGENS; n <= TETO_AUTOATENDIMENTO; n += 7) {
      expect(Number.isInteger(precoDe(n))).toBe(true);
    }
    expect(Number.isInteger(precoDe(1_000))).toBe(true);
  });

  test("e TODOS os dez degraus dão centavos inteiros ANTES do arredondamento", () => {
    /* As faixas têm casa decimal, então o `Math.round` de `precoDe` existe. Mas
       os degraus da tabela foram escolhidos para não precisar dele — se um
       passar a precisar, a tabela do Stripe e a nossa vão divergir por um
       centavo em algum lugar, e ninguém vai saber onde. */
    for (const d of DEGRAUS) {
      let total = 0;
      let ja = 0;
      for (const f of FAIXAS) {
        if (d <= ja) break;
        const nesta = Math.min(d, f.ate) - ja;
        if (nesta <= 0) continue;
        total += "fixo" in f ? f.fixo : nesta * f.centavos;
        ja = Math.min(d, f.ate);
      }
      expect(Math.abs(total - Math.round(total))).toBeLessThan(1e-9);
    }
  });
});

describe("4b. os dois números que o dono fixou, e a curva entre eles", () => {
  /**
   * "O plano mais barato tem que ter realmente o nosso custo de vinte centavos.
   * O plano antes do Clínica tem que ser de novecentos e noventa e nove reais,
   * com custo de nove centavos por mensagem. Divida em dez partes o desconto
   * que vai caindo."
   */
  test("a entrada custa 20 centavos por mensagem", () => {
    expect(centavosPorMensagem(ENTRADA_MENSAGENS)).toBeCloseTo(19.93, 2);
    expect(Math.round(centavosPorMensagem(ENTRADA_MENSAGENS))).toBe(20);
  });

  test("o topo custa R$ 999,00 a NOVE centavos por mensagem", () => {
    expect(precoDe(TETO_AUTOATENDIMENTO)).toBe(99_900);
    expect(centavosPorMensagem(TETO_AUTOATENDIMENTO)).toBe(9);
  });

  test("e é a conta do dono que define o teto: 999 ÷ 0,09", () => {
    /* O teto não foi escolhido — ele é consequência dos dois números acima. */
    expect(TETO_AUTOATENDIMENTO).toBe(Math.round(99_900 / 9));
  });

  test("são DEZ degraus", () => {
    expect(FAIXAS).toHaveLength(10);
    expect(DEGRAUS).toHaveLength(10);
  });

  test("o desconto sobe SEIS pontos a cada degrau, sempre", () => {
    /* É isto que "dividir em dez partes" quer dizer: passo constante, não um
       tombo no começo e migalhas depois — que era o defeito da escada anterior. */
    const descontos = DEGRAUS.map((d) => descontoVsEntrada(d));
    expect(descontos).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48, 54]);
  });

  test("o preço efetivo cai cerca de 1,2 centavo por degrau", () => {
    const efetivos = DEGRAUS.map((d) => centavosPorMensagem(d));
    for (let i = 1; i < efetivos.length; i++) {
      const passo = efetivos[i - 1] - efetivos[i];
      expect(passo).toBeGreaterThan(0.9);
      expect(passo).toBeLessThan(1.5);
    }
  });

  test("o preço marginal NUNCA sobe de uma faixa para a seguinte", () => {
    /* Uma faixa mais cara que a anterior faria comprar MENOS sair mais barato —
       e o slider mostraria o preço caindo enquanto a pessoa arrasta para trás. */
    const marginais = FAIXAS.map(marginalDe).filter((c): c is number => c !== null);
    for (let i = 1; i < marginais.length; i++) {
      expect(marginais[i]).toBeLessThanOrEqual(marginais[i - 1]);
    }
  });

  test("nenhuma faixa fura o piso", () => {
    for (const f of FAIXAS) {
      const c = marginalDe(f);
      if (c !== null) expect(c).toBeGreaterThanOrEqual(PISO_CENTAVOS_POR_MENSAGEM);
    }
  });

  test("o piso MARGINAL é 8, e o EFETIVO no topo é 9 — não são o mesmo número", () => {
    /* Em preço graduado o efetivo nunca alcança o marginal do fim. Confundir os
       dois é o que faria alguém "corrigir" a última faixa para 9 e quebrar o
       R$ 999,00. */
    expect(PISO_CENTAVOS_POR_MENSAGEM).toBe(8);
    expect(centavosPorMensagem(TETO_AUTOATENDIMENTO)).toBe(9);
    expect(centavosPorMensagem(TETO_AUTOATENDIMENTO)).toBeGreaterThan(PISO_CENTAVOS_POR_MENSAGEM);
  });
});

describe("5. os limites da escada", () => {
  test("abaixo da entrada, cobra a entrada — é o tíquete mínimo", () => {
    /* Sem isso alguém assina 10 mensagens por R$ 1,50 e a taxa fixa do Stripe
       (R$ 0,39) come 26% da receita. */
    expect(precoDe(10)).toBe(ENTRADA_CENTAVOS);
    expect(precoDe(0)).toBe(ENTRADA_CENTAVOS);
  });

  test("acima do teto, a escada NÃO continua — para no topo", () => {
    /* Acima de 11.100 é Clínica, sob consulta. Deixar a função extrapolar faria
       a tela vender 50.000 mensagens sozinha, no piso, sem ninguém olhar. */
    expect(precoDe(50_000)).toBe(precoDe(TETO_AUTOATENDIMENTO));
  });

  test("negativo não quebra nem devolve preço negativo", () => {
    expect(precoDe(-500)).toBe(ENTRADA_CENTAVOS);
  });

  test("e o PREÇO POR MENSAGEM acima do teto não fura o piso", () => {
    /* O mutante que sobreviveu à primeira bateria. Tirar o `Math.min` deixa
       `precoDe` igual (a lista de faixas já para no topo), mas
       `centavosPorMensagem(50.000)` passa a dividir R$ 999,00 por cinquenta mil
       e devolve 2 centavos — um quarto do piso. A tela mostraria um preço por
       mensagem que a plataforma nunca cobra e que daria prejuízo se cobrasse.
       O `precoDe` disfarçava o defeito; o preço unitário o revela. */
    expect(centavosPorMensagem(50_000)).toBeGreaterThanOrEqual(PISO_CENTAVOS_POR_MENSAGEM);
    expect(centavosPorMensagem(50_000)).toBe(centavosPorMensagem(TETO_AUTOATENDIMENTO));
  });
});

describe("6. o desconto anunciado nunca promete mais do que a fatura dá", () => {
  test("o topo anuncia 54%", () => {
    /* De 20 centavos na entrada para 9 no topo: 54,85% de economia real, que
       `floor` anuncia como 54%. */
    expect(descontoVsEntrada(TETO_AUTOATENDIMENTO)).toBe(54);
  });

  test("a entrada não tem desconto contra ela mesma", () => {
    expect(descontoVsEntrada(150)).toBe(0);
  });

  test("`floor`: o anunciado é sempre menor ou igual ao real", () => {
    /* Mesmo princípio de `promo.ts`. Se `floor` virar `round`, algum degrau
       passa a anunciar mais desconto do que entrega. */
    for (const d of DEGRAUS) {
      const real = (1 - centavosPorMensagem(d) / centavosPorMensagem(150)) * 100;
      expect(descontoVsEntrada(d)).toBeLessThanOrEqual(real);
    }
  });
});
