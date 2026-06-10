import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export type TeleconsultaSession = {
  id: string;
  patient_user_id: string;
  patient_name: string | null;
  scheduled_for: string | null;
  room_name: string;
  status: "agendada" | "sala_aberta" | "encerrada";
  doctor_notes: string | null;
  patient_notes: string | null;
  clinical_note: string | null;
  created_at: string;
};

const AdminTk = z.object({ accessToken: z.string().min(10) });

export const createTeleconsulta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        patientUserId: z.string().uuid(),
        scheduledFor: z.string().nullable(),
        doctorNotes: z.string().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.accessToken);
    if (!admin) return { ok: false as const, error: "Não autorizado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .insert({
        patient_user_id: data.patientUserId,
        scheduled_for: data.scheduledFor,
        doctor_notes: data.doctorNotes,
        status: "agendada",
      })
      .select()
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, session: row as TeleconsultaSession };
  });

export const getTeleconsultasAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AdminTk.parse(i))
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.accessToken);
    if (!admin) return { ok: false as const, error: "Não autorizado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .select("*, patient_profiles(display_name)")
      .order("created_at", { ascending: false });
    if (error) return { ok: false as const, error: error.message };
    const sessions: TeleconsultaSession[] = (rows ?? []).map((r: any) => ({
      ...r,
      patient_name: r.patient_profiles?.display_name ?? null,
    }));
    return { ok: true as const, sessions };
  });

export const updateTeleconsultaStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid(),
        status: z.enum(["agendada", "sala_aberta", "encerrada"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.accessToken);
    if (!admin) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .update({ status: data.status })
      .eq("id", data.id);
    return { ok: !error };
  });

export const getMyTeleconsultas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const { data: rows, error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .select("*")
      .eq("patient_user_id", u.user.id)
      .neq("status", "encerrada")
      .order("scheduled_for", { ascending: true, nullsFirst: false });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, sessions: (rows ?? []) as TeleconsultaSession[] };
  });

export const saveDoctorClinicalNote = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid(),
        clinicalNote: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.accessToken);
    if (!admin) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .update({ clinical_note: data.clinicalNote })
      .eq("id", data.id);
    return { ok: !error };
  });

export const generateClinicalNote = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        patient: z.object({
          name: z.string(),
          weeksAtSubmission: z.number().nullable(),
          weight: z.number().nullable(),
          systolic: z.number().nullable(),
          diastolic: z.number().nullable(),
          symptoms: z.array(z.string()),
          medications: z.string().nullable(),
          questions: z.string().nullable(),
          emotionalState: z.string().nullable(),
        }),
        bullets: z.string().min(5),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.accessToken);
    if (!admin) return { ok: false as const, error: "Não autorizado" };

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) return { ok: false as const, error: "API key não configurada" };

    const { generateText } = await import("ai");
    const { createChatProvider, DEFAULT_CHAT_MODEL } = await import("./ai-gateway.server");
    const google = createChatProvider(key);

    const p = data.patient;
    const preConsultaSummary = `
- Paciente: ${p.name}
- IG na consulta: ${p.weeksAtSubmission ? `${p.weeksAtSubmission} semanas` : "não informada"}
- Peso: ${p.weight ? `${p.weight} kg` : "não informado"}
- PA: ${p.systolic && p.diastolic ? `${p.systolic}/${p.diastolic} mmHg` : "não aferida"}
- Sintomas relatados: ${p.symptoms.length > 0 ? p.symptoms.join(", ") : "nenhum"}
- Medicamentos em uso: ${p.medications || "não informado"}
- Dúvidas da paciente: ${p.questions || "nenhuma"}
- Estado emocional: ${p.emotionalState || "não relatado"}`;

    const prompt = `Você é um assistente médico especialista em obstetrícia. Gere uma nota clínica de consulta de pré-natal em formato SOAP (Subjetivo, Objetivo, Avaliação, Plano) em português brasileiro, concisa e profissional.

PRÉ-CONSULTA DA PACIENTE:
${preConsultaSummary}

PONTOS DO MÉDICO DURANTE A CONSULTA:
${data.bullets}

Gere a nota SOAP. Use formatação clara com cabeçalhos em negrito. Seja específico e clínico. Máximo 400 palavras.`;

    const result = await generateText({
      model: google(process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL),
      prompt,
      maxTokens: 600,
    });

    return { ok: true as const, note: result.text };
  });

export const savePatientNotes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid(),
        notes: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .update({ patient_notes: data.notes })
      .eq("id", data.id)
      .eq("patient_user_id", u.user.id);
    return { ok: !error };
  });
