/**
 * Console da PLATAFORMA — server functions do super-admin (dono do negócio).
 *
 * Identidade do super-admin: PLATFORM_ADMIN_EMAIL (ou, se ausente, o 1º e-mail
 * de ADMIN_EMAILS). É uma conta ACIMA dos médicos e da equipe: enxerga a
 * operação inteira (todos os médicos, todas as pacientes, uso de IA, receita
 * estimada) para varredura e gestão. Nenhum médico assinante ou equipe comum
 * acessa estas funções.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** E-mail do dono da plataforma. */
function platformAdminEmail(): string {
  const explicit = (process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
  if (explicit) return explicit;
  return (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim().toLowerCase() || "";
}

async function requireSuperAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  const email = data.user?.email?.toLowerCase();
  const owner = platformAdminEmail();
  if (error || !email || !owner || email !== owner) return null;
  return data.user;
}

// Preços de referência por plano (o que decidimos juntos — fácil de ajustar).
// Usado só para a ESTIMATIVA de receita mensal (MRR) no console.
// "trial" = avaliação de 14 dias (label do cadastro, sem expiração automática
// ainda — roadmap de billing). "free" = plano permanente, sem custo variável:
// sem Segundo Cérebro, até 5 pacientes. "clinica" = "Pro Equipe" na página de
// vendas: preço POR MÉDICO (a partir de R$297) — como cada médico da equipe é
// uma linha própria em `doctors`, a soma abaixo já reflete o preço por
// assento automaticamente (não usa o desconto de 5+ médicos; é uma estimativa).
const PLAN_PRICE: Record<string, number> = {
  trial: 0,
  free: 0,
  starter: 197,
  pro: 347,
  clinica: 297,
  elite: 697,
  black: 1999,
};

export type PlatformDoctor = {
  id: string;
  display_name: string;
  email: string | null;
  plan: string;
  active: boolean;
  created_at: string | null;
  patients: number;
  brainEntries: number;
};

export type PlatformOverview = {
  isSuperAdmin: true;
  ownerEmail: string;
  totals: {
    doctorsTotal: number;
    doctorsActive: number;
    patientsTotal: number;
    brainHitsThisMonth: number;
    mrrEstimate: number;
  };
  doctors: PlatformDoctor[];
  generatedAt: string;
};

const TokenSchema = z.object({ accessToken: z.string().min(10) });

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Visão geral da plataforma (super-admin). */
export const getPlatformOverview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // Médicos assinantes
    type DocRow = {
      id: string;
      display_name: string | null;
      plan: string | null;
      active: boolean | null;
      created_at: string | null;
    };
    const docRows = await safe<DocRow[]>(
      async () =>
        ((
          await sb
            .from("doctors")
            .select("id,display_name,plan,active,created_at")
            .order("created_at", { ascending: false })
        ).data ?? []) as DocRow[],
      [],
    );

    // Contagens auxiliares por médico (pacientes vinculadas e entradas de cérebro)
    const patientsByDoctor = await safe<Map<string, number>>(async () => {
      const { data: rows } = await sb.from("patient_profiles").select("doctor_id");
      const m = new Map<string, number>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[]) {
        if (r.doctor_id) m.set(r.doctor_id, (m.get(r.doctor_id) ?? 0) + 1);
      }
      return m;
    }, new Map());

    const brainByDoctor = await safe<Map<string, number>>(async () => {
      const { data: rows } = await sb.from("brain_entries").select("doctor_id");
      const m = new Map<string, number>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[]) {
        if (r.doctor_id) m.set(r.doctor_id, (m.get(r.doctor_id) ?? 0) + 1);
      }
      return m;
    }, new Map());

    // E-mails dos médicos (via auth admin — best effort)
    const emailById = await safe<Map<string, string>>(async () => {
      const m = new Map<string, string>();
      for (let page = 1; page <= 5; page++) {
        const { data: pg } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (!pg?.users?.length) break;
        for (const u of pg.users) if (u.email) m.set(u.id, u.email);
        if (pg.users.length < 200) break;
      }
      return m;
    }, new Map());

    const doctors: PlatformDoctor[] = docRows.map((d) => ({
      id: d.id,
      display_name: d.display_name || "(sem nome)",
      email: emailById.get(d.id) ?? null,
      plan: d.plan || "trial",
      active: d.active ?? true,
      created_at: d.created_at,
      patients: patientsByDoctor.get(d.id) ?? 0,
      brainEntries: brainByDoctor.get(d.id) ?? 0,
    }));

    const patientsTotal = await safe(async () => {
      const { count } = await sb
        .from("patient_profiles")
        .select("*", { count: "exact", head: true });
      return (count ?? 0) as number;
    }, 0);

    const brainHitsThisMonth = await safe(async () => {
      const { count } = await sb
        .from("brain_hits")
        .select("*", { count: "exact", head: true })
        .neq("channel", "teste")
        .gte("created_at", monthStart);
      return (count ?? 0) as number;
    }, 0);

    const doctorsActive = doctors.filter((d) => d.active).length;
    const mrrEstimate = doctors
      .filter((d) => d.active)
      .reduce((s, d) => s + (PLAN_PRICE[d.plan] ?? 0), 0);

    const overview: PlatformOverview = {
      isSuperAdmin: true,
      ownerEmail: platformAdminEmail(),
      totals: {
        doctorsTotal: doctors.length,
        doctorsActive,
        patientsTotal,
        brainHitsThisMonth,
        mrrEstimate,
      },
      doctors,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true as const, overview };
  });

/** Confere se o usuário logado é o super-admin (para gate de UI). */
export const checkIsSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => ({
    isSuperAdmin: (await requireSuperAdmin(data.accessToken)) !== null,
  }));

const SetStatusSchema = z.object({
  accessToken: z.string().min(10),
  doctorId: z.string().uuid(),
  active: z.boolean().optional(),
  plan: z.enum(["trial", "free", "starter", "pro", "clinica", "elite", "black"]).optional(),
});

/** Ativa/desativa ou muda o plano de um médico (super-admin). */
export const setDoctorStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SetStatusSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.active !== undefined) patch.active = data.active;
    if (data.plan !== undefined) patch.plan = data.plan;
    const { error } = await (supabaseAdmin as any)
      .from("doctors")
      .update(patch)
      .eq("id", data.doctorId);
    return { ok: !error };
  });
