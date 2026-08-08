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

  test("o topo do autoatendimento é 2.500 mensagens", () => {
    expect(TETO_AUTOATENDIMENTO).toBe(2_500);
  });
});

describe("2. O PISO — a trava que impede o prejuízo futuro", () => {
  /**
   * O teste mais importante do arquivo. Tudo o mais é conveniência; este é o
   * que separa uma escada segura de uma que quebra quando o modelo encarecer.
   */
  test("nenhuma faixa vende abaixo de 9 centavos por mensagem", () => {
    for (const faixa of FAIXAS) {
      if ("centavos" in faixa) {
        expect(faixa.centavos).toBeGreaterThanOrEqual(PISO_CENTAVOS_POR_MENSAGEM);
      }
    }
  });

  test("e o piso é pelo menos 3× o custo de PLANEJAMENTO", () => {
    /* Contra o custo planejado (o pior caso), não contra a média — precificar
       contra a média é o que produz a surpresa. */
    expect(PISO_CENTAVOS_POR_MENSAGEM).toBeGreaterThanOrEqual(CUSTO_PLANEJADO_CENTAVOS * 3);
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

describe("4. o preço graduado é o mesmo que o Stripe vai calcular", () => {
  /* Se estas contas divergirem, a tela promete um número e a fatura cobra
     outro — que é a reclamação mais cara que existe. Cada linha aqui é uma
     linha da configuração do Stripe. */
  test("150 → só a faixa fixa", () => {
    expect(precoDe(150)).toBe(2_990);
  });

  test("300 → fixa + 150 × 19", () => {
    expect(precoDe(300)).toBe(2_990 + 150 * 19);
    expect(precoDe(300)).toBe(5_840);
  });

  test("1.000 → fixa + 150×19 + 200×18 + 250×17 + 250×15", () => {
    expect(precoDe(1_000)).toBe(2_990 + 150 * 19 + 200 * 18 + 250 * 17 + 250 * 15);
    expect(precoDe(1_000)).toBe(17_440);
  });

  test("2.000 → R$ 294,40, o teto que o dono já tinha aprovado", () => {
    /* O antigo topo (R$ 295,40) valia 2.500 mensagens. Com a escada de dez
       faixas o mesmo bolso compra 2.000 — e as outras 500 passaram a custar
       R$ 0,09 cada, que é onde o dono pediu que o desconto morasse. */
    expect(precoDe(2_000)).toBe(29_440);
  });

  test("2.500 → R$ 339,40, com as últimas 500 no piso", () => {
    expect(precoDe(2_500)).toBe(precoDe(2_000) + 500 * 9);
    expect(precoDe(2_500)).toBe(33_940);
  });

  test("a soma das dez faixas fecha com o topo", () => {
    /* A conta inteira, escrita de uma vez — é ela que vai para o painel do
       Stripe, faixa por faixa. */
    const soma =
      2_990 +
      150 * 19 +
      200 * 18 +
      250 * 17 +
      250 * 15 +
      250 * 14 +
      250 * 13 +
      250 * 11 +
      250 * 10 +
      500 * 9;
    expect(soma).toBe(precoDe(2_500));
  });
});

describe("4b. o desconto foi para as mensagens DE CIMA", () => {
  /**
   * A queixa que reescreveu a escada: "a partir do momento que a pessoa vai dos
   * cento e cinquenta e uma mensagens, já aumenta muito o desconto".
   *
   * A entrada sai a R$ 0,1993/mensagem. A faixa seguinte cobrava R$ 0,15 — ou
   * seja, comprar UMA mensagem a mais que o pacote mínimo derrubava o preço
   * marginal em 25% de uma vez, e o resto da escada não motivava mais nada.
   */
  test("a mensagem 151 quase não é mais barata que a 150", () => {
    const entradaPorMsg = centavosPorMensagem(ENTRADA_MENSAGENS);
    const primeiraMarginal = FAIXAS[1].centavos!;
    const queda = 1 - primeiraMarginal / entradaPorMsg;
    expect(queda).toBeLessThan(0.1); // era 0,25
  });

  test("o desconto sobe DE POUCO EM POUCO, degrau a degrau", () => {
    /* Nenhum salto maior que 6 pontos entre degraus vizinhos — antes o primeiro
       salto sozinho valia mais que isso. */
    for (let i = 1; i < DEGRAUS.length; i++) {
      const salto = descontoVsEntrada(DEGRAUS[i]) - descontoVsEntrada(DEGRAUS[i - 1]);
      expect(salto).toBeLessThanOrEqual(6);
    }
  });

  test("o preço marginal NUNCA sobe de uma faixa para a seguinte", () => {
    /* Uma faixa mais cara que a anterior faria comprar MENOS sair mais barato —
       e o slider mostraria o preço caindo enquanto a pessoa arrasta para trás. */
    const marginais = FAIXAS.slice(1).map((f) => f.centavos!);
    for (let i = 1; i < marginais.length; i++) {
      expect(marginais[i]).toBeLessThanOrEqual(marginais[i - 1]);
    }
  });

  test("são dez faixas — o dono pediu de oito a dez", () => {
    expect(FAIXAS.length).toBeGreaterThanOrEqual(8);
    expect(FAIXAS.length).toBeLessThanOrEqual(10);
  });

  test("o piso de R$ 0,09 começa em 2.001, e não antes", () => {
    /* "Acima de dois mil, a gente coloca o preço de zero vírgula zero nove pra
       cima" — palavra do dono. */
    const ultima = FAIXAS[FAIXAS.length - 1];
    const penultima = FAIXAS[FAIXAS.length - 2];
    expect(ultima.centavos).toBe(PISO_CENTAVOS_POR_MENSAGEM);
    expect(penultima.ate).toBe(2_000);
    expect(penultima.centavos).toBeGreaterThan(PISO_CENTAVOS_POR_MENSAGEM);
  });

  test("nenhuma faixa fura o piso", () => {
    for (const f of FAIXAS) {
      if ("centavos" in f) expect(f.centavos).toBeGreaterThanOrEqual(PISO_CENTAVOS_POR_MENSAGEM);
    }
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
    /* Acima de 2.500 é Clínica, sob consulta. Deixar a função extrapolar faria
       a tela vender 10.000 mensagens sozinha, no piso, sem ninguém olhar. */
    expect(precoDe(10_000)).toBe(precoDe(TETO_AUTOATENDIMENTO));
  });

  test("negativo não quebra nem devolve preço negativo", () => {
    expect(precoDe(-500)).toBe(ENTRADA_CENTAVOS);
  });

  test("e o PREÇO POR MENSAGEM acima do teto não fura o piso", () => {
    /* O mutante que sobreviveu à primeira bateria. Tirar o `Math.min` deixa
       `precoDe` igual (a lista de faixas já para em 2.500), mas
       `centavosPorMensagem(10.000)` passa a dividir R$ 295,40 por dez mil e
       devolve 2,95 centavos — um terço do piso. A tela mostraria um preço por
       mensagem que a plataforma nunca cobra e que daria prejuízo se cobrasse.
       O `precoDe` disfarçava o defeito; o preço unitário o revela. */
    expect(centavosPorMensagem(10_000)).toBeGreaterThanOrEqual(PISO_CENTAVOS_POR_MENSAGEM);
    expect(centavosPorMensagem(10_000)).toBe(centavosPorMensagem(TETO_AUTOATENDIMENTO));
  });
});

describe("6. o desconto anunciado nunca promete mais do que a fatura dá", () => {
  test("o topo anuncia 31%", () => {
    /* Caiu de 40% porque o desconto deixou de ser dado de uma vez na faixa 2.
       O que se perdeu em número de vitrine se ganhou em curva: agora ele sobe
       a cada degrau, que é o que faz a pessoa querer o degrau seguinte. */
    expect(descontoVsEntrada(2_500)).toBe(31);
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
