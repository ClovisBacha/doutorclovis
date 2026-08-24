/**
 * Preço é a parte do app que a paciente confere com o extrato do cartão. Um
 * erro aqui não é bug de tela — é cobrança errada.
 *
 * O teste que mais importa é o da escala: se um pacote maior render MENOS
 * Sementinhas por real que um menor, quem confiou e comprou o grande foi
 * penalizado por confiar. É a pegadinha clássica de loja de jogo, e é fácil
 * de introduzir sem querer ao mexer num preço só.
 *
 * ⚠️ ESTE ARQUIVO FOI REESCRITO em ago/2026, quando os quatro pacotes viraram
 * TRÊS e cada um passou a ter `base` + `bonus` (o layout que o dono desenhou).
 * A ordem também inverteu: a lista agora vai do MAIOR para o menor, porque é
 * essa a ordem da tela — e os testes antigos afirmavam o contrário.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  PACOTES,
  PACOTE_POR_ID,
  numeroBR,
  porReal,
  precoBRL,
  totalEntregue,
  gastavelDoPacote,
  vantagemSobreMenor,
} from "./pacotes-sementinhas";

describe("catálogo dos pacotes", () => {
  test("são TRÊS, com os números que o dono desenhou", () => {
    /* Ele recusou cinco faixas ("acho que é demais") e recusou pacote abaixo
       de mil ("a pessoa não compra nada"). Estes são os números da imagem. */
    expect(PACOTES.map((p) => [p.base, p.bonusParaPresentear, p.centavos])).toEqual([
      [10_000, 2_500, 9_990],
      [5_000, 1_000, 5_990],
      [1_000, 100, 1_490],
    ]);
  });

  test("⚠️ o número grande do cartão é o GASTÁVEL, nunca a soma dos dois bolsos", () => {
    /* O bônus só presenteia. Somar mostraria 12.500 num cartão que entrega
       10.000 de poder de compra — a categoria de erro mais cara que uma loja
       pode ter, e a que este teste existe para impedir de voltar. */
    expect(PACOTES.map(gastavelDoPacote)).toEqual([10_000, 5_000, 1_000]);
    expect(PACOTES.map(totalEntregue)).toEqual([12_500, 6_000, 1_100]);
    for (const p of PACOTES) expect(gastavelDoPacote(p)).toBeLessThan(totalEntregue(p));
  });

  test("⚠️ e a tela mostra os dois números SEPARADOS, com o bônus explicado", () => {
    /* A pílula não pode dizer só "+2.500": ao lado de "10.000 sementinhas" a
       soma acontece na cabeça de quem lê. Quem impede isso é a frase. */
    const tela = readFileSync("src/components/loja-sementinhas.tsx", "utf8");
    expect(tela).toContain("gastavelDoPacote(p)");
    expect(tela).not.toContain("totalEntregue");
    expect(tela).toContain("para presentear");
    expect(tela).toContain("só para dar às suas amigas");
  });

  test("os preços saem formatados como na tela", () => {
    expect(precoBRL(PACOTE_POR_ID["sem-10000"])).toBe("R$ 99,90");
    expect(precoBRL(PACOTE_POR_ID["sem-5000"])).toBe("R$ 59,90");
    expect(precoBRL(PACOTE_POR_ID["sem-1000"])).toBe("R$ 14,90");
  });

  test("os números levam separador de milhar", () => {
    expect(numeroBR(15_000)).toBe("15.000");
    expect(numeroBR(1_100)).toBe("1.100");
  });

  test("preço em centavos inteiros — nunca float de dinheiro", () => {
    for (const p of PACOTES) {
      expect(Number.isInteger(p.centavos)).toBe(true);
      expect(p.centavos).toBeGreaterThan(0);
      expect(Number.isInteger(p.base)).toBe(true);
      expect(Number.isInteger(p.bonusParaPresentear)).toBe(true);
    }
  });

  test("ids únicos", () => {
    expect(new Set(PACOTES.map((p) => p.id)).size).toBe(PACOTES.length);
  });

  test("⚠️ listados do MAIOR para o menor — a ordem da tela", () => {
    /* A tela renderiza na ordem desta lista, e o layout do dono põe o maior em
       cima. Inverter aqui inverteria a tela sem ninguém tocar no JSX. */
    for (let i = 1; i < PACOTES.length; i++) {
      expect(totalEntregue(PACOTES[i])).toBeLessThan(totalEntregue(PACOTES[i - 1]));
      expect(PACOTES[i].centavos).toBeLessThan(PACOTES[i - 1].centavos);
    }
  });

  test("exatamente um cartão tem a fita MELHOR VALOR, e é o maior", () => {
    const comFita = PACOTES.filter((p) => p.destaque);
    expect(comFita).toHaveLength(1);
    expect(comFita[0].id).toBe(PACOTES[0].id);
  });

  test("as três cores do layout, uma por cartão", () => {
    expect(PACOTES.map((p) => p.cor)).toEqual(["verde", "azul", "roxo"]);
  });
});

