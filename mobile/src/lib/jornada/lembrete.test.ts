import { describe, expect, test } from "bun:test";
import { DIAS_AGENDADOS, HORA_PADRAO, HORARIOS, horaValida, proximosLembretes } from "./lembrete";

describe("o lembrete diário da meditação", () => {
  test("as horas: de meia em meia, das 6h às 23h30, e a do site marcada", () => {
    expect(HORARIOS[0]).toBe("06:00");
    expect(HORARIOS.at(-1)).toBe("23:30");
    expect(HORARIOS).toContain(HORA_PADRAO);
    expect(HORARIOS.every(horaValida)).toBe(true);
    expect(horaValida("24:00")).toBe(false);
    expect(horaValida("9:00")).toBe(false);
  });

  test("um por dia na hora escolhida, só os que ainda vão acontecer", () => {
    const agora = new Date(2026, 9, 16, 10, 0);
    const l = proximosLembretes({ hora: "21:00", agora, meditouHoje: false });
    expect(l.length).toBe(DIAS_AGENDADOS);
    expect(l[0]).toEqual(new Date(2026, 9, 16, 21, 0));
    expect(l[1]).toEqual(new Date(2026, 9, 17, 21, 0));
  });

  test("já meditou hoje: hoje fica quieto, amanhã volta", () => {
    const agora = new Date(2026, 9, 16, 10, 0);
    const l = proximosLembretes({ hora: "21:00", agora, meditouHoje: true });
    expect(l[0]).toEqual(new Date(2026, 9, 17, 21, 0));
    expect(l.length).toBe(DIAS_AGENDADOS - 1);
  });

  test("a hora de hoje já passou: começa amanhã", () => {
    const agora = new Date(2026, 9, 16, 22, 15);
    expect(proximosLembretes({ hora: "21:00", agora, meditouHoje: false })[0]).toEqual(
      new Date(2026, 9, 17, 21, 0),
    );
  });

  test("a virada do mês e uma hora inválida", () => {
    const l = proximosLembretes({
      hora: "07:30",
      agora: new Date(2026, 9, 31, 8, 0),
      meditouHoje: false,
    });
    expect(l[0]).toEqual(new Date(2026, 10, 1, 7, 30));
    expect(proximosLembretes({ hora: "lixo", agora: new Date(), meditouHoje: false })).toEqual([]);
  });
});
