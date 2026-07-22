/**
 * Dashboard do médico — server function que agrega, em UMA chamada, os números
 * que dão valor real ao plano do médico assinante: carteira de pacientes por
 * fase da gestação, engajamento (ativas/inativas/risco de abandono), perguntas
 * pendentes + inteligência de FAQ (temas mais frequentes que alimentam o
 * Segundo Cérebro), uso do cérebro no mês e a agenda de consultas.
 *
 * Gate: equipe da instalação (ADMIN_EMAILS) OU médico assinante ativo — o mesmo
 * requireAdmin estendido de secondbrain.functions.ts.
 *
 * Robustez: cada bloco roda isolado; a falha de UMA query não derruba o resto
 * (defaults 0/[]). Todo acesso é via supabaseAdmin (service_role).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Quem é "o médico": e-mails autorizados, separados por vírgula em ADMIN_EMAILS.
function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Gate estendido (igual secondbrain.functions.ts): equipe da instalação OU médico assinante ativo.
async function requireAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  if (adminEmails().includes(data.user.email.toLowerCase())) return data.user;
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (doc?.active) return data.user;
  return null;
}

/** Multi-inquilino: o dashboard é sempre do próprio médico logado (auth uid). */
async function ownerDoctorId(user: { id: string }): Promise<string> {
  return user.id;
}

export type DoctorDashboard = {
  patients: {
    total: number;
    active7d: number;
    inactive7d: number;
    newThisMonth: number;
    stages: { t1: number; t2: number; t3: number; postparto: number; semData: number };
  };
  questions: {
    pending: number;
    answered: number;
    recentPending: { id: string; question: string; created_at: string }[];
    topThemes: { theme: string; count: number }[];
  };
  brain: {
    entries: number;
    approved: number;
    enabledApp: boolean;
    enabledWhatsapp: boolean;
    hitsThisMonth: number;
  };
  appointments: {
    pending: number;
    confirmedUpcoming: number;
    next: { dateLabel: string; patientName: string } | null;
  };
  engagement: {
    churnRisk: { name: string; lastActiveDays: number }[];
  };
  generatedAt: string;
};

const TokenSchema = z.object({ accessToken: z.string().min(10) });

// Executa uma seção do dashboard de forma isolada: erro → valor default.
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Normaliza texto para análise de FAQ: minúsculas e sem acentos. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Stopwords pt-BR comuns (normalizadas: sem acento) removidas da análise de temas.
const STOPWORDS = new Set(
  [
    "para",
    "você",
    "como",
    "quando",
    "posso",
    "tenho",
    "está",
    "isso",
    "esse",
    "essa",
    "meu",
    "minha",
    "dos",
    "das",
    "com",
    "sem",
    "mais",
    "muito",
    "também",
    "sobre",
    "qual",
    "quais",
  ].map(normalize),
);

/** Extrai os temas mais frequentes das perguntas (inteligência de FAQ). */
function extractTopThemes(questions: string[]): { theme: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const q of questions) {
    for (const word of normalize(q).split(/[^a-z0-9]+/)) {
      if (word.length <= 3 || STOPWORDS.has(word)) continue;
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([theme, count]) => ({ theme, count }));
}

