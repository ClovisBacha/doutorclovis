import { describe, expect, test } from "bun:test";
import { AVISO_MEDICO } from "~/lib/aviso-medico";

describe("o aviso médico (Apple 1.4.1)", () => {
  test("as duas medidas dizem que o app não dá orientação médica; só a completa dá o 192", () => {
    for (const t of [AVISO_MEDICO.completo, AVISO_MEDICO.curto]) {
      expect(t).toContain("não dá orientação médica");
      /* Sem o SOS no app (11/11/2026): o aviso não promete um SOS que não está lá. */
      expect(t).not.toContain("SOS");
    }
    /* A nota completa (o pé do Perfil) leva o 192; a linha curta, no pé da
       aula e do bebê, não (23/11/2026, o dono: "isso lembra a pessoa de ficar
       preocupada, o app é de bem-estar e de tranquilidade"). */
    expect(AVISO_MEDICO.completo).toContain("192");
    expect(AVISO_MEDICO.curto).not.toMatch(/192|emergência/i);
    expect(AVISO_MEDICO.completo).toContain("não faz diagnóstico");
    expect(AVISO_MEDICO.completo).toContain("não substitui");
  });

  test("o aviso não diz mais que o app orienta (21/10/2026)", () => {
    for (const t of [AVISO_MEDICO.completo, AVISO_MEDICO.curto])
      /* "orienta" como verbo (a frase antiga), e não dentro de "orientação". */
      expect(t).not.toMatch(/\borienta[\s,.;]|conteúdo educativo/i);
  });
});
