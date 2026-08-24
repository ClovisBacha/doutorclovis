/**
 * O defeito que este arquivo trava foi introduzido e enviado no mesmo dia, e
 * era invisível: a tela acesa funcionava na PRIMEIRA vez e nunca mais.
 *
 * O sistema solta o bloqueio sozinho quando a aba vai para segundo plano —
 * e a sentinela continua preenchida, só com `released: true`. Uma guarda que
 * pergunta "já tenho sentinela?" em vez de "já tenho sentinela VIVA?" nunca
 * repede. Nada quebra, nada aparece no console: a paciente só descobre porque
 * a meditação dela morre quando ela atende uma mensagem.
 */

import { describe, expect, test } from "bun:test";
import { manterTelaAcesa } from "./tela-acesa";

type Falsa = { released: boolean; release: () => Promise<void> };

/** Monta um `navigator.wakeLock` de mentira e devolve o placar dos pedidos. */
function bancada() {
  const sentinelas: Falsa[] = [];
  const g = globalThis as unknown as {
    navigator: unknown;
    document: unknown;
  };
  const ouvintes: Array<() => void> = [];
  let visibilidade = "visible";

  g.navigator = {
    wakeLock: {
      request: async () => {
        const s: Falsa = {
          released: false,
          release: async () => {
            s.released = true;
          },
        };
        sentinelas.push(s);
        return s;
      },
    },
  };
  g.document = {
    get visibilityState() {
      return visibilidade;
    },
    addEventListener: (_: string, fn: () => void) => ouvintes.push(fn),
    removeEventListener: (_: string, fn: () => void) => {
      const i = ouvintes.indexOf(fn);
      if (i >= 0) ouvintes.splice(i, 1);
    },
  };

  return {
    sentinelas,
    ouvintes,
    /** O sistema solta e a aba volta a ficar visível. */
    async sistemaSoltaEVolta() {
      sentinelas.at(-1)!.released = true;
      visibilidade = "visible";
      for (const fn of [...ouvintes]) fn();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe("manterTelaAcesa", () => {
  test("pede a tela ao começar", async () => {
    const b = bancada();
    const soltar = manterTelaAcesa();
    await Promise.resolve();
    await Promise.resolve();
    expect(b.sentinelas.length).toBe(1);
    soltar();
  });

  /* A invariante. Sem ela, a atividade longa morre na primeira interrupção. */
  test("REPEDE quando o sistema solta e a aba volta", async () => {
    const b = bancada();
    const soltar = manterTelaAcesa();
    await Promise.resolve();
    await Promise.resolve();
    await b.sistemaSoltaEVolta();
    expect(b.sentinelas.length).toBe(2);
    soltar();
  });

  test("não pede duas vezes se a sentinela continua viva", async () => {
    const b = bancada();
    const soltar = manterTelaAcesa();
    await Promise.resolve();
    await Promise.resolve();
    for (const fn of [...b.ouvintes]) fn(); // visível, e a sentinela viva
    await Promise.resolve();
    await Promise.resolve();
    expect(b.sentinelas.length).toBe(1);
    soltar();
  });

  test("soltar remove o ouvinte — sem isso, a atividade seguinte herda o de trás", async () => {
    const b = bancada();
    const soltar = manterTelaAcesa();
    await Promise.resolve();
    soltar();
    expect(b.ouvintes.length).toBe(0);
  });

  test("depois de soltar, não pede mais", async () => {
    const b = bancada();
    const soltar = manterTelaAcesa();
    await Promise.resolve();
    await Promise.resolve();
    soltar();
    await b.sistemaSoltaEVolta();
    expect(b.sentinelas.length).toBe(1);
  });

  test("aparelho sem wakeLock: no-op silencioso, nunca lança", () => {
    (globalThis as unknown as { navigator: unknown }).navigator = {};
    expect(() => manterTelaAcesa()()).not.toThrow();
  });
});
