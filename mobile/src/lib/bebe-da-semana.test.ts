import { describe, expect, test } from "bun:test";
import { babyForWeek, retaFinalMensagem } from "@/lib/gestacao";
import { FRASES } from "@/lib/frases-do-mascote";
import { bebeDaSemana, DESCRICAO_NO_APP, retaFinalNoApp } from "~/lib/bebe-da-semana";
import { FRASES_FORA_DO_APP, fraseDoDiaNoApp } from "~/lib/frase-do-dia";

/** O que o app não diz mais (21/10/2026: rede social + gamificação, não conselho médico). */
const CLINICO =
  /aborto|viabilidade|acompanhamento|equipe|cardioto|líquido|indução|médic|sentir os movimentos|termo|pulmões (quase )?prontos|cefálic|encaixe|sonha/i;

describe("o bebê da semana no app", () => {
  test("as trocadas ainda são, no site, o texto que foi trocado", () => {
    for (const [semana, t] of Object.entries(DESCRICAO_NO_APP)) {
      expect(babyForWeek(Number(semana)).desc).toBe(t.site);
      expect(bebeDaSemana(Number(semana)).desc).toBe(t.app);
    }
  });

  test("nenhuma semana fala como prontuário — nem a 43, que o site prende na 42", () => {
    for (let s = 1; s <= 45; s++) expect(bebeDaSemana(s).desc).not.toMatch(CLINICO);
    expect(bebeDaSemana(43).desc).toBe(DESCRICAO_NO_APP[42].app);
  });

  test("nenhuma semana dá gênero ao bebê", () => {
    /* A 40 do site dizia "no tempo dele". */
    for (let s = 1; s <= 45; s++) expect(bebeDaSemana(s).desc).not.toMatch(/\b(dele|dela)\b/i);
  });

  test("o resto da semana é o do site", () => {
    expect(bebeDaSemana(24).fruit).toBe(babyForWeek(24).fruit);
    expect(bebeDaSemana(21)).toEqual(babyForWeek(21));
    expect(bebeDaSemana(20).size).toBe(babyForWeek(20).size);
  });
});

describe("a reta final no app", () => {
  test("antes das 40, nada; nas 40, a do site", () => {
    expect(retaFinalNoApp(39)).toBeNull();
    expect(retaFinalNoApp(40)).toEqual(retaFinalMensagem(40));
  });

  test("41 e 42+ sem exame nem indução, com o título do site", () => {
    for (const s of [41, 42, 43]) {
      const r = retaFinalNoApp(s)!;
      expect(r.corpo).not.toMatch(CLINICO);
      expect(r.titulo).toBe(retaFinalMensagem(s)!.titulo);
    }
  });
});

describe("a frase do mascote no app", () => {
  test("as de fora existem na lista do site (se o site mudar, a catraca avisa)", () => {
    for (const f of FRASES_FORA_DO_APP) expect(FRASES.some((x) => x.texto === f)).toBe(true);
  });

  test("nunca sai uma frase de fora, e nunca falta frase onde o site tinha", () => {
    for (let dia = 20000; dia < 20400; dia++)
      for (const periodo of ["madrugada", "manha", "tarde", "noite"] as const) {
        const o = { dia, periodo, nome: "Ana", hora: 15, semanas: 30 };
        const f = fraseDoDiaNoApp(o);
        expect(f).not.toBeNull();
        expect(FRASES_FORA_DO_APP.has(f!)).toBe(false);
        expect(f!).not.toMatch(/médic/i);
      }
  });
});
