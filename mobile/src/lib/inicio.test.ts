import { describe, expect, test } from "bun:test";
import {
  dataCurta,
  dataProvavel,
  diasAteADpp,
  fracaoDaGestacao,
  idadeDoBebe,
  rotuloDaIdade,
} from "./inicio";

describe("as contas da home", () => {
  test("rótulo da idade gestacional no singular e no plural", () => {
    expect(rotuloDaIdade(24, 3)).toBe("24 semanas e 3 dias");
    expect(rotuloDaIdade(24, 0)).toBe("24 semanas");
    expect(rotuloDaIdade(1, 1)).toBe("1 semana e 1 dia");
  });
  test("dias até a DPP e fração", () => {
    expect(diasAteADpp(171)).toBe(109);
    expect(fracaoDaGestacao(140)).toBe(0.5);
    expect(fracaoDaGestacao(300)).toBe(1);
  });
  test("data provável a partir de hoje", () => {
    const hoje = new Date(2026, 9, 2);
    expect(dataCurta(dataProvavel(271, hoje))).toBe("11 de out de 2026");
  });
  test("idade do bebê depois do parto", () => {
    const hoje = new Date(2026, 9, 2);
    expect(idadeDoBebe("2026-10-01", hoje)).toBe("1 dia de vida");
    expect(idadeDoBebe("2026-09-11", hoje)).toBe("3 semanas de vida");
    expect(idadeDoBebe("2026-06-02", hoje)).toBe("4 meses de vida");
    expect(idadeDoBebe("2026-10-10", hoje)).toBeNull();
  });
});
