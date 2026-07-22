import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Lives por médico (multi-inquilino): cada médico cadastra as SUAS lives no
 * painel e divulga para as pacientes dele. A paciente logada vê as lives do
 * SEU médico; a página pública sem login cai no conteúdo estático (as "Lives
 * da Obstétrica" globais — doctor_id NULL — são um conceito futuro).
 *
 * Leitura passa sempre pelo servidor (tabela sem acesso anon); se a tabela ou
 * a coluna doctor_id ainda não existirem (migração pendente), a página usa o
 * fallback estático e o painel avisa para aplicar o APLICAR_PENDENTES.sql.
 */

export type Live = {
  id: string;
  title: string;
  scheduled_at: string | null;
  link: string | null;
  is_published: boolean;
  created_at: string;
  doctor_id?: string | null;
};

/** Gate: médico assinante ativo — dono do próprio tenant de lives. */
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
async function patientDoctorId(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
  if (!u.user) return null;
  const { data: p } = await (supabaseAdmin as any)
    .from("patient_profiles")
    .select("doctor_id")
    .eq("id", u.user.id)
    .maybeSingle();
  return p?.doctor_id ?? null;
}

/**
 * Página pública / app da paciente: só lives publicadas, mais recentes
 * primeiro. Com token da paciente vinculada → lives do médico dela; sem token
 * ou sem vínculo → lives globais da Obstétrica (doctor_id NULL, futuro).
 */
export const listLivesPublic = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const doctorId =
      data.accessToken && data.accessToken.length >= 10
        ? await patientDoctorId(data.accessToken)
        : null;
    let q = (supabaseAdmin as any)
      .from("lives")
      .select("id,title,scheduled_at,link,is_published,created_at,doctor_id")
      .eq("is_published", true);
    q = doctorId ? q.eq("doctor_id", doctorId) : q.is("doctor_id", null);
    const { data: rows, error } = await q
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) return { ok: false as const, lives: [] as Live[] };
    return { ok: true as const, lives: (rows ?? []) as Live[] };
  });

/** Painel do médico: as SUAS lives, inclusive despublicadas. */
export const listLivesAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, lives: [] as Live[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("lives")
      .select("id,title,scheduled_at,link,is_published,created_at,doctor_id")
      .eq("doctor_id", user.id)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error?.code === "42P01" || error?.code === "42703") {
      return { ok: false as const, lives: [] as Live[], missingTable: true as const };
    }
    if (error) return { ok: false as const, lives: [] as Live[] };
    return { ok: true as const, lives: (rows ?? []) as Live[] };
  });

export const saveLive = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid().optional().nullable(),
        title: z.string().min(3).max(160),
        scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
        link: z.string().url().max(300).optional().nullable(),
        isPublished: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, error: "Sem permissão." };
    // Kill switch (feature flag): o dono pode desligar as lives dos médicos.
    const { isFlagEnabled } = await import("@/lib/platform-flags.server");
    if (!(await isFlagEnabled("lives", user.id)))
      return { ok: false as const, error: "As lives estão temporariamente desativadas." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      title: data.title,
      scheduled_at: data.scheduledAt ?? null,
      link: data.link ?? null,
      is_published: data.isPublished,
    };
    const q = data.id
      ? // update: só a própria live (escopo por doctor_id)
        (supabaseAdmin as any).from("lives").update(row).eq("id", data.id).eq("doctor_id", user.id)
      : // insert: carimba o dono
        (supabaseAdmin as any).from("lives").insert({ ...row, doctor_id: user.id });
    const { error } = await q;
    if (error?.code === "42P01" || error?.code === "42703") {
      return {
        ok: false as const,
        error: "Aplique a migração 'lives' no Supabase (APLICAR_PENDENTES.sql).",
      };
    }
    if (error) {
      console.error("saveLive failed", error);
      return { ok: false as const, error: "Não foi possível salvar. Tente novamente." };
    }
    return { ok: true as const, error: null };
  });

export const deleteLive = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("lives")
      .delete()
      .eq("id", data.id)
      .eq("doctor_id", user.id);
    return { ok: !error };
  });
