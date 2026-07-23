import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Escapa texto do usuário antes de interpolar em HTML de e-mail (anti-injeção). */
function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Quem é "o médico": e-mails autorizados, separados por vírgula em ADMIN_EMAILS.
// Ex.: ADMIN_EMAILS="bachaclovis@gmail.com,secretaria@consultorio.com"
function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  if (!adminEmails().includes(data.user.email.toLowerCase())) return null;
  return data.user;
}

/**
 * Escopo multi-tenant do painel: equipe da instalação (ADMIN_EMAILS) OU médico
 * assinante ativo. Retorna quem é (isTeam) e o doctor_id do assinante para
 * recortar os dados. A equipe vê a instalação inteira; o assinante vê apenas o
 * que estiver vinculado ao PRÓPRIO doctor_id.
 */
type PanelScope = {
  user: { id: string; email?: string | null };
  isTeam: boolean;
  doctorId: string | null;
};

async function requireScope(accessToken: string): Promise<PanelScope | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  if (adminEmails().includes(data.user.email.toLowerCase())) {
    return { user: data.user, isTeam: true, doctorId: null };
  }
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (doc?.active) return { user: data.user, isTeam: false, doctorId: doc.id as string };
  return null;
}

/** Recorta uma query por doctor_id quando o chamador é um médico assinante. */
function scopedBy(qb: any, scope: PanelScope) {
  return scope.isTeam ? qb : qb.eq("doctor_id", scope.doctorId);
}

/**
 * Verifica se o chamador PODE mutar a linha `id` da tabela `table`.
 * Fail-closed: a equipe sempre pode; o assinante só se o doctor_id da linha
 * for exatamente o dele (linha sem doctor_id → negado para assinante).
 */
async function assertOwnsRow(
  sb: any,
  table: string,
  id: string,
  scope: PanelScope,
): Promise<boolean> {
  if (scope.isTeam) return true;
  const { data } = await sb.from(table).select("doctor_id").eq("id", id).maybeSingle();
  return !!data && data.doctor_id === scope.doctorId;
}

const TokenSchema = z.object({ accessToken: z.string().min(10) });

/** Diz se o usuário do token é um administrador (usado para mostrar o link). */
export const checkIsAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => ({ isAdmin: (await requireAdmin(data.accessToken)) !== null }));

export type AdminAppointment = {
  id: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  preferred_date: string;
  preferred_time: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
};

export type AdminQuestion = {
  id: string;
  question: string;
  answered: boolean;
  created_at: string;
  patient: string;
};

export type PatientEngagement = {
  id: string;
  display_name: string | null;
  baby_name: string | null;
  lmp_date: string | null;
  reference_date: string | null;
  reference_weeks: number | null;
  reference_days: number | null;
  isActive: boolean;
  lastActivityAt: string | null;
  hasUnseenForm: boolean;
};

export type AdminPreConsulta = {
  id: string;
  user_id: string;
  patient_name: string;
  submitted_at: string;
  weeks_at_submission: number | null;
  current_weight: number | null;
  systolic: number | null;
  diastolic: number | null;
  symptoms: string[];
  medications: string | null;
  questions: string | null;
  emotional_state: string | null;
  other_notes: string | null;
  seen_by_doctor: boolean;
};

/** Carrega os dados do painel do médico (pedidos de consulta + perguntas). */
export const getAdminData = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const [appts, questions, profiles] = await Promise.all([
      scopedBy(
        sb
          .from("appointment_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        scope,
      ),
      scopedBy(
        sb
          .from("doctor_questions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        scope,
      ),
      scopedBy(sb.from("patient_profiles").select("id,display_name,doctor_id"), scope),
    ]);

    const nameById = new Map(
      (profiles.data ?? []).map((p: { id: string; display_name: string | null }) => [
        p.id,
        p.display_name,
      ]),
    );
    const questionsWithName: AdminQuestion[] = (questions.data ?? []).map(
      (q: {
        id: string;
        user_id: string;
        question: string;
        answered: boolean;
        created_at: string;
      }) => ({
        id: q.id,
        question: q.question,
        answered: q.answered,
        created_at: q.created_at,
        patient: nameById.get(q.user_id) ?? "Paciente",
      }),
    );

    return {
      ok: true as const,
      isTeam: scope.isTeam,
      appointments: (appts.data ?? []) as AdminAppointment[],
      questions: questionsWithName,
    };
  });

