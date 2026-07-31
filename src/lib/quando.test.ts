/**
 * "hoje" tem que querer dizer hoje.
 *
 * As duas cópias desta função na tela do prontuário contavam períodos de 24
 * horas e chamavam isso de dia. Uma pressão 168/104 registrada ontem às 23h
 * aparecia como "hoje" para o médico que abrisse a tela de manhã; um evento de
 * anteontem, 47 horas atrás, aparecia como "ontem".
 *
 * Numa tela onde ele decide se liga para a paciente agora, isso não é enfeite.
 *
 * O fuso dos testes é America/Sao_Paulo (`[test] preload` do bunfig) — em UTC o
 * defeito é invisível.
 */

import { describe, expect, test } from "bun:test";
import { diasDeCalendario, quando } from "./quando";

const AGORA = new Date("2026-07-31T08:00:00-03:00"); // manhã de sexta

describe("o caso que quebrava: fim de noite virando 'hoje'", () => {
  test("ontem às 23h é ONTEM, mesmo com 9 horas de distância", () => {
    /* A conta antiga: (8h de hoje − 23h de ontem) = 9 h → floor(9/24) = 0 →
       "hoje". A pressão grave da noite anterior chegava ao médico como achado
       de hoje. */
    expect(quando("2026-07-30T23:00:00-03:00", AGORA)).toBe("ontem");
    expect(diasDeCalendario("2026-07-30T23:00:00-03:00", AGORA)).toBe(1);
  });

  test("anteontem às 09h é 'há 2 dias', não 'ontem'", () => {
    /* 47 horas atrás: floor(47/24) = 1 → "ontem". */
    expect(quando("2026-07-29T09:00:00-03:00", AGORA)).toBe("há 2 dias");
  });
});

describe("os casos normais continuam certos", () => {
  test("hoje de madrugada é hoje", () => {
    expect(quando("2026-07-31T00:10:00-03:00", AGORA)).toBe("hoje");
  });

  test("hoje mais cedo é hoje", () => {
    expect(quando("2026-07-31T07:59:00-03:00", AGORA)).toBe("hoje");
  });

  test("ontem de manhã é ontem", () => {
    expect(quando("2026-07-30T07:00:00-03:00", AGORA)).toBe("ontem");
  });

  test("uma semana atrás", () => {
    expect(quando("2026-07-24T15:00:00-03:00", AGORA)).toBe("há 7 dias");
  });
});

describe("bordas", () => {
  test("a virada é meia-noite local, e um minuto a separa", () => {
    expect(quando("2026-07-30T23:59:59-03:00", AGORA)).toBe("ontem");
    expect(quando("2026-07-31T00:00:01-03:00", AGORA)).toBe("hoje");
  });

  test("acima de 30 dias vira data", () => {
    expect(quando("2026-05-01T12:00:00-03:00", AGORA)).toBe("01/05/2026");
  });

  test("29 dias ainda é contagem", () => {
    expect(quando("2026-07-02T12:00:00-03:00", AGORA)).toBe("há 29 dias");
  });

  test("carimbo no futuro não vira 'há -1 dias'", () => {
    /* Relógio do aparelho dela adiantado, ou fuso errado no registro. */
    expect(quando("2026-08-02T12:00:00-03:00", AGORA)).toBe("hoje");
  });

  test("data inválida não imprime 'NaN'", () => {
    expect(quando("", AGORA)).toBe("—");
    expect(quando("nao e data", AGORA)).toBe("—");
    expect(diasDeCalendario("nao e data", AGORA)).toBe(0);
  });

  test("atravessa o fim do mês", () => {
    const primeiroDeAgosto = new Date("2026-08-01T10:00:00-03:00");
    expect(quando("2026-07-31T22:00:00-03:00", primeiroDeAgosto)).toBe("ontem");
  });
});
