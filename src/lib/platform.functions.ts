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
// Tabela de preços vigente (jul/2026) — usada só para ESTIMAR o MRR no
// console do dono. Clínica é sob consulta; 0 aqui = não entra na estimativa
// (o valor real do contrato é somado à mão quando fechar).
const PLAN_PRICE: Record<string, number> = {
  trial: 0,
  free: 0,
  starter: 149,
  pro: 297,
  clinica: 0,
  elite: 597,
  black: 1499,
};

export type PlatformDoctor = {
  id: string;
  display_name: string;
  email: string | null;
  plan: string;
  active: boolean;
  verified: boolean;
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
      verified: boolean | null;
      created_at: string | null;
    };
    const docRows = await safe<DocRow[]>(
      async () =>
        ((
          await sb
            .from("doctors")
            .select("id,display_name,plan,active,verified,created_at")
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
      verified: d.verified ?? false,
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

export type FinanceByDoctor = {
  doctorId: string | null;
  doctorName: string;
  requested: number;
  paid: number;
  pending: number;
  cancelled: number;
  revenueCents: number;
};

export type PlatformFinance = {
  isSuperAdmin: true;
  totals: {
    requested: number;
    paid: number;
    pending: number;
    cancelled: number;
    revenueCents: number;
  };
  byDoctor: FinanceByDoctor[];
  generatedAt: string;
};

// "Pago" = pagamento confirmado pelo médico (ou consulta já realizada).
const PAID_STATUS = new Set(["confirmado", "realizado"]);
const CANCELLED_STATUS = new Set(["cancelado"]);

/**
 * Financeiro da plataforma (super-admin): TODAS as consultas pagas do site,
 * agrupadas por médico. O dono enxerga quanto entrou por perfil de médico e
 * quantas consultas foram efetivamente pagas através da Obstétrica.
 */
export const getPlatformFinance = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    type ConsultRow = {
      doctor_id: string | null;
      status: string | null;
      amount_cents: number | null;
    };
    const rows = await safe<ConsultRow[]>(
      async () =>
        ((await sb.from("private_consultations").select("doctor_id,status,amount_cents")).data ??
          []) as ConsultRow[],
      [],
    );

    const nameById = await safe<Map<string, string>>(async () => {
      const { data: docs } = await sb.from("doctors").select("id,display_name");
      const m = new Map<string, string>();
      for (const d of (docs ?? []) as { id: string; display_name: string | null }[])
        m.set(d.id, d.display_name || "(sem nome)");
      return m;
    }, new Map());

    const NO_DOCTOR = "__none__";
    const acc = new Map<string, FinanceByDoctor>();
    const totals = { requested: 0, paid: 0, pending: 0, cancelled: 0, revenueCents: 0 };

    for (const r of rows) {
      const key = r.doctor_id ?? NO_DOCTOR;
      const entry =
        acc.get(key) ??
        ({
          doctorId: r.doctor_id ?? null,
          doctorName: r.doctor_id
            ? (nameById.get(r.doctor_id) ?? "(médico removido)")
            : "Sem médico",
          requested: 0,
          paid: 0,
          pending: 0,
          cancelled: 0,
          revenueCents: 0,
        } satisfies FinanceByDoctor);

      entry.requested += 1;
      totals.requested += 1;
      const status = r.status ?? "";
      if (PAID_STATUS.has(status)) {
        entry.paid += 1;
        totals.paid += 1;
        entry.revenueCents += r.amount_cents ?? 0;
        totals.revenueCents += r.amount_cents ?? 0;
      } else if (CANCELLED_STATUS.has(status)) {
        entry.cancelled += 1;
        totals.cancelled += 1;
      } else {
        entry.pending += 1;
        totals.pending += 1;
      }
      acc.set(key, entry);
    }

    const byDoctor = [...acc.values()].sort((a, b) => b.revenueCents - a.revenueCents);
    const finance: PlatformFinance = {
      isSuperAdmin: true,
      totals,
      byDoctor,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true as const, finance };
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
  verified: z.boolean().optional(),
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
    if (data.verified !== undefined) patch.verified = data.verified;
    if (data.plan !== undefined) patch.plan = data.plan;
    const { error } = await (supabaseAdmin as any)
      .from("doctors")
      .update(patch)
      .eq("id", data.doctorId);
    return { ok: !error };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Ativação & Retenção (instrumentação) — para o fundador parar de "estar cego".
// Tudo calculado a partir das tabelas de atividade que já existem (sem novo
// pipeline de eventos). Só super-admin.
// ─────────────────────────────────────────────────────────────────────────────

export type RetentionMetrics = {
  patients: {
    total: number;
    activated: number; // fez ≥1 registro (diário/saúde/chutes) alguma vez
    activatedPct: number;
    active7d: number;
    active30d: number;
    returning: number; // teve atividade em ≥2 dias distintos
    returningPct: number;
  };
  doctors: {
    total: number;
    active: number;
    trained: number; // ≥1 entrada no Segundo Cérebro
    trainedPct: number;
    withPatients: number; // ≥1 paciente vinculada
  };
  generatedAt: string;
};

/** Métricas de ativação/retenção da plataforma (super-admin). */
export const getRetentionMetrics = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const nowMs = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // Atividade por paciente: dias distintos + última atividade.
    const activity = await safe(async () => {
      const map = new Map<string, { days: Set<string>; last: number }>();
      const record = (uid: string, ts: string | null) => {
        if (!uid || !ts) return;
        const ms = new Date(ts).getTime();
        if (Number.isNaN(ms)) return;
        const day = new Date(ts).toISOString().slice(0, 10);
        const e = map.get(uid) ?? { days: new Set<string>(), last: 0 };
        e.days.add(day);
        if (ms > e.last) e.last = ms;
        map.set(uid, e);
      };
      const [health, journals, kicks] = await Promise.all([
        sb.from("health_logs").select("user_id,created_at").limit(8000),
        sb.from("journal_entries").select("user_id,created_at").limit(8000),
        sb.from("kick_sessions").select("user_id,started_at").limit(8000),
      ]);
      (health.data ?? []).forEach((r: any) => record(r.user_id, r.created_at));
      (journals.data ?? []).forEach((r: any) => record(r.user_id, r.created_at));
      (kicks.data ?? []).forEach((r: any) => record(r.user_id, r.started_at));
      return map;
    }, new Map<string, { days: Set<string>; last: number }>());

    const patientsTotal = await safe(async () => {
      const { count } = await sb
        .from("patient_profiles")
        .select("*", { count: "exact", head: true });
      return (count ?? 0) as number;
    }, 0);

    let active7d = 0;
    let active30d = 0;
    let returning = 0;
    for (const e of activity.values()) {
      if (e.last >= nowMs - 7 * DAY) active7d += 1;
      if (e.last >= nowMs - 30 * DAY) active30d += 1;
      if (e.days.size >= 2) returning += 1;
    }
    const activated = activity.size;
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

    // Médicos: ativos, treinaram a IA, têm pacientes.
    const docRows = await safe<{ id: string; active: boolean | null }[]>(async () => {
      return ((await sb.from("doctors").select("id,active")).data ?? []) as {
        id: string;
        active: boolean | null;
      }[];
    }, []);
    const trainedSet = await safe<Set<string>>(async () => {
      const { data: rows } = await sb.from("brain_entries").select("doctor_id");
      const s = new Set<string>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[])
        if (r.doctor_id) s.add(r.doctor_id);
      return s;
    }, new Set<string>());
    const withPatientsSet = await safe<Set<string>>(async () => {
      const { data: rows } = await sb.from("patient_profiles").select("doctor_id");
      const s = new Set<string>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[])
        if (r.doctor_id) s.add(r.doctor_id);
      return s;
    }, new Set<string>());

    const doctorsTotal = docRows.length;
    const doctorsActive = docRows.filter((d) => d.active).length;
    const trained = docRows.filter((d) => trainedSet.has(d.id)).length;
    const withPatients = docRows.filter((d) => withPatientsSet.has(d.id)).length;

    const metrics: RetentionMetrics = {
      patients: {
        total: patientsTotal,
        activated,
        activatedPct: pct(activated, patientsTotal),
        active7d,
        active30d,
        returning,
        returningPct: pct(returning, activated),
      },
      doctors: {
        total: doctorsTotal,
        active: doctorsActive,
        trained,
        trainedPct: pct(trained, doctorsTotal),
        withPatients,
      },
      generatedAt: new Date().toISOString(),
    };
    return { ok: true as const, metrics };
  });