const StatusSchema = z.object({
  accessToken: z.string().min(10),
  id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "done", "cancelled"]),
});

/** Atualiza o status de um pedido de consulta. */
export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => StatusSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "appointment_requests", data.id, scope)))
      return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("appointment_requests")
      .update({ status: data.status })
      .eq("id", data.id);

    // Cancelamento também fecha o ciclo: a paciente fica sabendo na hora.
    if (!error && data.status === "cancelled") {
      try {
        const { data: row } = await (supabaseAdmin as any)
          .from("appointment_requests")
          .select(
            "patient_name, patient_email, preferred_date, preferred_time, confirmed_date, confirmed_time, doctor_id",
          )
          .eq("id", data.id)
          .maybeSingle();
        // Se a consulta cancelada ESTAVA confirmada, a vaga abre: oferece à 1ª
        // da fila de espera daquela semana (cascata cuida do resto).
        if (row?.confirmed_date && row?.confirmed_time) {
          const { offerFreedSlot } = await import("@/lib/waitlist.functions");
          await offerFreedSlot(
            supabaseAdmin,
            (row.doctor_id as string | null) ?? null,
            row.confirmed_date,
            row.confirmed_time,
          );
        }
        if (row?.patient_email) {
          const { sendEmail, emailLayout } = await import("@/lib/email.server");
          const dataBr = new Date(row.preferred_date + "T00:00:00").toLocaleDateString("pt-BR");
          await sendEmail({
            to: row.patient_email,
            replyTo: process.env.ADMIN_EMAILS?.split(",")[0]?.trim(),
            subject: "Sobre sua solicitação de consulta",
            html: emailLayout(
              `Olá, ${esc((row.patient_name ?? "").split(" ")[0]) || "tudo bem"}!`,
              `<p style="margin:0 0 14px">Não foi possível confirmar sua consulta solicitada para ${dataBr} às ${esc(row.preferred_time)}.</p>
               <p style="margin:0 0 6px">Responda este e-mail ou solicite um novo horário — teremos prazer em encontrar uma alternativa.</p>`,
            ),
          });
        }
      } catch (e) {
        console.error("cancellation email failed", e);
      }
    }

    return { ok: !error };
  });

const ConfirmSchema = z.object({
  accessToken: z.string().min(10),
  id: z.string().uuid(),
  confirmedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirmedTime: z.string().min(4).max(8),
  priceBrl: z.number().int().nullable(),
  internalNotes: z.string().max(2000).nullable(),
});

/**
 * Confirma um pedido de consulta com data/hora (service role — o UPDATE pelo
 * navegador dependia de claim is_admin no JWT e falhava silenciosamente).
 * Recusa quando já existe outra consulta confirmada no mesmo horário.
 */
