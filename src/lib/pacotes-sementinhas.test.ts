/**
 * Preço é a parte do app que a paciente confere com o extrato do cartão. Um
 * erro aqui não é bug de tela — é cobrança errada.
 *
 * O teste que mais importa é o da escala: se um pacote maior render MENOS
 * Sementinhas por real que um menor, quem confiou e comprou o grande foi
 * penalizado por confiar. É a pegadinha clássica de loja de jogo, e é fácil
 * de introduzir sem querer ao mexer num preço só.
 */

import { describe, expect, test } from "bun:test";
import {
  PACOTES,
  PACOTE_POR_ID,
  podeComprarAqui,
  porReal,
  precoBRL,
  vantagemSobreMenor,
} from "./pacotes-sementinhas";

describe("catálogo dos pacotes", () => {
  test("os quatro pacotes pedidos existem", () => {
    expect(PACOTES.map((p) => p.quantidade)).toEqual([1000, 2000, 5000, 10000]);
  });

  test("o maior custa R$ 249,00 e dá 10.000", () => {
    const maior = PACOTE_POR_ID["sem-10000"];
    expect(maior.centavos).toBe(24900);
    expect(maior.quantidade).toBe(10000);
    expect(precoBRL(maior)).toBe("R$ 249,00");
  });

  test("preço em centavos inteiros — nunca float de dinheiro", () => {
    for (const p of PACOTES) {
      expect(Number.isInteger(p.centavos)).toBe(true);
      expect(p.centavos).toBeGreaterThan(0);
      expect(Number.isInteger(p.quantidade)).toBe(true);
    }
  });

  test("ids únicos", () => {
    expect(new Set(PACOTES.map((p) => p.id)).size).toBe(PACOTES.length);
  });

  test("listados do menor para o maior", () => {
    for (let i = 1; i < PACOTES.length; i++) {
      expect(PACOTES[i].quantidade).toBeGreaterThan(PACOTES[i - 1].quantidade);
      expect(PACOTES[i].centavos).toBeGreaterThan(PACOTES[i - 1].centavos);
    }
  });
});

describe("a escala não pune quem compra o maior", () => {
  test("pacote maior sempre rende MAIS Sementinhas por real", () => {
    for (let i = 1; i < PACOTES.length; i++) {
      expect(porReal(PACOTES[i])).toBeGreaterThan(porReal(PACOTES[i - 1]));
    }
  });

  test("a vantagem do maior sobre o menor é visível, não decorativa", () => {
    // Menos de 20% e o degrau não justifica o pacote grande existir.
    expect(vantagemSobreMenor(PACOTES.at(-1)!)).toBeGreaterThanOrEqual(20);
    expect(vantagemSobreMenor(PACOTES[0])).toBe(0);
  });

  test("nenhum pacote custa mais que R$ 249 (teto do dono)", () => {
    for (const p of PACOTES) expect(p.centavos).toBeLessThanOrEqual(24900);
  });
});

describe("o pacote maior não zera o jogo", () => {
  /* O catálogo do Cantinho custa ~11.700 🌱. Se o maior pacote comprasse tudo,
     a compra encerraria o jogo em vez de encurtá-lo. */
  test("10.000 não compra o catálogo inteiro", async () => {
    const { CANTINHO_ITEMS, CANTINHO_COMPLETIONIST_ID } = await import("./cantinho");
    const total = CANTINHO_ITEMS.filter(
      (i) => i.price > 0 && i.id !== CANTINHO_COMPLETIONIST_ID,
    ).reduce((s, i) => s + i.price, 0);
    expect(PACOTES.at(-1)!.quantidade).toBeLessThan(total);
  });
});

describe("loja de app nativo", () => {
  /* Apple 3.1.1 e Play Billing: moeda virtual consumível vai pela loja. Um
     botão que abre o Stripe dentro do app reprova na revisão. */
  test("no app nativo a compra por cartão fica indisponível", () => {
    expect(podeComprarAqui(true)).toBe(false);
  });

  test("no navegador a compra é permitida", () => {
    expect(podeComprarAqui(false)).toBe(true);
  });
});
