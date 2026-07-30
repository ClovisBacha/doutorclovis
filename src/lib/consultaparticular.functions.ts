import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";

/** Gate: médico assinante ativo — dono do próprio tenant de consultas pagas. */
async function requireDoctor(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !u.user) return null;
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", u.user.id)
    .maybeSingle();
  if (!doc || doc.active === false) return null;
  return u.user;
}

/** Resolve o médico da paciente logada (patient_profiles.doctor_id). */
async function patientDoctorId(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await (supabaseAdmin as any)
    .from("patient_profiles")
    .select("doctor_id")
    .eq("id", userId)
    .maybeSingle();
  return p?.doctor_id ?? null;
}

export type PrivateConsultation = {
  id: string;
  patient_user_id: string;
  doctor_id: string | null;
  consult_type: string;
  preferred_dates: string[];
  message: string | null;
  status: "pendente_pagamento" | "pagamento_enviado" | "confirmado" | "realizado" | "cancelado";
  mp_payment_id: string | null;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  amount_cents: number | null;
  created_at: string;
};

export const CONSULT_TYPES = [
  {
    key: "plantao_30",
    label: "Plantão de Dúvidas (30 min)",
    price: "R$ 150",
    priceNumber: 150,
    desc: "Tire dúvidas pontuais por videochamada. Ideal para resultados de exames ou sintomas não urgentes.",
  },
  {
    key: "consulta_60",
    label: "Consulta Completa (60 min)",
    price: "R$ 280",
    priceNumber: 280,
    desc: "Consulta completa de pré-natal particular, com revisão do histórico, exames e orientações.",
  },
  {
    key: "revisao_resultados",
    label: "Revisão de Exames (20 min)",
    price: "R$ 100",
    priceNumber: 100,
    desc: "Análise detalhada de exames laboratoriais ou de imagem com explicação personalizada.",
  },
];

