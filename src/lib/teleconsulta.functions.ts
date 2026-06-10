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