export const confirmAppointment = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ConfirmSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "appointment_requests", data.id, scope)))
      return { ok: false as const, error: "Sem permissão." };

    // Conflito de slot: outra consulta confirmada na mesma data/hora. Para o
    // médico assinante, o conflito é só na PRÓPRIA agenda (slots de outro
    // médico não colidem com a dele).
    const { data: clash } = await scopedBy(
      (supabaseAdmin as any)
        .from("appointment_requests")
        .select("id, patient_name")
        .eq("status", "confirmed")
        .eq("confirmed_date", data.confirmedDate)
        .eq("confirmed_time", data.confirmedTime)
        .neq("id", data.id),
      scope,
    ).limit(1);
    if (clash?.length) {
      return {
        ok: false as const,
        error: `Já existe consulta confirmada nesse horário (${clash[0].patient_name ?? "outra paciente"}).`,
      };
    }

    const { error } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .update({
        status: "confirmed",
        confirmed_date: data.confirmedDate,
        confirmed_time: data.confirmedTime,
        proposed_date: null,
        proposed_time: null,
        price_brl: data.priceBrl,
        internal_notes: data.internalNotes,
      })
      .eq("id", data.id);
    // 23505 = índice único do slot (doctor_id, confirmed_date, confirmed_time):
    // outra consulta foi confirmada nesse horário na fração de segundo entre a
    // checagem acima e este UPDATE. Backstop real contra double-booking.
    if (error)
      return {
        ok: false as const,
        error:
          (error as { code?: string }).code === "23505"
            ? "Já existe consulta confirmada nesse horário."
            : error.message,
      };

    // Fecha o ciclo com a paciente: e-mail de confirmação com data/hora.
    // Não bloqueia o fluxo se o e-mail falhar ou não estiver configurado.
    try {
      const { data: row } = await (supabaseAdmin as any)
        .from("appointment_requests")
        .select("patient_name, patient_email")
        .eq("id", data.id)
        .maybeSingle();
      if (row?.patient_email) {
        const { sendEmail, emailLayout } = await import("@/lib/email.server");
        const dataBr = new Date(data.confirmedDate + "T00:00:00").toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        const preco =
          data.priceBrl != null
            ? `<p style="margin:0 0 6px"><strong>Valor:</strong> R$ ${(data.priceBrl / 100).toFixed(2)}</p>`
            : "";
        await sendEmail({
          to: row.patient_email,
          replyTo: process.env.ADMIN_EMAILS?.split(",")[0]?.trim(),
          subject: "Sua consulta foi confirmada ✅",
          html: emailLayout(
            `Olá, ${esc((row.patient_name ?? "").split(" ")[0]) || "tudo bem"}!`,
            `<p style="margin:0 0 14px">Sua consulta foi <strong>confirmada</strong>:</p>
             <p style="margin:0 0 6px"><strong>Data:</strong> ${dataBr}</p>
             <p style="margin:0 0 6px"><strong>Horário:</strong> ${data.confirmedTime}</p>
             ${preco}
             <p style="margin:14px 0 0">Você também acompanha o status na aba <strong>Consultas</strong> do app.</p>
             <p style="margin:10px 0 0;font-size:13px;color:#9b8178">Precisa remarcar? Responda este e-mail.</p>`,
          ),
        });
      }
    } catch (e) {
      console.error("confirmation email failed", e);
    }

    return { ok: true as const, error: null };
  });

const ProposeSchema = z.object({
  accessToken: z.string().min(10),
  id: z.string().uuid(),
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proposedTime: z.string().min(4).max(8),
  priceBrl: z.number().int().nullable(),
  internalNotes: z.string().max(2000).nullable(),
});

/**
 * Contraproposta: quando o horário pedido não dá, o médico SUGERE outro. Não
 * confirma nada ainda — grava proposed_date/time + status 'counter_proposed' e
 * avisa a paciente pra aprovar (ou recusar) no app. A confirmação real só
 * acontece quando ela aprova (respondToProposedTime).
 */
export const proposeAppointmentTime = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ProposeSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "appointment_requests", data.id, scope)))
      return { ok: false as const, error: "Sem permissão." };

    const { error } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .update({
        status: "counter_proposed",
        proposed_date: data.proposedDate,
        proposed_time: data.proposedTime,
        price_brl: data.priceBrl,
        internal_notes: data.internalNotes,
      })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };

    // Avisa a paciente que há um horário sugerido pra aprovar (best-effort).
    try {
      const { data: row } = await (supabaseAdmin as any)
        .from("appointment_requests")
        .select("patient_name, patient_email")
        .eq("id", data.id)
        .maybeSingle();
      if (row?.patient_email) {
        const { sendEmail, emailLayout } = await import("@/lib/email.server");
        const dataBr = new Date(data.proposedDate + "T00:00:00").toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        await sendEmail({
          to: row.patient_email,
          replyTo: process.env.ADMIN_EMAILS?.split(",")[0]?.trim(),
          subject: "O médico sugeriu um novo horário 🗓️",
          html: emailLayout(
            `Olá, ${esc((row.patient_name ?? "").split(" ")[0]) || "tudo bem"}!`,
            `<p style="margin:0 0 14px">O horário que você pediu não estava disponível, então o médico <strong>sugeriu um novo horário</strong>:</p>
             <p style="margin:0 0 6px"><strong>Data:</strong> ${dataBr}</p>
             <p style="margin:0 0 6px"><strong>Horário:</strong> ${data.proposedTime}</p>
             <p style="margin:14px 0 0">Abra a aba <strong>Consultas</strong> no app para <strong>aprovar</strong> ou <strong>recusar</strong> esse horário.</p>
             <p style="margin:10px 0 0"><a href="https://www.obstetrica.com.br/minha-conta" style="color:#a85a44">Abrir o app →</a></p>`,
          ),
        });
      }
    } catch (e) {
      console.error("counter-proposal email failed", e);
    }

    return { ok: true as const, error: null };
  });

