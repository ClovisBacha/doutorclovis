/**
 * A VOLTA DO SEGUNDO PLANO, NA CASCA.
 *
 * ⚠️ Num app nativo a página não "carrega de novo" quando ela volta: fica dias
 * viva. O token de push só era renovado quando o cartão de avisos montava.
 * `appStateChange` é o gancho — e a renovação vai COM CALMA, no máximo uma vez a
 * cada 12 h: `inscreverPushNativo` registra e escreve no servidor, e dez trocas
 * de app numa sessão de contrações não podem virar dez registros iguais.
 *
 * ⚠️ E a sessão do Supabase NÃO entra: o supabase-js já ouve `visibilitychange`,
 * que o WKWebView dispara na volta. Uma segunda mão no mesmo relógio só
 * esconderia a causa real de um token vencido, se ela existir.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";
import { INTERVALO_DE_RENOVACAO_MS, deveRenovarAvisos } from "@/lib/nativo";

const NATIVO = semComentarios(readFileSync("src/lib/nativo.ts", "utf8"));

describe("⚠️ a casca ouve a volta do segundo plano", () => {
  test("o listener existe e é ligado junto com o botão de voltar", () => {
    expect(NATIVO).toContain('addListener("appStateChange"');
    expect(NATIVO).toMatch(/ligarBotaoVoltar\(App\);\s*ligarVoltaDoSegundoPlano\(App\);/);
  });

  test("o token de push é renovado na volta, por import dinâmico", () => {
    expect(NATIVO).toContain("renovarAvisosSeJaAutorizado()");
    expect(NATIVO).toContain('import("@/lib/avisos")');
  });

  test("⚠️ e NÃO põe a mão no relógio de renovação do Supabase", () => {
    expect(NATIVO).not.toContain("startAutoRefresh");
    expect(NATIVO).not.toContain("stopAutoRefresh");
    expect(NATIVO).not.toContain('import("@/integrations/supabase/client")');
  });
});

describe("⚠️ a renovação vai com calma", () => {
  test("nunca renovou → renova; renovou agora há pouco → não; passou o intervalo → sim", () => {
    const agora = 1_700_000_000_000;
    expect(deveRenovarAvisos(null, agora)).toBe(true);
    expect(deveRenovarAvisos(Number.NaN, agora)).toBe(true);
    expect(deveRenovarAvisos(agora - 60_000, agora)).toBe(false);
    expect(deveRenovarAvisos(agora - INTERVALO_DE_RENOVACAO_MS + 1, agora)).toBe(false);
    expect(deveRenovarAvisos(agora - INTERVALO_DE_RENOVACAO_MS, agora)).toBe(true);
  });

  test("o intervalo é de horas, não de minutos", () => {
    expect(INTERVALO_DE_RENOVACAO_MS).toBe(12 * 60 * 60 * 1000);
    expect(NATIVO).toContain("if (!deveRenovarAvisos(ultima, Date.now())) return;");
  });
});
