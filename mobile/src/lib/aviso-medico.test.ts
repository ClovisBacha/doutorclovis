import { describe, expect, test } from "bun:test";
import { AVISO_MEDICO } from "~/lib/aviso-medico";

describe("o aviso médico (Apple 1.4.1)", () => {
  test("as duas medidas dizem que não substitui o médico e dão o 192", () => {
    for (const t of [AVISO_MEDICO.completo, AVISO_MEDICO.curto]) {
      expect(t).toContain("não substitui");
      expect(t).toContain("192");
    }
    expect(AVISO_MEDICO.completo).toContain("não faz diagnóstico");
  });
});
