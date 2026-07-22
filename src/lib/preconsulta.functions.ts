import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SubmitSchema = z.object({
  accessToken: z.string().min(10),
  weeks: z.number().int().nullable().optional(),
  weight: z.string().optional(),
  systolic: z.string().optional(),
  diastolic: z.string().optional(),
  symptoms: z.array(z.string()).default([]),
  medications: z.string().max(1000).optional(),
  questions: z.string().max(2000).optional(),
  emotional_state: z.string().optional(),
  other_notes: z.string().max(1000).optional(),
});

export type PreConsultaForm = {
  id: string;
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

export const submitPreConsulta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SubmitSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!auth.user) return { ok: false as const, error: "Não autenticado" };

    // Carimba o médico da paciente para que o assinante veja a SUA pré-consulta.
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", auth.user.id)
      .maybeSingle();

    const { error } = await (supabaseAdmin as any).from("preconsulta_forms").insert({
      user_id: auth.user.id,
      doctor_id: prof?.doctor_id ?? null,
      weeks_at_submission: data.weeks ?? null,
      current_weight: data.weight ? parseFloat(data.weight) : null,
      systolic: data.systolic ? parseInt(data.systolic) : null,
      diastolic: data.diastolic ? parseInt(data.diastolic) : null,
      symptoms: data.symptoms,
      medications: data.medications || null,
      questions: data.questions || null,
      emotional_state: data.emotional_state || null,
      other_notes: data.other_notes || null,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const getMyPreConsultas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: auth } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!auth.user) return [] as PreConsultaForm[];
    const { data: forms } = await supabaseAdmin
      .from("preconsulta_forms")
      .select("*")
      .eq("user_id", auth.user.id)
      .order("submitted_at", { ascending: false })
      .limit(5);
    return (forms ?? []) as PreConsultaForm[];
  });
