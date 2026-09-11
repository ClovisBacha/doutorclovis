/**
 * QUANDO PERGUNTAR "DE 0 A 10".
 *
 * ⚠️ O NPS inteiro não tinha como receber uma resposta: `shouldAskNps` e
 * `submitNps` estavam escritas, testadas, e sem chamador no app. O relatório do
 * dono ficava em zero para sempre, sem nada quebrado a que apontar.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  AGRADECIMENTO,
  DIAS_DE_ADIAMENTO,
  DIAS_MINIMOS_DE_CONTA,
  classificar,
  contaNovaDemais,
  podeMostrarNps,
} from "./nps";

const AGORA = new Date("2026-08-28T12:00:00Z");
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86400000).toISOString();

const base = {
  perguntar: true,
  careMode: false as boolean | undefined,
  dispensadoEm: null,
  agora: AGORA,
};

describe("o portão do luto vem primeiro", () => {
  test("⚠️ em Modo Cuidado NUNCA pergunta", () => {
    /* "O quanto você recomendaria este app" para quem acabou de perder a
       gestação é indefensável. */
    expect(podeMostrarNps({ ...base, careMode: true })).toBe(false);
  });

  test("⚠️ 'não sei' também cala", () => {
    /* O perfil ainda não chegou. O pior caso de calar é uma pesquisa que não
       aconteceu; o de perguntar é a pergunta chegar a quem está de luto. */
    expect(podeMostrarNps({ ...base, careMode: undefined })).toBe(false);
  });
});

describe("o adiamento", () => {
  test("sem dispensa, pergunta", () => {
    expect(podeMostrarNps(base)).toBe(true);
  });

  test("dispensado ontem NÃO pergunta", () => {
    expect(podeMostrarNps({ ...base, dispensadoEm: diasAtras(1) })).toBe(false);
  });

  test(`dispensado há mais de ${DIAS_DE_ADIAMENTO} dias volta a perguntar`, () => {
    expect(podeMostrarNps({ ...base, dispensadoEm: diasAtras(DIAS_DE_ADIAMENTO + 1) })).toBe(true);
  });

  test("⚠️ carimbo ilegível cala", () => {
    expect(podeMostrarNps({ ...base, dispensadoEm: "amanhã de manhã" })).toBe(false);
  });

  test("⚠️ carimbo no FUTURO cala — inclusive muito no futuro", () => {
    /* ⚠️ O caso de 120 dias é o que faz esta asserção MORDER. Com 5 dias ela
       ficava verde mesmo trocando a subtração por `Math.abs`, e foi assim que
       a mutação mostrou que a guarda explícita que eu tinha escrito era código
       morto. Um relógio adiantado tem de calar, e nunca liberar. */
    expect(podeMostrarNps({ ...base, dispensadoEm: diasAtras(-5) })).toBe(false);
    expect(podeMostrarNps({ ...base, dispensadoEm: diasAtras(-120) })).toBe(false);
  });

  test("o servidor mandando não perguntar vence", () => {
    expect(podeMostrarNps({ ...base, perguntar: false })).toBe(false);
  });
});

describe("a conta nova", () => {
  test(`⚠️ antes de ${DIAS_MINIMOS_DE_CONTA} dias não se pergunta`, () => {
    /* Perguntar no dia 1 é perguntar sobre nada: a resposta mede a expectativa
       dela, não o produto. */
    expect(contaNovaDemais(diasAtras(1), AGORA)).toBe(true);
    expect(contaNovaDemais(diasAtras(DIAS_MINIMOS_DE_CONTA - 1), AGORA)).toBe(true);
  });

  test("depois disso, pode", () => {
    expect(contaNovaDemais(diasAtras(DIAS_MINIMOS_DE_CONTA + 1), AGORA)).toBe(false);
  });

  test("⚠️ sem data e com data ilegível NÃO pergunta", () => {
    expect(contaNovaDemais(null, AGORA)).toBe(true);
    expect(contaNovaDemais("ontem", AGORA)).toBe(true);
  });
});

describe("a classificação é a canônica", () => {
  test("9 e 10 promotoras, 7 e 8 neutras, o resto detratoras", () => {
    expect([9, 10].map(classificar)).toEqual(["promotora", "promotora"]);
    expect([7, 8].map(classificar)).toEqual(["neutra", "neutra"]);
    expect([0, 6].map(classificar)).toEqual(["detratora", "detratora"]);
  });

  test("⚠️ ela bate com a régua que o relatório usa para agregar", () => {
    /* Duas réguas para "quem é promotora" fariam a tela dizer um número e o
       relatório do dono outro. */
    const rel = readFileSync("src/lib/nps.functions.ts", "utf8");
    expect(rel).toContain("if (score >= 9) b.p += 1;");
    expect(rel).toContain("else if (score >= 7) b.pa += 1;");
  });
});

describe("o agradecimento", () => {
  test("⚠️ é UM só — não muda com a nota", () => {
    /* Responder à detratora com "o que podemos melhorar?" e à promotora com
       "avalie na loja" é o review gating que a diretriz 1.1.7 da App Store
       proíbe, e ensina que a nota mudou o tratamento que ela recebe. */
    const fonte = readFileSync("src/lib/nps.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
    expect(fonte).toContain("export const AGRADECIMENTO =");
    expect(fonte).not.toMatch(/AGRADECIMENTO_(PROMOTORA|DETRATORA)/);
    expect(AGRADECIMENTO).not.toMatch(/loja|App Store|Play Store|avali/i);
  });
});
