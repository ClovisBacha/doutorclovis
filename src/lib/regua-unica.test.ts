/**
 * UMA RÉGUA COM QUATRO CÓPIAS NÃO É UMA RÉGUA.
 *
 * `planoVigente` foi escrita como a "régua única de vencimento" — e chegou a UM
 * dos caminhos. Um verificador achou as outras três, cada uma discordando dela
 * de um jeito:
 *
 *  · `aiSearchDoctors` ranqueava pela coluna crua e nem SELECIONAVA
 *    `plan_expires_at`: um Elite com o cartão recusado seguia no topo de toda
 *    busca por IA, indefinidamente — que é textualmente o defeito que o caminho
 *    irmão (`planoValido`) tinha acabado de consertar.
 *  · `chooseDoctor` mantinha a regra ANTIGA inteira (`plan === "trial" && ...`),
 *    discordando nos dois eixos: deixava um `pro` vencido com 150 pacientes e
 *    derrubava um assinante em dia por um webhook atrasado de algumas horas.
 *  · A cota de convites premium não lia `plan_expires_at`, não conhecia o
 *    assento de clínica e não conhecia o dono da instalação — e a assimetria
 *    estava no MESMO arquivo, porque o caminho de RESGATE já usava o resolvedor.
 *
 * O teste que faltava é o de INVENTÁRIO: qualquer cópia nova reaparece aqui.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const doctors = semComentarios("src/lib/doctors.functions.ts");
const invites = semComentarios("src/lib/invites.functions.ts");
const carta = semComentarios("src/routes/api/carta-semanal.ts");
const cerebro = semComentarios("src/lib/secondbrain.functions.ts");

describe("1. nenhuma cópia da regra de vencimento sobrou", () => {
  /**
   * A forma da regra antiga: comparar `plan_expires_at` com `Date.now()` na mão.
   * Onde quer que ela reapareça, é uma quinta régua nascendo.
   */
  const REGRA_NA_MAO =
    /new Date\(\s*\w+\.plan_expires_at[\s\S]{0,40}\)\.getTime\(\)\s*<\s*Date\.now\(\)/;

  test("`doctors.functions` não recalcula vencimento na mão", () => {
    expect(doctors).not.toMatch(REGRA_NA_MAO);
  });

  test("e `chooseDoctor` usa a régua", () => {
    const i = doctors.indexOf("const planoEfetivo =");
    expect(i).toBeGreaterThan(-1);
    expect(doctors.slice(i, i + 200)).toContain("planoVigente(doc.plan, doc.plan_expires_at)");
  });
});

describe("2. a busca por IA ranqueia pela régua, não pela coluna", () => {
  test("`plan_expires_at` chega ao diretório", () => {
    /* Sem a coluna no SELECT, nenhuma régua teria o que ler — foi por isso que
       o defeito passou: a correção do irmão não podia funcionar aqui. */
    expect(doctors).toContain("plan,plan_expires_at,slug,bio,whatsapp");
  });

  test("e o desempate por plano passa por `planoVigente`", () => {
    const i = doctors.indexOf("score += PLAN_RANK[");
    expect(i).toBeGreaterThan(-1);
    const linha = doctors.slice(i, i + 160);
    expect(linha).toContain("vigente(d.plan, d.plan_expires_at)");
  });

  test("o ranking não lê mais `normalizePlan(d.plan)` sozinho", () => {
    /* A asserção que descreve o defeito. */
    expect(doctors).not.toContain("score += PLAN_RANK[normalizePlan(d.plan)] ?? 0;");
  });
});

describe("3. a cota de convites vem do resolvedor", () => {
  test("nada de `entitlementsFor(doc.plan)` — nem uma vez", () => {
    /* Ela ignora vencimento, assento de clínica e ADMIN_EMAILS, que são
       exatamente as três coisas que só o resolvedor conhece. */
    expect(invites).not.toContain("entitlementsFor(doc.plan)");
  });

  test("o teto sai de `getEntitlements`", () => {
    expect(invites).toContain('await import("./entitlements.server")');
    expect(invites).toContain("await getEntitlements(u.user)");
  });

  test("e é calculado UMA vez, para os dois chamadores", () => {
    /* Foi assim que os dois divergiram do caminho de resgate: cada um com a
       própria linha. */
    expect(invites.match(/const limit = convitesPorMes;/g)).toHaveLength(2);
  });
});

describe("4. o dono da clínica passa pela mesma régua de todo mundo", () => {
  test("`isPlatformTeamEmail` é consultado no assento", () => {
    /* Todo outro caminho do arquivo consultava; só este olhava a coluna `plan`
       direto — e a linha da própria equipe costuma ser `free`, porque a
       promoção dela vive na variável de ambiente. */
    const ent = semComentarios("src/lib/entitlements.server.ts");
    const i = ent.indexOf("const planoDoDono");
    expect(i).toBeGreaterThan(-1);
    expect(ent.slice(Math.max(0, i - 700), i + 120)).toContain("isPlatformTeamEmail(emailDoDono)");
  });
});

describe("5. a carta semanal ganhou os dois tetos", () => {
  test("o teto de ENTRADA existe — `babyDesc` não entra mais cru", () => {
    /* O comentário do topo do arquivo já descrevia este defeito: "é a pior das
       três nesse aspecto". Só metade tinha sido consertada. */
    expect(carta).toContain('body.babyDesc?.trim() || "").slice(0, 600)');
    expect(carta).not.toContain('const babyDesc = body.babyDesc?.trim() || "";');
  });

  test("o nome do bebê também", () => {
    expect(carta).toContain('body.babyName?.trim() || "").slice(0, 60)');
  });

  test("e o teto de SAÍDA — o prompt pede, ele não limita", () => {
    /* "Máximo 180 palavras" é pedido; um modelo em laço gera até o teto do
       provedor e a conta é nossa. */
    expect(carta).toContain("maxOutputTokens:");
  });
});

describe("6. responder uma pergunta exige o vínculo de HOJE", () => {
  test("`answerAndTrain` confere `patient_profiles.doctor_id`", () => {
    /* `.eq("doctor_id", ...)` na pergunta é o carimbo HISTÓRICO da linha. Sem
       o recorte, o médico de quem ela se desvinculou continuava gravando texto
       na aba dela. O gêmeo `responderPergunta` já tinha a checagem. */
    const i = cerebro.indexOf("export const answerAndTrain");
    expect(i).toBeGreaterThan(-1);
    const corpo = cerebro.slice(i, cerebro.indexOf("\nconst TestSchema", i));
    expect(corpo).toContain('.from("patient_profiles")');
    expect(corpo).toContain('.eq("doctor_id", target.doctorId)');
    expect(corpo).toContain('reason: "sem_vinculo"');
  });

  test("e a checagem vem ANTES de qualquer escrita", () => {
    const i = cerebro.indexOf("export const answerAndTrain");
    const corpo = cerebro.slice(i, cerebro.indexOf("\nconst TestSchema", i));
    const vinculo = corpo.indexOf('reason: "sem_vinculo"');
    const escrita = corpo.indexOf('.from("brain_entries")');
    expect(vinculo).toBeGreaterThan(-1);
    expect(escrita).toBeGreaterThan(-1);
    expect(vinculo).toBeLessThan(escrita);
  });
});
