import { describe, expect, test } from "bun:test";

import { diasAte, frasePrazo, proximaData, statusDoExame } from "@/lib/preventivos";

/* Um instante da TARDE: é ele que separa a conta certa da antiga. */
const hojeTarde = new Date(2026, 8, 11, 15, 0, 0);
const hojeMadrugada = new Date(2026, 8, 11, 0, 30, 0);

describe("diasAte — o que conta é o DIA CIVIL, nunca a distância em horas", () => {
  test("o que vence hoje dá ZERO, de manhã ou de tarde", () => {
    const hoje = new Date(2026, 8, 11);
    expect(diasAte(hoje, hojeTarde)).toBe(0);
    expect(diasAte(hoje, hojeMadrugada)).toBe(0);
  });

  /* ⚠️ ESTE É O DEFEITO QUE A FUNÇÃO EXISTE PARA FECHAR. A conta antiga
     (`Math.round((alvo - agora) / 86400000)`) dava −1 às 15h para um exame que
     vence hoje, e a tela escrevia "(1 dias em atraso)" sobre um rastreamento em
     dia. Aqui a diferença de horas não muda a resposta. */
  test("a hora do dia NÃO muda a contagem", () => {
    const amanha = new Date(2026, 8, 12);
    for (const h of [0, 6, 12, 15, 23]) {
      expect(diasAte(amanha, new Date(2026, 8, 11, h, 45))).toBe(1);
    }
  });

  test("conta para trás e atravessa o mês", () => {
    expect(diasAte(new Date(2026, 8, 1), hojeTarde)).toBe(-10);
    expect(diasAte(new Date(2026, 9, 1), hojeTarde)).toBe(20);
  });
});

describe("proximaData", () => {
  test("soma os meses", () => {
    expect(proximaData("2026-03-10", 12)?.toISOString().slice(0, 10)).toBe("2027-03-10");
  });

  /* ⚠️ `setMonth` TRANSBORDA: 31 de maio + 6 meses cairia em 1º de dezembro,
     porque novembro tem 30 dias. As frequências semestrais (pressão, dentista)
     são as que esbarram nisso. */
  test("não transborda para o mês seguinte", () => {
    const d = proximaData("2026-05-31", 6);
    expect(d?.getMonth()).toBe(10); // novembro
    expect(d?.getDate()).toBe(30);
  });

  test("29 de fevereiro num ano comum recua para 28", () => {
    const d = proximaData("2024-02-29", 12);
    expect(d?.getMonth()).toBe(1);
    expect(d?.getDate()).toBe(28);
  });

  test("sem data, sem prazo", () => {
    expect(proximaData(null, 12)).toBeNull();
    expect(proximaData("não é data", 12)).toBeNull();
  });
});

describe("statusDoExame", () => {
  test("o dia do vencimento ainda NÃO é atraso", () => {
    expect(statusDoExame(0)).toBe("soon");
    expect(statusDoExame(-1)).toBe("overdue");
  });

  test("sessenta dias é 'em breve'; sessenta e um é 'ok'", () => {
    expect(statusDoExame(60)).toBe("soon");
    expect(statusDoExame(61)).toBe("ok");
  });

  test("sem prazo é 'nunca registrado'", () => {
    expect(statusDoExame(null)).toBe("never");
  });
});

describe("frasePrazo", () => {
  /* ⚠️ O PLURAL É PARTE DO CONSERTO: a tela chegava a escrever "(1 dias em
     atraso)" — e escrevia isso justamente no dia do vencimento. */
  test("tem singular", () => {
    expect(frasePrazo(-1)).toBe("(1 dia em atraso)");
    expect(frasePrazo(1)).toBe("(em 1 dia)");
  });

  test("o dia do vencimento é 'hoje', e nunca 'em atraso'", () => {
    expect(frasePrazo(0)).toBe("(hoje)");
  });

  test("o plural continua", () => {
    expect(frasePrazo(-396)).toBe("(396 dias em atraso)");
    expect(frasePrazo(45)).toBe("(em 45 dias)");
  });

  test("sem prazo não escreve nada", () => {
    expect(frasePrazo(null)).toBeNull();
  });
});
