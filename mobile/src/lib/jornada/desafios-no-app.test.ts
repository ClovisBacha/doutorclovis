import { describe, expect, test } from "bun:test";
import { gestChallenge } from "@/lib/daily-challenges";
import { DESAFIOS_DA_GESTACAO_NO_APP, desafioDaGestacao } from "~/lib/jornada/desafios-no-app";

/** As telas do site que o app não tem (ou chama por outro nome). */
const TELA_QUE_NAO_EXISTE =
  /\baba (Consultas|Exames|Nutrição|Bem-estar|Alertas|Chutes)\b|Álbum|Diário|Meditações|Alertas|em Chutes|Dr\. Clóvis/;

describe("os desafios da gestação no app", () => {
  test("os trocados ainda são, no site, o texto que foi trocado", () => {
    for (const [D, t] of Object.entries(DESAFIOS_DA_GESTACAO_NO_APP)) {
      expect(gestChallenge(Number(D))?.label).toBe(t.site);
      expect(desafioDaGestacao(Number(D))?.label).toBe(t.app);
    }
  });

  test("nenhum desafio do app manda para tela que o app não tem", () => {
    for (let D = 7; D <= 300; D++) {
      const d = desafioDaGestacao(D);
      expect(d).not.toBeNull();
      expect(d!.label).not.toMatch(TELA_QUE_NAO_EXISTE);
      /* A aba Saúde do app guarda peso, pressão e glicemia (com o gráfico): é
         só disso que um desafio pode falar ao citá-la. */
      if (/\bSaúde\b/.test(d!.label) && !/sintoma|Movimentos|Contrações/.test(d!.label))
        expect(d!.label).toMatch(/peso|pressão|registr|curva/i);
    }
    expect(desafioDaGestacao(301)).toBeNull();
  });

  test("os desafios de Movimentos do bebê só vêm quando a ferramenta já existe (24 semanas)", () => {
    for (let D = 7; D <= 300; D++) {
      const d = desafioDaGestacao(D);
      if (d && /Movimentos do bebê/.test(d.label))
        expect(Math.floor(D / 7)).toBeGreaterThanOrEqual(24);
    }
  });

  test("o emoji e o id do site continuam", () => {
    const d = desafioDaGestacao(90)!;
    expect(d.emoji).toBe(gestChallenge(90)!.emoji);
    expect(d.id).toBe(gestChallenge(90)!.id);
  });
});