/* ══════════════════════════════════════════════════════════════════════
   Cupons de plataforma — só o super-admin (dono) gera. Cada cupom libera o
   Premium do app quando a paciente o resgata no popup. Diferente do convite
   do médico: não pertence a um médico e pode ter vários usos.
   ══════════════════════════════════════════════════════════════════════ */

export type PlatformCoupon = {
  id: string;
  code: string;
  max_redemptions: number | null;
  active: boolean;
  note: string | null;
  created_at: string;
  redemptions: number;
};

/** Lista os cupons de plataforma com a contagem de resgates (super-admin). */
export const listPlatformCoupons = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const, coupons: [] as PlatformCoupon[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: rows, error } = await sb
      .from("platform_coupons")
      .select("id,code,max_redemptions,active,note,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error?.code === "42P01")
      return { ok: false as const, coupons: [] as PlatformCoupon[], missingTable: true as const };
    if (error) return { ok: false as const, coupons: [] as PlatformCoupon[] };

    const { data: reds } = await sb
      .from("platform_coupon_redemptions")
      .select("coupon_id")
      .limit(10000);
    const counts = new Map<string, number>();
    for (const r of (reds ?? []) as { coupon_id: string }[]) {
      counts.set(r.coupon_id, (counts.get(r.coupon_id) ?? 0) + 1);
    }
    const coupons: PlatformCoupon[] = ((rows ?? []) as any[]).map((c) => ({
      ...c,
      redemptions: counts.get(c.id) ?? 0,
    }));
    return { ok: true as const, coupons };
  });

