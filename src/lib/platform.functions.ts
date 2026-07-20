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
import {
  ACCESS_STATUS,
  MAX_ROWS,
  PAID_STATUS,
  PAYING_STATUS,
  PLAN_PRICE,
  TokenSchema,
  doctorPlanMonthlyCents,
  patientPremiumMonthlyCents,
  platformAdminEmail,
  requireSuperAdmin,
  safe,
} from "@/lib/platform-admin.server";
import { writeAudit } from "@/lib/audit.server";

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
            .limit(MAX_ROWS)
        ).data ?? []) as DocRow[],
      [],
    );

    // Contagens auxiliares por médico (pacientes vinculadas e entradas de cérebro)
    const patientsByDoctor = await safe<Map<string, number>>(async () => {
      const { data: rows } = await sb.from("patient_profiles").select("doctor_id").limit(MAX_ROWS);
      const m = new Map<string, number>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[]) {
        if (r.doctor_id) m.set(r.doctor_id, (m.get(r.doctor_id) ?? 0) + 1);
      }
      return m;
    }, new Map());

    const brainByDoctor = await safe<Map<string, number>>(async () => {
      const { data: rows } = await sb.from("brain_entries").select("doctor_id").limit(MAX_ROWS);
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

// ─────────────────────────────────────────────────────────────────────────────
// Insights da plataforma (super-admin): o dashboard do DONO — tudo do site,
// dividido por médico, com receita REAL (assinaturas ativas), planos mais
// vendidos, agendamentos, consultas pagas e comissões a pagar (afiliados/cupons).
// Fonte de verdade da receita: tabela `subscriptions` (estado do Stripe), não o
// campo doctors.plan (que pode ser trial sem pagamento).
// ─────────────────────────────────────────────────────────────────────────────

export type InsightDoctor = {
  doctorId: string;
  name: string;
  email: string | null;
  plan: string;
  subStatus: string | null;
  paying: boolean;
  mrrCents: number;
  patients: number;
  patientsPremium: number;
  appointments: number;
  appointmentsThisMonth: number;
  paidConsults: number;
  consultRevenueCents: number;
  brainEntries: number;
  brainHitsThisMonth: number;
};
export type InsightAffiliate = {
  code: string;
  name: string;
  commissionPct: number;
  active: boolean;
  signups: number;
  revenueCents: number;
  /** Comissão acumulada na vida toda (não desconta repasses já feitos). */
  commissionTotalCents: number;
  /** Comissão gerada só neste mês — o valor típico do repasse do ciclo. */
  commissionMonthCents: number;
};
export type InsightCoupon = {
  code: string;
  kind: string;
  active: boolean;
  redemptions: number;
  maxRedemptions: number | null;
};
export type PlatformInsights = {
  isSuperAdmin: true;
  revenue: {
    doctorMrrCents: number;
    patientMrrCents: number;
    totalMrrCents: number;
    consultRevenueCents: number;
  };
  subscriptions: {
    doctorsPaying: number;
    patientsPremium: number;
    byPlan: { plan: string; count: number; monthly: number; annual: number }[];
  };
  appointments: { total: number; thisMonth: number; byStatus: { status: string; count: number }[] };
  transactions: {
    activeSubscriptions: number;
    paidConsultations: number;
    affiliateInvoices: number;
  };
  perDoctor: InsightDoctor[];
  affiliates: InsightAffiliate[];
  coupons: InsightCoupon[];
  generatedAt: string;
};

/** Dashboard consolidado do dono (super-admin). Tudo do site, por médico. */
export const getPlatformInsights = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Médicos
    type DocRow = {
      id: string;
      display_name: string | null;
      plan: string | null;
      active: boolean | null;
    };
    const docRows = await safe<DocRow[]>(
      async () =>
        ((await sb.from("doctors").select("id,display_name,plan,active").limit(MAX_ROWS)).data ??
          []) as DocRow[],
      [],
    );

    // Assinaturas (fonte de verdade da receita)
    type SubRow = {
      user_id: string;
      product: string;
      plan: string | null;
      status: string | null;
      source: string | null;
      created_at: string | null;
    };
    const subs = await safe<SubRow[]>(
      async () =>
        ((
          await sb
            .from("subscriptions")
            .select("user_id,product,plan,status,source,created_at")
            .order("created_at", { ascending: false })
            .limit(MAX_ROWS)
        ).data ?? []) as SubRow[],
      [],
    );
    // Melhor assinatura do médico (paga > teste > outra). `paying` = receita
    // realizada (status active); `trialing` dá acesso mas NÃO entra no MRR.
    const subRank = (st: string) => (PAYING_STATUS.has(st) ? 2 : ACCESS_STATUS.has(st) ? 1 : 0);
    const doctorSub = new Map<string, { plan: string; status: string; paying: boolean }>();
    // Premium da paciente: só 'stripe' + paga entra no MRR; cortesias (convite)
    // e testes contam como VOLUME, mas não como receita.
    const patientPremium = new Map<
      string,
      { plan: string | null; source: string; paying: boolean }
    >();
    for (const s of subs) {
      const status = s.status ?? "";
      const grants = ACCESS_STATUS.has(status);
      const paysNow = PAYING_STATUS.has(status);
      if (s.product === "doctor_plan") {
        const prev = doctorSub.get(s.user_id);
        if (!prev || subRank(status) > subRank(prev.status)) {
          doctorSub.set(s.user_id, { plan: s.plan ?? "", status, paying: paysNow });
        }
      } else if (s.product === "quiz_premium" && grants) {
        const prev = patientPremium.get(s.user_id);
        if (!prev || (paysNow && !prev.paying))
          patientPremium.set(s.user_id, {
            plan: s.plan ?? null,
            source: s.source ?? "stripe",
            paying: paysNow,
          });
      }
    }

    // Pacientes → médico (e quais são premium)
    type PatRow = { id: string; doctor_id: string | null };
    const patRows = await safe<PatRow[]>(
      async () =>
        ((await sb.from("patient_profiles").select("id,doctor_id").limit(MAX_ROWS)).data ??
          []) as PatRow[],
      [],
    );
    const patientsByDoctor = new Map<string, number>();
    const premiumByDoctor = new Map<string, number>();
    for (const p of patRows) {
      if (!p.doctor_id) continue;
      patientsByDoctor.set(p.doctor_id, (patientsByDoctor.get(p.doctor_id) ?? 0) + 1);
      if (patientPremium.has(p.id))
        premiumByDoctor.set(p.doctor_id, (premiumByDoctor.get(p.doctor_id) ?? 0) + 1);
    }

    // Agendamentos por médico (total + mês) e por status
    type ApptRow = { doctor_id: string | null; status: string | null; created_at: string | null };
    const apptRows = await safe<ApptRow[]>(
      async () =>
        ((
          await sb
            .from("appointment_requests")
            .select("doctor_id,status,created_at")
            .limit(MAX_ROWS)
        ).data ?? []) as ApptRow[],
      [],
    );
    const apptByDoctor = new Map<string, number>();
    const apptMonthByDoctor = new Map<string, number>();
    const apptByStatus = new Map<string, number>();
    let apptThisMonth = 0;
    for (const a of apptRows) {
      apptByStatus.set(a.status ?? "—", (apptByStatus.get(a.status ?? "—") ?? 0) + 1);
      const thisMonth = !!a.created_at && a.created_at >= monthStart;
      if (thisMonth) apptThisMonth += 1;
      if (a.doctor_id) {
        apptByDoctor.set(a.doctor_id, (apptByDoctor.get(a.doctor_id) ?? 0) + 1);
        if (thisMonth)
          apptMonthByDoctor.set(a.doctor_id, (apptMonthByDoctor.get(a.doctor_id) ?? 0) + 1);
      }
    }

    // Consultas pagas por médico
    type ConsultRow = {
      doctor_id: string | null;
      status: string | null;
      amount_cents: number | null;
    };
    const consultRows = await safe<ConsultRow[]>(
      async () =>
        ((
          await sb
            .from("private_consultations")
            .select("doctor_id,status,amount_cents")
            .limit(MAX_ROWS)
        ).data ?? []) as ConsultRow[],
      [],
    );
    const consultCountByDoctor = new Map<string, number>();
    const consultRevByDoctor = new Map<string, number>();
    let paidConsultationsTotal = 0;
    let consultRevenueTotal = 0;
    for (const c of consultRows) {
      if (!PAID_STATUS.has(c.status ?? "")) continue;
      paidConsultationsTotal += 1;
      consultRevenueTotal += c.amount_cents ?? 0;
      if (c.doctor_id) {
        consultCountByDoctor.set(c.doctor_id, (consultCountByDoctor.get(c.doctor_id) ?? 0) + 1);
        consultRevByDoctor.set(
          c.doctor_id,
          (consultRevByDoctor.get(c.doctor_id) ?? 0) + (c.amount_cents ?? 0),
        );
      }
    }

    // Cérebro por médico
    const brainEntriesByDoctor = await safe<Map<string, number>>(async () => {
      const { data: rows } = await sb.from("brain_entries").select("doctor_id").limit(MAX_ROWS);
      const m = new Map<string, number>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[])
        if (r.doctor_id) m.set(r.doctor_id, (m.get(r.doctor_id) ?? 0) + 1);
      return m;
    }, new Map());
    const brainHitsByDoctor = await safe<Map<string, number>>(async () => {
      const { data: rows } = await sb
        .from("brain_hits")
        .select("doctor_id,channel,created_at")
        .gte("created_at", monthStart)
        .limit(MAX_ROWS);
      const m = new Map<string, number>();
      for (const r of (rows ?? []) as { doctor_id: string | null; channel: string | null }[])
        if (r.doctor_id && r.channel !== "teste") m.set(r.doctor_id, (m.get(r.doctor_id) ?? 0) + 1);
      return m;
    }, new Map());

    // E-mails dos médicos (best effort)
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

    // Monta linhas por médico + agrega receita e planos
    let doctorMrrCents = 0;
    const byPlan = new Map<string, { count: number; monthly: number; annual: number }>();
    const perDoctor: InsightDoctor[] = docRows.map((d) => {
      const sub = doctorSub.get(d.id);
      const paying = !!sub?.paying;
      const mrrCents = paying ? doctorPlanMonthlyCents(sub!.plan || d.plan || "") : 0;
      doctorMrrCents += mrrCents;
      if (paying) {
        const base = (sub!.plan || d.plan || "—").replace(/_annual$/, "");
        const isAnnual = /_annual$/.test(sub!.plan || "");
        const cur = byPlan.get(base) ?? { count: 0, monthly: 0, annual: 0 };
        cur.count += 1;
        if (isAnnual) cur.annual += 1;
        else cur.monthly += 1;
        byPlan.set(base, cur);
      }
      return {
        doctorId: d.id,
        name: d.display_name || "(sem nome)",
        email: emailById.get(d.id) ?? null,
        plan: d.plan || "trial",
        subStatus: sub?.status ?? null,
        paying,
        mrrCents,
        patients: patientsByDoctor.get(d.id) ?? 0,
        patientsPremium: premiumByDoctor.get(d.id) ?? 0,
        appointments: apptByDoctor.get(d.id) ?? 0,
        appointmentsThisMonth: apptMonthByDoctor.get(d.id) ?? 0,
        paidConsults: consultCountByDoctor.get(d.id) ?? 0,
        consultRevenueCents: consultRevByDoctor.get(d.id) ?? 0,
        brainEntries: brainEntriesByDoctor.get(d.id) ?? 0,
        brainHitsThisMonth: brainHitsByDoctor.get(d.id) ?? 0,
      };
    });
    perDoctor.sort((a, b) => b.mrrCents - a.mrrCents || b.patients - a.patients);

    // Premium das pacientes (MRR): só assinaturas PAGAS (active) e via 'stripe'.
    // Cortesias (convite) e testes contam como volume, não como receita.
    let patientMrrCents = 0;
    let payingPremiumCount = 0;
    for (const pp of patientPremium.values())
      if (pp.paying && pp.source === "stripe") {
        patientMrrCents += patientPremiumMonthlyCents(pp.plan);
        payingPremiumCount += 1;
      }

    // Afiliados / micro-influenciadores (comissões: total acumulado + mês atual)
    const affiliates = await safe<InsightAffiliate[]>(async () => {
      const { data: rows } = await sb
        .from("affiliates")
        .select("code,name,commission_pct,active,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      const { data: earnings } = await sb
        .from("affiliate_earnings")
        .select("affiliate_code,commission_cents,amount_paid_cents,created_at")
        .limit(MAX_ROWS);
      const { data: signups } = await sb
        .from("patient_profiles")
        .select("ref_code")
        .not("ref_code", "is", null)
        .limit(MAX_ROWS);
      const byCode = new Map<
        string,
        { commission: number; commissionMonth: number; revenue: number; signups: number }
      >();
      for (const e of (earnings ?? []) as {
        affiliate_code: string;
        commission_cents: number;
        amount_paid_cents: number;
        created_at: string | null;
      }[]) {
        const c = byCode.get(e.affiliate_code) ?? {
          commission: 0,
          commissionMonth: 0,
          revenue: 0,
          signups: 0,
        };
        c.commission += e.commission_cents ?? 0;
        if (e.created_at && e.created_at >= monthStart)
          c.commissionMonth += e.commission_cents ?? 0;
        c.revenue += e.amount_paid_cents ?? 0;
        byCode.set(e.affiliate_code, c);
      }
      for (const s of (signups ?? []) as { ref_code: string }[]) {
        const c = byCode.get(s.ref_code) ?? {
          commission: 0,
          commissionMonth: 0,
          revenue: 0,
          signups: 0,
        };
        c.signups += 1;
        byCode.set(s.ref_code, c);
      }
      return ((rows ?? []) as any[]).map((r) => ({
        code: r.code,
        name: r.name,
        commissionPct: r.commission_pct,
        active: r.active,
        signups: byCode.get(r.code)?.signups ?? 0,
        revenueCents: byCode.get(r.code)?.revenue ?? 0,
        commissionTotalCents: byCode.get(r.code)?.commission ?? 0,
        commissionMonthCents: byCode.get(r.code)?.commissionMonth ?? 0,
      }));
    }, []);
    const affiliateInvoices = await safe(async () => {
      const { count } = await sb
        .from("affiliate_earnings")
        .select("*", { count: "exact", head: true });
      return (count ?? 0) as number;
    }, 0);

    // Cupons de plataforma (usos)
    const coupons = await safe<InsightCoupon[]>(async () => {
      const { data: rows } = await sb
        .from("platform_coupons")
        .select("id,code,kind,active,max_redemptions")
        .order("created_at", { ascending: false })
        .limit(300);
      const { data: reds } = await sb
        .from("platform_coupon_redemptions")
        .select("coupon_id")
        .limit(MAX_ROWS);
      const redByCoupon = new Map<string, number>();
      for (const r of (reds ?? []) as { coupon_id: string }[])
        redByCoupon.set(r.coupon_id, (redByCoupon.get(r.coupon_id) ?? 0) + 1);
      return ((rows ?? []) as any[]).map((c) => ({
        code: c.code,
        kind: c.kind,
        active: c.active,
        maxRedemptions: c.max_redemptions ?? null,
        redemptions: redByCoupon.get(c.id) ?? 0,
      }));
    }, []);

    const doctorsPaying = perDoctor.filter((d) => d.paying).length;
    const insights: PlatformInsights = {
      isSuperAdmin: true,
      revenue: {
        doctorMrrCents,
        patientMrrCents,
        totalMrrCents: doctorMrrCents + patientMrrCents,
        consultRevenueCents: consultRevenueTotal,
      },
      subscriptions: {
        doctorsPaying,
        patientsPremium: patientPremium.size,
        byPlan: [...byPlan.entries()]
          .map(([plan, v]) => ({ plan, ...v }))
          .sort((a, b) => b.count - a.count),
      },
      appointments: {
        total: apptRows.length,
        thisMonth: apptThisMonth,
        byStatus: [...apptByStatus.entries()]
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count),
      },
      transactions: {
        activeSubscriptions: doctorsPaying + payingPremiumCount,
        paidConsultations: paidConsultationsTotal,
        affiliateInvoices,
      },
      perDoctor,
      affiliates,
      coupons,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true as const, insights };
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
    if (!error)
      await writeAudit({ id: user.id, email: user.email }, "doctor.status", data.doctorId, {
        active: data.active ?? null,
        verified: data.verified ?? null,
        plan: data.plan ?? null,
      });
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
      return ((await sb.from("doctors").select("id,active").limit(MAX_ROWS)).data ?? []) as {
        id: string;
        active: boolean | null;
      }[];
    }, []);
    const trainedSet = await safe<Set<string>>(async () => {
      const { data: rows } = await sb.from("brain_entries").select("doctor_id").limit(MAX_ROWS);
      const s = new Set<string>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[])
        if (r.doctor_id) s.add(r.doctor_id);
      return s;
    }, new Set<string>());
    const withPatientsSet = await safe<Set<string>>(async () => {
      const { data: rows } = await sb.from("patient_profiles").select("doctor_id").limit(MAX_ROWS);
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
      await writeAudit({ id: user.id, email: user.email }, "coupon.create", custom, {
        maxRedemptions: data.maxRedemptions ?? null,
      });
      return { ok: true as const, code: custom };
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = randomCode();
      const { error } = await insert(code);
      if (!error) {
        await writeAudit({ id: user.id, email: user.email }, "coupon.create", code, {
          maxRedemptions: data.maxRedemptions ?? null,
        });
        return { ok: true as const, code };
      }
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
    if (!error)
      await writeAudit({ id: user.id, email: user.email }, "coupon.toggle", data.id, {
        active: data.active,
      });
    return { ok: !error };
  });
