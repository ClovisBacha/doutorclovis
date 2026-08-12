/**
 * A JORNADA MOSTRA CINCO BEBÊS DIFERENTES — e este arquivo é o que garante.
 *
 * O defeito que ele fecha: a Jornada do Bebê pedia a arte pela SEMANA REAL, e
 * as cinco artes do Drive (6 · 10 · 20 · 30 · 40) não têm as bordas dos cinco
 * estágios. Na 27ª semana — última do "Feto" — a arte mais próxima é a de 30,
 * que é a do "Feto (reta final)". A linha marcada "você está aqui" e a de baixo
 * mostravam o MESMO desenho, numa tela cujo assunto inteiro é a mudança.
 */

import { describe, expect, test } from "bun:test";
import {
  SEMANAS_DAS_ARTES,
  STAGE_RANGES,
  semanaDaArte,
  semanaTipicaDoEstagio,
} from "./arte-do-bebe";
import type { BabyStage } from "./gestacao";

const ESTAGIOS: BabyStage[] = ["embriao", "inicial", "feto", "tardio", "termo"];

describe("a arte mais próxima da semana", () => {
  test("as faixas são as que o comentário promete", () => {
    const faixa = (de: number, ate: number, esperado: number) => {
      for (let w = de; w <= ate; w++) expect(semanaDaArte(w)).toBe(esperado);
    };
    faixa(4, 8, 6);
    faixa(9, 15, 10);
    faixa(16, 25, 20);
    faixa(26, 35, 30);
    faixa(36, 42, 40);
  });

  test("empate vai para a arte MAIS NOVA", () => {
    /* 15 dista 5 da de 10 e 5 da de 20; 25 dista 5 da de 20 e 5 da de 30.
       Adiantar a arte antecipa marcos — cabelo, unhas, gordura — que ainda não
       existem no bebê dela. */
    expect(semanaDaArte(15)).toBe(10);
    expect(semanaDaArte(25)).toBe(20);
  });

  test("semana fora da faixa não quebra", () => {
    expect(SEMANAS_DAS_ARTES).toContain(semanaDaArte(0));
    expect(SEMANAS_DAS_ARTES).toContain(semanaDaArte(60));
    expect(semanaDaArte(0)).toBe(6);
    expect(semanaDaArte(60)).toBe(40);
  });
});

describe("a semana que representa cada estágio", () => {
  test("os cinco estágios dão CINCO artes distintas", () => {
    /* É a afirmação inteira desta tela. Dois estágios com o mesmo desenho
       fazem a jornada negar a única coisa que ela tem a dizer. */
    const artes = ESTAGIOS.map((e) => semanaDaArte(semanaTipicaDoEstagio(e)));
    expect(new Set(artes).size).toBe(5);
    expect(artes).toEqual([...SEMANAS_DAS_ARTES]);
  });

  test("a semana típica cai DENTRO da faixa do estágio", () => {
    for (const e of ESTAGIOS) {
      const [min, max] = STAGE_RANGES[e];
      const s = semanaTipicaDoEstagio(e);
      expect(s).toBeGreaterThanOrEqual(min);
      expect(s).toBeLessThanOrEqual(max);
    }
  });

  test("as faixas cobrem 4–42 sem buraco nem sobreposição", () => {
    /* Um buraco deixaria uma semana sem estágio na Jornada; uma sobreposição
       poria a mesma semana em duas linhas. */
    const faixas = ESTAGIOS.map((e) => STAGE_RANGES[e]);
    expect(faixas[0][0]).toBe(4);
    expect(faixas[faixas.length - 1][1]).toBe(42);
    for (let i = 1; i < faixas.length; i++) {
      expect(faixas[i][0]).toBe(faixas[i - 1][1] + 1);
    }
  });
});
