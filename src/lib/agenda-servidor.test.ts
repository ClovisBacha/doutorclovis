/**
 * O SERVIDOR É O BACKSTOP — e quatro invariantes dele não podem se perder.
 *
 * O painel roda contra um banco que fica atrás do repo (migrations pendentes),
 * e este arquivo cobra coisas que só quebram em produção, meses depois, sem
 * teste de unidade que as pegue de outro jeito:
 *
 *   1. O choque de horário em `marcarConsultaNoDia` compara FAIXA, não minuto
 *      exato — senão 10:00–10:30 e 10:15 passam como "livre".
 *   2. As DUAS colunas novas (`patient_user_id`, `duration_minutes`) têm recuo
 *      próprio contra PGRST204 — senão marcar consulta, que funciona hoje,
 *      para de funcionar no banco que só rodou metade dos SQLs.
 *   3. O aviso em massa (`sendDoctorBroadcast`) nunca manda para paciente de
 *      OUTRO médico, mesmo com um id forjado no corpo do pedido.
 *   4. O X de cancelar, no dia da agenda, manda cada tipo de evento para a
 *      tabela certa — um `ped:` cancelado como `part:` erraria a linha
 *      inteira, e o UPDATE recusaria em silêncio (a busca por id não bate).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** O trecho entre duas âncoras — nunca a primeira ocorrência solta da
    segunda âncora, que é como um teste casa com a função vizinha errada. */
function trecho(fonte: string, inicio: string, fim: string): string {
  const i = fonte.indexOf(inicio);
  expect(i).toBeGreaterThan(-1);
  const j = fonte.indexOf(fim, i + inicio.length);
  expect(j).toBeGreaterThan(i);
  return fonte.slice(i, j);
}

const admin = semComentarios("src/lib/admin.functions.ts");

describe("1. marcarConsultaNoDia — o choque é de FAIXA", () => {
  const fn = trecho(admin, "export const marcarConsultaNoDia", "export const contatoDaPaciente");

  test('usa a régua pura de sobreposição, não `.eq("confirmed_time", ...)`', () => {
    /* A checagem antiga comparava minuto exato — passava reto por uma consulta
       de 30 min que começa 15 minutos depois de outra. */
    expect(fn).toContain("minutosDesdeMeiaNoite");
    expect(fn).not.toContain('.eq("confirmed_time", data.hora)');
  });

  test("lê o dia inteiro, com a duração de cada linha", () => {
    expect(fn).toContain('.select("id, patient_name, confirmed_time, duration_minutes")');
  });

  test("a duração do médico entra na linha gravada", () => {
    expect(fn).toContain("duration_minutes: data.duracaoMinutos");
  });

  test("o recuo de PGRST204 tira as DUAS colunas novas, uma por vez", () => {
    /**
     * Um recuo que só sabe tirar `patient_user_id` (a versão antiga) volta a
     * quebrar assim que `duration_minutes` chegar num banco que só rodou o SQL
     * do vínculo — o INSERT falharia de novo, com a mesma coluna já removida
     * e a nova ainda no payload.
     */
    expect(fn).toContain('for (const coluna of ["patient_user_id", "duration_minutes"] as const)');
    expect(fn).toContain("delete linha[coluna]");
  });
});

describe("2. contatoDaPaciente — não vaza contato de paciente de outro médico", () => {
  const fn = trecho(admin, "export const contatoDaPaciente", "const ProposeSchema");

  test("confere o vínculo ANTES de ler e-mail/telefone", () => {
    const iVinculo = fn.indexOf("prof.doctor_id !== scope.doctorId");
    const iGetUser = fn.indexOf("auth.admin.getUserById");
    expect(iVinculo).toBeGreaterThan(-1);
    expect(iGetUser).toBeGreaterThan(iVinculo);
  });

  test("paciente inexistente ou de outro médico recusa, sem devolver contato", () => {
    expect(fn).toContain('return { ok: false as const, error: "Paciente não encontrada." }');
    expect(fn).toContain('return { ok: false as const, error: "Paciente não é sua." }');
  });
});

