/**
 * A ECONOMIA QUE FAZ A PACIENTE ASSINAR.
 *
 * As Sementinhas deixaram de ser um substituto do Premium e viraram um gerador
 * de demanda por ele: poucos itens grátis e baratos, de modo que em ~15 dias ela
 * já comprou todos — e a partir daí acumula moeda sem ter no que gastar,
 * olhando 57 itens bloqueados que ela JÁ pode pagar.
 *
 * O que este arquivo guarda é o CALIBRE. Um item grátis a mais, ou um preço
 * dobrado, e a parede se afasta semanas — sem nenhum erro visível, porque todos
 * os números continuam plausíveis. Foi exatamente assim que a loja chegou a
 * **241 dias** para zerar, que é o estado que este desenho veio corrigir.
 */

import { describe, expect, test } from "bun:test";
import { CANTINHO_ITEMS } from "./cantinho";
import {
  BONUS_VINCULO_MEDICO,
  CURVA_GRATIS,
  CUSTO_LOJA_GRATIS,
  ITENS_GRATIS,
  PRESENTE_SUGERIDO,
  SEMENTINHAS_POR_MENSAGEM,
  diasParaZerarLoja,
  mesadaDoMedico,
  saldoParado,
} from "./economia-sementinhas";

describe("1. o alvo do dono: 15 dias", () => {
  test("COM médico, ela zera a loja grátis em 15 dias", () => {
    /* O número que o dono pediu, literal. */
    expect(diasParaZerarLoja({ comMedico: true, presenteMensal: PRESENTE_SUGERIDO })).toBe(15);
  });

  test("SEM médico demora bem mais — e isso é de propósito", () => {
    /* A diferença é o que faz o vínculo com o médico valer alguma coisa no
       primeiro minuto. Se fossem iguais, o bônus seria enfeite. */
    const com = diasParaZerarLoja({ comMedico: true, presenteMensal: PRESENTE_SUGERIDO });
    const sem = diasParaZerarLoja({ comMedico: false });
    expect(sem).toBeGreaterThan(com + 5);
  });

  test("e nenhum dos dois passa de 30 dias", () => {
    /* O teto que impede o retorno ao estado antigo. Passando de um mês, a
       moeda deixa de acumular e a parede nunca chega. */
    expect(diasParaZerarLoja({ comMedico: false })).toBeLessThanOrEqual(30);
  });
});

describe("2. A PAREDE — moeda parada sem ter o que comprar", () => {
  /**
   * O mecanismo inteiro. Se o saldo parado nunca sobe, o desenho não faz nada:
   * ela compra devagar para sempre e nunca sente falta de nada.
   */
  test("no dia 15 ainda não há saldo parado — ela acabou de zerar", () => {
    expect(saldoParado(15, { comMedico: true, presenteMensal: PRESENTE_SUGERIDO })).toBe(0);
  });

  test("no dia 30 já há moeda parada", () => {
    expect(saldoParado(30, { comMedico: true, presenteMensal: PRESENTE_SUGERIDO })).toBeGreaterThan(
      0,
    );
  });

  test("e no dia 45 ela já pode pagar um item premium inteiro", () => {
    /* É esta a hora de converter: ela tem no bolso o preço de um item que só a
       assinatura destrava. */
    const premium = CANTINHO_ITEMS.filter((i) => i.premium).map((i) => i.price);
    const maisBarato = Math.min(...premium);
    expect(saldoParado(45, { comMedico: true, presenteMensal: PRESENTE_SUGERIDO })).toBeGreaterThan(
      maisBarato,
    );
  });

  test("o saldo parado só cresce — nunca volta a zero", () => {
    let anterior = -1;
    for (const dia of [20, 30, 45, 60, 90]) {
      const s = saldoParado(dia, { comMedico: true, presenteMensal: PRESENTE_SUGERIDO });
      expect(s).toBeGreaterThanOrEqual(anterior);
      anterior = s;
    }
  });
});

describe("3. a curva tem forma de jogo, não de planilha", () => {
  test("são 15 itens", () => {
    expect(ITENS_GRATIS).toBe(15);
    expect(CURVA_GRATIS).toHaveLength(15);
  });

  test("catorze vitórias baratas — nenhuma passa de 20 🌱", () => {
    /* O laço "ganhei → gastei → mudou a minha tela" precisa fechar várias vezes
       na primeira semana. Um primeiro item caro mata isso. */
    for (const p of CURVA_GRATIS.slice(0, 14)) expect(p).toBeLessThanOrEqual(20);
  });

  test("e UM troféu, que é o último", () => {
    const trofeu = CURVA_GRATIS[14];
    expect(trofeu).toBeGreaterThan(CURVA_GRATIS[13] * 5);
  });

  test("o troféu custa o MEIO da faixa premium — é âncora de preço", () => {
    /* O detalhe que faz a loja premium fazer sentido depois. Ela paga 200 num
       item grátis, aprende no corpo quanto vale 200, e quando vê os premium o
       número já significa alguma coisa.

       A asserção é sobre a FAIXA (entre a mediana e o Q3), não sobre a mediana
       exata — e a diferença tem história. A primeira versão exigia a mediana
       exata e reprovou: mover 27 itens baratos de grátis para premium puxou a
       mediana de 200 para 160, e uma afirmação que era verdadeira virou falsa
       sem nenhum número mudar de lugar. Prender ao valor exato ataria a curva a
       um número que se move sozinho toda vez que a loja for reorganizada. */
    const premium = CANTINHO_ITEMS.filter((i) => i.premium)
      .map((i) => i.price)
      .sort((a, b) => a - b);
    const mediana = premium[Math.floor(premium.length * 0.5)];
    const q3 = premium[Math.floor(premium.length * 0.75)];
    expect(CURVA_GRATIS[14]).toBeGreaterThanOrEqual(mediana);
    expect(CURVA_GRATIS[14]).toBeLessThanOrEqual(q3);
  });

  test("a curva nunca desce", () => {
    for (let i = 1; i < CURVA_GRATIS.length; i++) {
      expect(CURVA_GRATIS[i]).toBeGreaterThanOrEqual(CURVA_GRATIS[i - 1]);
    }
  });
});

