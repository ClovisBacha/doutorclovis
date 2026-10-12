import { describe, expect, test } from "bun:test";
import {
  dataCurta,
  diaDaJornada,
  diaDoPosParto,
  diaNaSemana,
  diasDaSemana,
  idadeEmDias,
  quandoAbre,
  semanaDoDia,
  temaDoDia,
} from "./dia";

describe("o dia da jornada", () => {
  test("D fica preso à faixa do conteúdo, 7 a 300", () => {
    expect(diaDaJornada(3)).toBe(7);
    expect(diaDaJornada(171)).toBe(171);
    expect(diaDaJornada(310)).toBe(300);
    expect(diaDaJornada(Number.NaN)).toBe(7);
    expect(diaDaJornada(171.9)).toBe(171);
  });

  test("semana e dia na notação da trilha do site", () => {
    expect(semanaDoDia(171)).toBe(24);
    expect(diaNaSemana(171)).toBe(4);
    expect(diaNaSemana(168)).toBe(1);
    expect(semanaDoDia(300)).toBe(42);
    expect(semanaDoDia(7)).toBe(1);
  });

  test("o ritmo por D % 7", () => {
    expect(temaDoDia(168).chave).toBe("bebe");
    expect(temaDoDia(169).chave).toBe("corpo");
    expect(temaDoDia(171).chave).toBe("sinais");
    expect(temaDoDia(174).chave).toBe("revisao");
  });

  test("os sete dias da semana", () => {
    expect(diasDaSemana(24)).toEqual([168, 169, 170, 171, 172, 173, 174]);
  });
});

describe("quando um dia futuro abre", () => {
  // quinta-feira, 1º de outubro de 2026
  const hoje = new Date(2026, 9, 1, 15, 0);
  test("amanhã, dia da semana, data", () => {
    expect(quandoAbre(171, 171, hoje)).toBe("hoje");
    expect(quandoAbre(172, 171, hoje)).toBe("amanhã");
    expect(quandoAbre(173, 171, hoje)).toBe("no sábado");
    expect(quandoAbre(175, 171, hoje)).toBe("na segunda-feira");
    expect(quandoAbre(178, 171, hoje)).toBe("em 08/10");
  });
});

describe("pós-parto", () => {
  test("a idade do bebê conta datas civis, não horas", () => {
    expect(idadeEmDias("2026-10-01", new Date(2026, 9, 1, 23, 30))).toBe(0);
    expect(idadeEmDias("2026-09-11", new Date(2026, 9, 1, 0, 5))).toBe(20);
    expect(idadeEmDias("2026-10-05", new Date(2026, 9, 1))).toBeNull();
    expect(idadeEmDias("lixo", new Date(2026, 9, 1))).toBeNull();
  });
  test("D do pós-parto = idade + 7", () => {
    expect(diaDoPosParto(0)).toBe(7);
    expect(diaDoPosParto(20)).toBe(27);
  });
});

test("data curta", () => {
  expect(dataCurta("2026-09-12T15:00:00")).toBe("12/09");
  expect(dataCurta(null)).toBeNull();
  expect(dataCurta("nada")).toBeNull();
});
