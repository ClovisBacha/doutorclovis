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
