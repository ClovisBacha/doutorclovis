/**
 * SEIS LUGARES ONDE DUAS PARTES DO PRODUTO DIZIAM COISAS DIFERENTES.
 *
 * Todas achadas pela varredura de contradições. O padrão é sempre o mesmo: duas
 * peças respondem à MESMA pergunta e nunca se comparam.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PLAN_ENTITLEMENTS, PLAN_RANK, normalizePlan } from "./entitlements";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const nutricao = semComentarios("src/routes/api/nutrition.ts");
const clinica = semComentarios("src/lib/clinic.functions.ts");
const painel = semComentarios("src/routes/_authenticated/painel.tsx");
const plataforma = semComentarios("src/lib/platform.functions.ts");
const cerebro = semComentarios("src/lib/secondbrain.functions.ts");

describe("1. a Nutrição não chama de gestante quem está em luto", () => {
  /**
   * `NUTRICAO_EM_LUTO` proíbe, em maiúsculas, falar da gestação — e a frase que
   * apresenta o bloco do médico, concatenada logo abaixo dele, dizia "o bloco
   * acima é do médico que acompanha esta GESTANTE". Duas instruções
   * contraditórias no mesmo prompt: o mesmo defeito que os avisos de cota
   * tinham, no arquivo ao lado.
   */
  test("a palavra é escolhida conforme o estado dela", () => {
    expect(nutricao).toContain('const quemE = careMode ? "paciente" : "gestante";');
  });

  test("e a frase usa a escolhida, não a fixa", () => {
    expect(nutricao).toContain("acompanha esta ${quemE}");
    expect(nutricao).not.toContain("acompanha esta gestante");
  });

  test("com a ordem certa do ternário", () => {
    /* Invertido, toda gestante viraria "paciente" e a paciente em luto viraria
       "gestante" — o defeito de volta, para todo mundo. */
    const i = nutricao.indexOf("const quemE =");
    expect(nutricao.slice(i, i + 60)).toContain('careMode ? "paciente"');
  });
});

describe("2. criar uma clínica não arranca o médico da anterior", () => {
  test("o vínculo atual é conferido antes de trocar o assento", () => {
    /* `sairDaClinica` foi escrita para ser A porta de saída, e este caminho
       passava por fora: criar uma clínica sobrescrevia `clinic_id` em silêncio,
       tirando o médico da clínica anterior sem um evento sequer — nem para ele,
       nem para o admin de lá, que perde um membro e não fica sabendo. */
    const i = clinica.indexOf("export const createClinic");
    expect(i).toBeGreaterThan(-1);
    const corpo = clinica.slice(i, i + 3000);
    expect(corpo).toContain("if (!atual?.clinic_id) {");
    expect(corpo).toContain('.select("clinic_id")');
  });

  test("e a troca só acontece dentro dessa guarda", () => {
    const i = clinica.indexOf("export const createClinic");
    const corpo = clinica.slice(i, i + 3000);
    const guarda = corpo.indexOf("if (!atual?.clinic_id) {");
    const troca = corpo.indexOf('clinic_role: "admin"');
    expect(guarda).toBeGreaterThan(-1);
    expect(troca).toBeGreaterThan(guarda);
  });
});

describe("3. a tela conta PACIENTES, como o servidor já contava", () => {
  /**
   * `hits` conta re-perguntas: a mesma gestante perguntando três vezes fazia a
   * tela dizer "3 pacientes" e esconder a sugestão de responder só para ela — a
   * única orientação que a tela dá sobre a decisão mais delicada do painel. E o
   * SERVIDOR já contava `brain_gap_askers` para recusar. Tela e servidor
   * contando coisas diferentes sobre a MESMA decisão.
   */
  test("`listBrainGaps` devolve pacientes distintas", () => {
    const i = cerebro.indexOf("export const listBrainGaps");
    const corpo = cerebro.slice(i, i + 4000);
    expect(corpo).toContain('.from("brain_gap_askers")');
    expect(corpo).toContain('.select("gap_id,user_id")');
    expect(corpo).toContain("new Set<string>()");
  });

  test("e a tela usa `pacientes`, não `hits`", () => {
    expect(painel).toContain("g.pacientes === 1 && !soParaEla");
    expect(painel).not.toContain("g.hits === 1 && !soParaEla");
  });

  test("sem a contagem, a tela não afirma nada", () => {
    /* `pacientes` é opcional: a consulta pode falhar. `undefined === 1` é
       falso, então a sugestão simplesmente não aparece — em vez de aparecer
       errada. */
    const i = cerebro.indexOf("pacientes?: number;");
    expect(i).toBeGreaterThan(-1);
  });
});