export const requestPrivateConsultation = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        consultType: z.string(),
        preferredDates: z.array(z.string()),
        message: z.string().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };

    // Kill switch (feature flag): o dono pode desligar consultas particulares.
    const { isFlagEnabled } = await import("@/lib/platform-flags.server");
    if (!(await isFlagEnabled("consulta_particular", u.user.id)))
      return {
        ok: false as const,
        error: "Consultas particulares estão temporariamente indisponíveis.",
      };

    const consultType = CONSULT_TYPES.find((ct) => ct.key === data.consultType);

    /* Médico da paciente resolvido ANTES do preço e da cobrança — as duas
       coisas dependem dele. Antes o preço era tabelado para a plataforma
       inteira e a cobrança saía descrita com o nome do fundador. */
    const doctorId = await patientDoctorId(u.user.id);
    const { supabaseAdmin: sbPreco } = await import("@/integrations/supabase/client.server");
    let medNome = "";
    let precoDoMedico: number | null = null;
    if (doctorId) {
      const { data: doc } = await (sbPreco as any)
        .from("doctors")
        .select("display_name,consultation_price_brl")
        .eq("id", doctorId)
        .maybeSingle();
      medNome = ((doc?.display_name as string | null) ?? "").trim();
      const p = doc?.consultation_price_brl as number | null | undefined;
      precoDoMedico = typeof p === "number" && p > 0 ? p : null;
    }
    /* O valor do médico manda. A tabela de CONSULT_TYPES só entra quando ele
       não preencheu — e aí é uma sugestão da plataforma, não o preço dele. */
    const amount = precoDoMedico ?? consultType?.priceNumber ?? 0;

    // Try to create PIX charge via Mercado Pago
    let mpPaymentId: string | null = null;
    let pixQrCode: string | null = null;
    let pixQrCodeBase64: string | null = null;

    /* A conta do Mercado Pago é UMA, da plataforma. Gerar PIX por ela para a
       consulta de outro médico manda o dinheiro dele para a conta errada —
       então a cobrança automática só sai quando não há outro médico envolvido.
       Nos demais casos cai no PIX manual, que usa a chave do próprio médico. */
    const mpToken = doctorId ? null : process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (mpToken && amount > 0 && u.user.email) {
      try {
        const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mpToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": `${u.user.id}-${Date.now()}`,
          },
          body: JSON.stringify({
            transaction_amount: amount,
            description: `${consultType?.label ?? data.consultType}${medNome ? ` — ${medNome}` : ""}`,
            payment_method_id: "pix",
            payer: { email: u.user.email },
          }),
        });
        if (mpRes.ok) {
          const mp = (await mpRes.json()) as {
            id?: number;
            point_of_interaction?: {
              transaction_data?: { qr_code?: string; qr_code_base64?: string };
            };
          };
          mpPaymentId = mp.id ? String(mp.id) : null;
          pixQrCode = mp.point_of_interaction?.transaction_data?.qr_code ?? null;
          pixQrCodeBase64 = mp.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;
        }
      } catch {
        // non-fatal — fall back to manual PIX
      }
    }

    // `doctorId` (o recorte multi-inquilino) já veio resolvido lá acima.
    const baseRow = {
      patient_user_id: u.user.id,
      consult_type: data.consultType,
      preferred_dates: data.preferredDates,
      message: data.message,
      mp_payment_id: mpPaymentId,
      pix_qr_code: pixQrCode,
      pix_qr_code_base64: pixQrCodeBase64,
      amount_cents: Math.round(amount * 100),
    };
    let ins = await db
      .from("private_consultations")
      .insert({ ...baseRow, doctor_id: doctorId })
      .select()
      .single();
    // Migração pendente (coluna doctor_id ainda não aplicada): não deixa a
    // paciente na mão — insere sem o recorte e o backfill vincula depois.
    if (ins.error && (ins.error.code === "42703" || ins.error.code === "PGRST204")) {
      ins = await db.from("private_consultations").insert(baseRow).select().single();
    }
    if (ins.error) return { ok: false as const, error: ins.error.message };
    return { ok: true as const, consultation: ins.data as PrivateConsultation };
  });

export const getMyPrivateConsultations = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
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
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
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

/**
 * Painel do médico: as consultas pagas das SUAS pacientes (recorte por
 * doctor_id). Cada médico administra o próprio fluxo de consultas particulares.
 */
export const getPrivateConsultationsForDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, error: "Não autorizado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    // Sem FK entre private_consultations e patient_profiles, o embed do
    // PostgREST falha (PGRST200) — buscamos os nomes em uma segunda query.
    const { data: rows, error } = await db
      .from("private_consultations")
      .select("*")
      .eq("doctor_id", user.id)
      .order("created_at", { ascending: false });
    if (error?.code === "42703" || error?.code === "42P01")
      return {
        ok: false as const,
        error: "Aplique a migração de consultas (APLICAR_PENDENTES.sql) no Supabase.",
      };
    if (error) return { ok: false as const, error: error.message };
    const userIds = [...new Set((rows ?? []).map((r: any) => r.patient_user_id))];
    const nameById = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from("patient_profiles")
        .select("id, display_name")
        .in("id", userIds);
      for (const p of (profiles ?? []) as { id: string; display_name: string | null }[])
        nameById.set(p.id, p.display_name);
    }
    const consultations = (rows ?? []).map((r: any) => ({
      ...r,
      patient_profiles: { display_name: nameById.get(r.patient_user_id) ?? null },
    }));
    return { ok: true as const, consultations: consultations as any[] };
  });

/** Médico confirma/cancela o pagamento — só das SUAS consultas (doctor_id). */
export const confirmPaymentForDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid(),
        status: z.enum(["confirmado", "cancelado", "realizado"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = typedDb(supabaseAdmin);
    const { error } = await db
      .from("private_consultations")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("doctor_id", user.id);
    return { ok: !error };
  });
