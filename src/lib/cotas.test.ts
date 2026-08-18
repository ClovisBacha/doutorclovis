import { describe, expect, test } from "bun:test";
import {
  chamadaDaCota,
  COTA_MINIMA_CENTAVOS,
  dividirEmCotas,
  estadoDaCota,
  legendaDaCota,
  podeReservarCotas,
  sugerirCotas,
  valorDaCota,
} from "./cotas";

describe("dividirEmCotas", () => {
  test("⚠️ a soma fecha EXATAMENTE — o caso R$1.200 ÷ 7", () => {
    // `Math.round(120000/7)` é 17143, e sete delas somam 120001: um centavo a
    // mais, todo chá, para sempre. Arredondando para baixo dá um a menos.
    const p = dividirEmCotas(120000, 7);
    expect(p).toHaveLength(7);
    expect(p.reduce((a, b) => a + b, 0)).toBe(120000);
    expect(p.every((c) => Number.isInteger(c))).toBe(true);
  });

  test("a soma fecha em qualquer divisão", () => {
    for (const total of [120000, 99999, 100, 250000, 33333]) {
      for (const n of [2, 3, 4, 7, 10, 12, 13, 24]) {
        const p = dividirEmCotas(total, n);
        expect(p.reduce((a, b) => a + b, 0)).toBe(total);
        expect(p.every(Number.isInteger)).toBe(true);
      }
    }
  });

  test("divisão exata dá cotas iguais", () => {
    expect(dividirEmCotas(120000, 12)).toEqual(Array(12).fill(10000));
  });

  test("⚠️ o resto vai para a ÚLTIMA, não espalhado", () => {
    // Espalhar deixaria as primeiras um centavo mais caras que as últimas, e a
    // tela mostraria dois preços para a mesma cota.
    const p = dividirEmCotas(1000, 3);
    expect(p).toEqual([333, 333, 334]);
    expect(new Set(p.slice(0, -1)).size).toBe(1);
  });

  test("entrada inválida devolve vazio, nunca NaN", () => {
    for (const [t, n] of [
      [0, 5],
      [-100, 5],
      [1000, 0],
      [1000, -1],
      [1000.5, 5],
      [NaN, 5],
    ] as const) {
      expect(dividirEmCotas(t as number, n as number)).toEqual([]);
    }
  });

  test("valorDaCota é o valor mostrado na tela", () => {
    expect(valorDaCota(120000, 12)).toBe(10000);
    expect(valorDaCota(0, 12)).toBe(0);
  });
});

describe("estadoDaCota", () => {
  test("fecha quando as reservas alcançam o total", () => {
    const e = estadoDaCota(12, 12);
    expect(e.fechada).toBe(true);
    expect(e.restantes).toBe(0);
    expect(e.fracao).toBe(1);
  });

  test("nunca passa do total nem fica negativo", () => {
    expect(estadoDaCota(12, 99).reservadas).toBe(12);
    expect(estadoDaCota(12, -5).reservadas).toBe(0);
    expect(estadoDaCota(12, -5).restantes).toBe(12);
  });
});

describe("podeReservarCotas", () => {
  test("⚠️ overshoot é recusado com o máximo real", () => {
    const r = podeReservarCotas(12, 11, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("acima-do-restante");
      expect(r.maximo).toBe(1);
    }
  });

  test("⚠️ a última vaga só cabe uma vez — a corrida", () => {
    // Duas amigas na última cota, no mesmo segundo. A régua diz não para a
    // segunda; quem garante é o servidor reler e gravar na mesma operação.
    expect(podeReservarCotas(12, 11, 1).ok).toBe(true);
    expect(podeReservarCotas(12, 12, 1).ok).toBe(false);
  });

  test("cota fechada recusa", () => {
    const r = podeReservarCotas(12, 12, 1);
    if (!r.ok) expect(r.motivo).toBe("cota-fechada");
  });

  test("quantidade inválida é recusada", () => {
    for (const q of [0, -1, 2.5, NaN]) {
      const r = podeReservarCotas(12, 0, q);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toBe("quantidade-invalida");
    }
  });
});

describe("sugerirCotas", () => {
  test("⚠️ nunca sugere cota abaixo do piso", () => {
    // "12x de R$ 8" transforma o carrinho numa vaquinha de trocado e faz a
    // amiga achar que o app está pedindo esmola.
    for (const total of [5000, 12000, 30000, 120000, 500000]) {
      for (const n of sugerirCotas(total)) {
        expect(valorDaCota(total, n)).toBeGreaterThanOrEqual(COTA_MINIMA_CENTAVOS);
      }
    }
  });

  test("valor pequeno demais não sugere divisão nenhuma", () => {
    expect(sugerirCotas(3000)).toEqual([]);
    expect(sugerirCotas(0)).toEqual([]);
  });

  test("um carrinho de R$1.200 sugere divisões usáveis", () => {
    const s = sugerirCotas(120000);
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(s.every((n) => n >= 2)).toBe(true);
  });
});

describe("os textos", () => {
  test("⚠️ a legenda não cobra — estado, nunca dívida", () => {
    const proibido = /falta[m]?\s|só\s+\d|corre|últim|urgente/i;
    expect(legendaDaCota(estadoDaCota(12, 5))).not.toMatch(proibido);
    expect(legendaDaCota(estadoDaCota(12, 5))).toBe("5 de 12 cotas");
    expect(legendaDaCota(estadoDaCota(12, 12))).toBe("12 de 12 cotas · fechado");
  });

  test("a chamada mostra o valor por cota em reais", () => {
    const t = chamadaDaCota(120000, 12);
    expect(t).toContain("12x");
    expect(t).toContain("100,00");
  });
});
