/**
 * Vínculo paciente ↔ médico — server functions.
 *
 * Fluxo (cadastro manual controlado pelo médico):
 *   1. a paciente BUSCA o médico (searchDoctors) e ENVIA solicitação (requestDoctor)
 *   2. o médico vê as pendências (listPatientRequests) e ACEITA/recusa
 *      (respondPatientRequest) — só ao aceitar a paciente passa a pertencer
 *      a ele (patient_profiles.doctor_id)
 *   3. a paciente acompanha o status (getMyDoctorLink); o médico lista as
 *      próprias pacientes (listMyPatients)
 *
 * A partir do vínculo, o chat/cérebro que a paciente usa no app é o do SEU
 * médico (ver api/chat.ts), e cada conta fica individual.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function requireUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

/** Confirma que o usuário logado é um médico assinante ativo. */
async function requireDoctor(accessToken: string) {
  const user = await requireUser(accessToken);
  if (!user) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", user.id)
    .maybeSingle();
  if (!doc || doc.active === false) return null;
  return user;
}

export type DoctorPublic = {
  id: string;
  display_name: string;
  title: string;
  specialty: string;
  slug: string | null;
};

export type MyDoctorLink = {
  doctor: DoctorPublic | null;
  pending: { id: string; doctor: DoctorPublic; created_at: string } | null;
};

export type PatientRequest = {
  id: string;
  patient_id: string;
  patient_name: string | null;
  message: string | null;
  created_at: string;
};

export type LinkedPatient = {
  id: string;
  display_name: string | null;
  due_date: string | null;
  created_at: string | null;
  /** Aulas premium do quiz diário (revisão liberada). */
  quiz_premium?: boolean | null;
};

const TokenSchema = z.object({ accessToken: z.string().min(10) });

/** Busca médicos ativos que aceitam pacientes (nome/especialidade). */
export const searchDoctors = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), query: z.string().max(80) }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const, doctors: [] as DoctorPublic[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const query = data.query.replace(/[%,()]/g, " ").trim();
    const { data: rows, error } = await (supabaseAdmin as any).rpc("search_doctors", {
      p_query: query,
    });
    if (error) return { ok: false as const, doctors: [] as DoctorPublic[] };
    return { ok: true as const, doctors: (rows ?? []) as DoctorPublic[] };
  });

/** A paciente envia (ou reaproveita) uma solicitação de vínculo a um médico. */
export const requestDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        doctorId: z.string().uuid(),
        message: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const, reason: "auth" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // O médico precisa existir, estar ativo e aceitando pacientes.
    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("id,active,accepting_patients")
      .eq("id", data.doctorId)
      .maybeSingle();
    if (!doc || doc.active === false || doc.accepting_patients === false) {
      return { ok: false as const, reason: "unavailable" as const };
    }

    // Já vinculada a este médico? Nada a fazer.
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", user.id)
      .maybeSingle();
    if (prof?.doctor_id === data.doctorId) {
      return { ok: true as const, status: "accepted" as const };
    }

    // Já existe uma pendente para este médico? Reaproveita (idempotente).
    const { data: existing } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .select("id,status")
      .eq("patient_id", user.id)
      .eq("doctor_id", data.doctorId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true as const, status: "pending" as const };

    const { error } = await (supabaseAdmin as any).from("patient_link_requests").insert({
      patient_id: user.id,
      doctor_id: data.doctorId,
      message: data.message ?? null,
      status: "pending",
    });
    if (error) return { ok: false as const, reason: "db" as const };
    return { ok: true as const, status: "pending" as const };
  });

/** Estado atual do vínculo da paciente: médico atual e/ou solicitação pendente. */
export const getMyDoctorLink = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", user.id)
      .maybeSingle();

    let doctor: DoctorPublic | null = null;
    if (prof?.doctor_id) {
      const { data: d } = await (supabaseAdmin as any)
        .from("doctors")
        .select("id,display_name,title,specialty,slug")
        .eq("id", prof.doctor_id)
        .maybeSingle();
      doctor = (d ?? null) as DoctorPublic | null;
    }

    // Solicitação pendente mais recente (se houver), com dados do médico.
    const { data: req } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .select("id,doctor_id,created_at")
      .eq("patient_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let pending: MyDoctorLink["pending"] = null;
    if (req?.doctor_id) {
      const { data: d } = await (supabaseAdmin as any)
        .from("doctors")
        .select("id,display_name,title,specialty,slug")
        .eq("id", req.doctor_id)
        .maybeSingle();
      if (d) pending = { id: req.id, doctor: d as DoctorPublic, created_at: req.created_at };
    }

    return { ok: true as const, link: { doctor, pending } as MyDoctorLink };
  });

