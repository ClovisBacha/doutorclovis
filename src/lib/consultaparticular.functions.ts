import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PrivateConsultation = {
  id: string;
  patient_user_id: string;
  consult_type: string;
  preferred_dates: string[];
  message: string | null;
  status: "pendente_pagamento" | "pagamento_enviado" | "confirmado" | "realizado" | "cancelado";
  created_at: string;
};

export const CONSULT_TYPES = [
  {
    key: "plantao_30",
    label: "Plantão de Dúvidas (30 min)",
    price: "R$ 150",
    desc: "Tire dúvidas pontuais por videochamada. Ideal para resultados de exames ou sintomas não urgentes.",
  },
  {
    key: "consulta_60",
    label: "Consulta Completa (60 min)",
    price: "R$ 280",
    desc: "Consulta completa de pré-natal particular, com revisão do histórico, exames e orientações.",
  },
  {
    key: "revisao_resultados",
    label: "Revisão de Exames (20 min)",
    price: "R$ 100",
    desc: "Análise detalhada de exames laboratoriais ou de imagem com explicação personalizada.",
  },
];

export const requestPrivateConsultation = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      accessToken: z.string().min(10),
      consultType: z.string(),
      preferredDates: z.array(z.string()),
      message: z.string().nullable(),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const { data: row, error } = await db
      .from("private_consultations")
      .insert({
        patient_user_id: u.user.id,
        consult_type: data.consultType,
        preferred_dates: data.preferredDates,
        message: data.message,
      })
      .select()
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, consultation: row as PrivateConsultation };
  });

export const getMyPrivateConsultations = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const { data: rows } = await db
      .from("private_consultations")
      .select("*")
      .eq("patient_user_id", u.user.id)
      .order("created_at", { ascending: false });
    return { ok: true as const, consultations: (rows ?? []) as PrivateConsultation[] };
  });

export const markPaymentSent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await db
      .from("private_consultations")
      .update({ status: "pagamento_enviado" })
      .eq("id", data.id)
      .eq("patient_user_id", u.user.id)
      .eq("status", "pendente_pagamento");
    return { ok: !error };
  });

export const getPrivateConsultationsAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user?.email || !adminEmails.includes(u.user.email.toLowerCase()))
      return { ok: false as const, error: "Não autorizado" };
    const { data: rows } = await db
      .from("private_consultations")
      .select("*, patient_profiles(display_name)")
      .order("created_at", { ascending: false });
    return { ok: true as const, consultations: (rows ?? []) as any[] };
  });

export const confirmPaymentAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      accessToken: z.string().min(10),
      id: z.string().uuid(),
      status: z.enum(["confirmado", "cancelado", "realizado"]),
    }).parse(i)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user?.email || !adminEmails.includes(u.user.email.toLowerCase()))
      return { ok: false as const };
    const { error } = await db
      .from("private_consultations")
      .update({ status: data.status })
      .eq("id", data.id);
    return { ok: !error };
  });
