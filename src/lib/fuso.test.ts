/**
 * Carimbo e comparação de horário quando o servidor não está no Brasil.
 *
 * Duas funções, dois defeitos reais:
 *
 *  · `ymdBrasilia` — `fetal_bpm_at` era gravado com `toISOString().slice(0,10)`
 *    dentro de uma server function. Teleconsulta das 21h15 do dia 30 virava
 *    carimbo 31/07, o aparelho dela calculava `days = -1`, e o cartão "ouvimos
 *    o coração do seu bebê" não aparecia na noite em que ele acabou de ouvir.
 *
 *  · `instanteBrasilia` — a fila de espera comparava `new Date("...T09:00")`
 *    (sem offset, logo UTC no servidor) contra `Date.now()`. Uma vaga das 09:00
 *    de Brasília parecia ter passado a partir das 06h da manhã, e nenhuma vaga
 *    da manhã liberada no mesmo dia era ofertada a quem esperava.
 *
 * Estes testes NÃO dependem do fuso do runner: as duas funções fixam
 * America/Sao_Paulo por dentro, que é exatamente a propriedade em teste.
 */

import { describe, expect, test } from "bun:test";
import { instanteBrasilia, ymdBrasilia } from "./utils";

describe("ymdBrasilia — a data do consultório, não a do servidor", () => {
  test("21h15 de 30/07 ainda é dia 30, mesmo com o ISO já em 31", () => {
    const teleconsultaDaNoite = new Date("2026-07-30T21:15:00-03:00");
    /* O que estava no código: */
    expect(teleconsultaDaNoite.toISOString().slice(0, 10)).toBe("2026-07-31");
    /* O que a paciente vê no calendário dela: */
    expect(ymdBrasilia(teleconsultaDaNoite)).toBe("2026-07-30");
  });

  test("meia-noite e um minuto já é o dia seguinte", () => {
    expect(ymdBrasilia(new Date("2026-07-31T00:01:00-03:00"))).toBe("2026-07-31");
  });

  test("23h59 ainda é o dia corrente", () => {
    expect(ymdBrasilia(new Date("2026-07-30T23:59:00-03:00"))).toBe("2026-07-30");
  });
});

describe("instanteBrasilia — a vaga das 9h é às 9h daqui", () => {
  test("converte a parede local para o instante certo", () => {
    /* 09:00 em Brasília = 12:00Z. A leitura ingênua dava 09:00Z. */
    expect(instanteBrasilia("2026-08-03", "09:00")).toBe(Date.parse("2026-08-03T12:00:00Z"));
  });

  test("O CASO QUE QUEBRAVA: às 7h da manhã a vaga das 9h ainda é futuro", () => {
    const seteDaManha = Date.parse("2026-08-03T10:00:00Z"); // 07:00 em Brasília
    const vagaDasNove = instanteBrasilia("2026-08-03", "09:00");
    expect(vagaDasNove > seteDaManha).toBe(true);

    /* A conta antiga, para deixar o defeito registrado: `new Date` sem offset
       num servidor UTC lê 09:00 como 09:00Z, que às 07h de Brasília já passou —
       e `offerNextForWeek` devolvia false sem ofertar a ninguém. */
    const comoEra = Date.parse("2026-08-03T09:00:00Z");
    expect(comoEra > seteDaManha).toBe(false);
  });

  test("uma vaga que JÁ passou continua sendo passado", () => {
    const dezDaManha = Date.parse("2026-08-03T13:00:00Z"); // 10:00 em Brasília
    expect(instanteBrasilia("2026-08-03", "09:00") > dezDaManha).toBe(false);
  });

  test("aceita HH:MM:SS além de HH:MM", () => {
    expect(instanteBrasilia("2026-08-03", "09:00:00")).toBe(
      instanteBrasilia("2026-08-03", "09:00"),
    );
  });

  test("meia-noite não rola para o dia seguinte", () => {
    /* O motivo do `hourCycle: "h23"`: com `hour12: false` o ICU devolve "24"
       para a meia-noite em várias versões, e o offset sairia 24h errado. */
    expect(instanteBrasilia("2026-08-03", "00:00")).toBe(Date.parse("2026-08-03T03:00:00Z"));
  });

  test("entrada inválida devolve NaN, não uma data qualquer", () => {
    /* Fail-loud: uma data inventada aqui viraria oferta de vaga em horário
       errado, e a paciente perderia a consulta por comparecer na hora errada. */
    expect(Number.isNaN(instanteBrasilia("", "09:00"))).toBe(true);
    expect(Number.isNaN(instanteBrasilia("03/08/2026", "09:00"))).toBe(true);
    expect(Number.isNaN(instanteBrasilia("2026-08-03", "manhã"))).toBe(true);
  });
});
