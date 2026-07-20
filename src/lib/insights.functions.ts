/**
 * Analytics de crescimento do dono (super-admin): funil de conversão, coortes
 * de retenção, unit economics (LTV/CAC por canal), custo/margem de IA, previsão
 * de receita e leaderboard de médicos — mais os alertas de churn/risco.
 *
 * Tudo read-only, via supabaseAdmin, com safe() por bloco (uma falha não
 * derruba o resto) e .limit(MAX_ROWS) nas leituras que agregam totais.
 * Números com premissas (LTV, conversão, churn, custo de IA) são claramente
 * rotulados como estimativa — os parâmetros ficam nas constantes abaixo.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  ACCESS_STATUS,
  MAX_ROWS,
  TokenSchema,
  doctorPlanMonthlyCents,
  monthStartISO,
  patientPremiumMonthlyCents,
  requireSuperAdmin,
  safe,
} from "@/lib/platform-admin.server";

// ── Premissas (fáceis de ajustar quando houver histórico real) ───────────
const DOCTOR_LIFETIME_MONTHS = 24; // tempo médio de vida de um médico assinante
const PATIENT_LIFETIME_MONTHS = 12; // idem paciente premium (ligado à gestação)
const TRIAL_CONVERSION = 0.4; // fração dos testes que viram pagantes
const MONTHLY_CHURN = 0.05; // cancelamento mensal estimado
const AI_COST_PER_HIT_CENTS = 1; // custo estimado por resposta do cérebro (R$0,01)
const RETENTION_CYCLE_DAYS = 35; // "reteve" = sobreviveu ao 1º ciclo (~1 mês)
const DAY = 24 * 60 * 60 * 1000;

const NAME_UNKNOWN = "(sem nome)";

type DoctorLite = {
  id: string;
  display_name: string | null;
  plan: string | null;
  active: boolean | null;
  created_at: string | null;
};
type SubLite = {
  user_id: string;
  product: string;
  plan: string | null;
  status: string | null;
  source: string | null;
  current_period_end: string | null;
  created_at: string | null;
};

async function loadDoctors(sb: any): Promise<DoctorLite[]> {
  return safe<DoctorLite[]>(
    async () =>
      ((await sb.from("doctors").select("id,display_name,plan,active,created_at").limit(MAX_ROWS))
        .data ?? []) as DoctorLite[],
    [],
  );
}
async function loadSubs(sb: any): Promise<SubLite[]> {
  return safe<SubLite[]>(
    async () =>
      ((
        await sb
          .from("subscriptions")
          .select("user_id,product,plan,status,source,current_period_end,created_at")
          .limit(MAX_ROWS)
      ).data ?? []) as SubLite[],
    [],
  );
}

/** Mapa de atividade por paciente: dias distintos + última atividade (ms). */
async function loadPatientActivity(
  sb: any,
): Promise<Map<string, { days: Set<string>; last: number }>> {
  return safe(async () => {
    const map = new Map<string, { days: Set<string>; last: number }>();
    const record = (uid: string | null, ts: string | null) => {
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
      sb.from("health_logs").select("user_id,created_at").limit(MAX_ROWS),
      sb.from("journal_entries").select("user_id,created_at").limit(MAX_ROWS),
      sb.from("kick_sessions").select("user_id,started_at").limit(MAX_ROWS),
    ]);
    (health.data ?? []).forEach((r: any) => record(r.user_id, r.created_at));
    (journals.data ?? []).forEach((r: any) => record(r.user_id, r.created_at));
    (kicks.data ?? []).forEach((r: any) => record(r.user_id, r.started_at));
    return map;
  }, new Map());
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

// ═════════════════════════════════════════════════════════════════════════
// Crescimento: funil + coortes + unit economics + IA + forecast + leaderboard
// ═════════════════════════════════════════════════════════════════════════

