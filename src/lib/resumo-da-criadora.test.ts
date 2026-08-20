import { describe, expect, test } from "bun:test";
import {
  assuntoDoResumo,
  corpoDoResumo,
  DIA_DO_RESUMO,
  valeMandarResumo,
} from "./resumo-da-criadora";

const n = { novas: 3, total: 41, centavos: 12345 };

describe("quando mandar", () => {
  /* ⚠️ Um e-mail semanal dizendo "ninguém entrou" é desânimo assinado pela
     plataforma, e ensina a criadora a arquivar o remetente sem abrir —
     perdendo junto a semana em que ele traria boa notícia. */
  test("⚠️ semana vazia NÃO manda", () => {
    expect(valeMandarResumo({ ...n, novas: 0 })).toBe(false);
    expect(valeMandarResumo({ novas: 0, total: 0, centavos: 0 })).toBe(false);
  });

  test("uma pessoa já basta", () => {
    expect(valeMandarResumo({ ...n, novas: 1 })).toBe(true);
  });

  /* ⚠️ Segunda, e não domingo: domingo é o dia do resumo da PACIENTE. */
  test("⚠️ sai na segunda", () => {
    expect(DIA_DO_RESUMO).toBe(1);
  });
});

describe("o texto", () => {
  test("o assunto leva o número e concorda no plural", () => {
    expect(assuntoDoResumo({ ...n, novas: 1 })).toContain("Uma pessoa");
    expect(assuntoDoResumo({ ...n, novas: 5 })).toContain("5 pessoas");
  });

  test("o corpo cumprimenta pelo nome quando há", () => {
    expect(corpoDoResumo(n, "Marina")).toContain("Oi, Marina!");
    expect(corpoDoResumo(n, null)).toContain("Oi!");
  });

  test("o dinheiro vem de centavos inteiros, formatado", () => {
    expect(corpoDoResumo(n, null)).toContain("R$");
    expect(corpoDoResumo(n, null)).toContain("123,45");
  });

  /* "R$ 0,00" num e-mail de boa notícia lê como se o trabalho dela não
     valesse nada. */
  test("sem comissão, a linha do dinheiro não aparece", () => {
    expect(corpoDoResumo({ ...n, centavos: 0 }, null)).not.toContain("R$");
  });

  /* ⚠️ E-mail fica na caixa de entrada, é encaminhado, aparece na tela do
     celular numa reunião. Nome de gestante não vai por aí — o resumo diz
     QUANTAS, e mais nada. */
  test("⚠️ NÃO há campo de nome de paciente no contrato", () => {
    const chaves = Object.keys(n);
    expect(chaves).toEqual(["novas", "total", "centavos"]);
    const texto = corpoDoResumo(n, "Marina");
    /* O único nome que pode aparecer é o DELA, no cumprimento. */
    expect(texto.match(/Marina/g)).toHaveLength(1);
  });

  /* ⚠️ Ela é parceira, não funcionária: nada de "poste mais". */
  test("⚠️ nem cobrança, nem promessa, nem nada clínico", () => {
    const t = `${assuntoDoResumo(n)} ${corpoDoResumo(n, "Marina")}`.toLocaleLowerCase("pt-BR");
    for (const proibido of [
      "poste",
      "publique mais",
      "esfri",
      "você não",
      "gestante",
      "grávida",
      "semana de gestação",
      "paciente",
    ]) {
      expect(t).not.toContain(proibido);
    }
  });

  test("o painel é linkado, para ela ver o detalhe", () => {
    expect(corpoDoResumo(n, null)).toContain("/influenciadora");
  });
});
