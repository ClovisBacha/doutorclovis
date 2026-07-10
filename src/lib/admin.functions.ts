import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [appts, questions, profiles] = await Promise.all([
      supabaseAdmin
        .from("appointment_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("doctor_questions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("patient_profiles").select("id,display_name"),
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
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("appointment_requests")
      .update({ status: data.status })
      .eq("id", data.id);
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
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Conflito de slot: outra consulta confirmada na mesma data/hora
    const { data: clash } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .select("id, patient_name")
      .eq("status", "confirmed")
      .eq("confirmed_date", data.confirmedDate)
      .eq("confirmed_time", data.confirmedTime)
      .neq("id", data.id)
      .limit(1);
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
        price_brl: data.priceBrl,
        internal_notes: data.internalNotes,
      })
      .eq("id", data.id);
    return error
      ? { ok: false as const, error: error.message }
      : { ok: true as const, error: null };
  });

const PaidSchema = z.object({ accessToken: z.string().min(10), id: z.string().uuid() });

/** Marca o pagamento de uma consulta como recebido (service role). */
export const markAppointmentPaid = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => PaidSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .update({ payment_status: "pago" })
      .eq("id", data.id);
    return error
      ? { ok: false as const, error: error.message }
      : { ok: true as const, error: null };
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
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [profiles, healthLogs, journals, kicks, qs, forms] = await Promise.all([
      supabaseAdmin
        .from("patient_profiles")
        .select("id,display_name,baby_name,lmp_date,reference_date,reference_weeks,reference_days"),
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
      supabaseAdmin
        .from("preconsulta_forms")
        .select("user_id,submitted_at,seen_by_doctor")
        .order("submitted_at", { ascending: false }),
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
      (forms.data ?? []).filter((f) => !f.seen_by_doctor).map((f) => f.user_id),
    );

    const patients: PatientEngagement[] = (profiles.data ?? []).map((p) => {
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
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: forms } = await supabaseAdmin
      .from("preconsulta_forms")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(100);

    const { data: profiles } = await supabaseAdmin
      .from("patient_profiles")
      .select("id,display_name");

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
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