const PaidSchema = z.object({ accessToken: z.string().min(10), id: z.string().uuid() });
export const markAppointmentPaid = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => PaidSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "appointment_requests", data.id, scope)))
      return { ok: false as const, error: "Sem permissão." };
    const { error } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .update({ payment_status: "pago" })
      .eq("id", data.id);
    return error
      ? { ok: false as const, error: error.message }
      : { ok: true as const, error: null };
  });

export type AdminWaitlistEntry = {
  id: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string | null;
  week_start: string;
  status: string;
  offer_date: string | null;
  offer_time: string | null;
  offer_deadline: string | null;
  created_at: string;
};

/**
 * [Painel] Fila de espera ATIVA do médico (waiting + offered), agrupável por
 * semana. Só leitura, escopada ao doctor_id do assinante (equipe vê tudo).
 */
export const getDoctorWaitlist = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, entries: [] as AdminWaitlistEntry[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await scopedBy(
      (supabaseAdmin as any)
        .from("appointment_waitlist")
        .select(
          "id, patient_name, patient_email, patient_phone, week_start, status, offer_date, offer_time, offer_deadline, created_at",
        )
        .in("status", ["waiting", "offered"]),
      scope,
    )
      .order("week_start", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(200);
    return { ok: true as const, entries: (rows ?? []) as AdminWaitlistEntry[] };
  });

const AnswerSchema = z.object({
  accessToken: z.string().min(10),
  id: z.string().uuid(),
  answered: z.boolean(),
});

/** Marca uma pergunta da paciente como respondida (ou não). */
export const setQuestionAnswered = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AnswerSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "doctor_questions", data.id, scope)))
      return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("doctor_questions")
      .update({ answered: data.answered })
      .eq("id", data.id);
    return { ok: !error };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Feature 46: Dashboard de Engajamento
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna dados de engajamento de todas as pacientes (ativas/inativas na última semana). */
export const getEngagementData = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [profiles, healthLogs, journals, kicks, qs, forms] = await Promise.all([
      scopedBy(
        sb
          .from("patient_profiles")
          .select(
            "id,display_name,baby_name,lmp_date,reference_date,reference_weeks,reference_days,doctor_id",
          ),
        scope,
      ),
      supabaseAdmin
        .from("health_logs")
        .select("user_id,created_at")
        .gte("created_at", sevenDaysAgo),
      supabaseAdmin
        .from("journal_entries")
        .select("user_id,created_at")
        .gte("created_at", sevenDaysAgo),
      supabaseAdmin
        .from("kick_sessions")
        .select("user_id,started_at")
        .gte("started_at", sevenDaysAgo),
      supabaseAdmin
        .from("doctor_questions")
        .select("user_id,created_at")
        .gte("created_at", sevenDaysAgo),
      scopedBy(
        sb
          .from("preconsulta_forms")
          .select("user_id,submitted_at,seen_by_doctor")
          .order("submitted_at", { ascending: false }),
        scope,
      ),
    ]);

    // Map userId → most recent activity timestamp
    const activityMap = new Map<string, string>();
    const record = (uid: string, ts: string) => {
      const prev = activityMap.get(uid);
      if (!prev || ts > prev) activityMap.set(uid, ts);
    };
    healthLogs.data?.forEach((r) => record(r.user_id, r.created_at));
    journals.data?.forEach((r) => record(r.user_id, r.created_at));
    kicks.data?.forEach((r) => record(r.user_id, r.started_at));
    qs.data?.forEach((r) => record(r.user_id, r.created_at));

    const unseenByUser = new Set<string>(
      ((forms.data ?? []) as { user_id: string; seen_by_doctor: boolean }[])
        .filter((f) => !f.seen_by_doctor)
        .map((f) => f.user_id),
    );

    type EngProfile = {
      id: string;
      display_name: string | null;
      baby_name: string | null;
      lmp_date: string | null;
      reference_date: string | null;
      reference_weeks: number | null;
      reference_days: number | null;
    };
    const patients: PatientEngagement[] = ((profiles.data ?? []) as EngProfile[]).map((p) => {
      const lastAt = activityMap.get(p.id) ?? null;
      const isActive = lastAt != null && lastAt >= sevenDaysAgo;
      return {
        id: p.id,
        display_name: p.display_name,
        baby_name: p.baby_name,
        lmp_date: p.lmp_date,
        reference_date: p.reference_date,
        reference_weeks: p.reference_weeks,
        reference_days: p.reference_days,
        isActive,
        lastActivityAt: lastAt,
        hasUnseenForm: unseenByUser.has(p.id),
      };
    });

    return {
      ok: true as const,
      patients,
      totalPatients: patients.length,
      activeLastWeek: patients.filter((p) => p.isActive).length,
      inactiveLastWeek: patients.filter((p) => !p.isActive).length,
      unseenPreConsultas: unseenByUser.size,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Feature 47: Pré-consultas no painel do médico
// ─────────────────────────────────────────────────────────────────────────────

/** Lista todas as pré-consultas submetidas pelas pacientes. */
export const getPreConsultaForms = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: forms } = await scopedBy(
      sb.from("preconsulta_forms").select("*").order("submitted_at", { ascending: false }),
      scope,
    ).limit(100);

    const { data: profiles } = await scopedBy(
      sb.from("patient_profiles").select("id,display_name,doctor_id"),
      scope,
    );

    const nameById = new Map(
      (profiles ?? []).map((p: { id: string; display_name: string | null }) => [
        p.id,
        p.display_name,
      ]),
    );

    const result: AdminPreConsulta[] = (forms ?? []).map((f: any) => ({
      ...f,
      patient_name: nameById.get(f.user_id) ?? "Paciente",
    }));

    return { ok: true as const, forms: result };
  });

