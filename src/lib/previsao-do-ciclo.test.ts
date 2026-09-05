/**
 * A PREVISÃO DO CICLO SÓ EXISTE ENQUANTO O ÚLTIMO PERÍODO É RECENTE.
 *
 * ⚠️ `buildCycleModel` projeta o ciclo médio a partir do ÚLTIMO período e não
 * sabe a idade dele: com um período de nove meses atrás, o "dia do ciclo" é a
 * data de hoje módulo 28 — fabricado, com "próximo período" e "janela fértil"
 * fabricados junto. Foi assim que o anel previu período para uma gestante.
 *
 * ⚠️ E a bandeira "gestante" sozinha não bastava. O aviso prometia "a previsão
 * volta depois do parto", e `computeGestation` conta para sempre: depois do
 * nascimento `weeks` continuava não-nulo e o anel nunca voltava — ou, se a
 * bandeira caísse, voltava projetando o período de antes da gravidez. O print
 * do dono, com a conta dele marcada como gestante, é que destapou os dois.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { PREVISAO_VALE_ATE_DIAS, previsaoAindaVale } from "./ciclo-menstrual";

const semProsa = (t: string) =>
  t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

/* ⚠️ Datas CRAVADAS: teste que lê o relógio falha às terças. */
const HOJE = new Date("2026-09-05T12:00:00-03:00");
const atras = (d: number) => new Date(HOJE.getTime() - d * 86400000);

describe("previsaoAindaVale", () => {
  test("período de duas semanas atrás: vale", () => {
    expect(previsaoAindaVale(atras(12), HOJE)).toBe(true);
  });
  test("no limite ainda vale; um dia depois, não", () => {
    expect(previsaoAindaVale(atras(PREVISAO_VALE_ATE_DIAS), HOJE)).toBe(true);
    expect(previsaoAindaVale(atras(PREVISAO_VALE_ATE_DIAS + 1), HOJE)).toBe(false);
  });
  test("⚠️ o caso do pós-parto: último período de dez meses atrás NÃO vale", () => {
    expect(previsaoAindaVale(atras(300), HOJE)).toBe(false);
  });
  test("período no futuro (relógio errado) não vale", () => {
    expect(previsaoAindaVale(atras(-3), HOJE)).toBe(false);
  });
  test("o limite é dois ciclos inteiros do teto do modelo", () => {
    /* O modelo trava o ciclo em 45 dias; dois sem registro é chute. */
    expect(PREVISAO_VALE_ATE_DIAS).toBe(90);
  });
});

describe("a tela obedece à régua, e a aba diz a verdade sobre o parto", () => {
  const TELA = semProsa(readFileSync("src/components/ciclo-menstrual-tab.tsx", "utf8"));
  const CONTA = semProsa(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

  test("⚠️ o anel e o calendário passam pela régua de idade, não só pela bandeira", () => {
    expect(TELA).toMatch(/historicoVelho = model != null && !previsaoAindaVale\(model\.lastStart/);
    expect(TELA).toMatch(/mostraPrevisao = model != null && !gestante && !historicoVelho/);
    expect(TELA).toContain("!mostraPrevisao ? null : model ?");
  });

  test("⚠️ 'gestante' é gestação SEM nascimento — senão a previsão nunca volta", () => {
    expect(CONTA).toMatch(/SaudeMulherHub gestante=\{gest != null && !profile\?\.birth_date\}/);
  });

  test("o aviso do histórico velho diz o FATO e não cobra", () => {
    const i = TELA.indexOf("A previsão está pausada");
    expect(i).toBeGreaterThan(-1);
    const bloco = TELA.slice(i, i + 400);
    expect(bloco).not.toMatch(/você não registrou|você deixou|esqueceu/i);
    expect(bloco).toMatch(/registrar um período novo/);
  });
});