/** Cria um cupom de Premium (código custom ou automático). */
export const createPlatformCoupon = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        code: z
          .string()
          .min(4)
          .max(16)
          .regex(/^[a-zA-Z0-9-]+$/, "só letras, números e -")
          .optional(),
        note: z.string().max(80).optional(),
        maxRedemptions: z.number().int().min(1).max(100000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const custom = (data.code ?? "").trim().toUpperCase();
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const randomCode = () => {
      let c = "";
      for (let i = 0; i < 8; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
      return c;
    };
    const insert = (code: string) =>
      sb.from("platform_coupons").insert({
        code,
        kind: "premium",
        note: data.note?.trim() || null,
        max_redemptions: data.maxRedemptions ?? null,
      });

    // Código custom: sem retry (o admin escolheu). Automático: retenta em
    // colisão (23505) — como no generateInviteCode.
    if (custom) {
      const { error } = await insert(custom);
      if (error?.code === "23505") return { ok: false as const, reason: "duplicado" as const };
      if (error?.code === "42P01") return { ok: false as const, reason: "migracao" as const };
      if (error) return { ok: false as const };
      return { ok: true as const, code: custom };
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = randomCode();
      const { error } = await insert(code);
      if (!error) return { ok: true as const, code };
      if (error.code === "42P01") return { ok: false as const, reason: "migracao" as const };
      if (error.code !== "23505") return { ok: false as const };
      // colisão improvável (32^8) → tenta outro código
    }
    return { ok: false as const };
  });

/** Ativa/desativa um cupom (inativo não resgata mais). */
export const togglePlatformCoupon = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ accessToken: z.string().min(10), id: z.string().uuid(), active: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("platform_coupons")
      .update({ active: data.active })
      .eq("id", data.id);
    return { ok: !error };
  });