export type GrowthMetrics = {
  isSuperAdmin: true;
  funnel: {
    doctors: { registered: number; activated: number; paying: number; retained: number };
    patients: { total: number; activated: number; premium: number };
  };
  cohorts: { month: string; size: number; activatedPct: number; active30dPct: number }[];
  unitEconomics: {
    doctorArpuCents: number;
    doctorLtvCents: number;
    patientArpuCents: number;
    patientLtvCents: number;
    channels: {
      code: string;
      name: string;
      signups: number;
      commissionTotalCents: number;
      cacCents: number;
    }[];
    assumptions: { doctorLifetimeMonths: number; patientLifetimeMonths: number };
  };
  aiCost: {
    hitsThisMonth: number;
    costThisMonthCents: number;
    costPerHitCents: number;
    mrrCents: number;
    marginThisMonthCents: number;
    byDoctor: { name: string; hits: number; costCents: number }[];
  };
  forecast: {
    currentMrrCents: number;
    months: { label: string; projectedMrrCents: number }[];
    assumptions: { trialConversion: number; monthlyChurn: number };
  };
  leaderboard: {
    doctorId: string;
    name: string;
    score: number;
    brainEntries: number;
    patients: number;
    brainHitsThisMonth: number;
  }[];
  generatedAt: string;
};