describe("4. a LOJA obedece à curva — a conta e o produto não podem divergir", () => {
  /**
   * `economia-sementinhas.ts` é a conta; `cantinho.ts` é a loja de verdade. Se
   * os dois discordarem, todos os testes acima passam e a paciente vê outra
   * coisa. É a mesma armadilha que pegou o backfill, o bloco do cérebro e o
   * corte da memória: provar a função e nunca o chamador.
   */
  const compraveis = CANTINHO_ITEMS.filter((i) => !i.premium && i.price > 0);

  test("são 15 itens grátis compráveis", () => {
    expect(compraveis).toHaveLength(ITENS_GRATIS);
  });

  test("e eles somam exatamente o que a curva diz", () => {
    expect(compraveis.reduce((s, i) => s + i.price, 0)).toBe(CUSTO_LOJA_GRATIS);
  });

  test("os preços da loja SÃO a curva", () => {
    const daLoja = compraveis.map((i) => i.price).sort((a, b) => a - b);
    expect(daLoja).toEqual([...CURVA_GRATIS].sort((a, b) => a - b));
  });

  test("os itens de preço zero continuam grátis — são padrão, não compra", () => {
    /* O fundo padrão e a Coroa da Coleção. Cobrar por eles seria cobrar por
       algo que ela já tem, e a Coroa é recompensa de coleção. */
    const zerados = CANTINHO_ITEMS.filter((i) => i.price === 0);
    expect(zerados.length).toBeGreaterThan(0);
    for (const i of zerados) expect(i.premium).toBe(false);
  });

  test("e a loja premium ficou grande — é ela que gera o desejo", () => {
    expect(CANTINHO_ITEMS.filter((i) => i.premium).length).toBeGreaterThan(50);
  });

  test("os grátis têm VARIEDADE de categoria — a loja precisa parecer viva", () => {
    /* Quinze itens da mesma categoria dariam a mesma soma e uma primeira
       impressão muito pior. */
    const tipos = new Set(compraveis.map((i) => i.type));
    expect(tipos.size).toBeGreaterThanOrEqual(6);
  });
});

describe("5. a mesada do médico", () => {
  test("é mensagens × 3", () => {
    expect(SEMENTINHAS_POR_MENSAGEM).toBe(3);
    expect(mesadaDoMedico(150)).toBe(450);
    expect(mesadaDoMedico(2_500)).toBe(7_500);
  });

  test("dá para presentear TODAS as pacientes dele, todo mês", () => {
    /* A razão se calibra sozinha: uma paciente ativa consome ~15 mensagens por
       mês, então × 3 dá ~45 🌱 por paciente. Ele nunca é obrigado a escolher
       entre pacientes — e escolher entre pacientes é o tipo de decisão que ele
       não deve ter de tomar. */
    for (const msgs of [150, 600, 1_000, 2_500]) {
      const pacientes = msgs / 15;
      const presentes = mesadaDoMedico(msgs) / PRESENTE_SUGERIDO;
      expect(presentes).toBeGreaterThanOrEqual(pacientes * 0.8);
    }
  });

  test("plano maior, mesada maior — sempre", () => {
    let anterior = -1;
    for (const m of [150, 300, 600, 1_000, 1_500, 2_000, 2_500]) {
      const mesada = mesadaDoMedico(m);
      expect(mesada).toBeGreaterThan(anterior);
      anterior = mesada;
    }
  });

  test("sem plano, sem mesada — e nunca negativa", () => {
    expect(mesadaDoMedico(0)).toBe(0);
    expect(mesadaDoMedico(-500)).toBe(0);
  });

  test("o bônus de vínculo é pago uma vez e vale a pena", () => {
    /* Precisa ser grande o suficiente para ela SENTIR — 100 🌱 compra os sete
       primeiros itens de uma vez. */
    expect(BONUS_VINCULO_MEDICO).toBe(100);
    const setePrimeiros = CURVA_GRATIS.slice(0, 7).reduce((s, p) => s + p, 0);
    expect(BONUS_VINCULO_MEDICO).toBeGreaterThan(setePrimeiros);
  });
});
