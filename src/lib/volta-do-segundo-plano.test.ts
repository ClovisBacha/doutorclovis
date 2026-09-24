/**
 * A VOLTA DO SEGUNDO PLANO, NA CASCA.
 *
 * ⚠️ Num app nativo a página não "carrega de novo" quando ela volta: fica dias
 * viva. Duas coisas dependiam de a página recarregar e por isso não aconteciam:
 * a renovação do token do Supabase (é por TIMER, e o iOS congela timers em
 * segundo plano) e a renovação do token de push (só rodava quando o cartão de
 * avisos montava). `appStateChange` é o gancho, e `startAutoRefresh` /
 * `stopAutoRefresh` é o par que a documentação do Supabase manda ligar a ele.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { semComentarios } from "@/lib/sem-comentarios";

const NATIVO = semComentarios(readFileSync("src/lib/nativo.ts", "utf8"));

describe("⚠️ a casca ouve a volta do segundo plano", () => {
  test("o listener existe e é ligado junto com o botão de voltar", () => {
    expect(NATIVO).toContain('addListener("appStateChange"');
    expect(NATIVO).toMatch(/ligarBotaoVoltar\(App\);\s*ligarVoltaDoSegundoPlano\(App\);/);
  });

  test("a sessão do Supabase para e volta a renovar com o app", () => {
    expect(NATIVO).toContain("supabase.auth.startAutoRefresh()");
    expect(NATIVO).toContain("supabase.auth.stopAutoRefresh()");
  });

  test("o token de push é renovado na volta, e não só quando o cartão monta", () => {
    expect(NATIVO).toContain("renovarAvisosSeJaAutorizado()");
  });

  test("tudo por import dinâmico — o navegador não paga por isto", () => {
    expect(NATIVO).toContain('import("@/integrations/supabase/client")');
    expect(NATIVO).toContain('import("@/lib/avisos")');
    expect(NATIVO).not.toMatch(/^import \{[^}]*\} from "@\/integrations\/supabase\/client"/m);
  });
});