export const getGrowthMetrics = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const now = Date.now();
    const monthStart = monthStartISO();

    const [doctors, subs, activity] = await Promise.all([
      loadDoctors(sb),
      loadSubs(sb),
      loadPatientActivity(sb),
    ]);

    // Pacientes (id, doctor_id, created_at, ref_code)
    type PatRow = { id: string; doctor_id: string | null; created_at: string | null };
    const patRows = await safe<PatRow[]>(
      async () =>
        ((await sb.from("patient_profiles").select("id,doctor_id,created_at").limit(MAX_ROWS))
          .data ?? []) as PatRow[],
      [],
    );

    // ── Assinaturas: pagantes, em teste, premium pagas ──
    const doctorPaying = new Map<string, { plan: string }>();
    const doctorTrialing = new Set<string>();
    const doctorRetained = new Set<string>();
    const patientPremium = new Map<string, { plan: string | null; source: string }>();
    for (const s of subs) {
      const grants = ACCESS_STATUS.has(s.status ?? "");
      if (s.product === "doctor_plan") {
        if (s.status === "trialing") doctorTrialing.add(s.user_id);
        if (grants) {
          doctorPaying.set(s.user_id, { plan: s.plan ?? "" });
          if (s.created_at && new Date(s.created_at).getTime() <= now - RETENTION_CYCLE_DAYS * DAY)
            doctorRetained.add(s.user_id);
        }
      } else if (s.product === "quiz_premium" && grants) {
        patientPremium.set(s.user_id, { plan: s.plan ?? null, source: s.source ?? "stripe" });
      }
    }

    // ── Funil de médicos ──
    const patientsByDoctor = new Map<string, number>();
    for (const p of patRows)
      if (p.doctor_id)
        patientsByDoctor.set(p.doctor_id, (patientsByDoctor.get(p.doctor_id) ?? 0) + 1);
    const doctorsRegistered = doctors.length;
    const doctorsActivated = doctors.filter(
      (d) => (patientsByDoctor.get(d.id) ?? 0) > 0 || doctorPaying.has(d.id),
    ).length;
    const doctorsPaying = doctors.filter((d) => doctorPaying.has(d.id)).length;
    const doctorsRetained = doctors.filter((d) => doctorRetained.has(d.id)).length;

    // ── Funil de pacientes ──
    const patientsTotal = patRows.length;
    const patientsActivated = patRows.filter((p) => activity.has(p.id)).length;
    const patientsPremiumCount = patRows.filter((p) => patientPremium.has(p.id)).length;

    // ── Coortes de retenção (por mês de cadastro da paciente) ──
    const cohortMap = new Map<string, { size: number; activated: number; active30d: number }>();
    for (const p of patRows) {
      if (!p.created_at) continue;
      const month = p.created_at.slice(0, 7); // YYYY-MM
      const c = cohortMap.get(month) ?? { size: 0, activated: 0, active30d: 0 };
      c.size += 1;
      const a = activity.get(p.id);
      if (a) {
        c.activated += 1;
        if (a.last >= now - 30 * DAY) c.active30d += 1;
      }
      cohortMap.set(month, c);
    }
    const cohorts = [...cohortMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6)
      .map(([month, c]) => ({
        month,
        size: c.size,
        activatedPct: pct(c.activated, c.size),
        active30dPct: pct(c.active30d, c.size),
      }));

    // ── Receita real (para unit economics, IA e forecast) ──
    let doctorMrrCents = 0;
    for (const { plan } of doctorPaying.values()) doctorMrrCents += doctorPlanMonthlyCents(plan);
    let patientMrrCents = 0;
    for (const pp of patientPremium.values())
      if (pp.source === "stripe") patientMrrCents += patientPremiumMonthlyCents(pp.plan);
    const totalMrrCents = doctorMrrCents + patientMrrCents;

    // ── Unit economics ──
    const doctorArpuCents = doctorsPaying > 0 ? Math.round(doctorMrrCents / doctorsPaying) : 0;
    const payingPremium = [...patientPremium.values()].filter((p) => p.source === "stripe").length;
    const patientArpuCents = payingPremium > 0 ? Math.round(patientMrrCents / payingPremium) : 0;

    const channels = await safe(
      async () => {
        const { data: affs } = await sb.from("affiliates").select("code,name").limit(300);
        const { data: earnings } = await sb
          .from("affiliate_earnings")
          .select("affiliate_code,commission_cents")
          .limit(MAX_ROWS);
        const { data: signups } = await sb
          .from("patient_profiles")
          .select("ref_code")
          .not("ref_code", "is", null)
          .limit(MAX_ROWS);
        const commByCode = new Map<string, number>();
        for (const e of (earnings ?? []) as { affiliate_code: string; commission_cents: number }[])
          commByCode.set(
            e.affiliate_code,
            (commByCode.get(e.affiliate_code) ?? 0) + (e.commission_cents ?? 0),
          );
        const signupByCode = new Map<string, number>();
        for (const s of (signups ?? []) as { ref_code: string }[])
          signupByCode.set(s.ref_code, (signupByCode.get(s.ref_code) ?? 0) + 1);
        return ((affs ?? []) as { code: string; name: string }[]).map((a) => {
          const commissionTotalCents = commByCode.get(a.code) ?? 0;
          const s = signupByCode.get(a.code) ?? 0;
          return {
            code: a.code,
            name: a.name,
            signups: s,
            commissionTotalCents,
            cacCents: s > 0 ? Math.round(commissionTotalCents / s) : 0,
          };
        });
      },
      [] as {
        code: string;
        name: string;
        signups: number;
        commissionTotalCents: number;
        cacCents: number;
      }[],
    );

    // ── Custo / margem de IA ──
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
    const nameById = new Map(doctors.map((d) => [d.id, d.display_name || NAME_UNKNOWN]));
    let hitsThisMonth = 0;
    for (const n of brainHitsByDoctor.values()) hitsThisMonth += n;
    const aiByDoctor = [...brainHitsByDoctor.entries()]
      .map(([id, hits]) => ({
        name: nameById.get(id) ?? NAME_UNKNOWN,
        hits,
        costCents: hits * AI_COST_PER_HIT_CENTS,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 20);
    const costThisMonthCents = hitsThisMonth * AI_COST_PER_HIT_CENTS;

    // ── Leaderboard de engajamento ──
    const brainEntriesByDoctor = await safe<Map<string, number>>(async () => {
      const { data: rows } = await sb.from("brain_entries").select("doctor_id").limit(MAX_ROWS);
      const m = new Map<string, number>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[])
        if (r.doctor_id) m.set(r.doctor_id, (m.get(r.doctor_id) ?? 0) + 1);
      return m;
    }, new Map());
    const leaderboard = doctors
      .map((d) => {
        const brainEntries = brainEntriesByDoctor.get(d.id) ?? 0;
        const patients = patientsByDoctor.get(d.id) ?? 0;
        const hits = brainHitsByDoctor.get(d.id) ?? 0;
        // Peso: treinar o cérebro e carteira ativa valem mais que uso pontual.
        const score = brainEntries * 3 + patients * 2 + hits;
        return {
          doctorId: d.id,
          name: d.display_name || NAME_UNKNOWN,
          score,
          brainEntries,
          patients,
          brainHitsThisMonth: hits,
        };
      })
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    // ── Forecast de MRR (3 meses) ──
    const trialingCount = doctors.filter(
      (d) => doctorTrialing.has(d.id) && !doctorPaying.has(d.id),
    ).length;
    const avgDoctorPriceCents = doctorArpuCents || 29700; // fallback: Pro
    const monthlyNewFromTrials = Math.round(trialingCount * TRIAL_CONVERSION * avgDoctorPriceCents);
    const months: { label: string; projectedMrrCents: number }[] = [];
    let running = totalMrrCents;
    const labelFmt = (offset: number) => {
      const d = new Date();
      d.setMonth(d.getMonth() + offset);
      return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    };
    for (let i = 1; i <= 3; i++) {
      running = Math.round(running * (1 - MONTHLY_CHURN) + monthlyNewFromTrials);
      months.push({ label: labelFmt(i), projectedMrrCents: running });
    }

    const metrics: GrowthMetrics = {
      isSuperAdmin: true,
      funnel: {
        doctors: {
          registered: doctorsRegistered,
          activated: doctorsActivated,
          paying: doctorsPaying,
          retained: doctorsRetained,
        },
        patients: {
          total: patientsTotal,
          activated: patientsActivated,
          premium: patientsPremiumCount,
        },
      },
      cohorts,
      unitEconomics: {
        doctorArpuCents,
        doctorLtvCents: doctorArpuCents * DOCTOR_LIFETIME_MONTHS,
        patientArpuCents,
        patientLtvCents: patientArpuCents * PATIENT_LIFETIME_MONTHS,
        channels: channels.sort((a, b) => b.signups - a.signups),
        assumptions: {
          doctorLifetimeMonths: DOCTOR_LIFETIME_MONTHS,
          patientLifetimeMonths: PATIENT_LIFETIME_MONTHS,
        },
      },
      aiCost: {
        hitsThisMonth,
        costThisMonthCents,
        costPerHitCents: AI_COST_PER_HIT_CENTS,
        mrrCents: totalMrrCents,
        marginThisMonthCents: totalMrrCents - costThisMonthCents,
        byDoctor: aiByDoctor,
      },
      forecast: {
        currentMrrCents: totalMrrCents,
        months,
        assumptions: { trialConversion: TRIAL_CONVERSION, monthlyChurn: MONTHLY_CHURN },
      },
      leaderboard,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true as const, metrics };
  });

