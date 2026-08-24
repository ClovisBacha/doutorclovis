/**
 * A régua de idade gestacional é UMA só, e é local.
 *
 * O painel do médico tinha a própria aritmética, e ela divergia da do app da
 * paciente por um dia todo fim de tarde:
 *
 *   new Date("2026-01-10")            → 00:00 UTC
 *   new Date("2026-01-10T00:00:00")   → 00:00 LOCAL
 *
 * Em America/Sao_Paulo são 3 horas de diferença: das 21h à meia-noite a ficha
 * do médico ficava um dia à frente do app dela. Medido 33s2d contra 33s1d, e a
 * fronteira do termo caindo em 37s0d de um lado e 36s6d do outro.
 *
 * Em obstetrícia o DIA decide conduta — corticoide, viabilidade, 36+6 versus
 * 37+0. Estes testes existem para que a segunda régua não volte a nascer.
 *
 * Rodam com TZ=America/Sao_Paulo (definido em `bunfig.toml`); o ponto do teste é
 * justamente o comportamento num fuso a oeste de Greenwich.
 */

import { describe, expect, test } from "bun:test";
import { computeGestation } from "./gestacao";

/** O caso que produzia a divergência: fim de tarde num fuso negativo. */
const FIM_DE_TARDE = new Date("2026-07-30T21:05:00-03:00");

describe("a régua ancora em MEIA-NOITE LOCAL, não em UTC", () => {
  test("às 21h o dia gestacional não vira", () => {
    const g = computeGestation({ lmp: "2026-01-10", today: FIM_DE_TARDE });
    /* Da DUM 10/01 até 30/07 são 201 dias completos. A régua UTC dava 202 a
       partir das 21h, porque o marco de origem estava 3 horas no passado. */
    expect(g?.totalDays).toBe(201);
    expect(g?.weeks).toBe(28);
    expect(g?.days).toBe(5);
  });

  test("de manhã e à noite do MESMO dia local, o mesmo resultado", () => {
    const manha = computeGestation({
      lmp: "2026-01-10",
      today: new Date("2026-07-30T08:00:00-03:00"),
    });
    const noite = computeGestation({
      lmp: "2026-01-10",
      today: new Date("2026-07-30T23:59:00-03:00"),
    });
    expect(manha?.totalDays).toBe(noite?.totalDays);
  });

  test("a virada acontece na meia-noite local, e só ali", () => {
    const antes = computeGestation({
      lmp: "2026-01-10",
      today: new Date("2026-07-30T23:59:59-03:00"),
    });
    const depois = computeGestation({
      lmp: "2026-01-10",
      today: new Date("2026-07-31T00:00:01-03:00"),
    });
    expect(depois!.totalDays - antes!.totalDays).toBe(1);
  });
});

describe("a fronteira do termo — 36+6 contra 37+0", () => {
  /* DUM tal que 30/07 seja exatamente 36s6d = 258 dias. */
  const dum = "2025-11-14";

  test("às 21h ela ainda é 36+6, não 37+0", () => {
    const g = computeGestation({ lmp: dum, today: FIM_DE_TARDE });
    expect(g?.weeks).toBe(36);
    expect(g?.days).toBe(6);
    /* Este é o número que muda conduta. A régua UTC dizia 37s0d — gestação a
       termo — três horas antes da hora. */
    expect(g!.weeks * 7 + g!.days).toBe(258);
  });
});

describe("o ultrassom manda na DUM", () => {
  test("reference_* tem precedência", () => {
    /* Usar a DUM tendo o ultrassom desloca a idade em SEMANAS — é o erro
       clássico, e o motivo pelo qual a função do painel existia em separado. */
    const g = computeGestation({
      lmp: "2026-01-10",
      referenceDate: "2026-06-01",
      referenceWeeks: 20,
      referenceDays: 0,
      today: FIM_DE_TARDE,
    });
    expect(g?.totalDays).toBe(20 * 7 + 59); // 59 dias de 01/06 a 30/07
    expect(g?.weeks).toBe(28);
  });

  test("a âncora do ultrassom também é local", () => {
    const manha = computeGestation({
      referenceDate: "2026-06-01",
      referenceWeeks: 20,
      referenceDays: 0,
      today: new Date("2026-07-30T08:00:00-03:00"),
    });
    expect(manha?.totalDays).toBe(
      computeGestation({
        referenceDate: "2026-06-01",
        referenceWeeks: 20,
        referenceDays: 0,
        today: FIM_DE_TARDE,
      })?.totalDays,
    );
  });
});

describe("bordas", () => {
  test("sem DUM e sem ultrassom não inventa idade", () => {
    expect(computeGestation({ today: FIM_DE_TARDE })).toBeNull();
    expect(computeGestation({ lmp: null, today: FIM_DE_TARDE })).toBeNull();
  });

  test("DUM no futuro devolve null, não número negativo", () => {
    /* Data digitada errada no cadastro. `-14 dias` renderizado como "-2 semanas"
       na ficha é pior que campo vazio. */
    expect(computeGestation({ lmp: "2026-12-01", today: FIM_DE_TARDE })).toBeNull();
  });

  test("reference_weeks sem reference_date cai na DUM", () => {
    const g = computeGestation({ lmp: "2026-01-10", referenceWeeks: 20, today: FIM_DE_TARDE });
    expect(g?.totalDays).toBe(201);
  });
});
