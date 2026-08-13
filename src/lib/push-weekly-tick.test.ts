/**
 * O AVISO SEMANAL DE GRATIDÃO — o que precisa estar certo nele.
 *
 * O cron inteiro depende de `supabaseAdmin`, o que torna caro montar um teste
 * de execução completa aqui (a mesma razão pela qual `cobrarLacunasParadas`,
 * ao lado, também nunca teve um). O que estes testes cobram são os
 * INVARIANTES que, se sumirem do código, mandam push para quem não pode
 * receber — Modo Cuidado, fora do domingo, ou reinventando o prefixo do
 * diário em vez de reaproveitar `PREFIXO_GRATIDAO`.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const FONTE = readFileSync("src/routes/api/push-weekly-tick.ts", "utf8");
const NUDGE = FONTE.slice(
  FONTE.indexOf("async function nudgeGratidaoDaSemana"),
  FONTE.indexOf("export const Route"),
);

describe("⚠️ o aviso semanal de gratidão", () => {
  test("só roda aos domingos, no fuso de Brasília", () => {
    /* A mesma armadilha que `cobrarLacunasParadas` já evita: a Vercel roda em
       UTC, e ler `getDay()` sem converter o fuso primeiro dispararia o push
       no dia errado para quem está em São Paulo à noite. */
    expect(NUDGE).toContain('timeZone: "America/Sao_Paulo"');
    expect(NUDGE).toContain("hojeBR.getDay() !== 0");
  });

  test("⚠️ nunca em Modo Cuidado", () => {
    /* Mesma régua de `celebrate.ts`: celebração é alegria, e "coisas boas"
       não pode chegar a quem perdeu a gestação. */
    expect(NUDGE).toContain('.eq("care_mode", true)');
    expect(NUDGE).toContain("porPaciente.delete(p.id)");
  });

  test("reaproveita PREFIXO_GRATIDAO — nunca reescreve 'Gratidão: ' à mão", () => {
    /* Duas cópias do mesmo prefixo divergem no primeiro conserto, e a
       divergência aqui seria silenciosa: o cron simplesmente contaria zero
       gratidões, sem erro nenhum. */
    expect(NUDGE).toContain('import("@/lib/gratidao")');
    expect(NUDGE).toContain("PREFIXO_GRATIDAO");
    expect(NUDGE).not.toMatch(/ilike\("content",\s*"Gratidão/);
  });

  test("é stateless — sem tabela de 'já mandei', o controle é o dia da semana", () => {
    expect(NUDGE).not.toMatch(/from\(["']gratidao_avisos["']\)/);
  });

  test("o deep-link usa o rótulo exato da aba — 'Caminho', com C maiúsculo", () => {
    /* `minha-conta` compara `?tab=` com os rótulos de `TABS` e ignora em
       silêncio o que não bate — errar a caixa aqui é o mesmo defeito que já
       existiu no aviso de presente do médico. */
    expect(NUDGE).toContain('url: "/minha-conta?tab=Caminho"');
  });

  test("chamado a partir do handler principal, dentro do try", () => {
    const chamada = FONTE.indexOf("await nudgeGratidaoDaSemana()");
    const doTry = FONTE.indexOf("try {");
    const doCatch = FONTE.indexOf("} catch (e)");
    expect(chamada).toBeGreaterThan(doTry);
    expect(chamada).toBeLessThan(doCatch);
  });
});
