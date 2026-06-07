import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  patient_name: z.string().min(2).max(120),
  patient_email: z.string().email().max(160),
  patient_phone: z.string().min(8).max(40),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_time: z.string().min(3).max(20),
  reason: z.string().min(3).max(200),
  notes: z.string().max(1000).optional().nullable(),
});

export const submitAppointmentRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("appointment_requests").insert({
      patient_name: data.patient_name,
      patient_email: data.patient_email,
      patient_phone: data.patient_phone,
      preferred_date: data.preferred_date,
      preferred_time: data.preferred_time,
      reason: data.reason,
      notes: data.notes ?? null,
    });
    if (error) {
      console.error("appointment insert failed", error);
      return { ok: false as const, error: "Não foi possível enviar agora. Tente novamente em instantes." };
    }
    return { ok: true as const };
  });