// ═════════════════════════════════════════════════════════════════════════
// Alertas de churn / risco
// ═════════════════════════════════════════════════════════════════════════

export type ChurnAlert = {
  kind: "past_due" | "trial_ending" | "premium_lapsing" | "no_patients" | "inactive_doctor";
  severity: "alta" | "media" | "baixa";
  who: string;
  detail: string;
};

export type ChurnAlerts = {
  isSuperAdmin: true;
  alerts: ChurnAlert[];
  counts: {
    past_due: number;
    trial_ending: number;
    premium_lapsing: number;
    no_patients: number;
    inactive_doctor: number;
  };
  generatedAt: string;
};

export const getChurnAlerts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const now = Date.now();
    const soon = now + 3 * DAY;

    const [doctors, subs] = await Promise.all([loadDoctors(sb), loadSubs(sb)]);
    const docName = new Map(doctors.map((d) => [d.id, d.display_name || NAME_UNKNOWN]));

    // Nome/e-mail das pacientes premium (para alertas de lapsing)
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

    const patientsByDoctor = await safe<Map<string, number>>(async () => {
      const { data: rows } = await sb.from("patient_profiles").select("doctor_id").limit(MAX_ROWS);
      const m = new Map<string, number>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[])
        if (r.doctor_id) m.set(r.doctor_id, (m.get(r.doctor_id) ?? 0) + 1);
      return m;
    }, new Map());
    const trainedSet = await safe<Set<string>>(async () => {
      const { data: rows } = await sb.from("brain_entries").select("doctor_id").limit(MAX_ROWS);
      const s = new Set<string>();
      for (const r of (rows ?? []) as { doctor_id: string | null }[])
        if (r.doctor_id) s.add(r.doctor_id);
      return s;
    }, new Set());

    const alerts: ChurnAlert[] = [];
    const paying = new Set<string>();
    for (const s of subs) {
      if (s.product === "doctor_plan") {
        if (ACCESS_STATUS.has(s.status ?? "")) paying.add(s.user_id);
        if (s.status === "past_due") {
          alerts.push({
            kind: "past_due",
            severity: "alta",
            who: docName.get(s.user_id) ?? NAME_UNKNOWN,
            detail: "Assinatura do médico em atraso — cobrança falhou.",
          });
        }
        if (s.status === "trialing" && s.current_period_end) {
          const end = new Date(s.current_period_end).getTime();
          if (end <= soon)
            alerts.push({
              kind: "trial_ending",
              severity: "media",
              who: docName.get(s.user_id) ?? NAME_UNKNOWN,
              detail: `Teste do médico termina em ${new Date(end).toLocaleDateString("pt-BR")}.`,
            });
        }
      } else if (s.product === "quiz_premium") {
        if (s.status === "past_due") {
          alerts.push({
            kind: "premium_lapsing",
            severity: "media",
            who: emailById.get(s.user_id) ?? "Paciente",
            detail: "Premium da paciente em atraso — pagamento falhou.",
          });
        }
        if (s.status === "trialing" && s.current_period_end) {
          const end = new Date(s.current_period_end).getTime();
          if (end <= soon)
            alerts.push({
              kind: "premium_lapsing",
              severity: "baixa",
              who: emailById.get(s.user_id) ?? "Paciente",
              detail: `Teste do Premium termina em ${new Date(end).toLocaleDateString("pt-BR")}.`,
            });
        }
      }
    }

    // Médicos pagando sem nenhuma paciente (onboarding travado = risco de churn)
    for (const id of paying) {
      if ((patientsByDoctor.get(id) ?? 0) === 0)
        alerts.push({
          kind: "no_patients",
          severity: "media",
          who: docName.get(id) ?? NAME_UNKNOWN,
          detail: "Médico pagando, mas ainda sem pacientes vinculadas.",
        });
      if (!trainedSet.has(id))
        alerts.push({
          kind: "inactive_doctor",
          severity: "baixa",
          who: docName.get(id) ?? NAME_UNKNOWN,
          detail: "Médico pagando, mas ainda não treinou o Segundo Cérebro.",
        });
    }

    const counts = {
      past_due: alerts.filter((a) => a.kind === "past_due").length,
      trial_ending: alerts.filter((a) => a.kind === "trial_ending").length,
      premium_lapsing: alerts.filter((a) => a.kind === "premium_lapsing").length,
      no_patients: alerts.filter((a) => a.kind === "no_patients").length,
      inactive_doctor: alerts.filter((a) => a.kind === "inactive_doctor").length,
    };
    const rank = { alta: 0, media: 1, baixa: 2 };
    alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);

    const result: ChurnAlerts = {
      isSuperAdmin: true,
      alerts,
      counts,
      generatedAt: new Date().toISOString(),
    };
    return { ok: true as const, result };
  });