describe("a escala não pune quem compra o maior", () => {
  test("pacote maior sempre rende MAIS Sementinhas por real", () => {
    /* A lista está em ordem decrescente, então o de índice menor rende mais. */
    for (let i = 1; i < PACOTES.length; i++) {
      expect(porReal(PACOTES[i - 1])).toBeGreaterThan(porReal(PACOTES[i]));
    }
  });

  test("o bônus é o que faz a escada — ele cresce mais rápido que o preço", () => {
    const proporcao = PACOTES.map((p) => p.bonusParaPresentear / p.base);
    for (let i = 1; i < proporcao.length; i++) {
      expect(proporcao[i - 1]).toBeGreaterThan(proporcao[i]);
    }
    /* 25% no topo, 10% na entrada. Era 50% enquanto o bônus caía na carteira
       gastável; com ele virando bolso de presente, 5.000 seriam 125 presentes
       guardados numa conta que talvez tenha três amigas. */
    expect(proporcao[0]).toBeCloseTo(0.25, 5);
    expect(proporcao[proporcao.length - 1]).toBeCloseTo(0.1, 5);
  });

  test("a vantagem do maior sobre o menor é visível, não decorativa", () => {
    // Menos de 20% e o degrau não justifica o pacote grande existir.
    expect(vantagemSobreMenor(PACOTES[0])).toBeGreaterThanOrEqual(20);
    /* ⚠️ Zero para o MENOR, que é o ÚLTIMO da lista. Ler `PACOTES[0]` daria a
       vantagem contra o topo — sempre negativa — e a tela mostraria "-67%" no
       cartão que ela deve querer. */
    expect(vantagemSobreMenor(PACOTES[PACOTES.length - 1])).toBe(0);
  });

  test("nenhum pacote passa de R$ 99,90", () => {
    /* O teto que o dono escolheu, e que é também onde Clash of Clans trava a
       faixa maior dele ($99,99) — parece ser o ponto em que qualquer app para. */
    for (const p of PACOTES) expect(p.centavos).toBeLessThanOrEqual(9_990);
  });
});

describe("⚠️ o pacote maior não zera o jogo", () => {
  /* Foi ESTE teste que obrigou o reajuste do catálogo: o maior pacote entregava
     15.000 🌱 gastáveis e o catálogo custava 14.894 — ela comprava uma vez e não
     sobrava mais nada para querer. Ver `cantinho.ts`.

     ⚠️ A conta é sobre o GASTÁVEL, não sobre o entregue. O bônus não compra um
     enfeite sequer, então somá-lo aqui inflaria a fatia e deixaria a trava
     verde sobre um poder de compra que não existe — que é o mesmo erro que o
     cartão da tela não pode cometer. */
  test("o maior pacote fica bem abaixo do catálogo inteiro", async () => {
    const { CANTINHO_ITEMS, CANTINHO_COMPLETIONIST_ID } = await import("./cantinho");
    const total = CANTINHO_ITEMS.filter(
      (i) => i.price > 0 && !i.aposentado && i.id !== CANTINHO_COMPLETIONIST_ID,
    ).reduce((s, i) => s + i.price, 0);
    expect(gastavelDoPacote(PACOTES[0])).toBeLessThan(total * 0.75);
  });
});
