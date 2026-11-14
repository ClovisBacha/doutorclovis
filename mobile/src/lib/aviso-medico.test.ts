import { describe, expect, test } from "bun:test";
import { AVISO_MEDICO } from "~/lib/aviso-medico";

describe("o aviso médico (Apple 1.4.1)", () => {
  test("as duas medidas dizem que o app não dá orientação médica e dão o 192", () => {
    for (const t of [AVISO_MEDICO.completo, AVISO_MEDICO.curto]) {
      expect(t).toContain("não dá orientação médica");
      /* Sem o SOS no app (11/11/2026), o caminho é o 192 — e o aviso não
         promete um SOS que não está lá. */
      expect(t).not.toContain("SOS");
      expect(t).toContain("192");
    }
    expect(AVISO_MEDICO.completo).toContain("não faz diagnóstico");
    expect(AVISO_MEDICO.completo).toContain("não substitui");
  });

  test("o aviso não diz mais que o app orienta (21/10/2026)", () => {
    for (const t of [AVISO_MEDICO.completo, AVISO_MEDICO.curto])
      /* "orienta" como verbo (a frase antiga), e não dentro de "orientação". */
      expect(t).not.toMatch(/\borienta[\s,.;]|conteúdo educativo/i);
  });
});
