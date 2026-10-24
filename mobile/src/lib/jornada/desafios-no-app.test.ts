import { describe, expect, test } from "bun:test";
import { gestChallenge } from "@/lib/daily-challenges";
import { DESAFIOS_DA_GESTACAO_NO_APP, desafioDaGestacao } from "~/lib/jornada/desafios-no-app";

/** As telas do site que o app não tem (ou chama por outro nome). */
const TELA_QUE_NAO_EXISTE =
  /\baba (Consultas|Exames|Nutrição|Bem-estar|Alertas|Chutes)\b|Álbum|Diário|Meditações|Alertas|em Chutes|Dr\. Clóvis|Estou com um sintoma/;

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
      /* Na aba Saúde do app sobraram só os Movimentos do bebê (e a agenda): o
         registro de peso, pressão e glicemia saiu, e as contrações moram no
         SOS (21/10/2026). Desafio que cita a Saúde fala dos Movimentos. */
      if (/\bSaúde\b/.test(d!.label)) expect(d!.label).toMatch(/Movimentos/);
      /* Nem meta de movimentos nem régua de trabalho de parto: o app não dá
         conduta. */
      expect(d!.label).not.toMatch(/\b10 movimentos\b|5-1-1/);
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

  test("o emoji e o id do site continuam — a não ser que a troca traga a sua", () => {
    const d = desafioDaGestacao(90)!;
    expect(d.emoji).toBe(gestChallenge(90)!.emoji);
    expect(d.id).toBe(gestChallenge(90)!.id);
    const trocado = desafioDaGestacao(80)!;
    expect(trocado.emoji).toBe("💌");
    expect(trocado.id).toBe(gestChallenge(80)!.id);
  });
});