describe("4. o MRR não conta assinatura vencida", () => {
  test("passa pela régua e normaliza a chave", () => {
    /* Dois erros na mesma linha, em sentidos opostos: um `pro` com o cartão
       recusado há meses somava para sempre, e qualquer variante de escrita do
       plano caía no `?? 0` e sumia da conta em silêncio. */
    const i = plataforma.indexOf("const mrrEstimate");
    expect(i).toBeGreaterThan(-1);
    const bloco = plataforma.slice(i, i + 300);
    expect(bloco).toContain("planoVigente(d.plan, d.plan_expires_at)");
    expect(bloco).toContain("normalizePlan(");
  });

  test("e a coluna do vencimento chega até ele", () => {
    expect(plataforma).toContain("plan,plan_expires_at,active,verified,created_at");
  });
});

describe("5. a escada de planos é monotônica de ponta a ponta", () => {
  /**
   * O teste de ordenação existente não olhava para `clinica` — a mudança de
   * rank 6 para 8 passou sem nenhuma cobertura. E foi essa mudança que tornou a
   * exceção "só sobe quem está abaixo do Elite" uma inversão.
   */
  const ESCADA = ["free", "essencial", "starter", "pro", "elite", "black", "clinica"];

  test("cada degrau tem rank estritamente maior que o anterior", () => {
    for (let i = 1; i < ESCADA.length; i++) {
      expect(PLAN_RANK[normalizePlan(ESCADA[i])]).toBeGreaterThan(
        PLAN_RANK[normalizePlan(ESCADA[i - 1])],
      );
    }
  });

  test("subir de degrau nunca reduz convites premium", () => {
    /* A forma exata do defeito que motivou o conserto: `CLINICA` herdava de
       `PRO` e ficava ACIMA de `ELITE`, então subir zerava os 25 convites. */
    for (let i = 1; i < ESCADA.length; i++) {
      const antes = PLAN_ENTITLEMENTS[normalizePlan(ESCADA[i - 1])];
      const depois = PLAN_ENTITLEMENTS[normalizePlan(ESCADA[i])];
      expect(depois.premiumInvitesPerMonth ?? 0).toBeGreaterThanOrEqual(
        antes.premiumInvitesPerMonth ?? 0,
      );
    }
  });

  test("nem reduz o teto de pacientes (null = sem teto)", () => {
    const teto = (v: number | null | undefined) => (v === null ? Infinity : (v ?? 0));
    for (let i = 1; i < ESCADA.length; i++) {
      const antes = PLAN_ENTITLEMENTS[normalizePlan(ESCADA[i - 1])];
      const depois = PLAN_ENTITLEMENTS[normalizePlan(ESCADA[i])];
      expect(teto(depois.maxPatients)).toBeGreaterThanOrEqual(teto(antes.maxPatients));
    }
  });

  test("nem o teto de cérebros", () => {
    const teto = (v: number | null | undefined) => (v === null ? Infinity : (v ?? 0));
    for (let i = 1; i < ESCADA.length; i++) {
      const antes = PLAN_ENTITLEMENTS[normalizePlan(ESCADA[i - 1])];
      const depois = PLAN_ENTITLEMENTS[normalizePlan(ESCADA[i])];
      expect(teto(depois.maxBrains)).toBeGreaterThanOrEqual(teto(antes.maxBrains));
    }
  });
});