/** A paciente cancela a própria solicitação pendente. */
export const cancelDoctorRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), requestId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .update({ status: "cancelled", decided_at: new Date().toISOString() })
      .eq("id", data.requestId)
      .eq("patient_id", user.id)
      .eq("status", "pending");
    return { ok: !error };
  });

/** Lista as solicitações pendentes destinadas ao médico logado. */
export const listPatientRequests = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, requests: [] as PatientRequest[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .select("id,patient_id,message,created_at")
      .eq("doctor_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

    const reqs = (rows ?? []) as Omit<PatientRequest, "patient_name">[];
    // Nomes das pacientes numa segunda query (sem FK para embed do PostgREST).
    const ids = [...new Set(reqs.map((r) => r.patient_id))];
    const nameById = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: profs } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("id,display_name")
        .in("id", ids);
      for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) {
        nameById.set(p.id, p.display_name);
      }
    }

    const requests: PatientRequest[] = reqs.map((r) => ({
      ...r,
      patient_name: nameById.get(r.patient_id) ?? null,
    }));
    return { ok: true as const, requests };
  });

/** O médico aceita ou recusa uma solicitação. Ao aceitar, vincula a paciente. */
export const respondPatientRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        requestId: z.string().uuid(),
        accept: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Só solicitações pendentes destinadas a ESTE médico (anti-IDOR).
    const { data: req } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .select("id,patient_id,doctor_id,status")
      .eq("id", data.requestId)
      .eq("doctor_id", user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (!req) return { ok: false as const };

    const now = new Date().toISOString();
    if (data.accept) {
      // Vincula a paciente ao médico (denormalizado em patient_profiles).
      const { error: linkErr } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .update({ doctor_id: user.id, updated_at: now })
        .eq("id", req.patient_id);
      if (linkErr) return { ok: false as const };
    }

    const { error } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .update({ status: data.accept ? "accepted" : "declined", decided_at: now })
      .eq("id", req.id);
    return { ok: !error };
  });

/** Lista as pacientes vinculadas ao médico logado. */
export const listMyPatients = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, patients: [] as LinkedPatient[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const first = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("id,display_name,due_date,created_at,quiz_premium")
      .eq("doctor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    let rows = first.data;
    if (first.error?.code === "42703") {
      // Coluna quiz_premium ainda não aplicada no banco: segue sem ela.
      const fallback = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("id,display_name,due_date,created_at")
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      rows = fallback.data;
    }

    return { ok: true as const, patients: (rows ?? []) as LinkedPatient[] };
  });

/**
 * Liga/desliga o premium do quiz diário de UMA paciente do médico logado
 * (ativação manual após o PIX — o médico confirma o pagamento e libera).
 */
export const setPatientQuizPremium = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        patientId: z.string().uuid(),
        premium: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Proteção: o toggle manual NÃO pode revogar quem tem assinatura ativa
    // (Stripe) ou convite ativo — o acesso pago é gerido pelo webhook, não
    // pela mão do médico. (Se a tabela subscriptions ainda não existe, ignora.)
    if (!data.premium) {
      try {
        const { data: subs } = await (supabaseAdmin as any)
          .from("subscriptions")
          .select("source,status")
          .eq("user_id", data.patientId)
          .eq("product", "quiz_premium")
          .in("status", ["active", "trialing"]);
        const paga = (subs ?? []).some(
          (s: any) => s.source === "stripe" || s.source === "doctor_invite",
        );
        if (paga) {
          return {
            ok: false as const,
            error:
              "Esta paciente tem uma assinatura ativa — o acesso é gerido pelo pagamento (cancele pelo Stripe).",
          };
        }
      } catch {
        /* subscriptions ausente: sem estado pago a proteger */
      }
    }

    const { error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ quiz_premium: data.premium })
      .eq("id", data.patientId)
      .eq("doctor_id", user.id); // tenancy: só as próprias pacientes
    if (error?.code === "42703") {
      return {
        ok: false as const,
        error: "Aplique a migração quiz_premium no Supabase (APLICAR_PENDENTES.sql).",
      };
    }
    return error
      ? { ok: false as const, error: error.message }
      : { ok: true as const, error: null };
  });
