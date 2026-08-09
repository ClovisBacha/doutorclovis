/**
 * A TRIAGEM DE SINTOMAS NÃO PODE SER PORTA ABERTA PARA A NOSSA CHAVE.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * `assessSymptoms` não pedia sessão, não tinha limite de taxa e não olhava
 * plano — e chamava o Gemini. Uma server function é um endpoint HTTP como outro
 * qualquer: bastava repetir a chamada para queimar a nossa chave, sem conta,
 * sem login e sem rastro em `ai_usage` de ninguém.
 *
 * ─── A PARTE QUE NÃO PODE SER "CORRIGIDA" DO JEITO ÓBVIO ────────────────────
 *
 * O reflexo é exigir sessão e recusar quem não tem. Aqui isso trocaria um
 * problema de custo por um problema de SEGURANÇA CLÍNICA.
 *
 * O nível de risco sai de `assessLevel` — regra pura, determinística, em
 * `src/lib/triage.ts`. A IA só escreve a explicação, e `LEVEL_FALLBACK` já
 * existe para quando não há chave. Recusar a chamada inteira faria uma gestante
 * com sangramento receber um ERRO em vez de "procure a maternidade agora".
 *
 * Então o gate é sobre o GASTO, não sobre a resposta. Sem sessão ela recebe a
 * mesma orientação, escrita à mão em vez de gerada.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const fn = readFileSync("src/lib/triage.functions.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const app = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");

describe("o gasto de modelo é trancado", () => {
  test("a chamada ao modelo depende de uma sessão válida", () => {
    expect(fn).toContain("if (key && podeGastarModelo && reasons.length > 0)");
    expect(fn).toContain("supabaseAdmin.auth.getUser(data.accessToken)");
  });

  test("e de um teto por PESSOA, não por IP", () => {
    /* O IP de uma operadora móvel é compartilhado por milhares de gestantes —
       limitar por IP cortaria justamente quem está na rua com sintoma. */
    expect(fn).toContain("triagemLimitada(u.user.id)");
    expect(fn).toContain("makeRateLimiter(12, 3_600_000)");
  });

  test("qualquer falha na checagem NEGA o gasto", () => {
    /* Falha fechando: um erro ao ler a sessão não pode virar chamada paga. */
    const i = fn.indexOf("const podeGastarModelo");
    const bloco = fn.slice(i, fn.indexOf("const key = process.env", i));
    expect(bloco).toContain("if (!data.accessToken) return false;");
    expect(bloco).toContain("if (!u?.user) return false;");
    expect(bloco).toContain("catch {\n        return false;");
  });
});

describe("mas a orientação CLÍNICA nunca é recusada", () => {
  test("o nível continua saindo da regra, antes de qualquer IA", () => {
    /**
     * É a linha que separa "cortei um custo" de "deixei uma gestante sem
     * resposta". `assessLevel` roda primeiro e não depende de nada externo.
     */
    const iNivel = fn.indexOf("assessLevel(data.symptoms");
    const iGate = fn.indexOf("const podeGastarModelo");
    expect(iNivel).toBeGreaterThan(-1);
    expect(iNivel).toBeLessThan(iGate);
  });

  test("sem sessão, a mensagem é a fixa por nível — não um erro", () => {
    expect(fn).toContain("let message = LEVEL_FALLBACK[level];");
    /* Nenhum caminho devolve erro por falta de token. */
    expect(fn).not.toContain('return { ok: false as const, error: "Não autenticado" }');
  });

  test("a sessão é OPCIONAL no validador — recusa no zod seria recusa da triagem", () => {
    /* `min(10)` sem `.optional()` faria o zod REJEITAR a chamada sem token
       antes de o handler rodar — e aí a decisão acima não valeria nada. */
    expect(fn).toContain("accessToken: z.string().min(10).optional()");
  });
});

describe("e o app manda a sessão", () => {
  test("a tela da paciente passa o token", () => {
    /* Sem isto o gate estaria certo e TODA paciente logada perderia a
       explicação escrita pela IA — o teste que prova a função e não o
       chamador, de novo. */
    const i = app.indexOf("await assessSymptoms({");
    expect(i).toBeGreaterThan(-1);
    expect(app.slice(i, i + 260)).toContain("accessToken: sess.session?.access_token");
  });
});

describe("a nota clínica da teleconsulta também pede plano", () => {
  /**
   * Ela EXIGIA sessão — não era porta aberta como a triagem. Mas não olhava
   * plano: um médico no Free abria Teleconsultas (a aba não é filtrada por
   * plano; o `podeIA` do painel cobre só a aba Cérebro) e gerava nota SOAP à
   * vontade, na nossa chave.
   *
   * Mesma régua da transcrição, e pelo mesmo motivo: o que chama modelo é do
   * produto de IA; o resto da plataforma é da casa.
   */
  const tele = readFileSync("src/lib/teleconsulta.functions.ts", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const bloco = tele.slice(tele.indexOf("export const generateClinicalNote"));

  test("o plano é conferido ANTES de tocar na chave", () => {
    const iPlano = bloco.indexOf("ent.aiApp");
    const iChave = bloco.indexOf("GOOGLE_GENERATIVE_AI_API_KEY");
    expect(iPlano).toBeGreaterThan(-1);
    expect(iPlano).toBeLessThan(iChave);
  });

  test("e a recusa oferece o plano, em vez de só negar", () => {
    /* Um "não autorizado" seco faria o médico achar que é defeito. */
    expect(bloco).toContain('fraseDoGancho("cerebro")');
  });

  test("a equipe passa, e o resto vem do plano do médico", () => {
    expect(bloco).toContain('getEntitlementsByDoctorId(scope.doctorId ?? "", scope.isTeam)');
  });
});