/** Agrega os números do dashboard do médico numa única chamada. */
export const getDoctorDashboard = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Multi-inquilino: o dashboard é SEMPRE recortado pelo doctor_id do médico
    // logado — nunca vaza PII de pacientes de outro perfil.
    const now = new Date();
    const nowMs = now.getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    // Resolver o dono do cérebro isolado: uma falha transitória aqui zera só o
    // bloco brain (fallback user.id), sem derrubar o dashboard inteiro.
    const doctorId = await safe(() => ownerDoctorId(user), user.id);

    // Aplica o recorte por médico quando NÃO é a equipe da instalação: o médico
    // assinante só enxerga o que está vinculado ao próprio doctor_id.
    const scoped = (qb: any) => qb.eq("doctor_id", doctorId);

    // ── Pacientes: carteira, fases da gestação, novas no mês ──────────────────
    type ProfileRow = {
      id: string;
      display_name: string | null;
      lmp_date: string | null;
      due_date: string | null;
      created_at: string | null;
    };
    const profiles = await safe<ProfileRow[]>(
      async () =>
        ((
          await scoped(
            sb.from("patient_profiles").select("id,display_name,lmp_date,due_date,created_at"),
          )
        ).data ?? []) as ProfileRow[],
      [],
    );

    const stages = { t1: 0, t2: 0, t3: 0, postparto: 0, semData: 0 };
    let newThisMonth = 0;
    for (const p of profiles) {
      if (p.created_at && p.created_at >= monthStart) newThisMonth += 1;

      if (!p.lmp_date) {
        stages.semData += 1;
        continue;
      }
      const weeks = Math.floor((nowMs - new Date(p.lmp_date).getTime()) / WEEK_MS);
      const postParto =
        (p.due_date != null && new Date(p.due_date).getTime() < nowMs) || weeks > 42;
      if (postParto) stages.postparto += 1;
      else if (weeks <= 13) stages.t1 += 1;
      else if (weeks <= 27) stages.t2 += 1;
      else stages.t3 += 1;
    }

    // ── Engajamento: última atividade por paciente (health_logs / journal / kicks)
    // Mesma lógica de atividade de getEngagementData (admin.functions.ts):
    // guarda o timestamp de atividade MAIS RECENTE por user_id. Sem filtro de
    // janela aqui — precisamos da última atividade "de sempre" para o risco de
    // abandono (>10 dias sem registro).
    const activityMap = await safe<Map<string, number>>(async () => {
      // O mapa é consultado por p.id; como `profiles` já vem recortado por
      // doctor_id no caminho do assinante, só as pacientes DELE são reveladas.
      if (profiles.length === 0) return new Map<string, number>();
      const map = new Map<string, number>();
      const record = (uid: string, ts: string | null) => {
        if (!uid || !ts) return;
        const ms = new Date(ts).getTime();
        const prev = map.get(uid);
        if (prev == null || ms > prev) map.set(uid, ms);
      };
      const [health, journals, kicks] = await Promise.all([
        sb
          .from("health_logs")
          .select("user_id,created_at")
          .order("created_at", { ascending: false })
          .limit(5000),
        sb
          .from("journal_entries")
          .select("user_id,created_at")
          .order("created_at", { ascending: false })
          .limit(5000),
        sb
          .from("kick_sessions")
          .select("user_id,started_at")
          .order("started_at", { ascending: false })
          .limit(5000),
      ]);
      (health.data ?? []).forEach((r: any) => record(r.user_id, r.created_at));
      (journals.data ?? []).forEach((r: any) => record(r.user_id, r.created_at));
      (kicks.data ?? []).forEach((r: any) => record(r.user_id, r.started_at));
      return map;
    }, new Map<string, number>());

    let active7d = 0;
    const churnCandidates: { name: string; lastActiveDays: number }[] = [];
    for (const p of profiles) {
      const lastMs = activityMap.get(p.id);
      if (lastMs != null && lastMs >= sevenAgoMs) active7d += 1;
      // Risco de abandono: JÁ teve atividade mas ficou >10 dias sem nenhum registro.
      if (lastMs != null) {
        const days = Math.floor((nowMs - lastMs) / (24 * 60 * 60 * 1000));
        if (days > 10) {
          churnCandidates.push({ name: p.display_name ?? "Paciente", lastActiveDays: days });
        }
      }
    }
    const churnRisk = churnCandidates
      .sort((a, b) => b.lastActiveDays - a.lastActiveDays)
      .slice(0, 5);

    // ── Perguntas: pendentes/respondidas, últimas pendentes, temas (FAQ) ──────
    const emptyQuestions = {
      pending: 0,
      answered: 0,
      recentPending: [] as { id: string; question: string; created_at: string }[],
      topThemes: [] as { theme: string; count: number }[],
    };
    const questions = await safe(async () => {
      const [pendingRes, answeredRes, recentRes, textsRes] = await Promise.all([
        scoped(
          sb
            .from("doctor_questions")
            .select("*", { count: "exact", head: true })
            .eq("answered", false),
        ),
        scoped(
          sb
            .from("doctor_questions")
            .select("*", { count: "exact", head: true })
            .eq("answered", true),
        ),
        scoped(
          sb
            .from("doctor_questions")
            .select("id,question,created_at")
            .eq("answered", false)
            .order("created_at", { ascending: false })
            .limit(5),
        ),
        scoped(
          sb
            .from("doctor_questions")
            .select("question")
            .order("created_at", { ascending: false })
            .limit(500),
        ),
      ]);
      return {
        pending: (pendingRes.count ?? 0) as number,
        answered: (answeredRes.count ?? 0) as number,
        recentPending: (recentRes.data ?? []) as {
          id: string;
          question: string;
          created_at: string;
        }[],
        topThemes: extractTopThemes(
          ((textsRes.data ?? []) as { question: string }[]).map((r) => r.question),
        ),
      };
    }, emptyQuestions);

    // ── Segundo Cérebro: entradas, aprovadas, canais ligados, usos no mês ─────
    const brain = await safe(
      async () => {
        const [entriesRes, approvedRes, settingsRes, hitsRes] = await Promise.all([
          sb
            .from("brain_entries")
            .select("*", { count: "exact", head: true })
            .eq("doctor_id", doctorId),
          sb
            .from("brain_entries")
            .select("*", { count: "exact", head: true })
            .eq("doctor_id", doctorId)
            .eq("approved", true),
          sb
            .from("brain_settings")
            .select("enabled_app,enabled_whatsapp")
            .eq("doctor_id", doctorId)
            .maybeSingle(),
          // 'teste' (teste do painel) NÃO conta como uso real do cérebro.
          sb
            .from("brain_hits")
            .select("*", { count: "exact", head: true })
            .eq("doctor_id", doctorId)
            .neq("channel", "teste")
            .gte("created_at", monthStart),
        ]);
        return {
          entries: (entriesRes.count ?? 0) as number,
          approved: (approvedRes.count ?? 0) as number,
          enabledApp: (settingsRes.data?.enabled_app ?? true) as boolean,
          enabledWhatsapp: (settingsRes.data?.enabled_whatsapp ?? true) as boolean,
          hitsThisMonth: (hitsRes.count ?? 0) as number,
        };
      },
      { entries: 0, approved: 0, enabledApp: true, enabledWhatsapp: true, hitsThisMonth: 0 },
    );

    // ── Consultas: pendentes, confirmadas futuras, próxima ────────────────────
    const emptyAppointments = {
      pending: 0,
      confirmedUpcoming: 0,
      next: null as { dateLabel: string; patientName: string } | null,
    };
    const appointments = await safe(async () => {
      const [pendingRes, upcomingRes, nextRes] = await Promise.all([
        scoped(
          sb
            .from("appointment_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending"),
        ),
        scoped(
          sb
            .from("appointment_requests")
            .select("*", { count: "exact", head: true })
            .eq("status", "confirmed")
            .gte("preferred_date", todayStr),
        ),
        scoped(
          sb
            .from("appointment_requests")
            .select("patient_name,preferred_date")
            .eq("status", "confirmed")
            .gte("preferred_date", todayStr)
            .order("preferred_date", { ascending: true })
            .limit(1),
        ),
      ]);
      const nextRow = (nextRes.data ?? [])[0] as
        | { patient_name: string | null; preferred_date: string }
        | undefined;
      let next: { dateLabel: string; patientName: string } | null = null;
      if (nextRow?.preferred_date) {
        const dateLabel = new Date(`${nextRow.preferred_date}T12:00:00`).toLocaleDateString(
          "pt-BR",
          {
            day: "numeric",
            month: "long",
            year: "numeric",
          },
        );
        next = { dateLabel, patientName: nextRow.patient_name ?? "Paciente" };
      }
      return {
        pending: (pendingRes.count ?? 0) as number,
        confirmedUpcoming: (upcomingRes.count ?? 0) as number,
        next,
      };
    }, emptyAppointments);

    const dashboard: DoctorDashboard = {
      patients: {
        total: profiles.length,
        active7d,
        inactive7d: Math.max(0, profiles.length - active7d),
        newThisMonth,
        stages,
      },
      questions,
      brain,
      appointments,
      engagement: { churnRisk },
      generatedAt: new Date().toISOString(),
    };

    return { ok: true as const, dashboard };
  });