describe("3. sendDoctorBroadcast — o filtro nunca escapa do escopo do médico", () => {
  const fn = trecho(admin, "export const sendDoctorBroadcast", "export type AdminWaitlistEntry");

  test("`ids` nasce de uma leitura JÁ recortada pelo médico (`scopedBy`)", () => {
    const iScoped = fn.indexOf("scopedBy(");
    const iIntersecao = fn.indexOf("escolhidas.has(id)");
    expect(iScoped).toBeGreaterThan(-1);
    expect(iIntersecao).toBeGreaterThan(iScoped);
  });

  test("o filtro é INTERSEÇÃO com `ids`, não substituição por `patientIds` cru", () => {
    /**
     * Se o código fizesse `ids = data.patientIds` direto, um id de paciente de
     * OUTRO médico no corpo do pedido receberia o aviso — o escopo existiria
     * na query mas não seria usado. A interseção é o que faz um id forjado
     * simplesmente não aparecer na lista final, sem precisar de outra consulta
     * para rejeitá-lo.
     */
    expect(fn).toContain("ids = ids.filter((id) => escolhidas.has(id))");
    expect(fn).not.toMatch(/ids\s*=\s*data\.patientIds/);
  });

  test("sem `patientIds`, continua mandando para todas — o comportamento de sempre", () => {
    expect(fn).toContain("if (data.patientIds && data.patientIds.length > 0)");
  });
});

describe("4. cancelar no dia da agenda — cada prefixo vai para a fonte certa", () => {
  const painel = semComentarios("src/routes/_authenticated/painel.tsx");
  const fn = trecho(
    painel,
    "aoCancelar={async (ev) => {",
    "<GoogleCalendarCard tokenFn={token} />",
  );

  test("`ped:` cancela em appointment_requests, via `updateAppointmentStatus`", () => {
    const iPrefixo = fn.indexOf('ev.id.startsWith("ped:")');
    const iChamada = fn.indexOf("updateAppointmentStatus({");
    const iStatus = fn.indexOf('status: "cancelled"');
    expect(iPrefixo).toBeGreaterThan(-1);
    expect(iChamada).toBeGreaterThan(iPrefixo);
    expect(iStatus).toBeGreaterThan(iChamada);
  });

  test("`tele:` cancela em teleconsulta_sessions, via `updateTeleconsultaStatus`", () => {
    const iPrefixo = fn.indexOf('ev.id.startsWith("tele:")');
    const iChamada = fn.indexOf("updateTeleconsultaStatus({");
    const iStatus = fn.indexOf('status: "cancelada"');
    expect(iPrefixo).toBeGreaterThan(-1);
    expect(iChamada).toBeGreaterThan(iPrefixo);
    expect(iStatus).toBeGreaterThan(iChamada);
  });

  test("`part:` cancela em private_consultations, via `confirmPaymentForDoctor`", () => {
    const iPrefixo = fn.indexOf('ev.id.startsWith("part:")');
    const iChamada = fn.indexOf("confirmPaymentForDoctor({");
    const iStatus = fn.indexOf('status: "cancelado"');
    expect(iPrefixo).toBeGreaterThan(-1);
    expect(iChamada).toBeGreaterThan(iPrefixo);
    expect(iStatus).toBeGreaterThan(iChamada);
  });

  test("um prefixo desconhecido recusa, em vez de cair num dos três ramos por acaso", () => {
    expect(fn).toContain('return { ok: false, erro: "Tipo de evento desconhecido." }');
  });
});

describe("5. teleconsulta_sessions aceita «cancelada»", () => {
  const tele = semComentarios("src/lib/teleconsulta.functions.ts");

  test("o validador de updateTeleconsultaStatus inclui «cancelada» no enum", () => {
    /**
     * O CHECK do banco (`teleconsulta_sessions_status_check`) nasceu fechado
     * em três palavras — sem esta linha, o zod aceitaria "cancelada" e o
     * Postgres recusaria o UPDATE com violação de CHECK, uma camada abaixo de
     * onde dá para testar sem banco de verdade.
     */
    expect(tele).toContain('status: z.enum(["agendada", "sala_aberta", "encerrada", "cancelada"])');
  });
});
