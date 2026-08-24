/**
 * A vibração da respiração, travada em teste.
 *
 * Este arquivo existe por um defeito que sobreviveu meses porque não havia como
 * medi-lo: `vibratePhase` falava direto com o `navigator`, então conferir o
 * padrão exigia um celular Android na mão. A lista era fixa —
 * `[40,120,60,120,80,120,100,120,120]` — e somava **880 ms** dentro de uma
 * inspiração de **4000 ms**.
 *
 * Na prática: a paciente sentia a subida por menos de um segundo e ficava três
 * segundos sem referência nenhuma, justamente no fim da fase, que é quando ela
 * mais precisa saber quanto falta. De olhos fechados, isso é o exercício
 * inteiro falhando em silêncio.
 *
 * Separar `padraoDaFase` como função pura é o que torna isto verificável.
 */

import { describe, expect, test } from "bun:test";
import { padraoDaFase } from "./breath-audio";

/** Soma o padrão inteiro: `[liga, desliga, liga, …]` em milissegundos. */
function total(padrao: number[]): number {
  return padrao.reduce((s, x) => s + x, 0);
}

/** Só os pulsos — os índices pares. As posições ímpares são pausas. */
function pulsos(padrao: number[]): number[] {
  return padrao.filter((_, i) => i % 2 === 0);
}

describe("o padrão dura a fase inteira", () => {
  /* O defeito original em uma linha: para durações reais, o padrão tem que
     cobrir quase toda a fase. 80% é a folga que a última pausa descartada
     deixa; menos que isso é o buraco voltando. */
  for (const dur of [3000, 4000, 5000, 6000, 8000]) {
    test(`${dur}ms de inspiração`, () => {
      const t = total(padraoDaFase("in", dur));
      expect(t).toBeGreaterThanOrEqual(dur * 0.8);
      expect(t).toBeLessThanOrEqual(dur);
    });
    test(`${dur}ms de expiração`, () => {
      const t = total(padraoDaFase("out", dur));
      expect(t).toBeGreaterThanOrEqual(dur * 0.8);
      expect(t).toBeLessThanOrEqual(dur);
    });
  }

  test("a inspiração de 4000ms não volta a ser um sopro de 880ms", () => {
    /* O número exato do defeito, para o teste falhar se alguém reintroduzir a
       lista fixa achando que "já funcionava". */
    expect(total(padraoDaFase("in", 4000))).toBeGreaterThan(880 * 3);
  });
});

describe("a forma diz qual é a fase, sem olhar a tela", () => {
  test("inspirar CRESCE", () => {
    const p = pulsos(padraoDaFase("in", 4000));
    expect(p.length).toBeGreaterThan(2);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeGreaterThan(p[i - 1]);
  });

  test("expirar DIMINUI", () => {
    const p = pulsos(padraoDaFase("out", 6000));
    expect(p.length).toBeGreaterThan(2);
    for (let i = 1; i < p.length; i++) expect(p[i]).toBeLessThan(p[i - 1]);
  });

  test("as duas fases começam em pontos opostos", () => {
    /* Se inspirar e expirar começassem parecidos, a mão sentiria movimento sem
       saber de qual fase — e só a tela resolveria, que é o que se quer evitar. */
    const dentro = pulsos(padraoDaFase("in", 4000));
    const fora = pulsos(padraoDaFase("out", 4000));
    expect(dentro[0]).toBeLessThan(fora[0]);
    expect(dentro[dentro.length - 1]).toBeGreaterThan(fora[fora.length - 1]);
  });
});

describe("segurar é silêncio com uma marca", () => {
  test("um toque só, curto", () => {
    const p = padraoDaFase("hold", 4000);
    expect(p).toHaveLength(1);
    expect(p[0]).toBeLessThan(60);
  });

  test("não depende da duração", () => {
    expect(padraoDaFase("hold", 1000)).toEqual(padraoDaFase("hold", 9000));
  });
});

describe("nenhum pulso nasce imperceptível", () => {
  /* Abaixo de ~18ms o motor não chega a girar. Um pulso desses é pior que
     nenhum: o compasso fica irregular sem motivo aparente. */
  for (const fase of ["in", "out"] as const) {
    for (const dur of [1500, 3000, 4000, 6000, 10000]) {
      test(`${fase} em ${dur}ms`, () => {
        for (const v of pulsos(padraoDaFase(fase, dur))) expect(v).toBeGreaterThanOrEqual(18);
      });
    }
  }
});

describe("entradas impossíveis não geram vibração", () => {
  for (const dur of [0, -1, NaN, Infinity]) {
    test(`${dur}`, () => {
      expect(padraoDaFase("in", dur)).toEqual([]);
    });
  }
});

describe("a cadência fica confortável em qualquer duração", () => {
  test("uma fase longa não vira um pulso só nem cinquenta", () => {
    expect(pulsos(padraoDaFase("in", 20000)).length).toBeLessThanOrEqual(12);
    expect(pulsos(padraoDaFase("in", 800)).length).toBeGreaterThanOrEqual(3);
  });

  test("o padrão sempre alterna liga/desliga", () => {
    /* `navigator.vibrate` lê índice par como vibração e ímpar como pausa. Um
       vetor de tamanho par terminaria numa pausa inútil. */
    expect(padraoDaFase("in", 4000).length % 2).toBe(1);
  });
});
