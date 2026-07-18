/**
 * Plano Clínica — server functions.
 *
 * A clínica é uma conta (owner_user_id) que agrupa médicos. Cada médico
 * CONTINUA com o próprio Segundo Cérebro (tudo chaveado por doctor_id);
 * a clínica ganha apenas o direito de OPERAR cada cérebro individualmente
 * pelo painel (admin da clínica) — nada é misturado entre médicos.
 *
 * Papéis:
 *   - admin  → dono da clínica (owner_user_id) ou médico com clinic_role='admin'.
 *   - member → médico da clínica; usa o painel normalmente, só o próprio cérebro.
 * Membro de clínica ativa herda as capacidades do plano Clínica
 * (entitlements.server.ts) — o assento vem da clínica, não do plano pessoal.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function authedUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export type ClinicInfo = {
  id: string;
  name: string;
  active: boolean;
  role: "admin" | "member";
};

export type ClinicMember = {
  id: string;
  display_name: string;
  specialty: string | null;
  plan: string | null;
  active: boolean;
  clinic_role: string;
  brainEntries: number;
  brainGaps: number;
};

/**
 * Clínica do usuário como ADMIN (dono da conta da clínica ou médico com
 * clinic_role='admin'). null = não administra clínica nenhuma.
 */
async function adminClinicOf(userId: string): Promise<{ id: string; name: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const { data: owned, error } = await sb
    .from("clinics")
    .select("id,name,active")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) return null; // tabela ainda não migrada → sem clínica
  if (owned?.active) return { id: owned.id, name: owned.name };
  const { data: me } = await sb
    .from("doctors")
    .select("clinic_id,clinic_role")
    .eq("id", userId)
    .maybeSingle();
  if (!me?.clinic_id || me.clinic_role !== "admin") return null;
  const { data: clinic } = await sb
    .from("clinics")
    .select("id,name,active")
    .eq("id", me.clinic_id)
    .maybeSingle();
  return clinic?.active ? { id: clinic.id, name: clinic.name } : null;
}

const TokenSchema = z.object({ accessToken: z.string().min(10) });

/** Clínica do usuário + (se admin) lista de médicos com resumo do cérebro. */
export const getMyClinic = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await authedUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Admin?
    const admin = await adminClinicOf(user.id);
    let clinic: ClinicInfo | null = null;
    if (admin) {
      clinic = { id: admin.id, name: admin.name, active: true, role: "admin" };
    } else {
      // Membro comum?
      const { data: me, error } = await sb
        .from("doctors")
        .select("clinic_id")
        .eq("id", user.id)
        .maybeSingle();
      if (error?.code === "42703")
        return { ok: true as const, clinic: null, members: [] as ClinicMember[], migrate: true };
      if (me?.clinic_id) {
        const { data: c } = await sb
          .from("clinics")
          .select("id,name,active")
          .eq("id", me.clinic_id)
          .maybeSingle();
        if (c) clinic = { id: c.id, name: c.name, active: c.active, role: "member" };
      }
    }
    if (!clinic) return { ok: true as const, clinic: null, members: [] as ClinicMember[] };

    // Lista de médicos só para o admin (member não vê os cérebros dos colegas).
    let members: ClinicMember[] = [];
    if (clinic.role === "admin") {
      const { data: docs } = await sb
        .from("doctors")
        .select("id,display_name,specialty,plan,active,clinic_role")
        .eq("clinic_id", clinic.id)
        .order("display_name", { ascending: true });
      const rows = (docs ?? []) as Omit<ClinicMember, "brainEntries" | "brainGaps">[];
      members = await Promise.all(
        rows.map(async (d) => {
          const [entries, gaps] = await Promise.all([
            sb
              .from("brain_entries")
              .select("id", { count: "exact", head: true })
              .eq("doctor_id", d.id)
              .eq("approved", true),
            sb
              .from("brain_gaps")
              .select("id", { count: "exact", head: true })
              .eq("doctor_id", d.id)
              .eq("status", "aberta"),
          ]);
          return {
            ...d,
            brainEntries: entries?.count ?? 0,
            brainGaps: gaps?.count ?? 0,
          } as ClinicMember;
        }),
      );
    }
    return { ok: true as const, clinic, members };
  });

/** Cria a clínica (uma por conta). Exige plano com assentos de equipe. */
export const createClinic = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), name: z.string().min(2).max(120) }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await authedUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { getEntitlements } = await import("./entitlements.server");
    if (!(await getEntitlements(user)).teamSeats)
      return { ok: false as const, reason: "plan" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: existing, error: exErr } = await sb
      .from("clinics")
      .select("id,name")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (exErr?.code === "42P01") return { ok: false as const, reason: "migracao" as const };
    if (existing) return { ok: true as const, clinicId: existing.id, already: true as const };

    const { data: clinic, error } = await sb
      .from("clinics")
      .insert({ name: data.name.trim(), owner_user_id: user.id })
      .select("id")
      .single();
    if (error || !clinic) return { ok: false as const };

    // Se o dono também é médico, entra como admin da própria clínica.
    await sb
      .from("doctors")
      .update({ clinic_id: clinic.id, clinic_role: "admin" })
      .eq("id", user.id);
    return { ok: true as const, clinicId: clinic.id as string };
  });

/** Adiciona um médico à clínica pelo e-mail da conta dele. */
export const addClinicDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), email: z.string().email() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await authedUser(data.accessToken);
    if (!user) return { ok: false as const };
    const clinic = await adminClinicOf(user.id);
    if (!clinic) return { ok: false as const, reason: "nao_admin" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: uid, error: rpcErr } = await sb.rpc("get_user_id_by_email", {
      p_email: data.email.trim().toLowerCase(),
    });
    if (rpcErr || !uid) return { ok: false as const, reason: "sem_conta" as const };

    const { data: doc } = await sb
      .from("doctors")
      .select("id,display_name,clinic_id")
      .eq("id", uid)
      .maybeSingle();
    if (!doc) return { ok: false as const, reason: "sem_conta_medico" as const };
    if (doc.clinic_id && doc.clinic_id !== clinic.id)
      return { ok: false as const, reason: "outra_clinica" as const };
    if (doc.clinic_id === clinic.id)
      return { ok: true as const, already: true as const, name: doc.display_name as string };

    const { error } = await sb
      .from("doctors")
      .update({ clinic_id: clinic.id, clinic_role: "member" })
      .eq("id", doc.id)
      .is("clinic_id", null); // corrida: só entra se ainda estiver sem clínica
    if (error) return { ok: false as const };
    return { ok: true as const, name: doc.display_name as string };
  });

/** Remove um médico da clínica (o cérebro dele fica intacto, com ele). */
export const removeClinicDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), doctorId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await authedUser(data.accessToken);
    if (!user) return { ok: false as const };
    const clinic = await adminClinicOf(user.id);
    if (!clinic) return { ok: false as const, reason: "nao_admin" as const };
    if (data.doctorId === user.id) return { ok: false as const, reason: "proprio" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("doctors")
      .update({ clinic_id: null, clinic_role: "member" })
      .eq("id", data.doctorId)
      .eq("clinic_id", clinic.id);
    return { ok: !error };
  });
