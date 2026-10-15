import { describe, expect, test } from "bun:test";
import { cartaDoDia } from "@/lib/cartas-do-bebe";
import { cartaDoDiaNoApp } from "~/lib/jornada/cartas";
import { D_MAXIMO, D_MINIMO, semanaDoDia } from "~/lib/jornada/dia";

const naGestacao = (dia: number) => cartaDoDiaNoApp({ dia, semanas: semanaDoDia(dia) });
const noPosParto = (dia: number) => cartaDoDiaNoApp({ dia, semanas: null, posParto: true });

describe("a carta do bebê nunca se repete de um dia para o outro", () => {
  test("em nenhum dia da gestação (D 7–300)", () => {
    const repetidas: number[] = [];
    for (let D = D_MINIMO + 1; D <= D_MAXIMO; D++)
      if (naGestacao(D).id === naGestacao(D - 1).id) repetidas.push(D);
    expect(repetidas).toEqual([]);
  });

  test("em nenhum dia do pós-parto (bebê com até 120 dias)", () => {
    const repetidas: number[] = [];
    for (let D = 8; D <= 127; D++) if (noPosParto(D).id === noPosParto(D - 1).id) repetidas.push(D);
    expect(repetidas).toEqual([]);
  });

  test("o caso medido — dias 195 e 196, na troca das semanas 27→28", () => {
    expect(naGestacao(196).id).not.toBe(naGestacao(195).id);
  });

  test("fora do dia da colisão, a carta é a mesma da régua do site", () => {
    const diferentes: number[] = [];
    for (let D = D_MINIMO; D <= D_MAXIMO; D++)
      if (naGestacao(D).id !== cartaDoDia({ dia: D, semanas: semanaDoDia(D) }).id)
        diferentes.push(D);
    // só os dias de troca de fase podem mudar, e são poucos
    expect(diferentes.length).toBeLessThanOrEqual(3);
    expect(diferentes).toContain(196);
  });
});