const SeenSchema = z.object({ accessToken: z.string().min(10), id: z.string().uuid() });

/** Marca uma pré-consulta como vista pelo médico. */
export const markPreConsultaSeen = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SeenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "preconsulta_forms", data.id, scope)))
      return { ok: false as const };
    await supabaseAdmin
      .from("preconsulta_forms")
      .update({ seen_by_doctor: true })
      .eq("id", data.id);
    return { ok: true as const };
  });

/** Gera relatório de uma paciente (últimas 2 semanas de registros). */
export const getPatientReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), userId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // A paciente precisa pertencer ao médico assinante (id do perfil = uid).
    if (!(await assertOwnsRow(supabaseAdmin as any, "patient_profiles", data.userId, scope)))
      return { ok: false as const };

    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const uid = data.userId;

    const [profile, healthLogs, journals, kicks, questions, preConsultas] = await Promise.all([
      supabaseAdmin.from("patient_profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin
        .from("health_logs")
        .select("*")
        .eq("user_id", uid)
        .gte("created_at", twoWeeksAgo)
        .order("log_date", { ascending: false }),
      supabaseAdmin
        .from("journal_entries")
        .select("*")
        .eq("user_id", uid)
        .gte("created_at", twoWeeksAgo)
        .order("entry_date", { ascending: false }),
      supabaseAdmin
        .from("kick_sessions")
        .select("*")
        .eq("user_id", uid)
        .gte("started_at", twoWeeksAgo)
        .order("started_at", { ascending: false }),
      supabaseAdmin
        .from("doctor_questions")
        .select("*")
        .eq("user_id", uid)
        .eq("answered", false)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("preconsulta_forms")
        .select("*")
        .eq("user_id", uid)
        .order("submitted_at", { ascending: false })
        .limit(1),
    ]);

    return {
      ok: true as const,
      profile: profile.data,
      healthLogs: healthLogs.data ?? [],
      journals: journals.data ?? [],
      kicks: kicks.data ?? [],
      pendingQuestions: questions.data ?? [],
      latestPreConsulta: preConsultas.data?.[0] ?? null,
    };
  });
