import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBottomNav,
  AppHomeScreen,
  SectionHeader,
  tabToSection,
  type AppTab,
  type BottomSection,
  type NextAppointment,
} from "@/components/app-mobile-shell";
import { TabErrorBoundary } from "@/components/tab-error-boundary";
import { TabSkeleton } from "@/components/tab-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { DOCTOR } from "@/lib/doctor.config";
import { ymdLocal } from "@/lib/utils";
import { getMyDoctor } from "@/lib/doctors.functions";
import { getMyAppointments, type MyAppointment } from "@/lib/appointments.functions";
import { toast } from "sonner";
import { checkIsAdmin } from "@/lib/admin.functions";
import {
  babyForWeek,
  computeGestation,
  consultaForWeek,
  dueDateFromLmp,
  trimesterForWeek,
} from "@/lib/gestacao";
import { BabyIllustration } from "@/components/baby-illustration";
import { assessSymptoms, saveTriageLog } from "@/lib/triage.functions";
import { RED_SYMPTOMS, YELLOW_SYMPTOMS, type RiskLevel } from "@/lib/triage";
import {
  submitPreConsulta,
  getMyPreConsultas,
  type PreConsultaForm,
} from "@/lib/preconsulta.functions";
import {
  getMyTeleconsultas,
  savePatientNotes,
  type TeleconsultaSession,
} from "@/lib/teleconsulta.functions";
import {
  getMyAlbumPosts,
  createAlbumPost,
  deleteAlbumPost,
  getOrCreateNameSession,
  addNameByPatient,
  toggleNameSession,
  removeNameEntry,
  type AlbumPost,
  type NameEntry,
  type NameSession,
} from "@/lib/family.functions";
import { getCourseProgress, savePanicEvent, type CourseProgress } from "@/lib/escola.functions";
import { COURSE_MODULES } from "@/lib/course-modules";
import {
  checkAndAwardAchievements,
  ACHIEVEMENT_DEFS,
  type AchievementDef,
} from "@/lib/achievements.functions";
import { GestacaoPath, ensureInitialJourneyPull, lsGet, lsSet } from "@/components/gestacao-path";
import {
  searchDoctors,
  requestDoctor,
  getMyDoctorLink,
  cancelDoctorRequest,
  getMyDoctorPix,
  type DoctorPublic,
  type MyDoctorLink,
} from "@/lib/patientlink.functions";
import {
  requestPrivateConsultation,
  getMyPrivateConsultations,
  markPaymentSent,
  CONSULT_TYPES,
  type PrivateConsultation,
} from "@/lib/consultaparticular.functions";
import {
  logCycleStart,
  updateCycleEnd,
  deleteCycle,
  getRecentCycles,
  setPreventiveReminder,
  getPreventiveReminders,
  type MenstrualCycle,
  type PreventiveReminder,
} from "@/lib/saudefeminina.functions";
import { joinCorporate } from "@/lib/corporativo.functions";
import {
  savePpdScreening,
  getMyPpdScreenings,
  startBreastfeeding,
  endBreastfeeding,
  getBreastfeedingLogs,
  setMilestone,
  getMilestones,
  removeMilestone,
  addBabyWeight,
  getBabyWeights,
  markVaccineGiven,
  getBabyVaccines,
  removeVaccine,
  type PpdScreening,
  type BreastfeedingLog,
  type BabyMilestone,
  type BabyWeight,
  type BabyVaccine,
} from "@/lib/postpartum.functions";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — Obstétrica" },
      { name: "description", content: "Acompanhe semana a semana o desenvolvimento do seu bebê." },
    ],
  }),
  component: MinhaContaPage,
});

type Profile = {
  id: string;
  display_name: string | null;
  baby_name: string | null;
  lmp_date: string | null;
  due_date: string | null;
  reference_date: string | null;
  reference_weeks: number | null;
  reference_days: number | null;
  blood_type?: string | null;
  allergies?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  height_cm?: number | null;
  pre_pregnancy_weight_kg?: number | null;
  medications?: string | null;
  birth_date?: string | null;
  pregnancy_number?: number | null;
  prior_bp_elevated?: boolean | null;
  prior_bp_week?: number | null;
  prior_gestational_diabetes?: boolean | null;
  prior_preterm?: boolean | null;
  prior_cesarean?: boolean | null;
  prior_notes?: string | null;
  corporate_account_id?: string | null;
  quiz_premium?: boolean | null;
  doctor_id?: string | null;
};

type JournalEntry = {
  id: string;
  entry_date: string;
  mood: string | null;
  content: string;
  created_at: string;
};
type KickSession = { id: string; started_at: string; ended_at: string | null; kick_count: number };
type ChecklistItem = { id: string; category: string; label: string; done: boolean };

type HealthLog = {
  id: string;
  log_date: string;
  weight_kg: number | null;
  systolic: number | null;
  diastolic: number | null;
  glucose_mg_dl: number | null;
  spo2: number | null;
  heart_rate_bpm: number | null;
  steps: number | null;
  sleep_hours: number | null;
  notes: string | null;
};
type ExamFile = {
  id: string;
  name: string;
  category: string;
  week: number | null;
  notes: string | null;
  image_data: string | null;
  created_at: string;
};
type BirthPlan = {
  id?: string;
  birth_type: string;
  pain_relief: string[];
  who_present: string;
  cord_cutting: string;
  skin_to_skin: boolean;
  breastfeeding: string;
  lighting: string;
  music: string;
  notes: string;
};
type DoctorQ = { id: string; question: string; answered: boolean; created_at: string };
type Invite = { id: string; token: string; companion_name: string | null; created_at: string };

type Gest = ReturnType<typeof computeGestation>;

const TABS = [
  "Bebê",
  "Caminho",
  "Carta do Bebê",
  "Calendário",
  "Linha do Tempo",
  "Diário",
  "Humor",
  "Chutes",
  "Contrações",
  "Saúde",
  "Nutrição",
  "Meditações",
  "Sons",
  "Exercícios",
  "Quartinho",
  "Clima",
  "Alertas",
  "Pré-consulta",
  "Perguntas",
  "Checklist",
  "Consultas",
  "Teleconsulta",
  "Acompanhante",
  "Conta Regressiva",
  "Álbum",
  "Nome do Bebê",
  "Escola",
  "FAQ",
  "Pânico",
  "Carteirinha",
  "Pós-parto",
  "Conquistas",
  "Loja",
  "Consulta Particular",
  "Ciclo Menstrual",
  "Preventivos",
  "Médico",
  "Chat IA",
  "Perfil",
  "Exames",
  "Plano de Parto",
  "Apoio Emocional",
] as const;
type Tab = (typeof TABS)[number];

const CATEGORIES: { label: string; tabs: readonly Tab[] }[] = [
  {
    label: "Gestação",
    tabs: [
      "Bebê",
      "Caminho",
      "Carta do Bebê",
      "Calendário",
      "Linha do Tempo",
      "Chutes",
      "Contrações",
      "Conta Regressiva",
      "Carteirinha",
    ],
  },
  {
    label: "Saúde",
    tabs: [
      "Saúde",
      "Exames",
      "Nutrição",
      "Meditações",
      "Sons",
      "Exercícios",
      "Clima",
      "Alertas",
      "Ciclo Menstrual",
      "Preventivos",
    ],
  },
  {
    label: "Família",
    tabs: [
      "Diário",
      "Humor",
      "Acompanhante",
      "Quartinho",
      "Álbum",
      "Nome do Bebê",
      "Pós-parto",
      "Apoio Emocional",
    ],
  },
  {
    label: "Consultas",
    tabs: [
      "Pré-consulta",
      "Plano de Parto",
      "Perguntas",
      "Checklist",
      "Consultas",
      "Teleconsulta",
      "Consulta Particular",
    ],
  },
  {
    label: "Aprender",
    tabs: ["Escola", "FAQ", "Pânico", "Conquistas", "Loja"],
  },
  {
    label: "Médico",
    tabs: ["Médico"],
  },
  {
    label: "Conta",
    tabs: ["Chat IA", "Perfil"],
  },
];

const CAT_STYLE: Record<string, { pill: string; glass: string; accent: string; emoji: string }> = {
  Gestação: {
    pill: "bg-pink-100/90 text-pink-700 shadow-[0_0_0_1px_rgba(244,114,182,0.25)]",
    glass: "glass-card glass-pink",
    accent: "text-pink-600",
    emoji: "🌸",
  },
  Saúde: {
    pill: "bg-emerald-100/90 text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]",
    glass: "glass-card glass-emerald",
    accent: "text-emerald-600",
    emoji: "🌿",
  },
  Família: {
    pill: "bg-violet-100/90 text-violet-700 shadow-[0_0_0_1px_rgba(139,92,246,0.25)]",
    glass: "glass-card glass-violet",
    accent: "text-violet-600",
    emoji: "💜",
  },
  Consultas: {
    pill: "bg-blue-100/90 text-blue-700 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]",
    glass: "glass-card glass-blue",
    accent: "text-blue-600",
    emoji: "📋",
  },
  Aprender: {
    pill: "bg-teal-100/90 text-teal-700 shadow-[0_0_0_1px_rgba(20,184,166,0.25)]",
    glass: "glass-card glass-teal",
    accent: "text-teal-600",
    emoji: "✨",
  },
  Médico: {
    pill: "bg-primary/10 text-primary shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_20%,transparent)]",
    glass: "glass-card glass-rose",
    accent: "text-primary",
    emoji: "🩺",
  },
  Conta: {
    pill: "bg-indigo-100/90 text-indigo-700 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]",
    glass: "glass-card glass-indigo",
    accent: "text-indigo-600",
    emoji: "💫",
  },
};

function categoryOfTab(t: Tab): string {
  return CATEGORIES.find((c) => (c.tabs as readonly string[]).includes(t))?.label ?? "Gestação";
}

/**
 * Dispara a checagem de conquistas após uma ação premiável (fire-and-forget).
 * Exibe um toast para cada conquista recém-desbloqueada; falhas são silenciosas.
 */
function triggerAchievementsCheck() {
  supabase.auth
    .getSession()
    .then(({ data: s }) =>
      s.session?.access_token
        ? checkAndAwardAchievements({ data: { accessToken: s.session.access_token } })
        : null,
    )
    .then((res) => {
      if (!res || !res.ok) return;
      for (const key of res.newlyAwarded ?? []) {
        const def = ACHIEVEMENT_DEFS.find((d) => d.key === key);
        if (def) toast(`${def.emoji} Nova conquista desbloqueada: ${def.title}!`);
      }
    })
    .catch(() => {});
}

function MinhaContaPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Deep-link opcional ?tab=<Aba> (usado pela varredura do super-admin)
  const initialTab = ((): Tab => {
    if (typeof window === "undefined") return "Bebê";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t && (TABS as readonly string[]).includes(t) ? (t as Tab) : "Bebê";
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDoctor, setIsDoctor] = useState(false);
  // Mobile-only: true = dashboard home screen (se veio deep-link de aba, abre nela)
  const [mobileHome, setMobileHome] = useState(initialTab === "Bebê");
  // Navegação disparada de DENTRO de uma aba (ex.: "Configure em Perfil") —
  // troca a aba e sai da home mobile, senão o destino fica escondido no celular.
  const goToTab = (t: string) => {
    setTab(t as Tab);
    setMobileHome(false);
  };

  // Próxima consulta confirmada → card na home mobile (fecha o ciclo
  // médico→paciente também na primeira tela do app).
  const [nextAppt, setNextAppt] = useState<NextAppointment | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return;
        const res = await getMyAppointments({ data: { accessToken: s.session.access_token } });
        if (!res.ok) return;
        const today = ymdLocal();
        const next = res.appointments
          .filter((a) => a.status === "confirmed" && (a.confirmed_date ?? "") >= today)
          .sort((a, b) =>
            (a.confirmed_date! + (a.confirmed_time ?? "")).localeCompare(
              b.confirmed_date! + (b.confirmed_time ?? ""),
            ),
          )[0];
        if (next) {
          setNextAppt({
            dateLabel: `${formatApptDate(next.confirmed_date!)} · ${next.confirmed_time ?? ""}`,
            typeLabel: next.reason,
          });
        }
      } catch {
        /* card é enhancement — sem consulta, sem card */
      }
    })();
  }, []);

  // Baixa a jornada da nuvem e arma a barreira anti-push logo no mount da
  // página, independente da aba ativa: abas como Sons/Quartinho gravam chaves
  // dc-path- sem montar a aba Caminho, então o pull inicial precisa acontecer
  // antes de qualquer push para não sobrescrever a jornada real na conta (P1).
  useEffect(() => {
    ensureInitialJourneyPull();
  }, []);

  // Retorno do checkout do Stripe: o webhook libera o acesso em segundos.
  // Reconsulta o perfil até o premium refletir e avisa a paciente.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const st = new URLSearchParams(window.location.search).get("assinatura");
    if (!st) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (st === "cancelada") {
      toast("Pagamento não concluído. Você pode tentar de novo quando quiser.");
      return;
    }
    if (st !== "sucesso") return;
    toast.success("Pagamento recebido! Ativando seu acesso…");
    let tries = 0;
    const tick = async () => {
      tries++;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await (supabase as any)
        .from("patient_profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      if (data?.quiz_premium) {
        setProfile(data);
        toast.success("Premium ativado! Aproveite 💛");
        return;
      }
      if (tries < 6) setTimeout(tick, 2000);
      else if (data) setProfile(data);
    };
    setTimeout(tick, 1500);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await (supabase as any)
        .from("patient_profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      setProfile(data);
      setLoading(false);

      const { data: s } = await supabase.auth.getSession();
      if (s.session?.access_token) {
        const r = await checkIsAdmin({ data: { accessToken: s.session.access_token } });
        setIsAdmin(r.isAdmin);
        // Médico cadastrado (ativo) também acessa o painel do consultório
        if (!r.isAdmin) {
          try {
            const me = await getMyDoctor({ data: { accessToken: s.session.access_token } });
            if (me.ok && me.doctor?.active) setIsDoctor(true);
          } catch {
            /* sem perfil de médico */
          }
        }
      }
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    // Limpa a jornada local (dc-path-*) e o marcador de sync: num aparelho
    // compartilhado, a próxima conta NÃO pode ver nem re-subir os dados de
    // saúde da conta anterior (vazamento entre contas).
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("dc-path-") || k === "dc-journey-synced-at")) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      /* modo privado/quota: sem cache local a limpar */
    }
    navigate({ to: "/" });
  }

  if (loading)
    return (
      <div className="mx-auto max-w-5xl px-5 py-8 space-y-4">
        <div className="skeleton h-52 rounded-3xl" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-[72px] rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-16 rounded-3xl" />
        <div className="skeleton h-24 rounded-3xl" />
      </div>
    );

  const gest = profile
    ? computeGestation({
        lmp: profile.lmp_date,
        referenceDate: profile.reference_date,
        referenceWeeks: profile.reference_weeks,
        referenceDays: profile.reference_days,
      })
    : null;

  const firstName = profile?.display_name?.split(" ")[0] ?? "mamãe";

  // Mobile navigation helpers
  const activeSection: BottomSection = mobileHome ? "home" : tabToSection(tab as AppTab);

  function mobileNavigate(t: AppTab) {
    setTab(t as Tab);
    setMobileHome(false);
  }

  function handleBottomNav(section: BottomSection) {
    if (section === "home") {
      setMobileHome(true);
      return;
    }
    setMobileHome(false);
    const sectionMap: Record<Exclude<BottomSection, "home">, Tab> = {
      gestacao: "Bebê",
      saude: "Saúde",
      consultas: "Consultas",
      eu: "Perfil",
    };
    setTab(sectionMap[section]);
  }

  const SECTION_TITLES: Record<BottomSection, string> = {
    home: "Início",
    gestacao: "Gestação",
    saude: "Saúde",
    consultas: "Consultas",
    eu: "Eu",
  };

  return (
    <>
      {/* ── App bottom nav (mobile only) ─────────────────────── */}
      <AppBottomNav activeSection={activeSection} onSelect={handleBottomNav} />

      <section className="mx-auto max-w-5xl px-5 py-6 md:py-12">
        {/* ── Desktop header ───────────────────────────────────── */}
        <div className="hidden md:flex flex-wrap items-end justify-between gap-3 mb-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Minha conta
            </p>
            <h1 className="mt-2 font-serif text-3xl md:text-4xl">Olá, {firstName} 💛</h1>
            {(profile?.baby_name || gest) && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {profile?.baby_name && <>Acompanhando {profile.baby_name}</>}
                {profile?.baby_name && gest && <span className="mx-2 opacity-40">·</span>}
                {gest && (
                  <>
                    {gest.weeks}s {gest.days}d de gestação
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(isAdmin || isDoctor) && (
              <Link
                to="/painel"
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
              >
                Painel do médico
              </Link>
            )}
            <button
              onClick={signOut}
              className="rounded-full border border-border/70 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              Sair
            </button>
          </div>
        </div>

        {/* ── Mobile top bar ───────────────────────────────────── */}
        <div className="flex md:hidden items-center justify-between mb-4">
          <p className="font-serif text-xl leading-tight text-foreground">
            {mobileHome ? `Olá, ${firstName} 💛` : SECTION_TITLES[activeSection]}
          </p>
          <div className="flex items-center gap-2">
            {(isAdmin || isDoctor) && (
              <Link
                to="/painel"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
              >
                Painel
              </Link>
            )}
            <button
              onClick={signOut}
              className="rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              Sair
            </button>
          </div>
        </div>

        {/* ── Sem médico vinculado? Convida a encontrar um ── */}
        {!loading && profile && !profile.doctor_id && (
          <Link
            to="/encontrar-medico"
            className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary/60"
          >
            <span className="text-2xl">👩‍⚕️</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Você ainda não tem um médico no app
              </p>
              <p className="text-xs text-muted-foreground">
                Encontre um obstetra por experiência, formação e cidade — ele passa a te acompanhar
                por aqui.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              Encontrar
            </span>
          </Link>
        )}

        {/* ── Mobile: home screen ──────────────────────────────── */}
        {mobileHome && (
          <div className="md:hidden">
            <AppHomeScreen
              firstName={firstName}
              babyName={profile?.baby_name ?? null}
              gest={gest}
              onNavigate={mobileNavigate}
              nextAppointment={nextAppt}
            />
          </div>
        )}

        {/* ── Desktop & mobile (when tab selected): category nav + tabs ── */}
        <div className={mobileHome ? "hidden md:block" : "block"}>
          {/* Section back-button on mobile */}
          {!mobileHome && (
            <SectionHeader
              title={SECTION_TITLES[activeSection]}
              onHome={() => setMobileHome(true)}
            />
          )}

          {/* Category selector */}
          <div className="print:hidden mt-2 md:mt-6 flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {CATEGORIES.map((cat) => {
              const active = categoryOfTab(tab) === cat.label;
              const cs = CAT_STYLE[cat.label] ?? CAT_STYLE["Gestação"];
              return (
                <button
                  key={cat.label}
                  onClick={() => {
                    if (!active) setTab(cat.tabs[0]);
                    setMobileHome(false);
                  }}
                  className={`press flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] ${
                    active
                      ? `${cs.pill} font-semibold`
                      : "text-foreground/60 hover:text-foreground/80"
                  }`}
                >
                  {active ? `${cs.emoji} ` : ""}
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Tab row */}
          <div className="print:hidden mt-3 flex gap-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex min-w-full gap-1">
              {CATEGORIES.find((c) => c.label === categoryOfTab(tab))?.tabs.map((t) => {
                const cs = CAT_STYLE[categoryOfTab(tab)] ?? CAT_STYLE["Gestação"];
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setTab(t);
                      setMobileHome(false);
                    }}
                    className={`press flex-shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] ${
                      tab === t
                        ? `${cs.pill} font-semibold`
                        : "text-foreground/60 hover:text-foreground/80"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div key={tab} className="mt-6 tab-enter">
            <TabErrorBoundary tabName={tab}>
              {tab === "Bebê" && <BabyTab profile={profile} gest={gest} onNavigate={goToTab} />}
              {tab === "Caminho" && (
                <GestacaoPath profile={profile} gest={gest} quizPremium={!!profile?.quiz_premium} />
              )}
              {tab === "Carta do Bebê" && (
                <CartaBebêTab profile={profile} gest={gest} onNavigate={goToTab} />
              )}
              {tab === "Calendário" && (
                <PrenatalCalendarTab profile={profile} gest={gest} onNavigate={goToTab} />
              )}
              {tab === "Linha do Tempo" && <TimelineTab profile={profile} gest={gest} />}
              {tab === "Diário" && <JournalTab profile={profile} gest={gest} />}
              {tab === "Humor" && <HumorTab />}
              {tab === "Chutes" && (
                <KicksTab weeks={gest?.weeks ?? null} babyName={profile?.baby_name ?? null} />
              )}
              {tab === "Contrações" && <ContracoesTab weeks={gest?.weeks ?? null} />}
              {tab === "Saúde" && <HealthTab gest={gest} profile={profile} onNavigate={goToTab} />}
              {tab === "Nutrição" && <NutricaoTab profile={profile} gest={gest} />}
              {tab === "Meditações" && <MeditacoesTab gest={gest} />}
              {tab === "Sons" && <SonsBebêTab gest={gest} />}
              {tab === "Exercícios" && <ExerciciosTab gest={gest} />}
              {tab === "Quartinho" && <QuartinhoTab gest={gest} />}
              {tab === "Clima" && <ClimaTab gest={gest} />}
              {tab === "Alertas" && <AlertsTab weeks={gest?.weeks ?? null} />}
              {tab === "Pré-consulta" && <PreConsultaTab profile={profile} gest={gest} />}
              {tab === "Perguntas" && <QuestionsTab gest={gest} />}
              {tab === "Checklist" && <ChecklistTab gest={gest} />}
              {tab === "Consultas" && <ConsultasTab />}
              {tab === "Teleconsulta" && <TeleconsultaTab profile={profile} />}
              {tab === "Acompanhante" && <CompanionTab babyName={profile?.baby_name ?? null} />}
              {tab === "Conta Regressiva" && (
                <CountdownTab profile={profile} gest={gest} onNavigate={goToTab} />
              )}
              {tab === "Álbum" && <AlbumTab profile={profile} />}
              {tab === "Nome do Bebê" && <NomeTab profile={profile} />}
              {tab === "Escola" && <EscolaBebêTab gest={gest} onNavigate={goToTab} />}
              {tab === "FAQ" && <FAQTab gest={gest} onNavigate={goToTab} />}
              {tab === "Pânico" && <PânicoTab profile={profile} onNavigate={goToTab} />}
              {tab === "Carteirinha" && (
                <CardTab profile={profile} gest={gest} onNavigate={goToTab} />
              )}
              {tab === "Pós-parto" && <PosPartoTab profile={profile} onNavigate={goToTab} />}
              {tab === "Conquistas" && <ConquistasTab />}
              {tab === "Loja" && <LojaTab gest={gest} />}
              {tab === "Consulta Particular" && <ConsultaParticularTab profile={profile} />}
              {tab === "Ciclo Menstrual" && <CicloMenstrualTab />}
              {tab === "Preventivos" && <PreventivosTab />}
              {tab === "Médico" && <MédicoTab />}
              {tab === "Exames" && <ExamesTab gest={gest} />}
              {tab === "Plano de Parto" && <PlanoPártoTab profile={profile} />}
              {tab === "Apoio Emocional" && <ApoioEmocionalTab onNavigate={goToTab} />}
              {tab === "Chat IA" && <ChatTab profile={profile} gest={gest} />}
              {tab === "Perfil" && <ProfileTab profile={profile} onSaved={setProfile} />}
            </TabErrorBoundary>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------- Bebê ---------- */
function BabyTab({
  profile,
  gest,
  onNavigate,
}: {
  profile: Profile | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
}) {
  if (!profile || !gest) {
    return (
      <div className="glass-card glass-pink rounded-3xl p-10 text-center">
        <p className="text-5xl mb-4">🌸</p>
        <p className="font-serif text-xl text-pink-700">Configure seu perfil</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure a data da sua última menstruação ou os dados do ultrassom em{" "}
          <button
            type="button"
            onClick={() => onNavigate("Perfil")}
            className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
          >
            Perfil
          </button>{" "}
          para começar o acompanhamento.
        </p>
      </div>
    );
  }
  const baby = babyForWeek(gest.weeks);
  const trimestre =
    gest.weeks < 14 ? "1º trimestre" : gest.weeks < 28 ? "2º trimestre" : "3º trimestre";
  const progress = Math.min(100, (gest.totalDays / 280) * 100);
  const due = profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);
  const daysToDue = due
    ? Math.max(0, Math.ceil((new Date(due + "T00:00:00").getTime() - Date.now()) / 86400000))
    : null;
  const exam = consultaForWeek(gest.weeks);
  const babyLabel = profile.baby_name ? profile.baby_name : "seu bebê";

  return (
    <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">{trimestre}</p>
        <h2 className="mt-2 font-serif text-4xl">
          {gest.weeks} <span className="text-2xl text-muted-foreground">semanas</span>
          {gest.days > 0 && (
            <span className="ml-2 text-xl text-muted-foreground">e {gest.days}d</span>
          )}
        </h2>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {progress.toFixed(0)}% da jornada {daysToDue != null && `· faltam ${daysToDue} dias`}
        </p>

        <div className="mt-6 rounded-2xl bg-[image:var(--gradient-warm)] p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">
            {babyLabel} esta semana
          </p>
          {/* Baby illustration — grows week-by-week */}
          <div className="my-3 flex justify-center">
            <BabyIllustration week={gest.weeks} />
          </div>
          <p className="mt-1 font-serif text-xl text-primary">{baby.size}</p>
          <p className="text-sm text-muted-foreground">
            Peso: {baby.weight} · {baby.fruit}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground">{baby.desc}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">
            DPP — Data provável do parto
          </p>
          <p className="mt-2 font-serif text-2xl">
            {due
              ? new Date(due + "T00:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
          {daysToDue != null && (
            <p className="mt-1 text-sm text-muted-foreground">
              {daysToDue === 0
                ? "É hoje! 🎉"
                : daysToDue === 1
                  ? "Amanhã!"
                  : `Faltam ${daysToDue} dias`}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Próxima consulta</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {gest.weeks < 28
              ? "Consultas mensais — agende sua próxima visita."
              : gest.weeks < 36
                ? "Consultas quinzenais a partir de agora."
                : "Consultas semanais — acompanhamento próximo."}
          </p>
        </div>
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Exame desta semana
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{exam}</p>
        </div>
      </div>
      {/* Segunda gestação: historical alerts */}
      {(profile.pregnancy_number ?? 1) >= 2 && (
        <div className="col-span-full rounded-3xl border border-primary/25 bg-primary/8 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
            🔁 2ª Gestação — Histórico da anterior
          </p>
          <div className="space-y-2 text-sm">
            {profile.prior_bp_elevated && (
              <div className="flex items-start gap-2 rounded-xl bg-white/70 p-3">
                <span className="text-red-500 text-base">⚠️</span>
                <p>
                  Na gestação anterior, você teve <strong>pressão elevada</strong>
                  {profile.prior_bp_week ? ` a partir da semana ${profile.prior_bp_week}` : ""}.
                  {gest.weeks >= (profile.prior_bp_week ?? 28) - 2
                    ? " Estamos nessa janela — monitore sua pressão com mais frequência."
                    : " Vamos monitorar de perto conforme a semana se aproxima."}
                </p>
              </div>
            )}
            {profile.prior_gestational_diabetes && (
              <div className="flex items-start gap-2 rounded-xl bg-white/70 p-3">
                <span className="text-primary text-base">🍬</span>
                <p>
                  Você teve <strong>diabetes gestacional</strong> anteriormente. O risco de
                  recorrência é maior — converse com seu médico sobre o teste de glicemia antecipado
                  (semanas 20–24).
                </p>
              </div>
            )}
            {profile.prior_preterm && (
              <div className="flex items-start gap-2 rounded-xl bg-white/70 p-3">
                <span className="text-primary text-base">👶</span>
                <p>
                  Histórico de <strong>parto prematuro</strong>. Seu médico acompanhará o
                  comprimento cervical com mais frequência nesta gestação.
                </p>
              </div>
            )}
            {profile.prior_cesarean && (
              <div className="flex items-start gap-2 rounded-xl bg-white/70 p-3">
                <span className="text-primary text-base">🏥</span>
                <p>
                  Cesariana anterior registrada. A via de parto desta gestação será planejada em
                  conjunto com o seu médico.
                </p>
              </div>
            )}
            {!profile.prior_bp_elevated &&
              !profile.prior_gestational_diabetes &&
              !profile.prior_preterm &&
              !profile.prior_cesarean && (
                <p className="text-primary">
                  Nenhuma complicação registrada na gestação anterior. Continue preenchendo seu
                  histórico em{" "}
                  <button
                    type="button"
                    onClick={() => onNavigate("Perfil")}
                    className="font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    Perfil → 2ª Gestação
                  </button>
                  .
                </p>
              )}
            {profile.prior_notes && (
              <div className="flex items-start gap-2 rounded-xl bg-white/70 p-3">
                <span className="text-base">📋</span>
                <p>
                  <strong>Observações:</strong> {profile.prior_notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Diário ---------- */

const JOURNAL_PROMPTS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Como estou me sentindo com esta gestação?",
    "O que mais me emociona nesse início?",
    "Quais são meus maiores medos agora?",
    "Uma mensagem para o meu bebê hoje.",
  ],
  2: [
    "Senti o bebê se mexer hoje?",
    "O que estou preparando para receber o bebê?",
    "Como está meu corpo nesta fase?",
    "Uma memória especial desta semana.",
  ],
  3: [
    "Estou pronta para o parto?",
    "Como está minha ansiedade agora?",
    "O que quero lembrar deste momento?",
    "Uma mensagem para o bebê antes de nascer.",
  ],
};

function JournalTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("😊");

  const trimester = gest ? trimesterForWeek(gest.weeks) : 1;
  const prompts = JOURNAL_PROMPTS[trimester];
  const firstName = profile?.display_name?.split(" ")[0];

  async function load() {
    const { data } = await (supabase as any)
      .from("journal_entries")
      .select("*")
      .order("entry_date", { ascending: false });
    setEntries(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!content.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any).from("journal_entries").insert({
      user_id: u.user.id,
      content: content.trim(),
      mood,
      entry_date: new Date().toLocaleDateString("en-CA"),
    });
    if (error) {
      toast.error("Não foi possível salvar o registro. Tente novamente.");
      return;
    }
    setContent("");
    load();
    triggerAchievementsCheck();
  }

  async function remove(id: string) {
    const { error } = await (supabase as any).from("journal_entries").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o registro. Tente novamente.");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">
          {firstName
            ? `${firstName}, como você está se sentindo hoje?`
            : "Como você está se sentindo hoje?"}
        </p>
        {gest && (
          <p className="mt-1 text-xs text-muted-foreground">
            Semana {gest.weeks} —{" "}
            {trimester === 1 ? "1º trimestre" : trimester === 2 ? "2º trimestre" : "3º trimestre"}
          </p>
        )}

        {/* Prompt suggestions — carrossel horizontal */}
        <div className="mt-3 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => setContent((c) => (c ? c + "\n" + p : p))}
              className="flex-shrink-0 rounded-2xl bg-primary/8 px-4 py-2.5 text-xs text-primary/90 transition-all duration-300 hover:bg-primary/12 active:scale-95"
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {["😊", "🥰", "😴", "🤢", "😢", "😰"].map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`rounded-full px-3 py-2 text-xl transition-all duration-300 [transition-timing-function:var(--ease-spring)] hover:scale-110 active:scale-95 ${
                mood === m ? "scale-110 bg-primary/15 ring-2 ring-primary" : "bg-secondary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Escreva uma memória, um pensamento, um sonho..."
          className="mt-4 w-full rounded-md border border-input bg-background p-3 text-sm"
        />
        <button
          onClick={add}
          className="mt-3 rounded-full px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 active:scale-95 hover:opacity-90"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 80%, white), var(--primary) 70%)",
          }}
        >
          Salvar no diário
        </button>
      </div>

      <div className="space-y-3">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">Seu diário começará aqui ✨</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {e.mood} · {new Date(e.entry_date + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
              <button
                onClick={() => remove(e.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                excluir
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{e.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Chutes ---------- */
function KicksTab({ weeks, babyName }: { weeks: number | null; babyName: string | null }) {
  const [active, setActive] = useState<KickSession | null>(null);
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<KickSession[]>([]);
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  const label = babyName ?? "o bebê";
  const isMonitoringPhase = weeks != null && weeks >= 28;

  async function load() {
    const { data } = await (supabase as any)
      .from("kick_sessions")
      .select("*")
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(10);
    setHistory(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active]);

  async function start() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await (supabase as any)
      .from("kick_sessions")
      .insert({ user_id: u.user.id, kick_count: 0 })
      .select()
      .single();
    if (error) {
      toast.error("Não foi possível iniciar a sessão. Tente novamente.");
      return;
    }
    setActive(data);
    setCount(0);
    startRef.current = Date.now();
    setElapsed(0);
  }

  async function tap() {
    if (!active) return;
    const next = count + 1;
    setCount(next);
    if (next >= 10) {
      await stop(next);
    }
  }

  async function stop(finalCount = count) {
    if (!active) return;
    const { error } = await (supabase as any)
      .from("kick_sessions")
      .update({ ended_at: new Date().toISOString(), kick_count: finalCount })
      .eq("id", active.id);
    if (error) {
      toast.error("Não foi possível salvar a sessão. Tente novamente.");
      return;
    }
    setActive(null);
    setCount(0);
    load();
    triggerAchievementsCheck();
  }

  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  // Stats from history
  const completeSessions = history.filter((s) => s.kick_count >= 10);
  const avgMins =
    completeSessions.length > 0
      ? Math.round(
          completeSessions.reduce((acc, s) => {
            const dur = s.ended_at
              ? (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000
              : 0;
            return acc + dur;
          }, 0) / completeSessions.length,
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Context banner */}
      {weeks != null && !isMonitoringPhase && (
        <div className="glass-card glass-violet rounded-2xl p-4 text-sm text-violet-800">
          <span className="mr-1.5">{weeks < 20 ? "🌱" : "🤗"}</span>
          {weeks < 20
            ? `Semana ${weeks} — os movimentos começam a ser sentidos entre as semanas 18 e 25. Continue o pré-natal normalmente.`
            : `Semana ${weeks} — você já pode perceber os movimentos de ${label}! A contagem formal de chutes começa na semana 28.`}
        </div>
      )}

      <div className="glass-card glass-violet rounded-3xl p-8 text-center">
        <p className="text-4xl mb-3">👶🦵</p>
        <p className="font-serif text-xl text-violet-700">Contador de chutes</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isMonitoringPhase
            ? `A partir da semana 28, conte 10 movimentos de ${label}. O ideal é sentir 10 em até 2 horas.`
            : "A contagem de movimentos é recomendada a partir da 28ª semana de gestação."}
        </p>
        {!active ? (
          <button
            onClick={start}
            className="mt-6 rounded-full px-8 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 active:scale-95 hover:opacity-90"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 80%, white), var(--primary) 70%)",
            }}
          >
            Iniciar sessão
          </button>
        ) : (
          <div className="mt-6">
            <button
              onClick={tap}
              className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-primary-foreground shadow-xl transition-transform duration-300 active:scale-95 hover:scale-[1.03]"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--primary) 78%, white), var(--primary) 70%)",
              }}
            >
              <div>
                <div className="font-serif text-5xl">{count}</div>
                <div className="text-xs uppercase tracking-widest opacity-80">/ 10 chutes</div>
              </div>
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              ⏱ {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </p>
            <button
              onClick={() => stop()}
              className="mt-3 text-xs text-muted-foreground hover:text-destructive"
            >
              Encerrar sessão
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {history.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Sessões registradas</p>
            <p className="mt-2 font-serif text-3xl">{history.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Sessões completas</p>
            <p className="mt-2 font-serif text-3xl">{completeSessions.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-primary">
              Tempo médio (10 chutes)
            </p>
            <p className="mt-2 font-serif text-3xl">{avgMins != null ? `${avgMins} min` : "—"}</p>
          </div>
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Histórico
        </p>
        <div className="space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>
          )}
          {history.map((s) => {
            const dur = s.ended_at
              ? Math.round(
                  (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000,
                )
              : 0;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm"
              >
                <span>
                  {new Date(s.started_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {s.kick_count >= 10 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      ✓ completo
                    </span>
                  )}
                  {s.kick_count} chutes · {dur} min
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Checklist ---------- */
const DEFAULT_ITEMS: { category: string; label: string }[] = [
  // Mamãe — documentos e identificação
  { category: "mae", label: "RG e CPF (originais)" },
  { category: "mae", label: "Cartão do convênio / SUS" },
  { category: "mae", label: "Carteira da gestante (pré-natal)" },
  { category: "mae", label: "Plano de parto impresso" },
  { category: "mae", label: "Exames recentes (ultrassom, sangue)" },
  // Mamãe — roupas e conforto
  { category: "mae", label: "2–3 camisolas com abertura frontal" },
  { category: "mae", label: "Roupão de algodão" },
  { category: "mae", label: "Chinelos fechados antiderrapantes" },
  { category: "mae", label: "Meias confortáveis (3 pares)" },
  { category: "mae", label: "Sutiã de amamentação (2 peças)" },
  { category: "mae", label: "Absorventes pós-parto (pacote)" },
  { category: "mae", label: "Calcinha descartável (pós-parto)" },
  // Mamãe — higiene e conforto
  { category: "mae", label: "Escova de dente e pasta" },
  { category: "mae", label: "Shampoo, sabonete e desodorante" },
  { category: "mae", label: "Creme para mamilos (lanolina)" },
  { category: "mae", label: "Protetor de seios (for breastfeeding)" },
  { category: "mae", label: "Travesseiro extra de amamentação" },
  { category: "mae", label: "Fones de ouvido + playlist relaxante" },
  { category: "mae", label: "Bolacha de água e sal / lanche leve" },
  // Bebê — roupas
  { category: "bebe", label: "5 bodies manga curta tamanho RN" },
  { category: "bebe", label: "5 macacões / mijões tamanho RN" },
  { category: "bebe", label: "2–3 mesinhas de algodão" },
  { category: "bebe", label: "2 toucas de RN" },
  { category: "bebe", label: "2 luvinhas para RN" },
  // Bebê — cuidados
  { category: "bebe", label: "Fraldas RN (1 pacote pequeno)" },
  { category: "bebe", label: "Lenços umedecidos sem perfume" },
  { category: "bebe", label: "Manta de algodão (2 peças)" },
  { category: "bebe", label: "Saída de maternidade (roupa especial)" },
  { category: "bebe", label: "Bebê conforto / cadeirinha de carro" },
  { category: "bebe", label: "Creme para assaduras" },
  // Acompanhante
  { category: "acompanhante", label: "2 trocas de roupa confortável" },
  { category: "acompanhante", label: "Itens de higiene pessoal" },
  { category: "acompanhante", label: "Lanches e snacks energéticos" },
  { category: "acompanhante", label: "Garrafa d'água" },
  { category: "acompanhante", label: "Carregador de celular + cabo" },
  { category: "acompanhante", label: "Cartão de crédito / dinheiro" },
  { category: "acompanhante", label: "Câmera ou celular com boa câmera" },
];

function ChecklistTab({ gest }: { gest: Gest }) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("mae");

  const weeks = gest?.weeks ?? 0;
  const urgencyBanner =
    weeks >= 37
      ? { text: "Semana 37+ — Sua mala deve estar completamente pronta!", color: "rose" }
      : weeks >= 34
        ? { text: `Semana ${weeks} — É hora de preparar a mala da maternidade.`, color: "amber" }
        : weeks >= 30
          ? { text: `Semana ${weeks} — Comece a separar os itens aos poucos.`, color: "blue" }
          : null;

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await (supabase as any)
      .from("checklist_items")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Não foi possível carregar o checklist.");
      return;
    }
    // Semeia os itens padrão só uma vez por usuário — quem apagou tudo fica com
    // a lista vazia. A flag "já semeei" vive na CONTA (patient_profiles.
    // checklist_seeded), não no localStorage: assim um aparelho novo não
    // re-semeia itens que a paciente apagou de propósito. Degrada com elegância
    // se a coluna ainda não foi aplicada (trata como não-semeado).
    let alreadySeeded = false;
    try {
      const { data: prof } = await (supabase as any)
        .from("patient_profiles")
        .select("checklist_seeded")
        .eq("id", u.user.id)
        .maybeSingle();
      alreadySeeded = !!prof?.checklist_seeded;
    } catch {
      /* coluna ausente — segue como não-semeado */
    }
    async function markSeeded() {
      try {
        await (supabase as any)
          .from("patient_profiles")
          .update({ checklist_seeded: true })
          .eq("id", u.user!.id);
      } catch {
        /* coluna ausente — ignora */
      }
    }
    if ((!data || data.length === 0) && !alreadySeeded) {
      const seed = DEFAULT_ITEMS.map((d) => ({ ...d, user_id: u.user!.id, done: false }));
      const { error: seedError } = await (supabase as any).from("checklist_items").insert(seed);
      if (seedError) {
        toast.error("Não foi possível criar a lista inicial.");
        setItems([]);
        return;
      }
      await markSeeded();
      const { data: again } = await (supabase as any)
        .from("checklist_items")
        .select("*")
        .order("created_at", { ascending: true });
      setItems(again ?? []);
    } else {
      if (data && data.length > 0 && !alreadySeeded) {
        await markSeeded();
      }
      setItems(data ?? []);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(it: ChecklistItem) {
    await (supabase as any).from("checklist_items").update({ done: !it.done }).eq("id", it.id);
    setItems((arr) => arr.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
  }
  async function add() {
    if (!label.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await (supabase as any)
      .from("checklist_items")
      .insert({ user_id: u.user.id, label: label.trim(), category });
    setLabel("");
    load();
  }
  async function remove(id: string) {
    await (supabase as any).from("checklist_items").delete().eq("id", id);
    setItems((arr) => arr.filter((x) => x.id !== id));
  }

  const groups = useMemo(() => {
    const g: Record<string, ChecklistItem[]> = { mae: [], bebe: [], acompanhante: [] };
    items.forEach((it) => {
      (g[it.category] = g[it.category] ?? []).push(it);
    });
    return g;
  }, [items]);

  const groupLabels: Record<string, string> = {
    mae: "Para a mamãe",
    bebe: "Para o bebê",
    acompanhante: "Para o acompanhante",
  };
  const total = items.length;
  const done = items.filter((i) => i.done).length;

  return (
    <div className="space-y-6">
      {urgencyBanner && (
        <div
          className={`rounded-2xl border p-4 text-sm font-medium ${
            urgencyBanner.color === "rose"
              ? "border-rose-300 bg-rose-50 text-rose-900"
              : urgencyBanner.color === "amber"
                ? "border-primary/25 bg-primary/8 text-foreground"
                : "border-primary/25 bg-secondary/60 text-foreground"
          }`}
        >
          {urgencyBanner.text}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Mala da maternidade</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {done} de {total} itens prontos
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>
        {done === total && total > 0 && (
          <p className="mt-2 text-sm font-medium text-emerald-600">Tudo pronto! 🎉</p>
        )}
      </div>

      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat} className="rounded-3xl border border-border bg-card p-6">
          <p className="font-serif text-lg">{groupLabels[cat] ?? cat}</p>
          <ul className="mt-3 space-y-1">
            {list.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-secondary/60"
              >
                <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={it.done}
                    onChange={() => toggle(it)}
                    className="h-4 w-4"
                  />
                  <span className={it.done ? "text-muted-foreground line-through" : ""}>
                    {it.label}
                  </span>
                </label>
                <button
                  onClick={() => remove(it.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="rounded-3xl bg-card p-6">
        <p className="text-sm font-medium">Adicionar item</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="mae">Mamãe</option>
            <option value="bebe">Bebê</option>
            <option value="acompanhante">Acompanhante</option>
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex: protetor de seios"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={add}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Perfil ---------- */
function ProfileTab({
  profile,
  onSaved,
}: {
  profile: Profile | null;
  onSaved: (p: Profile) => void;
}) {
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? "",
    baby_name: profile?.baby_name ?? "",
    lmp_date: profile?.lmp_date ?? "",
    reference_date: profile?.reference_date ?? "",
    reference_weeks: profile?.reference_weeks?.toString() ?? "",
    reference_days: profile?.reference_days?.toString() ?? "",
    blood_type: profile?.blood_type ?? "",
    allergies: profile?.allergies ?? "",
    emergency_contact: profile?.emergency_contact ?? "",
    emergency_phone: profile?.emergency_phone ?? "",
    height_cm: profile?.height_cm?.toString() ?? "",
    pre_pregnancy_weight_kg: profile?.pre_pregnancy_weight_kg?.toString() ?? "",
    medications: profile?.medications ?? "",
    birth_date: profile?.birth_date ?? "",
    pregnancy_number: profile?.pregnancy_number?.toString() ?? "1",
    prior_bp_elevated: profile?.prior_bp_elevated ?? false,
    prior_bp_week: profile?.prior_bp_week?.toString() ?? "",
    prior_gestational_diabetes: profile?.prior_gestational_diabetes ?? false,
    prior_preterm: profile?.prior_preterm ?? false,
    prior_cesarean: profile?.prior_cesarean ?? false,
    prior_notes: profile?.prior_notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [corporateCode, setCorporateCode] = useState("");
  const [corporateMsg, setCorporateMsg] = useState<string | null>(null);
  const [joiningCorporate, setJoiningCorporate] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Completion percentage
  const completionFields = [
    form.display_name,
    form.lmp_date || form.reference_date,
    form.blood_type,
    form.emergency_contact,
    form.emergency_phone,
    form.height_cm,
    form.pre_pregnancy_weight_kg,
  ];
  const completed = completionFields.filter(Boolean).length;
  const completionPct = Math.round((completed / completionFields.length) * 100);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sua sessão expirou — entre novamente.");
        return;
      }
      const payload: any = {
        id: u.user.id,
        display_name: form.display_name || null,
        baby_name: form.baby_name || null,
        lmp_date: form.lmp_date || null,
        due_date: form.lmp_date ? dueDateFromLmp(form.lmp_date) : null,
        reference_date: form.reference_date || null,
        reference_weeks: form.reference_weeks ? Number(form.reference_weeks) : null,
        reference_days: form.reference_days ? Number(form.reference_days) : null,
        blood_type: form.blood_type || null,
        allergies: form.allergies || null,
        emergency_contact: form.emergency_contact || null,
        emergency_phone: form.emergency_phone || null,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        pre_pregnancy_weight_kg: form.pre_pregnancy_weight_kg
          ? Number(form.pre_pregnancy_weight_kg)
          : null,
        medications: form.medications || null,
        birth_date: form.birth_date || null,
        pregnancy_number: form.pregnancy_number ? Number(form.pregnancy_number) : 1,
        prior_bp_elevated: form.prior_bp_elevated,
        prior_bp_week: form.prior_bp_week ? Number(form.prior_bp_week) : null,
        prior_gestational_diabetes: form.prior_gestational_diabetes,
        prior_preterm: form.prior_preterm,
        prior_cesarean: form.prior_cesarean,
        prior_notes: form.prior_notes || null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await (supabase as any)
        .from("patient_profiles")
        .upsert(payload)
        .select()
        .single();
      if (error) {
        setMsg(error.message);
      } else {
        onSaved(data);
        setMsg("Salvo com sucesso ✓");
        toast.success("Perfil salvo com sucesso!");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Completion card */}
      <div className="glass-card glass-indigo rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-600">
              💫 Perfil completo
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {completionPct < 100
                ? "Complete seu perfil para aproveitar todas as funcionalidades."
                : "Seu perfil está completo! 🎉"}
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-indigo-200 text-sm font-bold text-indigo-600">
            {completionPct}%
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Suas informações</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="Seu nome"
            value={form.display_name}
            onChange={(v) => setForm({ ...form, display_name: v })}
          />
          <Field
            label="Nome do bebê (opcional)"
            value={form.baby_name}
            onChange={(v) => setForm({ ...form, baby_name: v })}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Idade gestacional</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use a DUM (data da última menstruação) <strong>ou</strong> os dados informados pelo médico
          no ultrassom.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="DUM — Data da última menstruação"
            type="date"
            value={form.lmp_date}
            onChange={(v) => setForm({ ...form, lmp_date: v })}
          />
        </div>
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">— ou —</p>
          <p className="mt-1 text-sm">Idade gestacional informada pelo médico</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <Field
              label="Data da consulta/USG"
              type="date"
              value={form.reference_date}
              onChange={(v) => setForm({ ...form, reference_date: v })}
            />
            <Field
              label="Semanas"
              type="number"
              value={form.reference_weeks}
              onChange={(v) => setForm({ ...form, reference_weeks: v })}
            />
            <Field
              label="Dias"
              type="number"
              value={form.reference_days}
              onChange={(v) => setForm({ ...form, reference_days: v })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Dados clínicos & emergência</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="Tipo sanguíneo (ex: O+)"
            value={form.blood_type}
            onChange={(v) => setForm({ ...form, blood_type: v })}
          />
          <Field
            label="Alergias"
            value={form.allergies}
            onChange={(v) => setForm({ ...form, allergies: v })}
          />
          <Field
            label="Medicamentos em uso"
            value={form.medications}
            onChange={(v) => setForm({ ...form, medications: v })}
            placeholder="Ex: sulfato ferroso, ácido fólico..."
          />
          <Field
            label="Contato de emergência"
            value={form.emergency_contact}
            onChange={(v) => setForm({ ...form, emergency_contact: v })}
          />
          <Field
            label="Telefone de emergência"
            value={form.emergency_phone}
            onChange={(v) => setForm({ ...form, emergency_phone: v })}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Pós-parto</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha após o nascimento do bebê para ativar o Portal Pós-parto.
        </p>
        <div className="mt-4">
          <Field
            label="Data de nascimento do bebê"
            type="date"
            value={form.birth_date}
            onChange={(v) => setForm({ ...form, birth_date: v })}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Deixe em branco enquanto a gestação está em curso — preencha só quando o bebê nascer.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Dados corporais</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Usados para calcular seu IMC pré-gestacional e a curva de ganho de peso recomendada (IOM
          2009).
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="Altura (cm)"
            type="number"
            value={form.height_cm}
            onChange={(v) => setForm({ ...form, height_cm: v })}
          />
          <Field
            label="Peso pré-gestacional (kg)"
            type="number"
            value={form.pre_pregnancy_weight_kg}
            onChange={(v) => setForm({ ...form, pre_pregnancy_weight_kg: v })}
          />
        </div>
      </div>

      {/* Feature 19: Second pregnancy */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Histórico gestacional</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Se esta é sua segunda gestação (ou mais), registre as complicações anteriores para
          monitoramento personalizado.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Nº desta gestação</label>
            <select
              value={form.pregnancy_number}
              onChange={(e) => setForm({ ...form, pregnancy_number: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="1">1ª gestação</option>
              <option value="2">2ª gestação</option>
              <option value="3">3ª gestação</option>
              <option value="4">4ª gestação ou mais</option>
            </select>
          </div>
        </div>
        {Number(form.pregnancy_number) >= 2 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Complicações na gestação anterior:
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.prior_bp_elevated}
                onChange={(e) => setForm({ ...form, prior_bp_elevated: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Pressão arterial elevada / pré-eclâmpsia</span>
            </label>
            {form.prior_bp_elevated && (
              <div className="ml-7">
                <Field
                  label="A partir de qual semana?"
                  type="number"
                  value={form.prior_bp_week}
                  onChange={(v) => setForm({ ...form, prior_bp_week: v })}
                  placeholder="Ex: 32"
                />
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.prior_gestational_diabetes}
                onChange={(e) => setForm({ ...form, prior_gestational_diabetes: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Diabetes gestacional</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.prior_preterm}
                onChange={(e) => setForm({ ...form, prior_preterm: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Parto prematuro (antes de 37 semanas)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.prior_cesarean}
                onChange={(e) => setForm({ ...form, prior_cesarean: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm">Cesárea anterior</span>
            </label>
            <div>
              <label className="block text-sm font-medium mb-1">
                Outras observações (opcional)
              </label>
              <textarea
                value={form.prior_notes}
                onChange={(e) => setForm({ ...form, prior_notes: e.target.value })}
                rows={2}
                placeholder="Ex: bebê GIG, internação por DPP..."
                className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Feature 17: Push notifications */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Dicas semanais</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Receba uma dica personalizada baseada na sua semana gestacional toda segunda-feira.
        </p>
        <div className="mt-4">
          {notifPermission === "granted" ? (
            <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-200 p-4">
              <span className="text-2xl">🔔</span>
              <div>
                <p className="text-sm font-medium text-green-700">Notificações ativas</p>
                <p className="text-xs text-green-600">
                  Você receberá dicas semanais personalizadas.
                </p>
              </div>
            </div>
          ) : notifPermission === "denied" ? (
            <div className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
              Notificações bloqueadas neste navegador. Para ativar, vá nas configurações do
              navegador e permita notificações para este site.
            </div>
          ) : (
            <button
              onClick={async () => {
                if (!("Notification" in window)) return;
                const perm = await Notification.requestPermission();
                setNotifPermission(perm);
                if (perm === "granted") {
                  if ("serviceWorker" in navigator) {
                    navigator.serviceWorker.register("/sw.js").catch(() => {});
                  }
                }
              }}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white"
            >
              🔔 Ativar dicas semanais
            </button>
          )}
        </div>
      </div>

      {/* Feature 50: Corporate */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Benefício Corporativo</p>
        {profile?.corporate_account_id ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-primary/5 border border-primary/20 p-4">
            <span className="text-2xl">🏢</span>
            <div>
              <p className="text-sm font-medium text-primary">Acesso corporativo ativo</p>
              <p className="text-xs text-muted-foreground">
                Seu plano é custeado pela sua empresa.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Sua empresa oferece o portal como benefício? Insira o código fornecido pelo RH.
            </p>
            <div className="flex gap-2">
              <input
                value={corporateCode}
                onChange={(e) => setCorporateCode(e.target.value.toUpperCase())}
                placeholder="Código da empresa (ex: ABC123)"
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm font-mono uppercase tracking-wider"
                maxLength={12}
              />
              <button
                onClick={async () => {
                  if (!corporateCode.trim()) return;
                  setJoiningCorporate(true);
                  setCorporateMsg(null);
                  const { data: s } = await supabase.auth.getSession();
                  if (!s.session?.access_token) {
                    setJoiningCorporate(false);
                    return;
                  }
                  const res = await joinCorporate({
                    data: { accessToken: s.session.access_token, accessCode: corporateCode.trim() },
                  });
                  if (res.ok) {
                    setCorporateMsg(
                      `✅ Vinculado a ${res.companyName}! Salve o perfil para confirmar.`,
                    );
                    onSaved({
                      ...profile!,
                      corporate_account_id: "pending",
                    } as NonNullable<typeof profile>);
                  } else {
                    setCorporateMsg(res.error ?? "Código inválido.");
                  }
                  setJoiningCorporate(false);
                }}
                disabled={joiningCorporate || !corporateCode.trim()}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {joiningCorporate ? "..." : "Aplicar"}
              </button>
            </div>
            {corporateMsg && (
              <p
                className={`text-sm ${corporateMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}
              >
                {corporateMsg}
              </p>
            )}
          </div>
        )}
      </div>

      {msg && <p className="text-sm text-primary">{msg}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

/* ---------- Saúde (peso + pressão) ---------- */
// IOM 2009 expected weight gain corridor at gestational week w, given pre-pregnancy BMI
function iomGain(week: number, bmi: number): { min: number; max: number } {
  let rMin: number, rMax: number;
  if (bmi < 18.5) {
    rMin = 0.44;
    rMax = 0.58;
  } else if (bmi < 25) {
    rMin = 0.35;
    rMax = 0.5;
  } else if (bmi < 30) {
    rMin = 0.23;
    rMax = 0.33;
  } else {
    rMin = 0.17;
    rMax = 0.27;
  }

  if (week <= 12) {
    const f = week / 12;
    return { min: f * 0.5, max: f * 2.0 };
  }
  return { min: 0.5 + (week - 12) * rMin, max: 2.0 + (week - 12) * rMax };
}

function HealthTab({
  gest,
  profile,
  onNavigate,
}: {
  gest: Gest;
  profile: Profile | null;
  onNavigate: (tab: string) => void;
}) {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [form, setForm] = useState({
    weight_kg: "",
    systolic: "",
    diastolic: "",
    glucose_mg_dl: "",
    spo2: "",
    heart_rate_bpm: "",
    steps: "",
    sleep_hours: "",
    notes: "",
  });
  const [showWearable, setShowWearable] = useState(false);

  async function load() {
    const { data } = await (supabase as any)
      .from("health_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .limit(60);
    setLogs(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (
      !form.weight_kg &&
      !form.systolic &&
      !form.diastolic &&
      !form.glucose_mg_dl &&
      !form.spo2 &&
      !form.heart_rate_bpm &&
      !form.steps &&
      !form.sleep_hours &&
      !form.notes
    ) {
      toast.error("Preencha ao menos um campo para registrar.");
      return;
    }
    // Envia apenas os campos preenchidos (colunas extras podem não existir
    // no banco ainda sem as migrations pendentes) e a data local do navegador.
    const payload: Record<string, unknown> = {
      user_id: u.user.id,
      log_date: new Date().toLocaleDateString("en-CA"),
    };
    if (form.weight_kg) payload.weight_kg = Number(form.weight_kg);
    if (form.systolic) payload.systolic = Number(form.systolic);
    if (form.diastolic) payload.diastolic = Number(form.diastolic);
    if (form.glucose_mg_dl) payload.glucose_mg_dl = Number(form.glucose_mg_dl);
    if (form.spo2) payload.spo2 = Number(form.spo2);
    if (form.heart_rate_bpm) payload.heart_rate_bpm = Number(form.heart_rate_bpm);
    if (form.steps) payload.steps = Number(form.steps);
    if (form.sleep_hours) payload.sleep_hours = Number(form.sleep_hours);
    if (form.notes) payload.notes = form.notes;
    const { error } = await (supabase as any).from("health_logs").insert(payload);
    if (error) {
      toast.error("Erro ao salvar o registro. Tente novamente.");
      return;
    }
    triggerAchievementsCheck();
    setForm({
      weight_kg: "",
      systolic: "",
      diastolic: "",
      glucose_mg_dl: "",
      spo2: "",
      heart_rate_bpm: "",
      steps: "",
      sleep_hours: "",
      notes: "",
    });
    load();
  }
  async function remove(id: string) {
    const { error } = await (supabase as any).from("health_logs").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o registro. Tente novamente.");
      return;
    }
    load();
  }

  const last = logs[0];
  const allWeightLogs = logs.filter((l) => l.weight_kg != null).reverse();
  const weights = allWeightLogs.slice(-12);

  // Stats
  const firstWeight = allWeightLogs[0]?.weight_kg ? Number(allWeightLogs[0].weight_kg) : null;
  const lastWeight = allWeightLogs[allWeightLogs.length - 1]?.weight_kg
    ? Number(allWeightLogs[allWeightLogs.length - 1].weight_kg)
    : null;
  const totalGain =
    firstWeight != null && lastWeight != null ? (lastWeight - firstWeight).toFixed(1) : null;

  const lastBp = logs.find((l) => l.systolic != null && l.diastolic != null);
  const bpStatus =
    lastBp?.systolic != null && lastBp?.diastolic != null
      ? lastBp.systolic >= 160 || lastBp.diastolic >= 110
        ? { label: "PA muito elevada", color: "rose" }
        : lastBp.systolic >= 140 || lastBp.diastolic >= 90
          ? { label: "PA elevada", color: "amber" }
          : { label: "PA normal", color: "emerald" }
      : null;

  // IOM weight curve — Feature #9
  const prePregW = profile?.pre_pregnancy_weight_kg
    ? Number(profile.pre_pregnancy_weight_kg)
    : null;
  const heightM = profile?.height_cm ? profile.height_cm / 100 : null;
  const bmi = prePregW && heightM ? prePregW / (heightM * heightM) : null;

  // Map each weight log to gestational week at that date
  type WeightPoint = { week: number; weight: number };
  const weightByWeek: WeightPoint[] = [];
  if (bmi != null && prePregW != null) {
    allWeightLogs.forEach((l) => {
      const g = computeGestation({
        lmp: profile?.lmp_date,
        referenceDate: profile?.reference_date,
        referenceWeeks: profile?.reference_weeks,
        referenceDays: profile?.reference_days,
        today: new Date(l.log_date + "T00:00:00"),
      });
      if (g && g.weeks >= 0 && g.weeks <= 42 && l.weight_kg) {
        weightByWeek.push({ week: g.weeks, weight: Number(l.weight_kg) });
      }
    });
  }

  // Build SVG IOM chart
  const showIomChart = bmi != null && prePregW != null && weightByWeek.length > 0;
  const iomChartW = 400,
    iomChartH = 180;
  let iomMinY: number, iomMaxY: number;
  if (showIomChart) {
    const corridor = [0, 10, 20, 30, 40].map((w) => {
      const g = iomGain(w, bmi!);
      return { min: prePregW! + g.min, max: prePregW! + g.max };
    });
    const allY = [...corridor.flatMap((c) => [c.min, c.max]), ...weightByWeek.map((p) => p.weight)];
    iomMinY = Math.min(...allY) - 1;
    iomMaxY = Math.max(...allY) + 1;
  } else {
    iomMinY = 50;
    iomMaxY = 90;
  }
  const yRange = Math.max(iomMaxY - iomMinY, 1);

  function toSvgX(week: number) {
    return (week / 42) * iomChartW;
  }
  function toSvgY(w: number) {
    return iomChartH - ((w - iomMinY) / yRange) * (iomChartH - 20) - 10;
  }

  const bandMinPts = Array.from(
    { length: 43 },
    (_, i) => `${toSvgX(i)},${toSvgY(prePregW! + iomGain(i, bmi!).min)}`,
  ).join(" ");
  const bandMaxPts = Array.from(
    { length: 43 },
    (_, i) => `${toSvgX(i)},${toSvgY(prePregW! + iomGain(i, bmi!).max)}`,
  ).join(" ");
  const bandPolygon =
    bandMinPts +
    " " +
    Array.from(
      { length: 43 },
      (_, i) => `${toSvgX(42 - i)},${toSvgY(prePregW! + iomGain(42 - i, bmi!).max)}`,
    ).join(" ");
  const actualPts = weightByWeek.map((p) => `${toSvgX(p.week)},${toSvgY(p.weight)}`).join(" ");

  const bmiLabel =
    bmi == null
      ? null
      : bmi < 18.5
        ? "abaixo do peso"
        : bmi < 25
          ? "peso normal"
          : bmi < 30
            ? "sobrepeso"
            : "obesidade";

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        <div className="press glass-card glass-emerald rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-600">⚖️ Último peso</p>
          <p className="mt-2 font-serif text-3xl">
            {last?.weight_kg ? `${last.weight_kg} kg` : "—"}
          </p>
        </div>
        <div className="press glass-card glass-teal rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-teal-600">📈 Ganho total</p>
          <p className="mt-2 font-serif text-3xl">
            {totalGain != null ? `${Number(totalGain) > 0 ? "+" : ""}${totalGain} kg` : "—"}
          </p>
        </div>
        <div
          className={`press rounded-3xl p-5 ${bpStatus?.color === "rose" ? "glass-card glass-rose" : bpStatus?.color === "amber" ? "glass-card glass-amber" : "glass-card glass-blue"}`}
        >
          <p
            className={`text-xs uppercase tracking-[0.22em] ${bpStatus?.color === "rose" ? "text-rose-600" : bpStatus?.color === "amber" ? "text-amber-600" : "text-blue-600"}`}
          >
            🩺 Última PA
          </p>
          <p className="mt-2 font-serif text-3xl">
            {lastBp?.systolic && lastBp?.diastolic ? `${lastBp.systolic}/${lastBp.diastolic}` : "—"}
          </p>
          {bpStatus && (
            <p
              className={`mt-1 text-xs font-medium ${bpStatus.color === "rose" ? "text-rose-700" : bpStatus.color === "amber" ? "text-amber-700" : "text-emerald-700"}`}
            >
              {bpStatus.label}
            </p>
          )}
        </div>
        {(() => {
          const lastGlucose = logs.find((l) => l.glucose_mg_dl != null);
          const gv = lastGlucose?.glucose_mg_dl;
          const gColor = gv == null ? null : gv > 140 ? "rose" : gv > 95 ? "amber" : "emerald";
          const gLabel =
            gv == null ? null : gv > 140 ? "Atenção: elevada" : gv > 95 ? "Limite" : "Normal";
          return (
            <div
              className={`press rounded-3xl p-5 ${gColor === "rose" ? "glass-card glass-rose" : gColor === "amber" ? "glass-card glass-amber" : "glass-card glass-sky"}`}
            >
              <p
                className={`text-xs uppercase tracking-[0.22em] ${gColor === "rose" ? "text-rose-600" : gColor === "amber" ? "text-amber-600" : "text-sky-600"}`}
              >
                🍬 Glicemia
              </p>
              <p className="mt-2 font-serif text-3xl">{gv != null ? `${gv} mg/dL` : "—"}</p>
              {gLabel && (
                <p
                  className={`mt-1 text-xs font-medium ${gColor === "rose" ? "text-rose-700" : gColor === "amber" ? "text-amber-700" : "text-emerald-700"}`}
                >
                  {gLabel}
                </p>
              )}
            </div>
          );
        })()}
        <div className="press glass-card glass-pink rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-pink-600">🫀 SpO₂ / FC</p>
          <p className="mt-2 font-serif text-2xl">
            {last?.spo2 ? `${last.spo2}%` : "—"}
            {last?.heart_rate_bpm ? (
              <span className="ml-1 text-lg text-muted-foreground"> {last.heart_rate_bpm}bpm</span>
            ) : null}
          </p>
        </div>
      </div>

      {/* IOM weight corridor chart — Feature #9 */}
      {showIomChart ? (
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary">
                Curva de ganho de peso (IOM 2009)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                IMC pré-gestacional: {bmi!.toFixed(1)} ({bmiLabel}) · Faixa recomendada em verde
              </p>
            </div>
          </div>
          <svg viewBox={`0 0 ${iomChartW} ${iomChartH}`} className="mt-3 h-44 w-full">
            {/* Corridor band */}
            <polygon points={bandPolygon} fill="var(--primary)" fillOpacity="0.12" />
            {/* Min line */}
            <polyline
              points={bandMinPts}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.4"
            />
            {/* Max line */}
            <polyline
              points={bandMaxPts}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.4"
            />
            {/* Actual weight line */}
            {weightByWeek.length > 1 && (
              <polyline
                points={actualPts}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            )}
            {/* Data points */}
            {weightByWeek.map((p, i) => (
              <circle
                key={i}
                cx={toSvgX(p.week)}
                cy={toSvgY(p.weight)}
                r="4"
                fill="var(--primary)"
              />
            ))}
            {/* X-axis labels */}
            {[0, 10, 20, 28, 36, 40].map((w) => (
              <text
                key={w}
                x={toSvgX(w)}
                y={iomChartH - 1}
                fontSize="8"
                fill="var(--muted-foreground)"
                textAnchor="middle"
              >
                {w}s
              </text>
            ))}
          </svg>
          <p className="mt-1 text-xs text-muted-foreground">
            Linha sólida = seu peso · Faixa = zona saudável para seu IMC. Configure altura e peso
            pré-gestacional em{" "}
            <button
              type="button"
              onClick={() => onNavigate("Perfil")}
              className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
            >
              Perfil
            </button>
            .
          </p>
        </div>
      ) : (
        prePregW == null && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
            Configure sua <strong>altura</strong> e <strong>peso pré-gestacional</strong> em{" "}
            <button
              type="button"
              onClick={() => onNavigate("Perfil")}
              className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
            >
              Perfil
            </button>{" "}
            para ver a curva de ganho de peso recomendada pelo IOM.
          </div>
        )
      )}

      {/* Gráfico histórico de PA */}
      {(() => {
        const bpHistory = logs
          .filter((l) => l.systolic != null && l.diastolic != null)
          .reverse()
          .slice(-15);
        if (bpHistory.length < 2) return null;
        const W = 400,
          H = 140;
        const allY = bpHistory.flatMap((l) => [l.systolic!, l.diastolic!]);
        const minY = Math.min(...allY, 50) - 5;
        const maxY = Math.max(...allY, 160) + 5;
        const sy = (v: number) => H - 10 - ((v - minY) / (maxY - minY)) * (H - 20);
        const sx = (i: number) => 10 + (i / (bpHistory.length - 1)) * (W - 20);
        const systPts = bpHistory.map((l, i) => `${sx(i)},${sy(l.systolic!)}`).join(" ");
        const diasPts = bpHistory.map((l, i) => `${sx(i)},${sy(l.diastolic!)}`).join(" ");
        return (
          <div className="rounded-3xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-primary">
              Histórico de pressão arterial
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Linha vermelha = sistólica · Linha azul = diastólica · Limite em tracejado
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-36 w-full">
              {/* threshold 140 sistólica */}
              <line
                x1="10"
                y1={sy(140)}
                x2={W - 10}
                y2={sy(140)}
                stroke="#f87171"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.6"
              />
              <text x="12" y={sy(140) - 3} fontSize="7" fill="#f87171" opacity="0.8">
                140
              </text>
              {/* threshold 90 diastólica */}
              <line
                x1="10"
                y1={sy(90)}
                x2={W - 10}
                y2={sy(90)}
                stroke="#60a5fa"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.6"
              />
              <text x="12" y={sy(90) - 3} fontSize="7" fill="#60a5fa" opacity="0.8">
                90
              </text>
              <polyline
                points={systPts}
                fill="none"
                stroke="#f87171"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <polyline
                points={diasPts}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {bpHistory.map((l, i) => (
                <g key={i}>
                  <circle cx={sx(i)} cy={sy(l.systolic!)} r="3.5" fill="#f87171" />
                  <circle cx={sx(i)} cy={sy(l.diastolic!)} r="3.5" fill="#60a5fa" />
                </g>
              ))}
            </svg>
          </div>
        );
      })()}

      {/* Gráfico histórico de glicemia */}
      {(() => {
        const glHistory = logs
          .filter((l) => l.glucose_mg_dl != null)
          .reverse()
          .slice(-15);
        if (glHistory.length < 2) return null;
        const W = 400,
          H = 130;
        const allY = glHistory.map((l) => l.glucose_mg_dl!);
        const minY = Math.min(...allY, 70) - 5;
        const maxY = Math.max(...allY, 180) + 5;
        const sy = (v: number) => H - 10 - ((v - minY) / (maxY - minY)) * (H - 20);
        const sx = (i: number) => 10 + (i / (glHistory.length - 1)) * (W - 20);
        const pts = glHistory.map((l, i) => `${sx(i)},${sy(l.glucose_mg_dl!)}`).join(" ");
        return (
          <div className="rounded-3xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-primary">
              Histórico de glicemia
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Referência em jejum: &lt; 95 mg/dL · Pós-prandial: &lt; 140 mg/dL
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-32 w-full">
              {/* zona verde < 95 */}
              <rect
                x="10"
                y={sy(95)}
                width={W - 20}
                height={sy(minY) - sy(95)}
                fill="#4ade80"
                opacity="0.08"
              />
              <line
                x1="10"
                y1={sy(95)}
                x2={W - 10}
                y2={sy(95)}
                stroke="#4ade80"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.7"
              />
              <text x="12" y={sy(95) - 3} fontSize="7" fill="#4ade80" opacity="0.9">
                95
              </text>
              {/* threshold 140 */}
              <line
                x1="10"
                y1={sy(140)}
                x2={W - 10}
                y2={sy(140)}
                stroke="#fb923c"
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.7"
              />
              <text x="12" y={sy(140) - 3} fontSize="7" fill="#fb923c" opacity="0.9">
                140
              </text>
              <polyline
                points={pts}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {glHistory.map((l, i) => (
                <circle
                  key={i}
                  cx={sx(i)}
                  cy={sy(l.glucose_mg_dl!)}
                  r="3.5"
                  fill={
                    l.glucose_mg_dl! > 140
                      ? "#f87171"
                      : l.glucose_mg_dl! > 95
                        ? "#fb923c"
                        : "var(--primary)"
                  }
                />
              ))}
            </svg>
          </div>
        );
      })()}

      {/* Wearable data summary — Feature #6 */}
      {logs.some(
        (l) =>
          (l as any).spo2 ||
          (l as any).heart_rate_bpm ||
          (l as any).steps ||
          (l as any).sleep_hours,
      ) && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "SpO₂", value: logs.find((l) => (l as any).spo2)?.spo2, unit: "%" },
            {
              label: "FC",
              value: logs.find((l) => (l as any).heart_rate_bpm)?.heart_rate_bpm,
              unit: "bpm",
            },
            { label: "Passos", value: logs.find((l) => (l as any).steps)?.steps, unit: "" },
            {
              label: "Sono",
              value: logs.find((l) => (l as any).sleep_hours)?.sleep_hours,
              unit: "h",
            },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-serif text-2xl">
                {m.value != null ? `${m.value}${m.unit}` : "—"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Wearable sync guide */}
      <details className="rounded-2xl border border-border bg-card">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium">
          📱 Como sincronizar com seu dispositivo
        </summary>
        <div className="space-y-2 px-5 pb-4 pt-2 text-sm text-muted-foreground">
          <p>
            <strong>Apple Health (iPhone):</strong> Abra o app Saúde → Resumo → veja SpO2, FC, Sono
            e Passos → registre manualmente os valores aqui.
          </p>
          <p>
            <strong>Google Fit (Android):</strong> Abra o Google Fit → Diário → copie os valores do
            dia → registre abaixo nos campos de wearable.
          </p>
          <p>
            <strong>Garmin / Fitbit / Samsung Health:</strong> Acesse o app do seu dispositivo →
            Dashboard → Atividade do Dia → copie os valores desejados.
          </p>
          <p className="text-xs">
            A integração automática requer aplicativo nativo. Por ora, o registro manual mantém seu
            histórico no portal.
          </p>
        </div>
      </details>

      {/* New log form */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Novo registro</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
          <Field
            label="Peso (kg)"
            type="number"
            value={form.weight_kg}
            onChange={(v) => setForm({ ...form, weight_kg: v })}
          />
          <Field
            label="Sistólica"
            type="number"
            value={form.systolic}
            onChange={(v) => setForm({ ...form, systolic: v })}
          />
          <Field
            label="Diastólica"
            type="number"
            value={form.diastolic}
            onChange={(v) => setForm({ ...form, diastolic: v })}
          />
          <Field
            label="Glicemia (mg/dL)"
            type="number"
            value={form.glucose_mg_dl}
            onChange={(v) => setForm({ ...form, glucose_mg_dl: v })}
          />
          <Field
            label="Notas"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
          />
        </div>
        <button
          onClick={() => setShowWearable((v) => !v)}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          {showWearable ? "▲ Ocultar wearable" : "▼ Adicionar dados do wearable"}
        </button>
        {showWearable && (
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Field
              label="SpO₂ (%)"
              type="number"
              value={form.spo2}
              onChange={(v) => setForm({ ...form, spo2: v })}
            />
            <Field
              label="FC (bpm)"
              type="number"
              value={form.heart_rate_bpm}
              onChange={(v) => setForm({ ...form, heart_rate_bpm: v })}
            />
            <Field
              label="Passos"
              type="number"
              value={form.steps}
              onChange={(v) => setForm({ ...form, steps: v })}
            />
            <Field
              label="Sono (horas)"
              type="number"
              value={form.sleep_hours}
              onChange={(v) => setForm({ ...form, sleep_hours: v })}
            />
          </div>
        )}
        <button
          onClick={add}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
        >
          Adicionar
        </button>
      </div>

      {/* History list */}
      <div className="space-y-2">
        {logs.map((l) => (
          <div
            key={l.id}
            className="flex items-start justify-between rounded-xl border border-border bg-card p-4 text-sm"
          >
            <span className="text-muted-foreground shrink-0">
              {new Date(l.log_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
            <span className="flex-1 px-3 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              {l.weight_kg && <span>⚖️ {l.weight_kg} kg</span>}
              {l.systolic && l.diastolic && (
                <span>
                  💓 {l.systolic}/{l.diastolic}
                </span>
              )}
              {l.glucose_mg_dl && <span>🩸 {l.glucose_mg_dl} mg/dL</span>}
              {l.spo2 && <span>🫁 {l.spo2}% SpO₂</span>}
              {l.heart_rate_bpm && <span>❤️ {l.heart_rate_bpm}bpm</span>}
              {l.steps && <span>🚶 {l.steps} passos</span>}
              {l.sleep_hours && <span>🌙 {l.sleep_hours}h sono</span>}
              {l.notes && <span className="text-muted-foreground">{l.notes}</span>}
            </span>
            <button
              onClick={() => remove(l.id)}
              className="text-xs text-muted-foreground hover:text-destructive shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Perguntas para o médico ---------- */

const SUGGESTED_QUESTIONS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Que suplementos devo tomar no 1º trimestre?",
    "Quais alimentos devo evitar?",
    "Posso fazer exercícios físicos?",
    "O que é a translucência nucal?",
  ],
  2: [
    "Como interpretar o resultado do ultrassom morfológico?",
    "O que é o teste de glicose?",
    "Posso viajar nesta fase?",
    "Como posso estimular o bebê?",
  ],
  3: [
    "Quando devo ir para a maternidade?",
    "Quais são os sinais de trabalho de parto?",
    "Como é decidido entre parto normal e cesárea?",
    "O que é o plano de parto?",
  ],
};

function QuestionsTab({ gest }: { gest: Gest }) {
  const [items, setItems] = useState<DoctorQ[]>([]);
  const [text, setText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const trimester = gest ? trimesterForWeek(gest.weeks) : 1;
  const suggestions = SUGGESTED_QUESTIONS[trimester];

  async function load() {
    const { data } = await (supabase as any)
      .from("doctor_questions")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(question?: string) {
    const q = (question ?? text).trim();
    if (!q) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      return;
    }
    // Carimba o médico vinculado para o assinante ver a pergunta da SUA paciente.
    const { data: prof } = await (supabase as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", u.user.id)
      .maybeSingle();
    const { error } = await (supabase as any)
      .from("doctor_questions")
      .insert({ user_id: u.user.id, question: q, doctor_id: prof?.doctor_id ?? null });
    if (error) {
      toast.error("Não foi possível salvar a pergunta. Tente novamente.");
      return;
    }
    setText("");
    load();
    triggerAchievementsCheck();
  }
  async function toggle(q: DoctorQ) {
    const { error } = await (supabase as any)
      .from("doctor_questions")
      .update({ answered: !q.answered })
      .eq("id", q.id);
    if (error) {
      toast.error("Não foi possível atualizar a pergunta. Tente novamente.");
      return;
    }
    setItems((arr) => arr.map((x) => (x.id === q.id ? { ...x, answered: !x.answered } : x)));
  }
  async function remove(id: string) {
    const { error } = await (supabase as any).from("doctor_questions").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover a pergunta. Tente novamente.");
      return;
    }
    setItems((arr) => arr.filter((x) => x.id !== id));
  }

  const pending = items.filter((q) => !q.answered);
  const answered = items.filter((q) => q.answered);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Anote para a próxima consulta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Aquela dúvida que sempre esquece na hora — registre aqui.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Ex: posso fazer exercícios físicos?"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => add()}
            className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
          >
            Adicionar
          </button>
        </div>

        {/* Suggested questions by trimester */}
        <div className="mt-4">
          <button
            onClick={() => setShowSuggestions((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showSuggestions
              ? "▲ Ocultar sugestões"
              : "▼ Ver perguntas comuns do " +
                (trimester === 1 ? "1º" : trimester === 2 ? "2º" : "3º") +
                " trimestre"}
          </button>
          {showSuggestions && (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => add(s)}
                  className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Pendentes ({pending.length})
        </p>
        <div className="space-y-2">
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma pergunta pendente.</p>
          )}
          {pending.map((q) => (
            <div
              key={q.id}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <input
                type="checkbox"
                checked={q.answered}
                onChange={() => toggle(q)}
                className="mt-1 h-4 w-4"
              />
              <p className="flex-1 text-sm">{q.question}</p>
              <button
                onClick={() => remove(q.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {answered.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Respondidas ({answered.length})
          </p>
          <div className="space-y-2 opacity-60">
            {answered.map((q) => (
              <div
                key={q.id}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => toggle(q)}
                  className="mt-1 h-4 w-4"
                />
                <p className="flex-1 text-sm line-through">{q.question}</p>
                <button
                  onClick={() => remove(q.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Acompanhante ---------- */
function CompanionTab({ babyName }: { babyName: string | null }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const { data } = await (supabase as any)
      .from("companion_invites")
      .select("*")
      .order("created_at", { ascending: false });
    setInvites(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // Token criptográfico (não-enumerável) — dá acesso ao painel do papai,
    // álbum e alerta de pânico. Validade de 1 ano cobre gestação + pós-parto;
    // o backend já rejeita convites vencidos (expires_at) e o "Revogar" segue
    // sendo o controle imediato.
    const token = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await (supabase as any).from("companion_invites").insert({
      user_id: u.user.id,
      token,
      companion_name: name || null,
      expires_at: expiresAt,
    });
    setName("");
    load();
  }
  async function revoke(id: string) {
    await (supabase as any).from("companion_invites").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Convidar acompanhante</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Gere um link para o papai, vovó ou alguém especial acompanhar a evolução
          {babyName ? ` de ${babyName}` : " do bebê"} (visualização).
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do acompanhante (opcional)"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={create}
            className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
          >
            Gerar convite
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {invites.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum convite ainda.</p>
        )}
        {invites.map((i) => {
          const url = `${window.location.origin}/acompanhar/${i.token}`;
          return (
            <div key={i.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{i.companion_name ?? "Acompanhante"}</p>
                <button
                  onClick={() => revoke(i.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  revogar
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={url}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(url)}
                  className="rounded-full bg-secondary px-4 py-2 text-xs"
                >
                  Copiar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Alertas / triagem de sintomas ---------- */
function AlertsTab({ weeks }: { weeks: number | null }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    level: RiskLevel;
    reasons: string[];
    message: string;
  } | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function avaliar() {
    setLoading(true);
    setResult(null);
    try {
      const res = await assessSymptoms({
        data: {
          symptoms: [...selected],
          systolic: sys ? Number(sys) : null,
          diastolic: dia ? Number(dia) : null,
          note: note || undefined,
          weeks,
        },
      });
      setResult(res);
      // Grava a triagem na CONTA da paciente (histórico + dashboard do médico).
      // Fire-and-forget: falha de rede/tabela ausente NÃO atrapalha a orientação.
      try {
        const { data: s } = await supabase.auth.getSession();
        if (s.session?.access_token) {
          void saveTriageLog({
            data: {
              accessToken: s.session.access_token,
              level: res.level,
              symptoms: [...selected],
              systolic: sys ? Number(sys) : null,
              diastolic: dia ? Number(dia) : null,
              note: note || null,
            },
          }).catch(() => {});
        }
      } catch {
        /* sessão indisponível — a triagem já foi mostrada, seguimos */
      }
    } catch {
      toast.error(
        "Não foi possível avaliar os sintomas. Tente novamente ou ligue para o consultório.",
      );
    } finally {
      setLoading(false);
    }
  }

  const styles: Record<RiskLevel, { box: string; dot: string; titulo: string }> = {
    vermelho: {
      box: "border-rose-300 bg-rose-50",
      dot: "bg-rose-500",
      titulo: "Procure atendimento agora",
    },
    amarelo: {
      box: "border-primary/25 bg-primary/8",
      dot: "bg-primary",
      titulo: "Atenção — fale com o consultório",
    },
    verde: {
      box: "border-emerald-300 bg-emerald-50",
      dot: "bg-emerald-500",
      titulo: "Sem sinais de alerta",
    },
  };

  return (
    <div className="max-w-2xl">
      <div className="rounded-2xl border border-primary/20 bg-primary/6 p-4 text-sm text-foreground">
        Esta triagem é uma orientação e <strong>não substitui avaliação médica</strong>. Em
        emergência, ligue <strong>192 (SAMU)</strong> ou vá ao pronto-socorro.
      </div>
      {weeks != null && (
        <p className="mt-3 text-xs text-muted-foreground">
          Avaliação para semana {weeks} de gestação.
        </p>
      )}

      <p className="mt-5 text-sm font-medium">Marque o que você está sentindo:</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[...RED_SYMPTOMS, ...YELLOW_SYMPTOMS].map((s) => (
          <label
            key={s.id}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              selected.has(s.id) ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(s.id)}
              onChange={() => toggle(s.id)}
              className="accent-[oklch(0.5_0.11_18)]"
            />
            {s.label}
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Pressão (opcional):</label>
          <input
            value={sys}
            onChange={(e) => setSys(e.target.value)}
            inputMode="numeric"
            placeholder="120"
            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <span>/</span>
          <input
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            inputMode="numeric"
            placeholder="80"
            className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Quer descrever algo? (opcional)"
        className="mt-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
      />

      <button
        onClick={avaliar}
        disabled={loading}
        className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {loading ? "Avaliando…" : "Avaliar sintomas"}
      </button>

      {result && (
        <div className={`mt-6 rounded-2xl border p-5 ${styles[result.level].box}`}>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${styles[result.level].dot}`} />
            <p className="font-serif text-lg">{styles[result.level].titulo}</p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground">{result.message}</p>
          {result.reasons.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Sinais considerados: {result.reasons.join(", ")}.
            </p>
          )}
          {result.level === "vermelho" && (
            <a
              href="tel:192"
              className="mt-4 inline-block rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white"
            >
              Ligar 192 (SAMU)
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Carteirinha digital (feat 43 — evoluída) ---------- */
function CardTab({
  profile,
  gest,
  onNavigate,
}: {
  profile: Profile | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const due = profile
    ? (profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null))
    : null;
  const updatedAt = new Date().toLocaleString("pt-BR");

  const cardText = profile
    ? [
        `🚨 CARTEIRINHA DE EMERGÊNCIA — GESTANTE`,
        `Paciente: ${profile.display_name ?? "—"}`,
        `Bebê: ${profile.baby_name ?? "—"}`,
        `IG: ${gest ? `${gest.weeks}s ${gest.days}d` : "—"}`,
        `DPP: ${due ? new Date(due + "T00:00:00").toLocaleDateString("pt-BR") : "—"}`,
        `Tipo sanguíneo: ${profile.blood_type ?? "—"}`,
        `Alergias: ${profile.allergies ?? "Nenhuma"}`,
        `Medicamentos: ${profile.medications ?? "Nenhum"}`,
        `Contato de emergência: ${profile.emergency_contact ?? "—"} — ${profile.emergency_phone ?? "—"}`,
        `Médico: ${DOCTOR.name} | ${DOCTOR.crm}`,
        `Atualizado: ${updatedAt}`,
      ].join("\n")
    : "";

  // QR gerado localmente: dados de saúde não saem do aparelho e funciona offline
  useEffect(() => {
    if (!cardText) return;
    let cancelled = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(cardText, { width: 480, margin: 1 }))
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cardText]);

  if (!profile)
    return <p className="text-sm text-muted-foreground">Preencha seu perfil primeiro.</p>;

  function copyCard() {
    navigator.clipboard.writeText(cardText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* Main card */}
      <div className="rounded-3xl bg-[image:var(--gradient-warm)] p-8 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">
              Carteirinha de emergência
            </p>
            <h2 className="mt-1.5 font-serif text-2xl">{profile.display_name ?? "—"}</h2>
            {profile.baby_name && (
              <p className="text-sm text-muted-foreground">Bebê: {profile.baby_name}</p>
            )}
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            GESTANTE
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info label="IG atual" value={gest ? `${gest.weeks}s ${gest.days}d` : "—"} />
          <Info
            label="DPP"
            value={due ? new Date(due + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
          />
          <Info label="Tipo sanguíneo" value={profile.blood_type ?? "—"} />
          <Info label="Alergias" value={profile.allergies || "Nenhuma"} />
          <Info label="Medicamentos" value={profile.medications || "Nenhum"} />
          <Info label="Contato emergência" value={profile.emergency_contact ?? "—"} />
          {profile.emergency_phone && (
            <Info label="Tel. emergência" value={profile.emergency_phone} />
          )}
          <Info label="Médico" value={DOCTOR.name} />
        </div>

        <div className="mt-5 rounded-xl bg-card/60 p-3 text-xs text-muted-foreground">
          Atualizado em: {updatedAt}
        </div>

        <div className="mt-6 flex flex-col items-center border-t border-primary/20 pt-5">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="QR Code de emergência"
              className="h-48 w-48 rounded-lg bg-white p-2"
            />
          ) : (
            <div className="skeleton h-48 w-48 rounded-lg" />
          )}
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Escaneie para ver todos os dados em caso de emergência
          </p>
          <p className="mt-2 text-xs font-medium text-primary">
            {DOCTOR.name} — Ginecologia & Obstetrícia
          </p>
        </div>
      </div>

      {/* Emergency numbers */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-3">
          Números de emergência
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "SAMU", number: "192" },
            { label: "Bombeiros", number: "193" },
            { label: "SIATE/Resgate", number: "192" },
            { label: "CVV (apoio emocional)", number: "188" },
          ].map(({ label, number }) => (
            <a
              key={label}
              href={`tel:${number}`}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm"
            >
              <span className="text-lg">📞</span>
              <div>
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-sm font-bold text-red-600">{number}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Copy button */}
      <button
        onClick={copyCard}
        className="w-full rounded-2xl bg-primary py-3 text-sm font-medium text-white"
      >
        {copied ? "✓ Copiado!" : "Copiar dados para enviar por WhatsApp"}
      </button>

      <button
        onClick={() => window.print()}
        className="print:hidden w-full rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
      >
        🖨️ Imprimir carteirinha
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Mantenha seus dados atualizados em{" "}
        <button
          type="button"
          onClick={() => onNavigate("Perfil")}
          className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
        >
          Perfil
        </button>{" "}
        — o QR Code atualiza automaticamente.
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card/60 p-3 backdrop-blur">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/* ---------- Chat IA ---------- */
type ChatMsg = { role: "user" | "assistant"; content: string };

function buildPatientContext(profile: Profile | null, gest: Gest): string {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.display_name) parts.push(`Meu nome é ${profile.display_name}.`);
  if (gest) {
    parts.push(`Estou na semana ${gest.weeks} e ${gest.days} dias de gestação.`);
  }
  if (profile.baby_name) parts.push(`O nome do meu bebê é ${profile.baby_name}.`);
  return parts.join(" ");
}

// ─── WhatsApp-style chat ─────────────────────────────────────────────────────

type WAMsg = {
  role: "user" | "assistant";
  content: string;
  ts: Date;
  image?: string;
  audioUrl?: string;
  audioDuration?: string;
  fileName?: string;
  fileSize?: string;
};

function WABubble({ msg }: { msg: WAMsg }) {
  const isUser = msg.role === "user";
  const timeStr = msg.ts.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div className={`flex items-end gap-1.5 mb-0.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {!isUser && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white self-end mb-0.5"
          style={{
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(12px)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.35), 0 2px 8px rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.22)",
          }}
        >
          IA
        </div>
      )}

      <div
        className={`max-w-[75%] overflow-hidden ${isUser ? "rounded-2xl rounded-tr-none" : "rounded-2xl rounded-tl-none"}`}
        style={
          isUser
            ? {
                background: "rgba(180,75,65,0.30)",
                backdropFilter: "blur(18px) saturate(1.4)",
                border: "1px solid rgba(255,180,160,0.28)",
                boxShadow: "inset 0 1px 1px rgba(255,200,180,0.3), 0 4px 16px rgba(0,0,0,0.3)",
              }
            : {
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(18px) saturate(1.4)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.3), 0 4px 16px rgba(0,0,0,0.25)",
              }
        }
      >
        {/* Imagem */}
        {msg.image && <img src={msg.image} alt="" className="block w-full max-h-52 object-cover" />}

        {/* Áudio */}
        {msg.audioUrl && (
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ minWidth: 180 }}>
            <button
              onClick={() => {
                if (!audioRef.current) return;
                if (playing) {
                  audioRef.current.pause();
                  setPlaying(false);
                } else {
                  audioRef.current.play().then(() => setPlaying(true));
                }
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-[13px]"
              style={{
                background: "rgba(255,255,255,0.22)",
                backdropFilter: "blur(8px)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4)",
              }}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <div className="flex flex-1 items-center gap-[2px]">
              {[3, 6, 4, 9, 5, 7, 4, 8, 6, 5, 9, 4, 7, 5, 8].map((h, i) => (
                <div
                  key={i}
                  className="w-[2px] rounded-full shrink-0"
                  style={{ height: h, background: "rgba(255,255,255,0.5)" }}
                />
              ))}
            </div>
            <span className="text-[11px] shrink-0" style={{ color: "rgba(255,255,255,0.6)" }}>
              {msg.audioDuration ?? "0:00"}
            </span>
            <audio
              ref={audioRef}
              src={msg.audioUrl}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          </div>
        )}

        {/* Arquivo */}
        {msg.fileName && (
          <div className="flex items-center gap-3 px-3 py-2.5" style={{ minWidth: 180 }}>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(8px)",
              }}
            >
              📄
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-[12px] font-semibold line-clamp-1"
                style={{ color: "rgba(255,255,255,0.92)" }}
              >
                {msg.fileName}
              </p>
              {msg.fileSize && (
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {msg.fileSize}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Texto */}
        {msg.content && (
          <p
            className="px-3 pt-2 text-[14px] leading-snug whitespace-pre-wrap"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {msg.content}
          </p>
        )}

        {/* Timestamp */}
        <div className="flex items-center justify-end gap-1 px-2.5 pb-1.5 pt-0.5">
          <span className="text-[10px] leading-none" style={{ color: "rgba(255,255,255,0.45)" }}>
            {timeStr}
          </span>
          {isUser && (
            <span className="text-[10px] leading-none" style={{ color: "rgba(130,210,255,0.9)" }}>
              ✓✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  const ctx = buildPatientContext(profile, gest);
  const firstName = profile?.display_name?.split(" ")[0];

  const greeting = [
    firstName ? `Olá, ${firstName}!` : "Olá!",
    gest ? `Você está na semana ${gest.weeks} — vou responder levando em conta sua gestação.` : "",
    "Sou o assistente virtual do consultório do seu obstetra. Como posso ajudar?",
  ]
    .filter(Boolean)
    .join(" ");

  const [messages, setMessages] = useState<WAMsg[]>([
    { role: "assistant", content: greeting, ts: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  function dataUrlMediaType(dataUrl: string): string {
    return /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "image/jpeg";
  }

  async function sendText(textOverride?: string, image?: string) {
    const text = (textOverride ?? input).trim();
    if ((!text && !image) || loading) return;

    const enrichedText =
      ctx && messages.filter((m) => m.role === "user").length === 0
        ? `[Contexto: ${ctx}]\n\n${text}`.trim()
        : text;

    const displayMsg: WAMsg = { role: "user", content: text, image, ts: new Date() };
    const displayNext = [...messages, displayMsg];

    setMessages(displayNext);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      const uiMessages = [...messages.filter((m) => m.content || m.image), displayMsg].map(
        (m, i) => {
          const msgText = m === displayMsg ? enrichedText : m.content;
          return {
            id: String(i),
            role: m.role,
            parts: [
              ...(m.image
                ? [{ type: "file", mediaType: dataUrlMediaType(m.image), url: m.image }]
                : []),
              ...(msgText ? [{ type: "text", text: msgText }] : []),
            ],
          };
        },
      );
      // Envia o token da paciente para o /api/chat resolver o médico dela e
      // usar a IA do consultório correto (cada conta é individual).
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: uiMessages }),
      });
      if (!res.ok) throw new Error(await res.text());
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let buffer = "";
      const asstMsg: WAMsg = { role: "assistant", content: "", ts: new Date() };
      setMessages([...displayNext, asstMsg]);
      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === "text-delta" && json.delta) acc += json.delta;
        } catch {}
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(processLine);
        setMessages([...displayNext, { ...asstMsg, content: acc }]);
      }
      (buffer + decoder.decode()).split("\n").forEach(processLine);
      setMessages([...displayNext, { ...asstMsg, content: acc }]);
    } catch {
      setMessages([
        ...displayNext,
        {
          role: "assistant",
          content: "Desculpe, ocorreu um erro. Tente novamente.",
          ts: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setShowAttach(false);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem válido.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Imagem muito grande — o limite é 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => void sendText(input, reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleDocSoon() {
    setShowAttach(false);
    toast("Envio de documentos em breve — por enquanto, envie fotos ou texto.");
  }

  function handleAudioSoon() {
    toast("Mensagens de áudio em breve — por enquanto, envie texto ou fotos.");
  }

  const chatBg = "linear-gradient(160deg, #150608 0%, #280d10 35%, #3d1218 65%, #521a20 100%)";

  return (
    <div
      className="-mx-4 flex flex-col overflow-hidden rounded-t-none"
      style={{ height: "72vh", background: chatBg }}
    >
      {/* Header — glass */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px) saturate(1.6)",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.28)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4)",
          }}
        >
          IA
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[15px] font-semibold leading-tight"
            style={{ color: "rgba(255,255,255,0.95)" }}
          >
            Assistente do seu médico
          </p>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            Dúvidas gerais sobre gestação
          </p>
        </div>
      </div>

      {/* Área de mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-0.5 px-3 py-3">
        {messages.map((m, i) => (
          <WABubble key={i} msg={m} />
        ))}

        {/* Indicador digitando */}
        {loading && (
          <div className="flex items-end gap-1.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.22)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.35)",
              }}
            >
              IA
            </div>
            <div
              className="rounded-2xl rounded-tl-none px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.3), 0 4px 16px rgba(0,0,0,0.25)",
              }}
            >
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((j) => (
                  <div
                    key={j}
                    className="h-2 w-2 animate-bounce rounded-full"
                    style={{ background: "rgba(255,255,255,0.55)", animationDelay: `${j * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Menu de anexos — glass dark */}
      {showAttach && (
        <div
          className="grid grid-cols-3 gap-3 px-4 py-4"
          style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <button
            onClick={() => fileImageRef.current?.click()}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{
                background: "rgba(230,100,110,0.38)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(240,140,140,0.42)",
                boxShadow: "inset 0 1px 1px rgba(255,220,210,0.3)",
              }}
            >
              🖼️
            </div>
            <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
              Galeria
            </span>
          </button>
          <button onClick={handleDocSoon} className="flex flex-col items-center gap-1.5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{
                background: "rgba(160,70,55,0.38)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(210,120,100,0.42)",
                boxShadow: "inset 0 1px 1px rgba(255,200,180,0.3)",
              }}
            >
              📄
            </div>
            <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
              Documento
            </span>
          </button>
          <button
            onClick={() => setShowAttach(false)}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
              style={{
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.25)",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              ✕
            </div>
            <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
              Fechar
            </span>
          </button>
        </div>
      )}

      {/* Barra de input — glass floating */}
      <div
        className="flex items-end gap-2 px-2 py-2"
        style={{
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px) saturate(1.5)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Botão + (anexar) */}
        <button
          onClick={() => setShowAttach((v) => !v)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity active:opacity-60"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            className="h-5 w-5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Campo de texto */}
        <div
          className="flex min-h-[40px] flex-1 items-end rounded-3xl px-4 py-2"
          style={{
            background: "rgba(255,255,255,0.13)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.22)",
            boxShadow: "inset 0 1px 1px rgba(255,255,255,0.18)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
            placeholder="Mensagem"
            rows={1}
            className="flex-1 resize-none bg-transparent text-[15px] leading-[1.45] outline-none placeholder:text-white/40"
            style={{
              maxHeight: 100,
              color: "rgba(255,255,255,0.92)",
            }}
          />
          {!input.trim() && (
            <button
              onClick={() => fileImageRef.current?.click()}
              className="ml-1 shrink-0 self-end text-xl"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              📷
            </button>
          )}
        </div>

        {/* Enviar ou Microfone */}
        {input.trim() ? (
          <button
            onClick={() => sendText()}
            disabled={loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #e05a6a, #8b5147)",
              boxShadow: "0 4px 18px rgba(220,80,90,0.5), inset 0 1px 1px rgba(255,255,255,0.3)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 translate-x-0.5">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleAudioSoon}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, #a855f7, #8b5147)",
              boxShadow: "0 4px 18px rgba(168,85,247,0.5), inset 0 1px 1px rgba(255,255,255,0.3)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 3.49-3.44 6.19-6.91 6.19S5.58 15.49 5.09 12H3.07c.53 4.21 3.98 7.5 8.16 7.94V23h2.54v-3.06C17.95 19.5 21.4 16.21 21.93 12h-2.02z" />
            </svg>
          </button>
        )}
      </div>

      {/* Inputs de arquivo ocultos */}
      <input
        ref={fileImageRef}
        type="file"
        accept="image/*"
        onChange={handleImage}
        className="hidden"
      />
    </div>
  );
}

/* ---------- Calendário do Pré-natal ---------- */

type Milestone = {
  week: number;
  type: "exam" | "consult" | "vaccine" | "milestone";
  label: string;
  detail?: string;
};

const PRENATAL_MILESTONES: Milestone[] = [
  {
    week: 6,
    type: "consult",
    label: "1ª consulta pré-natal",
    detail: "Confirmação da gestação, exames iniciais e início do ácido fólico.",
  },
  {
    week: 8,
    type: "exam",
    label: "Exames iniciais (sangue e urina)",
    detail: "Hemograma, sorologias, tipagem sanguínea, urina EAS.",
  },
  {
    week: 11,
    type: "exam",
    label: "Translucência nucal",
    detail: "Ultrassom entre 11s–13s6d + PAPP-A e beta-hCG.",
  },
  {
    week: 12,
    type: "milestone",
    label: "Fim do 1º trimestre 🎉",
    detail: "Risco de aborto reduz significativamente.",
  },
  { week: 14, type: "consult", label: "Consulta mensal" },
  { week: 16, type: "consult", label: "Consulta mensal" },
  {
    week: 18,
    type: "exam",
    label: "Ultrassom morfológico",
    detail: "Avaliação detalhada da anatomia fetal. Entre 18–22 semanas.",
  },
  {
    week: 20,
    type: "milestone",
    label: "Metade da gestação! 🌟",
    detail: "Bebê começa a ser sentido com mais frequência.",
  },
  {
    week: 24,
    type: "exam",
    label: "Curva glicêmica (TOTG)",
    detail: "Rastreio de diabetes gestacional. Jejum de 8h.",
  },
  { week: 26, type: "consult", label: "Consulta mensal" },
  { week: 26, type: "exam", label: "Hemograma e exames de rotina" },
  {
    week: 28,
    type: "milestone",
    label: "Início do 3º trimestre",
    detail: "Conte os movimentos diariamente a partir de agora.",
  },
  {
    week: 30,
    type: "consult",
    label: "Consultas quinzenais",
    detail: "A partir da 30ª semana, consultas a cada 2 semanas.",
  },
  {
    week: 32,
    type: "exam",
    label: "Ultrassom de crescimento fetal",
    detail: "Avaliação de crescimento e Doppler quando indicado.",
  },
  { week: 34, type: "consult", label: "Consulta quinzenal" },
  {
    week: 35,
    type: "exam",
    label: "Cultura Streptococcus Grupo B",
    detail: "Swab vaginal/retal entre 35–37 semanas.",
  },
  {
    week: 36,
    type: "consult",
    label: "Consultas semanais",
    detail: "A partir da 36ª semana, consultas semanais.",
  },
  {
    week: 37,
    type: "milestone",
    label: "A TERMO! Bebê pronto para nascer 🎉",
    detail: "Semana 37 marca o início do período a termo.",
  },
  {
    week: 38,
    type: "exam",
    label: "Cardiotocografia (CTG)",
    detail: "Avaliação do bem-estar fetal e planejamento do parto.",
  },
  { week: 40, type: "milestone", label: "DPP — Data Provável do Parto 👶" },
];

const TYPE_COLOR: Record<Milestone["type"], string> = {
  exam: "bg-secondary text-primary border-border",
  consult: "bg-primary/10 text-primary border-primary/20",
  vaccine: "bg-primary/10 text-primary border-primary/20",
  milestone: "bg-primary/10 text-primary border-primary/20",
};
const TYPE_LABEL: Record<Milestone["type"], string> = {
  exam: "Exame",
  consult: "Consulta",
  vaccine: "Vacina",
  milestone: "Marco",
};

function weekToDate(targetWeek: number, profile: Profile): Date | null {
  if (profile.reference_date && profile.reference_weeks != null) {
    const ref = new Date(profile.reference_date + "T00:00:00");
    const gestDaysSoFar = profile.reference_weeks * 7 + (profile.reference_days ?? 0);
    const lmpEquiv = new Date(ref.getTime() - gestDaysSoFar * 86400000);
    return new Date(lmpEquiv.getTime() + targetWeek * 7 * 86400000);
  }
  if (profile.lmp_date) {
    const lmp = new Date(profile.lmp_date + "T00:00:00");
    return new Date(lmp.getTime() + targetWeek * 7 * 86400000);
  }
  return null;
}

function toGoogleCalUrl(label: string, date: Date) {
  const ymd = ymdLocal(date).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Pré-natal: ${label}`,
    dates: `${ymd}/${ymd}`,
    details: "Acompanhamento pré-natal — Obstétrica",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function PrenatalCalendarTab({
  profile,
  gest,
  onNavigate,
}: {
  profile: Profile | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
}) {
  if (!profile || (!profile.lmp_date && !profile.reference_date)) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Configure a DUM ou os dados do ultrassom em{" "}
          <button
            type="button"
            onClick={() => onNavigate("Perfil")}
            className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
          >
            Perfil
          </button>{" "}
          para gerar o calendário personalizado.
        </p>
      </div>
    );
  }

  const currentWeek = gest?.weeks ?? 0;
  const today = new Date();

  function downloadAllIcs() {
    const events: string[] = [];
    // DTSTAMP é obrigatório no VEVENT (RFC 5545); DTEND de evento all-day é
    // EXCLUSIVO — precisa ser o dia seguinte, senão o evento tem duração zero
    // e alguns clientes o descartam.
    const dtstamp = `${ymdLocal().replace(/-/g, "")}T000000Z`;
    PRENATAL_MILESTONES.forEach((m) => {
      const d = weekToDate(m.week, profile!);
      if (!d) return;
      const ymd = ymdLocal(d).replace(/-/g, "");
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const ymdEnd = ymdLocal(next).replace(/-/g, "");
      const lines = [
        "BEGIN:VEVENT",
        `UID:prenatal-${m.week}-${m.label.slice(0, 10).replace(/\s/g, "")}@doutorclovis`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${ymd}`,
        `DTEND;VALUE=DATE:${ymdEnd}`,
        `SUMMARY:Pré-natal S${m.week}: ${m.label}`,
        m.detail ? `DESCRIPTION:${m.detail}` : "",
        "END:VEVENT",
      ].filter(Boolean);
      events.push(...lines);
    });
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Obstetrica//Prenatal Calendar//PT-BR",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "prenatal-obstetrica.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary">
            Calendário do Pré-natal
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os marcos, exames e consultas da sua gestação.
          </p>
        </div>
        <button
          onClick={downloadAllIcs}
          className="rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          ↓ Baixar .ics
        </button>
      </div>

      <div className="relative space-y-3 pl-6">
        {/* Vertical line */}
        <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />

        {PRENATAL_MILESTONES.map((m, idx) => {
          const date = weekToDate(m.week, profile);
          const isPast = date != null && date < today;
          const isCurrent =
            m.week === currentWeek ||
            (m.week === Math.ceil(currentWeek / 2) * 2 && Math.abs(m.week - currentWeek) <= 1);
          const isUpcoming =
            !isPast && date != null && date.getTime() - today.getTime() < 21 * 86400000;

          return (
            <div
              key={idx}
              className={`relative rounded-2xl border p-4 transition-all ${
                isPast
                  ? "border-border bg-card opacity-60"
                  : isUpcoming
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border bg-card"
              }`}
            >
              {/* Timeline dot */}
              <div
                className={`absolute -left-4 top-5 h-3 w-3 rounded-full border-2 ${
                  isPast
                    ? "border-border bg-background"
                    : isUpcoming
                      ? "border-primary bg-primary"
                      : "border-primary/40 bg-background"
                }`}
              />

              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLOR[m.type]}`}
                    >
                      {TYPE_LABEL[m.type]}
                    </span>
                    <span className="text-xs text-muted-foreground">Semana {m.week}</span>
                    {isPast && <span className="text-xs text-emerald-600">✓ concluído</span>}
                    {isUpcoming && !isPast && (
                      <span className="text-xs font-medium text-primary">Em breve!</span>
                    )}
                  </div>
                  <p
                    className={`mt-1 text-sm font-medium ${isPast ? "text-muted-foreground" : "text-foreground"}`}
                  >
                    {m.label}
                  </p>
                  {m.detail && <p className="mt-0.5 text-xs text-muted-foreground">{m.detail}</p>}
                  {date && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {date.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
                {date && !isPast && (
                  <a
                    href={toGoogleCalUrl(m.label, date)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full border border-primary/30 px-3 py-1 text-xs text-primary hover:bg-primary/5"
                  >
                    + Agenda
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Contrações ---------- */

type Contraction = {
  id: string;
  started_at: string;
  ended_at: string | null;
  intensity: number;
};

const INTENSITY_LABEL = ["", "Leve", "Moderada", "Forte"];
const INTENSITY_COLOR = [
  "",
  "bg-secondary text-primary",
  "bg-primary/10 text-primary",
  "bg-rose-100 text-rose-700",
];

function analyzeContractions(list: Contraction[]): {
  status: "normal" | "atencao" | "alerta" | "urgente";
  label: string;
  detail: string;
} {
  if (list.length < 2)
    return {
      status: "normal",
      label: "Monitorando",
      detail: "Registre mais contrações para análise do padrão.",
    };

  const completed = list.filter((c) => c.ended_at != null);
  if (completed.length < 2)
    return { status: "normal", label: "Monitorando", detail: "Continue registrando." };

  // Average duration (seconds)
  const avgDur =
    completed.reduce((sum, c) => {
      const dur = (new Date(c.ended_at!).getTime() - new Date(c.started_at).getTime()) / 1000;
      return sum + dur;
    }, 0) / completed.length;

  // Average interval between contractions (minutes)
  const sorted = [...list].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const interval =
      (new Date(sorted[i].started_at).getTime() - new Date(sorted[i - 1].started_at).getTime()) /
      60000;
    intervals.push(interval);
  }
  const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length;

  if (avgInterval <= 3 && avgDur >= 60)
    return {
      status: "urgente",
      label: "⚠️ Vá para a maternidade agora",
      detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — trabalho de parto avançado.`,
    };
  if (avgInterval <= 5 && avgDur >= 45)
    return {
      status: "alerta",
      label: "Trabalho de parto ativo",
      detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — ligue para o consultório.`,
    };
  if (avgInterval <= 10 && avgDur >= 30)
    return {
      status: "atencao",
      label: "Atenção — padrão irregular",
      detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — monitore de perto.`,
    };
  return {
    status: "normal",
    label: "Padrão normal",
    detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s.`,
  };
}

function ContracoesTab({ weeks }: { weeks: number | null }) {
  const [contractions, setContractions] = useState<Contraction[]>([]);
  const [active, setActive] = useState<Contraction | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [intensity, setIntensity] = useState(2);
  const startRef = useRef<number>(0);

  async function load() {
    const { data } = await (supabase as any)
      .from("contraction_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(30);
    setContractions(data ?? []);
    // Resume active contraction if exists (no ended_at)
    const open = (data ?? []).find((c: Contraction) => !c.ended_at);
    if (open) {
      setActive(open);
      startRef.current = new Date(open.started_at).getTime();
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active]);

  async function startContraction() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await (supabase as any)
      .from("contraction_logs")
      .insert({ user_id: u.user.id, intensity })
      .select()
      .single();
    if (error) {
      toast.error("Não foi possível registrar a contração. Tente novamente.");
      return;
    }
    setActive(data);
    startRef.current = Date.now();
    setElapsed(0);
    load();
  }

  async function stopContraction() {
    if (!active) return;
    const { error } = await (supabase as any)
      .from("contraction_logs")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) {
      toast.error("Não foi possível salvar a contração. Tente novamente.");
      return;
    }
    setActive(null);
    setElapsed(0);
    load();
  }

  async function clearSession() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!window.confirm("Apagar todo o histórico de contrações?")) return;
    const { error } = await (supabase as any)
      .from("contraction_logs")
      .delete()
      .eq("user_id", u.user.id);
    if (error) {
      toast.error("Não foi possível limpar o histórico. Tente novamente.");
      return;
    }
    setActive(null);
    load();
  }

  const elapsedSecs = Math.floor(elapsed / 1000);
  const elapsedMins = Math.floor(elapsedSecs / 60);
  const recentContractions = contractions.slice(0, 10);
  // Análise/banner consideram apenas contrações das últimas 2 horas,
  // para não manter alertas urgentes presos com dados antigos.
  const ANALYSIS_WINDOW_MS = 2 * 3600000;
  const analysisWindow = contractions
    .filter((c) => Date.now() - new Date(c.started_at).getTime() < ANALYSIS_WINDOW_MS)
    .slice(0, 10);
  const analysis = analyzeContractions(analysisWindow);

  const statusStyle: Record<string, string> = {
    normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
    atencao: "border-primary/20 bg-primary/6 text-foreground",
    alerta: "border-rose-200 bg-rose-50 text-rose-800",
    urgente: "border-rose-400 bg-rose-100 text-rose-900",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/6 p-4 text-sm text-foreground">
        Use este diário se sentir contrações regulares.{" "}
        <strong>Em dúvida, ligue para o consultório.</strong> Em emergência, ligue{" "}
        <strong>192 (SAMU)</strong>.
      </div>

      {/* Analysis banner */}
      {analysisWindow.length >= 2 && (
        <div className={`rounded-2xl border p-4 ${statusStyle[analysis.status]}`}>
          <p className="font-semibold">{analysis.label}</p>
          <p className="mt-0.5 text-sm">{analysis.detail}</p>
          {analysis.status === "urgente" && (
            <a
              href="tel:192"
              className="mt-3 inline-block rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white"
            >
              Ligar 192 (SAMU)
            </a>
          )}
        </div>
      )}

      {/* Main button */}
      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Cronômetro de contrações</p>

        {/* Intensity selector */}
        {!active && (
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setIntensity(i)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  intensity === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {INTENSITY_LABEL[i]}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          {active ? (
            <div>
              <button
                onClick={stopContraction}
                className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-300 active:scale-95"
                style={{
                  background: "radial-gradient(circle at 30% 25%, #fb7185, #e11d48 70%)",
                }}
              >
                <div>
                  <div className="font-serif text-4xl">
                    {String(elapsedMins).padStart(2, "0")}:
                    {String(elapsedSecs % 60).padStart(2, "0")}
                  </div>
                  <div className="text-xs uppercase tracking-widest opacity-80 mt-1">
                    Toque p/ parar
                  </div>
                </div>
              </button>
              <p className="mt-3 text-sm font-medium text-rose-600 animate-pulse">
                Contração ativa...
              </p>
            </div>
          ) : (
            <button
              onClick={startContraction}
              className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-primary-foreground shadow-xl transition-transform duration-300 active:scale-95 hover:scale-[1.03]"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--primary) 78%, white), var(--primary) 70%)",
              }}
            >
              <div>
                <div className="text-lg font-medium">Iniciar</div>
                <div className="text-xs uppercase tracking-widest opacity-80 mt-1">contração</div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* History table */}
      {recentContractions.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Últimas contrações
            </p>
            <button
              onClick={clearSession}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Limpar sessão
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {recentContractions.map((c, idx) => {
              const dur = c.ended_at
                ? Math.round(
                    (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000,
                  )
                : null;
              const interval =
                idx < recentContractions.length - 1
                  ? Math.round(
                      (new Date(c.started_at).getTime() -
                        new Date(recentContractions[idx + 1].started_at).getTime()) /
                        60000,
                    )
                  : null;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(c.started_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${INTENSITY_COLOR[c.intensity] ?? ""}`}
                  >
                    {INTENSITY_LABEL[c.intensity] ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {dur != null ? `${dur}s` : "ativa"}
                    {interval != null && ` · intervalo ${interval}min`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Pré-consulta Inteligente ---------- */

const PRE_CONSULT_SYMPTOMS = [
  "Náuseas ou vômitos",
  "Dor de cabeça",
  "Inchaço nos pés",
  "Dor lombar",
  "Sangramento",
  "Redução de movimentos",
  "Tontura",
  "Febre",
  "Dificuldade para dormir",
  "Cansaço excessivo",
];

const EMOTIONAL_OPTIONS = [
  { value: "otima", label: "Ótima 😊" },
  { value: "bem", label: "Bem 🙂" },
  { value: "ansiosa", label: "Ansiosa 😰" },
  { value: "cansada", label: "Cansada 😴" },
  { value: "triste", label: "Triste 😢" },
];

function PreConsultaTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  const [form, setForm] = useState({
    weight: "",
    systolic: "",
    diastolic: "",
    symptoms: [] as string[],
    medications: "",
    questions: "",
    emotional_state: "",
    other_notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<PreConsultaForm[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  async function loadHistory() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const forms = await getMyPreConsultas({ data: { accessToken: s.session.access_token } });
    setHistory(forms);
  }
  useEffect(() => {
    loadHistory();
  }, []);

  function toggleSymptom(s: string) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(s) ? f.symptoms.filter((x) => x !== s) : [...f.symptoms, s],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }
      const res = await submitPreConsulta({
        data: {
          accessToken: s.session.access_token,
          weeks: gest?.weeks ?? null,
          ...form,
        },
      });
      if (!res.ok) {
        toast.error("Não foi possível enviar. Tente novamente.");
        return;
      }
      setDone(true);
      loadHistory();
    } catch {
      toast.error("Não foi possível enviar. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-10 text-center">
        <p className="text-4xl">✓</p>
        <h2 className="mt-3 font-serif text-2xl text-emerald-800">Formulário enviado!</h2>
        <p className="mt-2 text-sm text-emerald-700">
          Seu médico receberá seu resumo antes da consulta. Pode chegar com tranquilidade!
        </p>
        <button
          onClick={() => {
            setDone(false);
            setForm({
              weight: "",
              systolic: "",
              diastolic: "",
              symptoms: [],
              medications: "",
              questions: "",
              emotional_state: "",
              other_notes: "",
            });
          }}
          className="mt-5 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white"
        >
          Preencher novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <strong>Para o seu médico:</strong> preencha antes de cada consulta. Seu resumo chega
        formatado para o médico — sem precisar lembrar de tudo na hora!
        {gest && (
          <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            Semana {gest.weeks}
          </span>
        )}
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Emotional state */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-serif text-lg">Como você está se sentindo?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EMOTIONAL_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, emotional_state: o.value }))}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  form.emotional_state === o.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vitals */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-serif text-lg">Medidas desta semana</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field
              label="Peso atual (kg)"
              type="number"
              value={form.weight}
              onChange={(v) => setForm((f) => ({ ...f, weight: v }))}
            />
            <Field
              label="Pressão sistólica"
              type="number"
              value={form.systolic}
              onChange={(v) => setForm((f) => ({ ...f, systolic: v }))}
            />
            <Field
              label="Pressão diastólica"
              type="number"
              value={form.diastolic}
              onChange={(v) => setForm((f) => ({ ...f, diastolic: v }))}
            />
          </div>
        </div>

        {/* Symptoms */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-serif text-lg">Sintomas desde a última consulta</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PRE_CONSULT_SYMPTOMS.map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  form.symptoms.includes(s) ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.symptoms.includes(s)}
                  onChange={() => toggleSymptom(s)}
                  className="h-4 w-4"
                />
                {s}
              </label>
            ))}
          </div>
        </div>

        {/* Open questions */}
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-serif text-lg">Medicamentos em uso</p>
          <textarea
            value={form.medications}
            onChange={(e) => setForm((f) => ({ ...f, medications: e.target.value }))}
            rows={2}
            placeholder="Ex.: Sulfato ferroso, ácido fólico, vitamina D..."
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-serif text-lg">Perguntas para o médico</p>
          <textarea
            value={form.questions}
            onChange={(e) => setForm((f) => ({ ...f, questions: e.target.value }))}
            rows={3}
            placeholder="Anote suas dúvidas aqui — elas chegam direto para o seu médico antes da consulta."
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-serif text-lg">Algo mais a relatar?</p>
          <textarea
            value={form.other_notes}
            onChange={(e) => setForm((f) => ({ ...f, other_notes: e.target.value }))}
            rows={2}
            placeholder="Algo incomum que notou, mudança no bebê, preocupação específica..."
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar para o médico"}
        </button>
      </form>

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showHistory ? "▲ Ocultar" : "▼ Ver"} formulários anteriores ({history.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-3">
              {history.map((h) => (
                <div key={h.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      Semana {h.weeks_at_submission ?? "—"} —{" "}
                      {new Date(h.submitted_at).toLocaleDateString("pt-BR")}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${h.seen_by_doctor ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}
                    >
                      {h.seen_by_doctor ? "Visualizado ✓" : "Aguardando"}
                    </span>
                  </div>
                  {h.questions && <p className="mt-2 text-muted-foreground">{h.questions}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Nutrição Tab ---------- */

const NUTRIENT_TIPS: Record<1 | 2 | 3, { nutrient: string; why: string; foods: string }[]> = {
  1: [
    {
      nutrient: "Ácido Fólico",
      why: "Previne defeitos do tubo neural",
      foods: "Feijão, lentilha, espinafre, brócolis",
    },
    {
      nutrient: "Ferro",
      why: "Suporte ao volume de sangue",
      foods: "Carne vermelha magra, feijão + vitamina C",
    },
    { nutrient: "Vitamina B6", why: "Alivia enjoo matinal", foods: "Banana, batata, frango, atum" },
    {
      nutrient: "Água",
      why: "Hidratação e redução do enjoo",
      foods: "8–10 copos/dia; água de coco, chás claros",
    },
  ],
  2: [
    {
      nutrient: "Cálcio",
      why: "Formação óssea do bebê",
      foods: "Leite, iogurte, sardinha, brócolis",
    },
    {
      nutrient: "Ômega-3",
      why: "Desenvolvimento do cérebro fetal",
      foods: "Salmão, sardinha, sementes de chia, linhaça",
    },
    {
      nutrient: "Proteína",
      why: "Crescimento muscular e placentário",
      foods: "Ovos, frango, leguminosas, queijos pasteurizados",
    },
    {
      nutrient: "Vitamina D",
      why: "Absorção de cálcio e imunidade",
      foods: "Ovos, cogumelos, exposição solar moderada",
    },
  ],
  3: [
    {
      nutrient: "Fibras",
      why: "Combate a constipação",
      foods: "Aveia, ameixa, mamão, folhas verdes",
    },
    {
      nutrient: "Magnésio",
      why: "Reduz câimbras nas pernas",
      foods: "Castanha-do-pará, banana, sementes de abóbora",
    },
    {
      nutrient: "Ferro",
      why: "Preparo para o parto",
      foods: "Fígado (cozido), feijão preto, espinafre",
    },
    {
      nutrient: "Vitamina C",
      why: "Aumenta absorção do ferro",
      foods: "Acerola, laranja, morango, kiwi",
    },
  ],
};

const NUTRITION_CHIPS: Record<1 | 2 | 3, string[]> = {
  1: [
    "Como controlar o enjoo com alimentação?",
    "Quais alimentos evitar no 1º trimestre?",
    "Posso tomar suplemento de ácido fólico junto com a alimentação?",
    "O que comer quando não tenho apetite?",
  ],
  2: [
    "Quanta proteína preciso por dia?",
    "Posso comer salmão? Qual a frequência ideal?",
    "Como garantir cálcio suficiente sem laticínios?",
    "O que comer antes e depois de uma caminhada?",
  ],
  3: [
    "Como evitar a constipação no final da gestação?",
    "Tenho muita azia — o que posso comer?",
    "Qual o melhor lanche noturno para não acordar com fome?",
    "Posso comer tâmara para preparar o parto?",
  ],
};

function NutricaoTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  const trimester = gest ? trimesterForWeek(gest.weeks) : 2;
  const tips = NUTRIENT_TIPS[trimester as 1 | 2 | 3];
  const chips = NUTRITION_CHIPS[trimester as 1 | 2 | 3];
  const firstName = profile?.display_name?.split(" ")[0];

  const greeting = [
    firstName ? `Olá, ${firstName}!` : "Olá!",
    gest ? `No ${trimester}º trimestre, vou focar nas necessidades da semana ${gest.weeks}.` : "",
    "Sou sua nutricionista gestacional virtual. Como posso ajudar com sua alimentação hoje?",
  ]
    .filter(Boolean)
    .join(" ");

  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const uiMessages = next.map((m, i) => ({
        id: String(i),
        role: m.role,
        parts: [{ type: "text", text: m.content }],
      }));
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: uiMessages }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages([...next, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        chunk.split("\n").forEach((line) => {
          if (!line.startsWith("data: ")) return;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.type === "text-delta" && json.delta) acc += json.delta;
          } catch {}
        });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Nutrient reference card */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Nutrientes em destaque — {trimester}º trimestre</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {tips.map((t) => (
            <div key={t.nutrient} className="rounded-2xl border border-border bg-secondary/40 p-3">
              <p className="text-sm font-semibold text-primary">{t.nutrient}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.why}</p>
              <p className="mt-1 text-xs">{t.foods}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div
        className="flex flex-col rounded-3xl border border-border bg-card"
        style={{ height: "55vh" }}
      >
        <div className="border-b border-border p-4">
          <p className="font-serif text-lg">Nutricionista Virtual</p>
          <p className="text-xs text-muted-foreground">
            Orientações personalizadas para sua gestação — não substitui avaliação nutricional
            individual.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
                }`}
              >
                {m.content || "..."}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion chips */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-2">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => send(c)}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-xs hover:bg-secondary/70"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 border-t border-border p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Pergunte sobre alimentação na gestação..."
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm"
          />
          <button
            onClick={() => send()}
            disabled={loading}
            className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            {loading ? "..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Consultas Tab (Feature #2 — Transcrição IA) ---------- */

type ConsultaNote = {
  id: string;
  recorded_at: string;
  title: string | null;
  raw_transcript: string | null;
  orientacoes: string | null;
  medicamentos: string | null;
  proximos_exames: string | null;
  proxima_consulta: string | null;
};

type TranscribeResult = {
  ok: boolean;
  transcript?: string;
  titulo?: string;
  orientacoes?: string[];
  medicamentos?: string[];
  proximos_exames?: string[];
  proxima_consulta?: string | null;
  error?: string;
};

/* Rótulo/estilo por status da consulta — o mesmo vocabulário do painel. */
const APPT_STATUS_UI: Record<
  MyAppointment["status"],
  { label: string; cls: string; emoji: string }
> = {
  confirmed: { label: "Confirmada", cls: "bg-emerald-100 text-emerald-700", emoji: "✅" },
  pending: { label: "Aguardando confirmação", cls: "bg-amber-100 text-amber-700", emoji: "⏳" },
  done: { label: "Realizada", cls: "bg-slate-100 text-slate-500", emoji: "✔️" },
  cancelled: { label: "Não confirmada", cls: "bg-rose-100 text-rose-600", emoji: "✖️" },
};

function formatApptDate(ymd: string): string {
  const s = new Date(ymd + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  // Só a primeira letra maiúscula ("Sexta-feira, 17 de julho") — a classe
  // capitalize deixaria cada palavra maiúscula ("17 De Julho").
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ConsultasTab() {
  const [appts, setAppts] = useState<MyAppointment[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<ConsultaNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [activeNoteTab, setActiveNoteTab] = useState<
    "transcript" | "orientacoes" | "medicamentos" | "exames"
  >("transcript");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>("audio/webm");

  useEffect(() => {
    loadNotes();
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return;
        const res = await getMyAppointments({ data: { accessToken: s.session.access_token } });
        if (res.ok) setAppts(res.appointments);
      } finally {
        setLoadingAppts(false);
      }
    })();
  }, []);

  async function loadNotes() {
    setLoadingNotes(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await (supabase as any)
        .from("consultation_notes")
        .select("*")
        .eq("user_id", u.user.id)
        .order("recorded_at", { ascending: false });
      setNotes(data ?? []);
    } finally {
      setLoadingNotes(false);
    }
  }

  async function startRecording() {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/mp4", "audio/webm"].find(
        (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t),
      );
      const mr = preferred
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      mimeRef.current = (mr.mimeType || preferred || "audio/webm").split(";")[0];
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      const mediaStream = stream;
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        mediaStream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setResult(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setSavedMsg(null);
    } catch (err) {
      stream?.getTracks().forEach((t) => t.stop());
      alert(
        err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError")
          ? "Não foi possível acessar o microfone. Verifique as permissões do navegador."
          : "Seu navegador não suporta gravação de áudio. Tente atualizar o navegador.",
      );
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function transcribe() {
    if (!audioBlob) return;
    setTranscribing(true);
    setResult(null);
    try {
      const fd = new FormData();
      const ext = audioBlob.type.includes("mp4")
        ? "m4a"
        : audioBlob.type.includes("ogg")
          ? "ogg"
          : "webm";
      fd.append("audio", audioBlob, `consulta.${ext}`);
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const json: TranscribeResult = await res.json();
      setResult(json);
    } catch {
      setResult({ ok: false, error: "Falha ao transcrever. Tente novamente." });
    } finally {
      setTranscribing(false);
    }
  }

  async function saveNote() {
    if (!result?.ok) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setSavedMsg("Sua sessão expirou. Faça login novamente.");
        return;
      }
      const { error } = await (supabase as any).from("consultation_notes").insert({
        user_id: u.user.id,
        title: result.titulo ?? "Consulta",
        raw_transcript: result.transcript ?? null,
        orientacoes: result.orientacoes?.join("\n") ?? null,
        medicamentos: result.medicamentos?.join("\n") ?? null,
        proximos_exames: result.proximos_exames?.join("\n") ?? null,
        proxima_consulta: result.proxima_consulta ?? null,
      });
      if (error) {
        setSavedMsg("Erro ao salvar: " + error.message);
      } else {
        setSavedMsg("Nota salva com sucesso ✓");
        setResult(null);
        setAudioBlob(null);
        setAudioUrl(null);
        loadNotes();
      }
    } finally {
      setSaving(false);
    }
  }

  // Ordenação: confirmadas futuras primeiro (mais próxima no topo), depois
  // pendentes, depois histórico (realizadas/não confirmadas) mais recente antes.
  const today = ymdLocal();
  const upcoming = appts
    .filter((a) => a.status === "confirmed" && (a.confirmed_date ?? "") >= today)
    .sort((a, b) =>
      (a.confirmed_date! + (a.confirmed_time ?? "")).localeCompare(
        b.confirmed_date! + (b.confirmed_time ?? ""),
      ),
    );
  const pending = appts
    .filter((a) => a.status === "pending")
    .sort((a, b) => a.preferred_date.localeCompare(b.preferred_date));
  const history = appts
    .filter(
      (a) =>
        a.status === "done" ||
        a.status === "cancelled" ||
        (a.status === "confirmed" && (a.confirmed_date ?? "") < today),
    )
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* ── Minhas consultas: o ciclo médico→paciente fecha AQUI ────── */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-lg">Minhas consultas</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Acompanhe o status dos seus agendamentos.
            </p>
          </div>
          <a
            href="/agendamento"
            className="press rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Agendar nova consulta
          </a>
        </div>

        {loadingAppts ? (
          <div className="mt-4 space-y-2">
            <div className="skeleton h-16 rounded-2xl" />
            <div className="skeleton h-16 rounded-2xl" />
          </div>
        ) : appts.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-secondary/50 p-5 text-center">
            <p className="text-2xl">🗓️</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Você ainda não tem consultas por aqui. Agende a primeira — leva 1 minuto.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Use o mesmo e-mail da sua conta para o agendamento aparecer aqui.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {upcoming.map((a, i) => (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 ${
                  i === 0 ? "border-emerald-300 bg-emerald-50/60" : "border-border bg-background"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${APPT_STATUS_UI.confirmed.cls}`}
                  >
                    {APPT_STATUS_UI.confirmed.emoji} {i === 0 ? "Próxima consulta" : "Confirmada"}
                  </span>
                  {a.price_brl != null && (
                    <span className="text-xs text-muted-foreground">
                      R$ {(a.price_brl / 100).toFixed(2)}
                      {a.payment_status === "pago" ? " · pago ✓" : ""}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {formatApptDate(a.confirmed_date!)} · {a.confirmed_time}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
              </div>
            ))}
            {pending.map((a) => (
              <div key={a.id} className="rounded-2xl border border-border bg-background p-4">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${APPT_STATUS_UI.pending.cls}`}
                >
                  {APPT_STATUS_UI.pending.emoji} {APPT_STATUS_UI.pending.label}
                </span>
                <p className="mt-2 text-sm">
                  Você pediu {formatApptDate(a.preferred_date)} · {a.preferred_time}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.reason} — o consultório confirma em até 1 dia útil.
                </p>
              </div>
            ))}
            {history.length > 0 && (
              <details className="pt-1">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-primary">
                  Histórico ({history.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {history.map((a) => {
                    const ui = APPT_STATUS_UI[a.status === "confirmed" ? "done" : a.status];
                    return (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-border/60 bg-background/60 p-3 opacity-80"
                      >
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ui.cls}`}
                        >
                          {ui.emoji} {ui.label}
                        </span>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {new Date(
                            (a.confirmed_date ?? a.preferred_date) + "T00:00:00",
                          ).toLocaleDateString("pt-BR")}{" "}
                          · {a.confirmed_time ?? a.preferred_time} — {a.reason}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Recording card */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Gravar consulta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Grave o áudio da consulta e a IA extrai orientações, medicamentos e exames
          automaticamente.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!recording && (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 rounded-full bg-rose-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-rose-600"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
              Iniciar gravação
            </button>
          )}
          {recording && (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-full border-2 border-rose-500 px-6 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
              Parar gravação
            </button>
          )}
          {recording && (
            <span className="flex items-center gap-1.5 text-sm text-rose-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              Gravando...
            </span>
          )}
        </div>

        {audioUrl && (
          <div className="mt-4 space-y-3">
            <audio controls src={audioUrl} className="w-full" />
            <button
              onClick={transcribe}
              disabled={transcribing}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {transcribing ? "Transcrevendo..." : "Transcrever com IA"}
            </button>
          </div>
        )}
      </div>

      {/* Result card */}
      {result && (
        <div className="rounded-3xl border border-border bg-card p-6">
          {result.error ? (
            <p className="text-sm text-destructive">{result.error}</p>
          ) : (
            <>
              <p className="font-serif text-lg">{result.titulo ?? "Consulta transcrita"}</p>

              {/* Sub-tabs */}
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {(["transcript", "orientacoes", "medicamentos", "exames"] as const).map((tab) => {
                  const labels: Record<typeof tab, string> = {
                    transcript: "Transcrição",
                    orientacoes: "Orientações",
                    medicamentos: "Medicamentos",
                    exames: "Exames",
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveNoteTab(tab)}
                      className={`rounded-full px-4 py-1 text-xs font-medium transition-colors ${
                        activeNoteTab === tab
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl bg-secondary/40 p-4 text-sm">
                {activeNoteTab === "transcript" && (
                  <p className="whitespace-pre-wrap">{result.transcript || "Sem transcrição."}</p>
                )}
                {activeNoteTab === "orientacoes" &&
                  (result.orientacoes?.length ? (
                    <ul className="space-y-1.5">
                      {result.orientacoes.map((o, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 text-primary">•</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Nenhuma orientação identificada.</p>
                  ))}
                {activeNoteTab === "medicamentos" &&
                  (result.medicamentos?.length ? (
                    <ul className="space-y-1.5">
                      {result.medicamentos.map((m, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 text-primary">💊</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">Nenhum medicamento mencionado.</p>
                  ))}
                {activeNoteTab === "exames" && (
                  <>
                    {result.proximos_exames?.length ? (
                      <ul className="space-y-1.5">
                        {result.proximos_exames.map((e, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-0.5 text-primary">🔬</span>
                            {e}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">Nenhum exame solicitado.</p>
                    )}
                    {result.proxima_consulta && (
                      <p className="mt-3 rounded-lg border border-border bg-background p-2 text-xs">
                        📅 Próxima consulta: {result.proxima_consulta}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={saveNote}
                  disabled={saving}
                  className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar nota"}
                </button>
                {savedMsg && <p className="text-sm text-primary">{savedMsg}</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* History */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Histórico de consultas</p>
        {loadingNotes ? (
          <div className="mt-4 space-y-2">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
        ) : notes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma consulta salva ainda.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {notes.map((n) => (
              <details key={n.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{n.title ?? "Consulta"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.recorded_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </summary>
                <div className="mt-3 space-y-2 text-sm">
                  {n.orientacoes && (
                    <div>
                      <p className="font-medium text-primary">Orientações</p>
                      <p className="whitespace-pre-line text-muted-foreground">{n.orientacoes}</p>
                    </div>
                  )}
                  {n.medicamentos && (
                    <div>
                      <p className="font-medium text-primary">Medicamentos</p>
                      <p className="whitespace-pre-line text-muted-foreground">{n.medicamentos}</p>
                    </div>
                  )}
                  {n.proximos_exames && (
                    <div>
                      <p className="font-medium text-primary">Exames</p>
                      <p className="whitespace-pre-line text-muted-foreground">
                        {n.proximos_exames}
                      </p>
                    </div>
                  )}
                  {n.proxima_consulta && (
                    <p className="text-xs text-muted-foreground">
                      Próxima consulta: {n.proxima_consulta}
                    </p>
                  )}
                  {n.raw_transcript && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">
                        Ver transcrição completa
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-background p-3 text-xs">
                        {n.raw_transcript}
                      </p>
                    </details>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Linha do Tempo (Feature #12) ---------- */

type TimelineEvent = {
  id: string;
  date: string;
  type: "saude" | "diario" | "consulta" | "chutes" | "preconsulta" | "marco";
  title: string;
  detail?: string;
  badge?: string;
};

const EV_STYLE: Record<TimelineEvent["type"], { dot: string; badge: string }> = {
  saude: { dot: "bg-primary/50", badge: "bg-primary/10 text-primary" },
  diario: { dot: "bg-primary/60", badge: "bg-primary/10 text-primary" },
  consulta: { dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
  chutes: { dot: "bg-primary", badge: "bg-primary/10 text-primary" },
  preconsulta: { dot: "bg-rose-400", badge: "bg-rose-100 text-rose-700" },
  marco: { dot: "bg-primary", badge: "bg-primary/10 text-primary" },
};

const EV_LABEL: Record<TimelineEvent["type"], string> = {
  saude: "Saúde",
  diario: "Diário",
  consulta: "Consulta",
  chutes: "Chutes",
  preconsulta: "Pré-consulta",
  marco: "Marco",
};

function TimelineTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimelineEvent["type"] | "todos">("todos");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sua sessão expirou — entre novamente.");
        return;
      }
      await loadEvents(u.user.id);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents(userId: string) {
    const [logsRes, journalRes, consultRes, kicksRes, preRes] = await Promise.all([
      (supabase as any)
        .from("health_logs")
        .select("id, log_date, weight_kg, systolic, diastolic")
        .eq("user_id", userId)
        .order("log_date", { ascending: false }),
      (supabase as any)
        .from("journal_entries")
        .select("id, entry_date, mood, content")
        .eq("user_id", userId)
        .order("entry_date", { ascending: false }),
      (supabase as any)
        .from("consultation_notes")
        .select("id, recorded_at, title, orientacoes")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false }),
      (supabase as any)
        .from("kick_sessions")
        .select("id, started_at, kick_count")
        .eq("user_id", userId)
        .not("ended_at", "is", null)
        .order("started_at", { ascending: false }),
      (supabase as any)
        .from("preconsulta_forms")
        .select("id, submitted_at, weeks_at_submission, emotional_state")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: false }),
    ]);

    const all: TimelineEvent[] = [];

    for (const r of logsRes.data ?? []) {
      const parts = [];
      if (r.weight_kg) parts.push(`Peso: ${r.weight_kg} kg`);
      if (r.systolic && r.diastolic) parts.push(`PA: ${r.systolic}/${r.diastolic}`);
      all.push({
        id: r.id,
        date: r.log_date,
        type: "saude",
        title: "Registro de saúde",
        detail: parts.join(" · ") || undefined,
      });
    }
    for (const r of journalRes.data ?? []) {
      all.push({
        id: r.id,
        date: r.entry_date,
        type: "diario",
        title: `Diário ${r.mood ?? ""}`.trim(),
        detail: r.content?.slice(0, 100) + (r.content?.length > 100 ? "..." : ""),
      });
    }
    for (const r of consultRes.data ?? []) {
      all.push({
        id: r.id,
        date: r.recorded_at?.slice(0, 10),
        type: "consulta",
        title: r.title ?? "Consulta",
        detail: r.orientacoes?.split("\n")?.[0],
      });
    }
    for (const r of kicksRes.data ?? []) {
      all.push({
        id: r.id,
        date: r.started_at?.slice(0, 10),
        type: "chutes",
        title: `${r.kick_count ?? 0} chutes registrados`,
      });
    }
    for (const r of preRes.data ?? []) {
      all.push({
        id: r.id,
        date: r.submitted_at?.slice(0, 10),
        type: "preconsulta",
        title: `Pré-consulta — semana ${r.weeks_at_submission ?? "?"}`,
        detail: r.emotional_state ? `Humor: ${r.emotional_state}` : undefined,
      });
    }

    // Marcos gestacionais já alcançados entram como eventos na linha do tempo
    if (gest && profile) {
      for (const m of PRENATAL_MILESTONES) {
        if (m.week > gest.weeks) continue;
        const d = weekToDate(m.week, profile);
        if (!d) continue;
        all.push({
          id: `milestone-${m.week}-${m.label}`,
          date: ymdLocal(d),
          type: "consulta",
          title: `📌 ${m.label} (semana ${m.week})`,
          detail: m.detail,
        });
      }
    }

    const failed = [logsRes, journalRes, consultRes, kicksRes, preRes].filter(
      (r) => r.error,
    ).length;
    if (failed > 0) {
      toast.error(`Alguns registros não puderam ser carregados (${failed} de 5 fontes).`);
    }

    all.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    setEvents(all);
  }

  const filtered = filter === "todos" ? events : events.filter((e) => e.type === filter);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Sua jornada pré-natal</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os seus registros numa linha do tempo cronológica.
        </p>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(["todos", "saude", "diario", "consulta", "chutes", "preconsulta"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f === "todos" ? "Todos" : EV_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-serif text-xl text-foreground/70">Nenhum registro ainda</p>
          <p className="mt-2 text-sm text-muted-foreground">Comece usando as outras abas!</p>
        </div>
      ) : (
        <div className="relative ml-4">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 h-full w-px bg-border" />

          <div className="space-y-4">
            {filtered.map((ev) => {
              const s = EV_STYLE[ev.type];
              return (
                <div key={ev.id} className="relative flex gap-4 pl-10">
                  {/* Dot */}
                  <div
                    className={`absolute left-0 top-4 h-6 w-6 rounded-full border-2 border-background ${s.dot} flex items-center justify-center`}
                  />

                  <div className="flex-1 rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{ev.title}</p>
                        {ev.detail && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{ev.detail}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>
                          {EV_LABEL[ev.type]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {ev.date
                            ? new Date(ev.date + "T00:00:00").toLocaleDateString("pt-BR")
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Humor (Feature #18) ---------- */

const MOOD_VALUE: Record<string, number> = {
  "🥰": 5,
  "😊": 4,
  "😴": 3,
  "🤢": 2,
  "😢": 1,
  "😰": 1,
};

const MOOD_LABEL: Record<string, string> = {
  "🥰": "Muito bem",
  "😊": "Bem",
  "😴": "Cansada",
  "🤢": "Mal-estar",
  "😢": "Triste",
  "😰": "Ansiosa",
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MOOD_SUGGESTIONS: Record<number, string[]> = {
  5: [
    "Que semana maravilhosa! Anote o que trouxe tanta alegria para se lembrar depois.",
    "Compartilhe sua energia com quem você ama.",
  ],
  4: [
    "Você está indo muito bem! Uma caminhada leve pode ampliar ainda mais essa sensação.",
    "Pratique gratidão escrevendo 3 coisas boas do dia.",
  ],
  3: [
    "O cansaço é parte normal da gestação. Descanse sem culpa e peça ajuda quando precisar.",
    "Hidrate-se bem e tente dormir mais cedo esta semana.",
  ],
  2: [
    "Dias difíceis passam. Gentileza consigo mesma é o melhor remédio.",
    "Gengibre, torradas secas e pequenas refeições frequentes podem ajudar no mal-estar.",
  ],
  1: [
    "Seus sentimentos são válidos. Se a tristeza ou ansiedade persistir, conversar com o seu médico pode ajudar.",
    "Técnicas de respiração profunda e meditação guiada (aba Meditações) podem aliviar a ansiedade.",
  ],
};

function HumorTab() {
  const [entries, setEntries] = useState<{ entry_date: string; mood: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("journal_entries")
        .select("entry_date, mood")
        .order("entry_date", { ascending: false })
        .limit(180);
      setEntries(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <TabSkeleton />;

  if (entries.length === 0)
    return (
      <div className="py-14 text-center">
        <p className="text-4xl mb-3">💛</p>
        <p className="font-serif text-xl text-foreground/70">Nenhum registro ainda</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use a aba <strong>Diário</strong> para registrar seu humor diariamente.
        </p>
      </div>
    );

  // Last 8 weeks of data for chart
  const today = new Date();
  const weeks: { label: string; avg: number | null }[] = [];
  for (let w = 7; w >= 0; w--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
    const inWeek = entries.filter((e) => {
      const d = new Date(e.entry_date + "T00:00:00");
      return d >= weekStart && d <= weekEnd;
    });
    const vals = inWeek.map((e) => MOOD_VALUE[e.mood ?? ""] ?? 3).filter(Boolean);
    weeks.push({ label, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null });
  }

  // Day-of-week averages
  const dayMap: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  entries.forEach((e) => {
    const d = new Date(e.entry_date + "T00:00:00");
    const v = MOOD_VALUE[e.mood ?? ""];
    if (v) dayMap[d.getDay()].push(v);
  });
  const dayAvg = Array.from({ length: 7 }, (_, i) => {
    const vals = dayMap[i];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  // Overall trend
  const recent = entries.slice(0, 14);
  const recentAvg = recent.map((e) => MOOD_VALUE[e.mood ?? ""] ?? 3);
  const overallAvg = recentAvg.length
    ? Math.round(recentAvg.reduce((a, b) => a + b, 0) / recentAvg.length)
    : 3;
  const suggestions = MOOD_SUGGESTIONS[Math.min(5, Math.max(1, overallAvg))] ?? MOOD_SUGGESTIONS[3];

  const bestDay = dayAvg.reduce<number>(
    (best, v, i) => (v !== null && (best === -1 || v > (dayAvg[best] ?? 0)) ? i : best),
    -1,
  );
  const hardDay = dayAvg.reduce<number>(
    (hard, v, i) => (v !== null && (hard === -1 || v < (dayAvg[hard] ?? 6)) ? i : hard),
    -1,
  );

  // SVG chart dimensions
  const W = 340,
    H = 100,
    pad = 10;
  const chartW = W - pad * 2;
  const chartH = H - pad * 2;
  const points = weeks.map((w, i) => ({
    x: pad + (i / (weeks.length - 1)) * chartW,
    y: w.avg !== null ? pad + chartH - ((w.avg - 1) / 4) * chartH : null,
    avg: w.avg,
    label: w.label,
  }));
  const polyline = points
    .filter((p) => p.y !== null)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  // Mood frequency
  const moodCount: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.mood) moodCount[e.mood] = (moodCount[e.mood] ?? 0) + 1;
  });
  const topMoods = Object.entries(moodCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Resumo dos últimos 14 dias</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-secondary/50 p-3 text-center">
            <p className="text-2xl">
              {Object.entries(MOOD_VALUE).find(([, v]) => v === Math.round(overallAvg))?.[0] ??
                "😊"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Humor médio</p>
          </div>
          <div className="rounded-2xl bg-secondary/50 p-3 text-center">
            <p className="text-lg font-bold text-primary">{entries.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Registros totais</p>
          </div>
          {bestDay >= 0 && (
            <div className="rounded-2xl bg-emerald-50 p-3 text-center">
              <p className="text-lg font-bold text-emerald-600">{DAY_NAMES[bestDay]}</p>
              <p className="mt-1 text-xs text-muted-foreground">Melhor dia da semana</p>
            </div>
          )}
          {hardDay >= 0 && hardDay !== bestDay && (
            <div className="rounded-2xl bg-primary/6 p-3 text-center">
              <p className="text-lg font-bold text-primary">{DAY_NAMES[hardDay]}</p>
              <p className="mt-1 text-xs text-muted-foreground">Dia mais difícil</p>
            </div>
          )}
        </div>
      </div>

      {/* Weekly mood chart */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Humor por semana</p>
        <p className="text-xs text-muted-foreground mt-1">
          Média semanal das últimas 8 semanas (1=muito ruim · 5=ótimo)
        </p>
        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full max-w-sm">
            {/* Grid lines */}
            {[1, 2, 3, 4, 5].map((v) => {
              const y = pad + chartH - ((v - 1) / 4) * chartH;
              return (
                <line
                  key={v}
                  x1={pad}
                  y1={y}
                  x2={W - pad}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  strokeWidth={1}
                />
              );
            })}
            {/* Polyline */}
            {polyline && (
              <polyline
                points={polyline}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeLinejoin="round"
              />
            )}
            {/* Data points */}
            {points.map(
              (p, i) =>
                p.y !== null && (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y!} r={4} fill="var(--primary)" />
                    <text
                      x={p.x}
                      y={H + 18}
                      textAnchor="middle"
                      fontSize={8}
                      fill="currentColor"
                      opacity={0.5}
                    >
                      {p.label}
                    </text>
                  </g>
                ),
            )}
          </svg>
        </div>
      </div>

      {/* Day of week heatmap */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Padrão por dia da semana</p>
        <div className="mt-4 flex gap-2">
          {DAY_NAMES.map((name, i) => {
            const avg = dayAvg[i];
            const val = avg !== null ? Math.round(avg) : null;
            const colors = [
              "",
              "bg-rose-200",
              "bg-orange-200",
              "bg-amber-100",
              "bg-emerald-100",
              "bg-emerald-300",
            ];
            return (
              <div key={name} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={`h-10 w-full rounded-lg ${val !== null ? colors[val] : "bg-secondary"} flex items-center justify-center`}
                >
                  {val !== null ? (
                    <span className="text-lg">
                      {Object.entries(MOOD_VALUE).find(([, v]) => v === val)?.[0] ?? "😐"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{name}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top moods */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Seus humores mais frequentes</p>
        <div className="mt-4 space-y-2">
          {topMoods.map(([emoji, count]) => (
            <div key={emoji} className="flex items-center gap-3">
              <span className="text-2xl">{emoji}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{MOOD_LABEL[emoji] ?? emoji}</span>
                  <span className="text-muted-foreground">{count}×</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((count / entries.length) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Personalized suggestions */}
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
        <p className="font-serif text-lg">Sugestões personalizadas</p>
        <ul className="mt-3 space-y-2">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-primary">✦</span>
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Meditações Guiadas (Feature #17) ---------- */

type Meditation = {
  id: string;
  title: string;
  duration: string;
  topic: string;
  trimester: 1 | 2 | 3 | 0;
  script: string;
};

const MEDITATIONS: Meditation[] = [
  {
    id: "nausea",
    title: "Alívio das náuseas",
    duration: "5 min",
    topic: "Bem-estar físico",
    trimester: 1,
    script: `Encontre uma posição confortável, de preferência sentada com as costas apoiadas. Feche os olhos suavemente. Comece a respirar fundo pelo nariz, devagar. Inspire... e expire... Inspire contando até quatro... e expire contando até seis... Sinta seu corpo relaxar a cada expiração. Agora visualize uma cor calmante — pode ser azul suave, verde menta, ou qualquer cor que traga paz para você. Imagine essa cor preenchendo seu corpo de cima para baixo, como uma luz gentil. Enquanto respira, sinta sua digestão se acalmando. Seu corpo é sábio. Ele cuida de você e do seu bebê a cada momento. A náusea é um sinal de que sua gestação está saudável — mas agora você escolhe dar ao seu corpo um momento de descanso. Continue respirando devagar... Inspire pelo nariz... Expire pela boca, soltando a tensão... Visualize sua barriga se aquecendo com uma luz dourada e protetora. Você e seu bebê estão seguros e bem. Permaneça nesse estado de quietude por mais alguns instantes. Quando estiver pronta, abra os olhos lentamente.`,
  },
  {
    id: "ansiedade-inicial",
    title: "Acalmando a ansiedade",
    duration: "6 min",
    topic: "Saúde mental",
    trimester: 1,
    script: `Sente-se ou deite-se confortavelmente. Feche os olhos. Coloque uma mão sobre o coração e a outra sobre a barriga. Respire fundo... Sinta o movimento suave das suas mãos. Você está aqui. Você está presente. Comece a respiração em quatro tempos: inspire pelo nariz enquanto conta 1... 2... 3... 4... Segure suavemente: 1... 2... 3... 4... Expire pela boca: 1... 2... 3... 4... 5... 6... Repita esse ciclo mais três vezes. Enquanto você respira, reconheça que a ansiedade é uma forma de amor — é seu corpo tentando proteger você e seu bebê. Mas você é capaz. As gerações de mulheres que vieram antes de você carregaram seus filhos com amor e saíram fortes pelo outro lado. Você também vai. Visualize um lugar seguro — pode ser uma praia, um jardim, o sofá da sua casa. Esteja completamente nesse lugar. Sinta a textura, ouça os sons, perceba o cheiro. Você está segura. Seu bebê está seguro. Continue respirando... Lentamente, devagar. Permita que essa sensação de calma se espalhe por todo o seu corpo. Quando estiver pronta, abra os olhos, piscando devagar.`,
  },
  {
    id: "conexao-bebe",
    title: "Conexão com o bebê",
    duration: "7 min",
    topic: "Vínculo materno",
    trimester: 2,
    script: `Deite-se de lado, com um travesseiro entre os joelhos, na posição mais confortável possível. Feche os olhos. Coloque as duas mãos sobre a barriga com carinho. Respire fundo e, na expiração, imagine que seu amor vai diretamente para o seu bebê — como uma onda de calor que o envolve. Neste momento, pense no nome que você escolheu, ou simplesmente pense: meu bebê. Seu bebê já te ouve. Já sente a temperatura da sua voz. Sente seus movimentos. Diga baixinho — ou apenas pense: Eu te amo. Estou aqui com você. Você é muito esperado. Visualize seu bebê quentinho e confortável dentro de você. Pequeno, mas completo. Perfeito a cada dia. Sinta os batimentos do seu próprio coração... e imagine o coraçãozinho do seu bebê batendo no mesmo ritmo. Dois corações. Uma só história. Permaneça nessa conexão por quantos momentos quiser. Não existe pressa. Você tem tudo que seu bebê precisa agora mesmo. Quando estiver pronta, agradeça ao seu corpo por este momento. Abra os olhos com calma.`,
  },
  {
    id: "dor-lombar",
    title: "Relaxamento para dor lombar",
    duration: "8 min",
    topic: "Bem-estar físico",
    trimester: 2,
    script: `Deite-se de costas em uma superfície firme, com os joelhos dobrados e os pés apoiados no chão. Se preferir, coloque um travesseiro embaixo dos joelhos. Feche os olhos. Respire fundo, lentamente. Na inspiração, sinta seu pulmão expandir. Na expiração, sinta seu corpo afundar na superfície, mais pesado, mais relaxado. Comece pelo topo da cabeça. Solte a tensão da testa. Relaxe as sobrancelhas, os olhos, as bochechas, a mandíbula. Desça pelo pescoço... pelos ombros... Sinta os ombros afundarem gentilmente. Agora concentre sua atenção na lombar — a parte baixa das costas. A cada expiração, imagine que a tensão nessa área vai se dissolvendo como açúcar na água. Inspire... expire... Visualize uma luz quente e relaxante envolvendo sua coluna, do sacro até os ombros. Quente, suave, aliviante. Seu corpo carrega um precioso presente. É natural sentir desconforto, mas agora você escolhe dar a ele descanso. Permaneça nessa leveza. Continue respirando. Sinta a gravidade trabalhar por você, liberando peso. Quando quiser, flexione os pés, vire para o lado, e levante-se com cuidado.`,
  },
  {
    id: "insonia",
    title: "Para dormir melhor",
    duration: "10 min",
    topic: "Sono",
    trimester: 3,
    script: `Este exercício é para ser feito na cama, na hora de dormir. Deite-se na posição que for mais confortável. Feche os olhos. Deixe o corpo relaxar completamente. Não há mais nada a fazer hoje. Você cuidou de tudo que precisava. Agora é o tempo do descanso. Comece relaxando os pés. Solte os dedos... os arcos plantares... os calcanhares... Suba pelos tornozelos, panturrilhas, joelhos. Sinta as pernas ficarem pesadas e quentes. Continue pelo quadril... pela barriga... Agradeça ao seu bebê por este dia de companhia. Relaxe o peito... os ombros... os braços... as mãos. Solte os dedos das mãos. Sinta-os formigando de relaxamento. Pelo pescoço... pelo rosto inteiro... Respire lento, ritmado. Inspire... quatro tempos... Expire... seis tempos... Imagine que você está flutuando em uma água morna e tranquila. Não há esforço. Só flutuação. A cada onda de pensamento, deixe passar sem segurar. Pensamento? Deixa ir. Preocupação? Amanhã você resolve. Agora só existe o presente momento. Você... seu bebê... este quarto... esta cama... Continuando a respiração lenta e ritmada... Cada expiração te leva mais fundo para o descanso... Mais fundo... Mais tranquila... Permita que o sono venha naturalmente.`,
  },
  {
    id: "preparo-parto",
    title: "Preparando-se para o parto",
    duration: "9 min",
    topic: "Preparo emocional",
    trimester: 3,
    script: `Sente-se confortavelmente, com as costas apoiadas e as mãos sobre a barriga. Feche os olhos. Respire fundo... Inspire... e expire... Você está se aproximando de um dos momentos mais poderosos da sua vida. E você está pronta. Nem todo o preparo vem de livros ou cursos — parte dele já está dentro de você, inscrita na sua biologia, no instinto milenar de cada mãe que já existiu antes de você. Comece visualizando o dia do parto como você gostaria que fosse: você está calm, rodeada de pessoas que te apoiam. A cada contração, você respira fundo. A dor é sua aliada — ela te aproxima do seu bebê. Visualize você mesma forte, presente, capaz. Agora pense no momento em que você verá seu bebê pela primeira vez. O peso nos seus braços. O cheiro. Os olhinhos tentando te enxergar. Este momento está se aproximando. E você está mais do que pronta para ele. Respire... Inspire força... Expire medo... Inspire confiança... Expire tensão... Continue por alguns ciclos, no seu ritmo. Lembre: cada contração te traz mais perto. Cada respiração é suporte para o seu bebê. Você foi feita para isso. Quando estiver pronta, abra os olhos com gratidão.`,
  },
  {
    id: "gratidao",
    title: "Gratidão gestacional",
    duration: "6 min",
    topic: "Bem-estar mental",
    trimester: 0,
    script: `Encontre uma posição confortável. Feche os olhos. Coloque as mãos sobre o coração. Comece respirando lentamente. Inspire... e expire... Neste momento, pense em três coisas pelas quais você é grata hoje. Podem ser pequenas: o sol entrando pela janela, uma mensagem de alguém que você ama, um momento de quietude. Sinta essa gratidão no peito — como um calor agradável que se expande. Agora pense no seu bebê. Ele está aí, crescendo, se desenvolvendo, se preparando para te conhecer. Que milagre silencioso acontece dentro de você a cada momento. Agradeça ao seu corpo pelo trabalho incansável que realiza. Agradeça ao seu coração, aos seus pulmões, aos seus rins, à sua placenta. Tudo funciona em harmonia para proteger a vida que você carrega. Você não precisa fazer tudo perfeito. Você só precisa estar presente. E você está. Respire essa gratidão... Deixe ela preencher cada célula. Quando estiver pronta, abra os olhos com um sorriso gentil.`,
  },
];

const TOPICS = [...new Set(MEDITATIONS.map((m) => m.topic))];

function MeditacoesTab({ gest }: { gest: Gest }) {
  const currentTrimester = gest ? trimesterForWeek(gest.weeks) : null;
  const [selected, setSelected] = useState<Meditation | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(0.9);
  const [topicFilter, setTopicFilter] = useState<string>("todos");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale" | null>(null);
  const breathRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startBreathing() {
    // 4-4-6: cada fase reagenda a próxima com a duração correta (setInterval fixaria 4s para tudo)
    const durations = { inhale: 4000, hold: 4000, exhale: 6000 };
    const nextOf = { inhale: "hold", hold: "exhale", exhale: "inhale" } as const;
    function tick(phase: "inhale" | "hold" | "exhale") {
      setBreathPhase(phase);
      breathRef.current = setTimeout(() => tick(nextOf[phase]), durations[phase]);
    }
    tick("inhale");
  }

  function stopBreathing() {
    if (breathRef.current) clearTimeout(breathRef.current);
    setBreathPhase(null);
  }

  function speak(med: Meditation) {
    if (!("speechSynthesis" in window)) {
      alert(
        "Seu navegador não suporta síntese de voz. Use Chrome ou Edge para a melhor experiência.",
      );
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(med.script);
    utter.lang = "pt-BR";
    utter.rate = rate;
    utter.pitch = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find((v) => v.lang.startsWith("pt")) || null;
    if (ptVoice) utter.voice = ptVoice;
    utter.onend = () => {
      setPlaying(false);
      stopBreathing();
    };
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setPlaying(true);
    startBreathing();
  }

  function togglePlay() {
    if (!selected) return;
    if (playing) {
      window.speechSynthesis.pause();
      setPlaying(false);
      stopBreathing();
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPlaying(true);
      startBreathing();
    } else {
      speak(selected);
    }
  }

  function stop() {
    window.speechSynthesis.cancel();
    setPlaying(false);
    stopBreathing();
  }

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (breathRef.current) clearTimeout(breathRef.current);
    };
  }, []);

  const filtered = MEDITATIONS.filter((m) => {
    const matchesTopic = topicFilter === "todos" || m.topic === topicFilter;
    return matchesTopic;
  });

  const breathLabel = { inhale: "Inspire...", hold: "Segure...", exhale: "Expire..." };
  const breathScale = { inhale: "scale-125", hold: "scale-125", exhale: "scale-75" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Meditações Guiadas</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sessões de meditação narradas por voz, específicas para cada fase da gestação.
          {currentTrimester &&
            ` No ${currentTrimester}º trimestre, recomendamos as meditações destacadas.`}
        </p>
        {!("speechSynthesis" in window) && (
          <p className="mt-2 rounded-xl bg-primary/6 px-3 py-2 text-xs text-primary">
            Use Chrome, Edge ou Safari para narração em voz. Outros navegadores podem não suportar.
          </p>
        )}
      </div>

      {/* Topic filter */}
      <div className="flex flex-wrap gap-2">
        {["todos", ...TOPICS].map((t) => (
          <button
            key={t}
            onClick={() => setTopicFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              topicFilter === t
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t === "todos" ? "Todos os temas" : t}
          </button>
        ))}
      </div>

      {/* Player */}
      {selected && (
        <div className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-6">
          <p className="font-serif text-xl">{selected.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected.topic} · {selected.duration}
          </p>

          {/* Breathing animation */}
          {breathPhase && (
            <div className="my-6 flex flex-col items-center gap-3">
              <div
                className={`h-20 w-20 rounded-full bg-primary/30 transition-transform duration-[4000ms] ease-in-out ${breathScale[breathPhase]}`}
              />
              <p className="text-sm font-medium text-primary animate-pulse">
                {breathLabel[breathPhase]}
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={togglePlay}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
            >
              {playing ? "⏸ Pausar" : "▶ Iniciar meditação"}
            </button>
            {(playing || window.speechSynthesis?.paused) && (
              <button
                onClick={stop}
                className="rounded-full border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary"
              >
                ⏹ Parar
              </button>
            )}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Velocidade
              <input
                type="range"
                min="0.6"
                max="1.2"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-20"
              />
              <span>{rate}×</span>
            </label>
          </div>

          {/* Script preview */}
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:underline">
              Ver script completo
            </summary>
            <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-background p-4 text-xs leading-relaxed text-muted-foreground">
              {selected.script}
            </p>
          </details>
        </div>
      )}

      {/* Meditation list */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((med) => {
          const isRecommended =
            currentTrimester !== null &&
            (med.trimester === 0 || med.trimester === currentTrimester);
          return (
            <button
              key={med.id}
              onClick={() => {
                setSelected(med);
                stop();
              }}
              className={`rounded-2xl border p-4 text-left transition-all hover:border-primary/50 ${
                selected?.id === med.id ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{med.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{med.topic}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">{med.duration}</span>
                  {isRecommended && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {med.trimester === 0 ? "Para qualquer trimestre" : `${med.trimester}º trim.`}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Teleconsulta (Feature #13) ---------- */

function TeleconsultaTab({ profile }: { profile: Profile | null }) {
  const [sessions, setSessions] = useState<TeleconsultaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<TeleconsultaSession | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const tk = data.session?.access_token ?? "";
    const res = await getMyTeleconsultas({ data: { accessToken: tk } });
    if (res.ok) setSessions(res.sessions);
    setLoading(false);
  }

  async function saveNotes(id: string) {
    setSavingNotes(true);
    try {
      const { data } = await supabase.auth.getSession();
      const tk = data.session?.access_token ?? "";
      const res = await savePatientNotes({ data: { accessToken: tk, id, notes } });
      if (!res.ok) {
        toast.error("Não foi possível salvar as anotações. Tente novamente.");
        return;
      }
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, patient_notes: notes } : s)));
      toast.success("Anotações salvas");
    } catch {
      toast.error("Não foi possível salvar as anotações. Tente novamente.");
    } finally {
      setSavingNotes(false);
    }
  }

  const STATUS_LABEL_TC: Record<string, string> = {
    agendada: "Agendada",
    sala_aberta: "Sala aberta",
    encerrada: "Encerrada",
  };
  const STATUS_STYLE_TC: Record<string, string> = {
    agendada: "bg-primary/10 text-primary",
    sala_aberta: "bg-emerald-100 text-emerald-700",
    encerrada: "bg-secondary text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Teleconsulta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando o seu médico abrir a sala, você receberá um e-mail com o link do Google Meet e
          poderá entrar também por aqui com um clique.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Para solicitar uma teleconsulta, entre em contato pelo WhatsApp ou pelo formulário de{" "}
          <strong>Agendamento</strong>.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-20 rounded-2xl" />
          <div className="skeleton h-20 rounded-2xl" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-4xl mb-3">📱</p>
          <p className="font-serif text-xl text-foreground/70">Nenhuma teleconsulta</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma consulta agendada no momento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-3xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {s.scheduled_for
                      ? new Date(s.scheduled_for).toLocaleString("pt-BR", {
                          dateStyle: "full",
                          timeStyle: "short",
                        })
                      : "Horário a definir"}
                  </p>
                  {s.doctor_notes && (
                    <p className="mt-1 text-sm text-muted-foreground">{s.doctor_notes}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE_TC[s.status]}`}
                >
                  {STATUS_LABEL_TC[s.status]}
                </span>
              </div>

              {s.status === "sala_aberta" && s.meet_url && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={s.meet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    🎥 Entrar na teleconsulta
                  </a>
                  <p className="self-center text-xs text-muted-foreground">
                    Abre o Google Meet em nova aba
                  </p>
                </div>
              )}

              {/* Patient notes */}
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Suas anotações da consulta
                </p>
                <textarea
                  value={s.id === activeSession?.id ? notes : (s.patient_notes ?? "")}
                  onChange={(e) => setNotes(e.target.value)}
                  onFocus={() => {
                    setActiveSession(s);
                    setNotes(s.patient_notes ?? "");
                  }}
                  rows={2}
                  placeholder="Anote dúvidas antes ou orientações recebidas durante a consulta..."
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                />
                {activeSession?.id === s.id && (
                  <button
                    onClick={() => saveNotes(s.id)}
                    disabled={savingNotes}
                    className="mt-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {savingNotes ? "Salvando..." : "Salvar anotações"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Carta Semanal do Bebê (Feature #21) ---------- */

function CartaBebêTab({
  profile,
  gest,
  onNavigate,
}: {
  profile: Profile | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
}) {
  const [letter, setLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cachedWeek, setCachedWeek] = useState<number | null>(null);
  const week = gest?.weeks ?? null;

  useEffect(() => {
    if (!week) return;
    loadCached(week);
  }, [week]);

  async function loadCached(w: number) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await (supabase as any)
      .from("baby_letters")
      .select("week, content")
      .eq("user_id", u.user.id)
      .eq("week", w)
      .single();
    if (data?.content) {
      setLetter(data.content);
      setCachedWeek(data.week);
    }
  }

  async function generate() {
    if (!week) return;
    setLoading(true);
    try {
      const baby = babyForWeek(week);
      const res = await fetch("/api/carta-semanal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week,
          babyName: profile?.baby_name ?? null,
          babyDesc: `${baby.desc} Tamanho: ${baby.size}. Peso estimado: ${baby.weight}. Comparado a: ${baby.fruit}.`,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setLetter(json.letter);
      setCachedWeek(week);
      // Save to DB
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { error } = await (supabase as any)
          .from("baby_letters")
          .upsert(
            { user_id: u.user.id, week, content: json.letter },
            { onConflict: "user_id,week" },
          );
        if (error) {
          toast.error("Não foi possível salvar a carta. Ela não ficará guardada para depois.");
        }
      }
    } catch (e: any) {
      setLetter("Erro ao gerar a carta: " + (e?.message ?? "tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  if (!gest || !week) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Configure sua gestação em{" "}
          <button
            type="button"
            onClick={() => onNavigate("Perfil")}
            className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
          >
            Perfil
          </button>{" "}
          para receber a carta semanal do seu bebê.
        </p>
      </div>
    );
  }

  const baby = babyForWeek(week);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Semana {week}</p>
            <p className="mt-1 font-serif text-2xl">Carta do seu bebê</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Uma mensagem especial na perspectiva do {profile?.baby_name ?? "seu bebê"}, gerada por
              IA com base no desenvolvimento real desta semana.
            </p>
          </div>
          <div className="text-4xl">{baby.fruit}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="rounded-full bg-secondary px-3 py-1">📏 {baby.size}</span>
          <span className="rounded-full bg-secondary px-3 py-1">⚖️ {baby.weight}</span>
        </div>
      </div>

      {/* Letter display */}
      {letter ? (
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/5 to-background p-8">
          {/* Decorative stamp */}
          <div className="absolute right-6 top-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary/20 text-xs font-bold uppercase tracking-wider text-primary/40">
            Semana
            <br />
            {week}
          </div>
          <p className="mb-6 font-serif text-sm text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="whitespace-pre-line font-serif text-base leading-relaxed text-foreground">
            {letter}
          </p>
          {cachedWeek === week && (
            <p className="mt-6 text-xs text-muted-foreground">
              Carta da semana {week} · salva automaticamente
            </p>
          )}
        </div>
      ) : (
        <div className="py-14 text-center">
          <p className="text-4xl mb-3">💌</p>
          <p className="font-serif text-xl text-foreground/70">Sua carta ainda não chegou</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Clique abaixo para receber uma mensagem especial do seu bebê nesta semana.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {loading
            ? "Gerando carta..."
            : letter
              ? "Gerar nova carta"
              : "✉️ Receber carta desta semana"}
        </button>
        {letter && (
          <button
            onClick={() => {
              const text = `Carta do bebê — Semana ${week}\n\n${letter}`;
              navigator.clipboard?.writeText(text).then(() => alert("Copiado!"));
            }}
            className="rounded-full border border-border px-6 py-3 text-sm text-muted-foreground hover:bg-secondary"
          >
            Copiar texto
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        A IA gera uma carta única por semana — clique em "Gerar nova carta" para criar uma versão
        diferente.
      </p>
    </div>
  );
}

/* ---------- Sons para o Bebê (Feature #25) ---------- */

type SoundType = "heartbeat" | "pink-noise" | "binaural" | "lullaby" | "rain";

const SOUND_INFO: Record<
  SoundType,
  { label: string; description: string; minWeek: number; icon: string }
> = {
  heartbeat: {
    label: "Batimento cardíaco materno",
    description: "Sons do coração da mamãe — o primeiro som que o bebê ouve.",
    minWeek: 16,
    icon: "❤️",
  },
  "pink-noise": {
    label: "Ruído rosa",
    description: "Frequências suaves que imitam o ambiente uterino e auxiliam no sono.",
    minWeek: 20,
    icon: "🌊",
  },
  binaural: {
    label: "Batidas binaurais",
    description: "Dois tons levemente diferentes criam uma sensação de relaxamento profundo.",
    minWeek: 24,
    icon: "🎵",
  },
  lullaby: {
    label: "Melodia de ninar",
    description: "Sequência pentatônica suave — o bebê reconhecerá essa melodia após o nascimento.",
    minWeek: 24,
    icon: "🎶",
  },
  rain: {
    label: "Chuva suave",
    description: "Som de chuva filtrado, semelhante ao líquido amniótico.",
    minWeek: 18,
    icon: "🌧️",
  },
};

function SonsBebêTab({ gest }: { gest: Gest }) {
  const currentWeek = gest?.weeks ?? 0;
  const [playing, setPlaying] = useState<SoundType | null>(null);
  const [volume, setVolume] = useState(0.5);
  // Chave com prefixo dc-path- para entrar no sync do journey_state (a
  // preferência de sons mais tocados segue a paciente entre aparelhos).
  const [playCount, setPlayCount] = useState<Partial<Record<SoundType, number>>>(() =>
    lsGet<Partial<Record<SoundType, number>>>("dc-path-sons-play-count", {}),
  );
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const masterRef = useRef<GainNode | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextBeatRef = useRef<number>(0);

  function getCtx() {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }

  function stopAll() {
    if (schedulerRef.current) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
    nodesRef.current.forEach((n) => {
      try {
        (n as any).stop?.();
        n.disconnect();
      } catch {}
    });
    nodesRef.current = [];
    if (masterRef.current) {
      masterRef.current.disconnect();
      masterRef.current = null;
    }
    setPlaying(null);
  }

  function playPinkNoise(ctx: AudioContext, master: GainNode) {
    const bufferSize = 4 * ctx.sampleRate;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(master);
    src.start();
    nodesRef.current.push(src);
  }

  function playRain(ctx: AudioContext, master: GainNode) {
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.5;
    src.connect(filter);
    filter.connect(master);
    src.start();
    nodesRef.current.push(src);
  }

  function playBinaural(ctx: AudioContext, master: GainNode) {
    const merger = ctx.createChannelMerger(2);
    merger.connect(master);
    const left = ctx.createOscillator();
    const right = ctx.createOscillator();
    const gL = ctx.createGain();
    gL.gain.value = 0.3;
    const gR = ctx.createGain();
    gR.gain.value = 0.3;
    left.frequency.value = 200;
    right.frequency.value = 210;
    left.connect(gL);
    gL.connect(merger, 0, 0);
    right.connect(gR);
    gR.connect(merger, 0, 1);
    left.start();
    right.start();
    nodesRef.current.push(left, right);
  }

  function scheduleHeartbeats(ctx: AudioContext, master: GainNode) {
    // ~72 bpm: frequência cardíaca materna em repouso (o rótulo do som é "coração da mamãe")
    const interval = 60 / 72;
    nextBeatRef.current = ctx.currentTime + 0.1;
    schedulerRef.current = setInterval(() => {
      const t = nextBeatRef.current;
      if (t > ctx.currentTime + 0.3) return;
      // Lub
      const o1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      o1.type = "sine";
      o1.frequency.value = 80;
      g1.gain.setValueAtTime(0, t);
      g1.gain.linearRampToValueAtTime(0.4, t + 0.02);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o1.connect(g1);
      g1.connect(master);
      o1.start(t);
      o1.stop(t + 0.14);
      // Dub
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = "sine";
      o2.frequency.value = 65;
      const t2 = t + 0.13;
      g2.gain.setValueAtTime(0, t2);
      g2.gain.linearRampToValueAtTime(0.25, t2 + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.1);
      o2.connect(g2);
      g2.connect(master);
      o2.start(t2);
      o2.stop(t2 + 0.12);
      nextBeatRef.current = t + interval;
    }, 50) as ReturnType<typeof setInterval>;
  }

  function scheduleLullaby(ctx: AudioContext, master: GainNode) {
    // C major pentatonic: C4 D4 E4 G4 A4
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
    const dur = 0.6;
    let idx = 0;
    let t = ctx.currentTime + 0.1;

    function scheduleNote() {
      const freq = notes[idx % notes.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
      gain.gain.linearRampToValueAtTime(0, t + dur - 0.05);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
      idx++;
    }

    for (let i = 0; i < 16; i++) scheduleNote();
    schedulerRef.current = setInterval(() => {
      if (t - ctx.currentTime < 1.5) {
        for (let i = 0; i < 8; i++) scheduleNote();
      }
    }, 2000) as ReturnType<typeof setInterval>;
  }

  function play(type: SoundType) {
    if (playing === type) {
      stopAll();
      return;
    }
    stopAll();
    const ctx = getCtx();
    const master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    masterRef.current = master;
    if (type === "pink-noise") playPinkNoise(ctx, master);
    else if (type === "rain") playRain(ctx, master);
    else if (type === "binaural") playBinaural(ctx, master);
    else if (type === "heartbeat") scheduleHeartbeats(ctx, master);
    else if (type === "lullaby") scheduleLullaby(ctx, master);
    setPlaying(type);
    const newCount = { ...playCount, [type]: (playCount[type] ?? 0) + 1 };
    setPlayCount(newCount);
    lsSet("dc-path-sons-play-count", newCount);
  }

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = volume;
  }, [volume]);

  useEffect(() => () => stopAll(), []);

  const sortedByPlays = (Object.keys(SOUND_INFO) as SoundType[]).sort(
    (a, b) => (playCount[b] ?? 0) - (playCount[a] ?? 0),
  );

  return (
    <div className="space-y-6">
      {/* Info */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Sons para o bebê</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O bebê começa a ouvir sons por volta da semana 16–18. Sons reproduzidos regularmente
          durante a gestação são reconhecidos pelo recém-nascido.
        </p>
        {currentWeek > 0 && currentWeek < 16 && (
          <p className="mt-3 rounded-xl bg-primary/6 px-3 py-2 text-xs text-primary">
            Na semana {currentWeek}, o bebê ainda não ouve sons externos. A partir da semana 16 o
            sistema auditivo começa a se desenvolver.
          </p>
        )}
      </div>

      {/* Volume */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-3">
        <span className="text-sm text-muted-foreground">🔉 Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1"
        />
        <span className="w-10 text-right text-xs text-muted-foreground">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Sound cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {sortedByPlays.map((type) => {
          const info = SOUND_INFO[type];
          const isPlaying = playing === type;
          const unlocked = currentWeek === 0 || currentWeek >= info.minWeek;
          const count = playCount[type] ?? 0;
          return (
            <button
              key={type}
              onClick={() => unlocked && play(type)}
              className={`rounded-2xl border p-5 text-left transition-all ${
                isPlaying
                  ? "border-primary bg-primary/10 shadow-md"
                  : unlocked
                    ? "border-border bg-card hover:border-primary/40"
                    : "border-border bg-secondary/40 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{info.icon}</span>
                    <p className="text-sm font-medium">{info.label}</p>
                    {isPlaying && (
                      <span className="flex gap-0.5">
                        {[1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className="inline-block h-3 w-1 animate-bounce rounded-full bg-primary"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{info.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  {!unlocked && (
                    <span className="text-xs text-muted-foreground">Sem. {info.minWeek}</span>
                  )}
                  {count > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{count}× tocado</p>
                  )}
                </div>
              </div>
              {isPlaying && (
                <p className="mt-3 text-xs font-medium text-primary">
                  ▶ Tocando — clique para pausar
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Most played */}
      {Object.values(playCount).some((v) => v > 0) && (
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="font-serif text-lg">Sons favoritos do seu bebê</p>
          <div className="mt-4 space-y-2">
            {sortedByPlays
              .filter((t) => (playCount[t] ?? 0) > 0)
              .map((t) => (
                <div key={t} className="flex items-center gap-3">
                  <span className="text-xl">{SOUND_INFO[t].icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{SOUND_INFO[t].label}</span>
                      <span className="text-muted-foreground">{playCount[t]}×</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.round(((playCount[t] ?? 0) / Math.max(...Object.values(playCount).map((v) => v ?? 0))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Anote os sons favoritos — o bebê pode reconhecê-los após o nascimento 🌟
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Exercícios por Trimestre (Feature #19) ---------- */

type Exercise = {
  id: string;
  title: string;
  category: string;
  duration: string;
  benefit: string;
  description: string;
  steps: string[];
  trimester: number[];
  minWeek: number;
  maxWeek?: number;
  safetyLevel: "verde" | "amarelo";
  caution?: string;
  youtubeSearch: string;
};

const EXERCISES: Exercise[] = [
  {
    id: "kegel",
    title: "Exercícios de Kegel",
    category: "Assoalho Pélvico",
    duration: "10 min",
    benefit: "Fortalece o assoalho pélvico, reduz risco de incontinência e facilita o parto",
    description:
      "Contrações do assoalho pélvico — o exercício mais recomendado durante toda a gestação.",
    steps: [
      "Sente-se ou deite-se confortavelmente",
      "Identifique os músculos do assoalho pélvico (como se fosse segurar a urina)",
      "Contraia por 5 segundos, relaxe por 5 segundos",
      "Repita 10 vezes por série",
      "Faça 3 séries ao longo do dia",
    ],
    trimester: [1, 2, 3],
    minWeek: 4,
    safetyLevel: "verde",
    youtubeSearch: "exercício kegel gestação como fazer",
  },
  {
    id: "agachamento",
    title: "Agachamento com apoio",
    category: "Fortalecimento",
    duration: "15 min",
    benefit: "Fortalece pernas e quadril, abre a pelve para o parto",
    description:
      "Agachamento parcial apoiado na parede — excelente para preparar o corpo para o parto.",
    steps: [
      "Fique de costas para a parede, pés afastados na largura dos ombros",
      "Deslize as costas pela parede até os joelhos formarem ~90°",
      "Segure por 10–30 segundos",
      "Suba devagar contraindo os glúteos",
      "Repita 5–8 vezes",
    ],
    trimester: [1, 2, 3],
    minWeek: 8,
    safetyLevel: "verde",
    caution: "Interrompa se sentir dor pélvica ou pressão excessiva",
    youtubeSearch: "agachamento gestante seguro exercício",
  },
  {
    id: "respiracao-diafragmatica",
    title: "Respiração diafragmática",
    category: "Respiração",
    duration: "10 min",
    benefit: "Reduz ansiedade, melhora oxigenação e prepara para o parto",
    description:
      "Técnica de respiração profunda que acalma o sistema nervoso e aumenta a oxigenação.",
    steps: [
      "Sente-se confortavelmente com uma mão na barriga",
      "Inspire pelo nariz contando até 4, sentindo a barriga subir",
      "Segure por 2 segundos",
      "Expire lentamente pela boca contando até 6",
      "Repita por 10 ciclos, 2× ao dia",
    ],
    trimester: [1, 2, 3],
    minWeek: 4,
    safetyLevel: "verde",
    youtubeSearch: "respiração diafragmática gestantes técnica",
  },
  {
    id: "caminhada",
    title: "Caminhada moderada",
    category: "Cardio",
    duration: "20–30 min",
    benefit: "Melhora circulação, controla peso, reduz inchaço e melhora humor",
    description: "A caminhada é o exercício mais seguro e recomendado durante toda a gestação.",
    steps: [
      "Use tênis com boa sustentação",
      "Comece com 10 min e aumente gradualmente",
      "Mantenha ritmo confortável — você deve conseguir conversar",
      "Hidrate-se bem antes, durante e depois",
      "Evite horários muito quentes (prefira manhã cedo ou fim de tarde)",
    ],
    trimester: [1, 2, 3],
    minWeek: 4,
    safetyLevel: "verde",
    caution: "Reduza a intensidade e distância no 3º trimestre conforme o conforto",
    youtubeSearch: "caminhada gestante benefícios dicas segurança",
  },
  {
    id: "gato-vaca",
    title: "Gato e Vaca (Cat-Cow)",
    category: "Yoga",
    duration: "10 min",
    benefit: "Alivia dor lombar, melhora postura e mobiliza a coluna vertebral",
    description:
      "Movimento clássico de yoga — excelente para aliviar as dores lombares comuns na gestação.",
    steps: [
      "Ajoelhe-se em 4 apoios (mãos e joelhos)",
      "Inspire: arqueie as costas para baixo, levante a cabeça (posição vaca)",
      "Expire: redonde as costas para cima, abaixe a cabeça (posição gato)",
      "Repita 10–15 vezes de forma fluida e suave",
      "Mantenha os movimentos lentos e controlados",
    ],
    trimester: [1, 2, 3],
    minWeek: 8,
    safetyLevel: "verde",
    youtubeSearch: "yoga gestante gato vaca lombar alívio",
  },
  {
    id: "alongamento-pescoco",
    title: "Alongamento de pescoço e ombros",
    category: "Alongamento",
    duration: "8 min",
    benefit: "Alivia tensão cervical e cefaleias comuns no 1º trimestre",
    description: "Alongamentos suaves para aliviar a tensão acumulada na região cervical.",
    steps: [
      "Sente-se ereto numa cadeira sem encostar na coluna",
      "Incline a cabeça lateralmente devagar, orelha ao ombro",
      "Segure 20–30 segundos de cada lado",
      "Gire o pescoço suavemente em semicírculos (NUNCA círculo completo)",
      "Encolha e abaixe os ombros, solte. Repita 5 vezes.",
    ],
    trimester: [1, 2, 3],
    minWeek: 4,
    safetyLevel: "verde",
    youtubeSearch: "alongamento pescoço ombros gestante tensão cervical",
  },
  {
    id: "borboleta",
    title: "Postura da borboleta",
    category: "Yoga",
    duration: "10 min",
    benefit: "Abre o quadril, flexibiliza a virilha e prepara para o parto",
    description: "Sentada com as plantas dos pés juntas — abre o quadril progressivamente.",
    steps: [
      "Sente-se no chão com as costas apoiadas na parede",
      "Junte as plantas dos pés, deixando os joelhos caírem para os lados",
      "Segure os pés com as mãos",
      "Mantenha a posição por 1–3 minutos respirando profundamente",
      'Opcionalmente, mova os joelhos levemente para cima e para baixo ("asa de borboleta")',
    ],
    trimester: [1, 2, 3],
    minWeek: 10,
    safetyLevel: "verde",
    caution: "Não force além do conforto — respeite os limites do seu corpo",
    youtubeSearch: "postura borboleta gestante yoga quadril",
  },
  {
    id: "hidroginastica",
    title: "Hidroginástica gestacional",
    category: "Cardio",
    duration: "30–45 min",
    benefit: "Baixo impacto, alivia inchaço e dores articulares, melhora circulação",
    description:
      "A água reduz o impacto sobre as articulações — ideal especialmente no 3º trimestre.",
    steps: [
      "Procure uma turma específica para gestantes",
      "Use roupa de banho confortável e óculos de natação",
      "Comunicique à professora sua semana gestacional",
      "Prefira piscinas aquecidas (evite frio extremo)",
      "Hidrate-se mesmo dentro d'água",
    ],
    trimester: [2, 3],
    minWeek: 14,
    safetyLevel: "verde",
    youtubeSearch: "hidroginástica gestante benefícios exercícios água",
  },
  {
    id: "yoga-3t",
    title: "Yoga para o 3º trimestre",
    category: "Yoga",
    duration: "20 min",
    benefit: "Prepara corpo e mente para o parto, alivia desconfortos do final da gestação",
    description:
      "Sequência de yoga adaptada para o 3º trimestre com foco em abertura de quadril e relaxamento.",
    steps: [
      "Postura do guerreiro modificada: apoie a mão na parede",
      "Postura da pomba: com apoios, abre quadril profundamente",
      "Postura da criança adaptada: abre joelhos para a barriga",
      "Savasana lateral: deite-se de lado com travesseiros de suporte",
      "Mantenha cada posição por 1–3 minutos",
    ],
    trimester: [3],
    minWeek: 28,
    safetyLevel: "verde",
    youtubeSearch: "yoga terceiro trimestre gestante preparação parto",
  },
];

const EXERCISE_CATEGORIES = [...new Set(EXERCISES.map((e) => e.category))];

function ExerciciosTab({ gest }: { gest: Gest }) {
  const currentWeek = gest?.weeks ?? 0;
  const currentTrimester = gest ? trimesterForWeek(gest.weeks) : null;
  const [catFilter, setCatFilter] = useState<string>("todos");
  const [expanded, setExpanded] = useState<string | null>(null);

  const available = EXERCISES.filter((ex) => {
    const weekOk =
      currentWeek === 0 ||
      (currentWeek >= ex.minWeek && (!ex.maxWeek || currentWeek <= ex.maxWeek));
    const trimOk = currentTrimester === null || ex.trimester.includes(currentTrimester);
    const catOk = catFilter === "todos" || ex.category === catFilter;
    return catOk && weekOk && trimOk;
  });

  const locked = EXERCISES.filter((ex) => {
    const weekOk =
      currentWeek > 0 && (currentWeek < ex.minWeek || (ex.maxWeek && currentWeek > ex.maxWeek));
    const catOk = catFilter === "todos" || ex.category === catFilter;
    return catOk && weekOk;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Exercícios para gestantes</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentTrimester
            ? `Exercícios liberados para o ${currentTrimester}º trimestre (semana ${currentWeek}).`
            : "Configure sua gestação em Perfil para ver os exercícios recomendados para sua semana."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          ⚠️ Consulte seu médico antes de iniciar qualquer atividade física na gestação.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {["todos", ...EXERCISE_CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              catFilter === cat
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {cat === "todos" ? "Todos" : cat}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      {available.length === 0 && locked.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          Nenhum exercício encontrado para este filtro.
        </p>
      ) : (
        <div className="space-y-3">
          {available.map((ex) => (
            <div key={ex.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === ex.id ? null : ex.id)}
                className="flex w-full items-start justify-between gap-3 p-5 text-left"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{ex.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${ex.safetyLevel === "verde" ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"}`}
                    >
                      {ex.safetyLevel === "verde" ? "✓ Liberado" : "⚠ Consulte médico"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ex.category} · {ex.duration} · {ex.benefit}
                  </p>
                </div>
                <span className="text-muted-foreground">{expanded === ex.id ? "▲" : "▼"}</span>
              </button>

              {expanded === ex.id && (
                <div className="border-t border-border px-5 pb-5">
                  <p className="mt-4 text-sm text-muted-foreground">{ex.description}</p>
                  {ex.caution && (
                    <p className="mt-2 rounded-xl bg-primary/6 px-3 py-2 text-xs text-primary">
                      {ex.caution}
                    </p>
                  )}
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Como fazer
                    </p>
                    <ol className="mt-2 space-y-1.5">
                      {ex.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ex.youtubeSearch)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary"
                  >
                    ▶ Ver vídeos no YouTube
                  </a>
                </div>
              )}
            </div>
          ))}

          {locked.length > 0 && (
            <details className="rounded-2xl p-4">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {locked.length} exercício(s) não disponíveis para sua semana atual
              </summary>
              <div className="mt-3 space-y-2">
                {locked.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground"
                  >
                    <span>{ex.title}</span>
                    <span>A partir da semana {ex.minWeek}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Quartinho (Feature #29) ---------- */

type QuartinhoItem = {
  id: string;
  category: string;
  label: string;
  priority: "essencial" | "recomendado" | "opcional";
  weekSuggested: number;
  searchQuery: string;
};

const QUARTO_ITEMS: QuartinhoItem[] = [
  // Sono
  {
    id: "qb-bercinho",
    category: "Sono",
    label: "Berço ou mini berço",
    priority: "essencial",
    weekSuggested: 25,
    searchQuery: "berço bebê",
  },
  {
    id: "qb-colchao",
    category: "Sono",
    label: "Colchão firminho para berço",
    priority: "essencial",
    weekSuggested: 25,
    searchQuery: "colchão berço bebê",
  },
  {
    id: "qb-protetor",
    category: "Sono",
    label: "Protetor de berço respirável",
    priority: "recomendado",
    weekSuggested: 28,
    searchQuery: "protetor berço respirável",
  },
  {
    id: "qb-mosquiteiro",
    category: "Sono",
    label: "Mosquiteiro para berço",
    priority: "recomendado",
    weekSuggested: 30,
    searchQuery: "mosquiteiro berço bebê",
  },
  {
    id: "qb-baba",
    category: "Sono",
    label: "Babá eletrônica / monitor de bebê",
    priority: "recomendado",
    weekSuggested: 32,
    searchQuery: "babá eletrônica monitor bebê",
  },
  {
    id: "qb-cortina",
    category: "Sono",
    label: "Cortina blackout",
    priority: "recomendado",
    weekSuggested: 30,
    searchQuery: "cortina blackout quarto bebê",
  },
  // Troca
  {
    id: "qb-trocador",
    category: "Troca",
    label: "Trocador com proteção lateral",
    priority: "essencial",
    weekSuggested: 28,
    searchQuery: "trocador bebê",
  },
  {
    id: "qb-fraldas-rn",
    category: "Troca",
    label: "Fraldas descartáveis RN e P",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "fralda descartável recém-nascido",
  },
  {
    id: "qb-toalhinhas",
    category: "Troca",
    label: "Toalhinhas umedecidas sem álcool",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "toalhinhas umedecidas bebê sem álcool",
  },
  {
    id: "qb-pomada",
    category: "Troca",
    label: "Pomada para assadura",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "pomada assadura bebê",
  },
  {
    id: "qb-termometro",
    category: "Troca",
    label: "Termômetro digital axilar",
    priority: "essencial",
    weekSuggested: 32,
    searchQuery: "termômetro digital bebê",
  },
  // Banho
  {
    id: "qb-banheira",
    category: "Banho",
    label: "Banheira plástica com suporte",
    priority: "essencial",
    weekSuggested: 28,
    searchQuery: "banheira bebê plástica",
  },
  {
    id: "qb-sabonete",
    category: "Banho",
    label: "Sabonete líquido neutro para bebê",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "sabonete líquido neutro bebê",
  },
  {
    id: "qb-shampoo",
    category: "Banho",
    label: "Shampoo para bebê sem lágrimas",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "shampoo bebê sem lágrimas",
  },
  {
    id: "qb-toalha",
    category: "Banho",
    label: "Toalhas com capuz (mín. 3)",
    priority: "essencial",
    weekSuggested: 32,
    searchQuery: "toalha capuz bebê",
  },
  {
    id: "qb-algodao",
    category: "Banho",
    label: "Algodão hidrófilo e cotonete bebê",
    priority: "essencial",
    weekSuggested: 34,
    searchQuery: "algodão hidrófilo bebê cotonete",
  },
  // Alimentação
  {
    id: "qb-almofada",
    category: "Alimentação",
    label: "Almofada de amamentação",
    priority: "essencial",
    weekSuggested: 30,
    searchQuery: "almofada amamentação",
  },
  {
    id: "qb-bomba",
    category: "Alimentação",
    label: "Bomba de leite (manual ou elétrica)",
    priority: "recomendado",
    weekSuggested: 32,
    searchQuery: "bomba de leite materno",
  },
  {
    id: "qb-mamadeiras",
    category: "Alimentação",
    label: "Mamadeiras anticolica (caso necessário)",
    priority: "opcional",
    weekSuggested: 35,
    searchQuery: "mamadeira anticólica bebê",
  },
  {
    id: "qb-creme",
    category: "Alimentação",
    label: "Lanolina para mamilos",
    priority: "recomendado",
    weekSuggested: 34,
    searchQuery: "lanolina mamilo amamentação",
  },
  // Transporte
  {
    id: "qb-carrinho",
    category: "Transporte",
    label: "Carrinho de bebê",
    priority: "essencial",
    weekSuggested: 28,
    searchQuery: "carrinho de bebê",
  },
  {
    id: "qb-bebe-conforto",
    category: "Transporte",
    label: "Bebê conforto (obrigatório por lei)",
    priority: "essencial",
    weekSuggested: 26,
    searchQuery: "bebê conforto cadeirinha carro",
  },
  {
    id: "qb-sling",
    category: "Transporte",
    label: "Sling ou canguru ergonômico",
    priority: "recomendado",
    weekSuggested: 30,
    searchQuery: "sling ergonômico bebê",
  },
  // Segurança e conforto
  {
    id: "qb-aspirador",
    category: "Saúde",
    label: "Aspirador nasal",
    priority: "essencial",
    weekSuggested: 35,
    searchQuery: "aspirador nasal bebê",
  },
  {
    id: "qb-cortador-unhas",
    category: "Saúde",
    label: "Kit manicure para bebê",
    priority: "essencial",
    weekSuggested: 35,
    searchQuery: "kit manicure cortador unhas bebê",
  },
  {
    id: "qb-cadeira",
    category: "Conforto",
    label: "Cadeira de amamentação/poltrona",
    priority: "recomendado",
    weekSuggested: 30,
    searchQuery: "cadeira amamentação poltrona",
  },
  {
    id: "qb-humidificador",
    category: "Conforto",
    label: "Umidificador de ar",
    priority: "opcional",
    weekSuggested: 32,
    searchQuery: "umidificador ar quarto bebê",
  },
];

const PRIORITY_STYLE: Record<QuartinhoItem["priority"], { badge: string; label: string }> = {
  essencial: { badge: "bg-rose-100 text-rose-700", label: "Essencial" },
  recomendado: { badge: "bg-primary/10 text-primary", label: "Recomendado" },
  opcional: { badge: "bg-secondary text-muted-foreground", label: "Opcional" },
};

const QUARTO_CATEGORIES = [...new Set(QUARTO_ITEMS.map((i) => i.category))];

function QuartinhoTab({ gest }: { gest: Gest }) {
  // Chave com prefixo dc-path- para pegar carona no sync do journey_state:
  // o checklist do quartinho passa a viver na CONTA, não só no aparelho.
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(lsGet<string[]>("dc-path-quartinho-checked", [])),
  );
  const [catFilter, setCatFilter] = useState<string>("todos");
  const [priorityFilter, setPriorityFilter] = useState<string>("todos");
  const currentWeek = gest?.weeks ?? 0;

  function toggle(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
    lsSet("dc-path-quartinho-checked", [...next]);
  }

  const filtered = QUARTO_ITEMS.filter((item) => {
    const catOk = catFilter === "todos" || item.category === catFilter;
    const prioOk = priorityFilter === "todos" || item.priority === priorityFilter;
    return catOk && prioOk;
  });

  const essentialItems = QUARTO_ITEMS.filter((i) => i.priority === "essencial");
  const doneEssential = essentialItems.filter((i) => checked.has(i.id)).length;
  const totalChecked = QUARTO_ITEMS.filter((i) => checked.has(i.id)).length;
  const completionPct = Math.round((totalChecked / QUARTO_ITEMS.length) * 100);

  // Items to focus this week
  const upcoming =
    currentWeek > 0
      ? QUARTO_ITEMS.filter(
          (i) =>
            !checked.has(i.id) &&
            i.weekSuggested <= currentWeek + 4 &&
            i.weekSuggested >= currentWeek - 1,
        )
          .sort((a, b) => a.weekSuggested - b.weekSuggested)
          .slice(0, 5)
      : [];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-serif text-lg">Preparação do quartinho</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {doneEssential}/{essentialItems.length} itens essenciais adquiridos · {totalChecked}/
              {QUARTO_ITEMS.length} total
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-primary/20 text-sm font-bold text-primary">
            {completionPct}%
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Upcoming this week */}
      {upcoming.length > 0 && (
        <div className="rounded-3xl border border-primary/20 bg-primary/6 p-5">
          <p className="text-sm font-semibold text-foreground">⏰ Comprar nas próximas semanas</p>
          <div className="mt-3 space-y-2">
            {upcoming.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs text-primary">
                <span>{item.label}</span>
                <span>Sem. {item.weekSuggested}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {["todos", ...QUARTO_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${catFilter === c ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}
            >
              {c === "todos" ? "Todas as categorias" : c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["todos", "essencial", "recomendado", "opcional"].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${priorityFilter === p ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}
            >
              {p === "todos" ? "Todas as prioridades" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Items grouped by category */}
      {QUARTO_CATEGORIES.filter((cat) => catFilter === "todos" || catFilter === cat).map((cat) => {
        const items = filtered.filter((i) => i.category === cat);
        if (items.length === 0) return null;
        const doneCat = items.filter((i) => checked.has(i.id)).length;
        return (
          <div key={cat} className="rounded-3xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="font-medium">{cat}</p>
              <span className="text-xs text-muted-foreground">
                {doneCat}/{items.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {items.map((item) => {
                const isChecked = checked.has(item.id);
                const pStyle = PRIORITY_STYLE[item.priority];
                const isTimely = currentWeek > 0 && Math.abs(item.weekSuggested - currentWeek) <= 3;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-5 py-3.5 ${isChecked ? "bg-secondary/30" : ""}`}
                  >
                    <button
                      onClick={() => toggle(item.id)}
                      className={`h-5 w-5 shrink-0 rounded border-2 transition-colors ${isChecked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}
                    >
                      {isChecked && (
                        <span className="flex items-center justify-center text-xs">✓</span>
                      )}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`text-sm ${isChecked ? "line-through text-muted-foreground" : ""}`}
                      >
                        {item.label}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${pStyle.badge}`}>
                          {pStyle.label}
                        </span>
                        {currentWeek > 0 && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${isTimely ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
                          >
                            Sem. {item.weekSuggested}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={`https://www.amazon.com.br/s?k=${encodeURIComponent(item.searchQuery)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-full border border-border p-1.5 text-xs text-muted-foreground hover:bg-secondary"
                      title="Buscar na Amazon"
                    >
                      🛒
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Conta Regressiva ---------- */
const MILESTONES = [
  { week: 12, label: "Fim do 1º trimestre", emoji: "🌱" },
  { week: 20, label: "Metade da gestação", emoji: "🌟" },
  { week: 24, label: "Viabilidade fetal", emoji: "💪" },
  { week: 28, label: "3º trimestre", emoji: "🌙" },
  { week: 34, label: "Bebê já pode nascer", emoji: "🎉" },
  { week: 37, label: "Gestação a termo", emoji: "✅" },
  { week: 40, label: "Data provável do parto", emoji: "🍼" },
];

function CountdownTab({
  profile,
  gest,
  onNavigate,
}: {
  profile: Profile | null;
  gest: Gest;
  onNavigate: (tab: string) => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!profile || !gest) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground">
        Configure seu perfil (DPP ou DUM) para ver a contagem regressiva.
      </div>
    );
  }

  const due = profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);
  if (!due) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground">
        Adicione a data provável do parto em{" "}
        <button
          type="button"
          onClick={() => onNavigate("Perfil")}
          className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
        >
          Perfil
        </button>
        .
      </div>
    );
  }

  const dueMs = new Date(due + "T00:00:00").getTime();
  const diffMs = Math.max(0, dueMs - now);
  const isDueToday = now >= dueMs && now < dueMs + 86400000;
  const overdueDays = Math.floor((now - dueMs) / 86400000);
  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const progress = Math.min(100, (gest.totalDays / 280) * 100);

  const lmpMs = profile.lmp_date
    ? new Date(profile.lmp_date + "T00:00:00").getTime()
    : dueMs - 280 * 86400000;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-rose-50 p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Faltam para a DPP
        </p>
        <div className="mt-6 flex justify-center gap-4 sm:gap-8">
          {[
            { value: days, label: "dias" },
            { value: hours, label: "horas" },
            { value: mins, label: "min" },
            { value: secs, label: "seg" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="tabular-nums text-4xl font-bold text-primary sm:text-5xl">
                {String(value).padStart(2, "0")}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <div className="mx-auto h-3 max-w-sm overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {progress.toFixed(1)}% da gestação completa
          </p>
        </div>
        {diffMs === 0 &&
          (isDueToday ? (
            <p className="mt-4 text-lg font-semibold text-primary">
              🎊 Hoje é a data provável do parto! Parabéns, mamãe!
            </p>
          ) : (
            <p className="mt-4 text-lg font-semibold text-primary">
              A DPP passou há {overdueDays} {overdueDays === 1 ? "dia" : "dias"} — mantenha contato
              próximo com o consultório.
            </p>
          ))}
      </div>

      <div>
        <h3 className="mb-4 font-semibold">Marcos da gestação</h3>
        <div className="space-y-3">
          {MILESTONES.map((m) => {
            const milestoneMs = lmpMs + m.week * 7 * 86400000;
            const passed = now >= milestoneMs;
            const isCurrent = gest.weeks === m.week;
            const diffDays = Math.ceil((milestoneMs - now) / 86400000);

            return (
              <div
                key={m.week}
                className={`flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : passed
                      ? "border-border bg-secondary/30 opacity-70"
                      : "border-border bg-card"
                }`}
              >
                <span className="text-2xl">{passed ? "✅" : m.emoji}</span>
                <div className="flex-1">
                  <p
                    className={`font-medium ${passed ? "line-through text-muted-foreground" : ""}`}
                  >
                    {m.label}
                  </p>
                  <p className="text-xs text-muted-foreground">Semana {m.week}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {passed ? "Conquistado! 🎉" : isCurrent ? "Esta semana!" : `Em ${diffDays} dias`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Álbum Familiar ---------- */
function AlbumTab({ profile }: { profile: Profile | null }) {
  const [posts, setPosts] = useState<AlbumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [emoji, setEmoji] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const res = await getMyAlbumPosts({ data: { accessToken: s.session.access_token } });
      if (res.ok) setPosts(res.posts);

      // Get companion invite token for sharing
      const { data: invites } = await (supabase as any)
        .from("companion_invites")
        .select("token")
        .eq("user_id", s.session.user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (invites?.[0]?.token) {
        setInviteToken(invites[0].token);
        setShareUrl(`${window.location.origin}/album/${invites[0].token}`);
      }
      setLoading(false);
    })();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 800;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageData(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!caption && !imageData && !emoji) return;
    setSubmitting(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setSubmitting(false);
      return;
    }
    const displayName = profile?.display_name ?? "Mamãe";
    const res = await createAlbumPost({
      data: {
        accessToken: s.session.access_token,
        authorName: displayName,
        caption: caption || null,
        imageData,
        emoji: emoji || null,
      },
    });
    if (res.ok) {
      const res2 = await getMyAlbumPosts({ data: { accessToken: s.session.access_token } });
      if (res2.ok) setPosts(res2.posts);
      setCaption("");
      setEmoji("");
      setImageData(null);
      if (fileRef.current) fileRef.current.value = "";
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await deleteAlbumPost({ data: { accessToken: s.session.access_token, id } });
    if (!res.ok) {
      toast.error("Não foi possível excluir a foto. Tente novamente.");
      return;
    }
    setPosts((p) => p.filter((x) => x.id !== id));
  }

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Adicionar ao álbum</h3>
        <div className="space-y-3">
          <input
            type="file"
            accept="image/*"
            ref={fileRef}
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-xs file:font-medium file:text-primary"
          />
          {imageData && (
            <div className="relative inline-block">
              <img
                src={imageData}
                alt="pré-visualização da imagem"
                className="h-32 rounded-xl object-cover"
              />
              <button
                onClick={() => {
                  setImageData(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center"
              >
                ×
              </button>
            </div>
          )}
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Legenda (opcional)..."
            className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm"
          />
          <div className="flex gap-2">
            {["💕", "🤰", "👶", "🌸", "⭐", "🎀", "💙", "🌈"].map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(emoji === e ? "" : e)}
                className={`rounded-xl p-2 text-xl transition-colors ${emoji === e ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-secondary"}`}
              >
                {e}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || (!caption && !imageData && !emoji)}
            className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? "Salvando..." : "Publicar no álbum"}
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium mb-2">Link para família ver o álbum:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
            />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white"
            >
              Copiar
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            A família acessa o álbum com o mesmo link do acompanhante.
          </p>
        </div>
      )}

      {!inviteToken && (
        <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
          Crie um convite de acompanhante na aba <strong>Acompanhante</strong> para compartilhar o
          álbum com a família.
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-4">
          Álbum ({posts.length} {posts.length === 1 ? "memória" : "memórias"})
        </h3>
        {posts.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-4xl mb-3">📷</p>
            <p className="font-serif text-xl text-foreground/70">Nenhuma memória ainda</p>
            <p className="mt-2 text-sm text-muted-foreground">Comece adicionando a primeira!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="group relative rounded-2xl border border-border bg-card overflow-hidden"
              >
                {post.image_data && (
                  <img
                    src={post.image_data}
                    alt={post.caption ?? "Foto do álbum"}
                    className="w-full object-cover"
                    style={{ maxHeight: 220 }}
                  />
                )}
                <div className="p-4">
                  {post.emoji && <span className="text-2xl">{post.emoji}</span>}
                  {post.caption && <p className="mt-1 text-sm">{post.caption}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {post.author_name} · {new Date(post.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-xs text-destructive transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Nome do Bebê ---------- */
function NomeTab({ profile }: { profile: Profile | null }) {
  const [session, setSession] = useState<NameSession | null>(null);
  const [entries, setEntries] = useState<NameEntry[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const res = await getOrCreateNameSession({ data: { accessToken: s.session.access_token } });
      if (res.ok) {
        setSession(res.session);
        setEntries(res.entries);
        setShareUrl(`${window.location.origin}/votar-nome/${res.session.share_token}`);
      }
      setLoading(false);
    })();
  }, []);

  async function handleAddName() {
    if (!newName.trim()) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setSaving(false);
      return;
    }
    const addRes = await addNameByPatient({
      data: {
        accessToken: s.session.access_token,
        name: newName.trim(),
        suggestedBy: "Mamãe",
      },
    });
    if (!addRes.ok) {
      toast.error("Não foi possível adicionar o nome. Tente novamente.");
      setSaving(false);
      return;
    }
    const res = await getOrCreateNameSession({ data: { accessToken: s.session.access_token } });
    if (res.ok) {
      setSession(res.session);
      setEntries(res.entries);
    }
    setNewName("");
    setSaving(false);
  }

  async function handleToggle(isActive: boolean, revealWinner: boolean) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await toggleNameSession({
      data: { accessToken: s.session.access_token, isActive, revealWinner },
    });
    if (!res.ok) {
      toast.error("Não foi possível atualizar a votação. Tente novamente.");
      return;
    }
    setSession((prev) =>
      prev ? { ...prev, is_active: isActive, reveal_winner: revealWinner } : prev,
    );
  }

  async function handleRemove(entryId: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await removeNameEntry({ data: { accessToken: s.session.access_token, entryId } });
    if (!res.ok) {
      toast.error("Não foi possível remover o nome. Tente novamente.");
      return;
    }
    setEntries((e) => e.filter((x) => x.id !== entryId));
  }

  if (loading) return <TabSkeleton />;
  if (!session)
    return <div className="text-muted-foreground text-center py-12">Erro ao carregar sessão.</div>;

  const sortedEntries = [...entries].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
  const maxVotes = sortedEntries[0]?.vote_count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center justify-between rounded-3xl border border-border bg-card p-6">
        <div>
          <h3 className="font-semibold">Votação de nomes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {session.is_active ? "Aberta para votos" : "Votação encerrada"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleToggle(!session.is_active, session.reveal_winner)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              session.is_active ? "bg-secondary text-foreground" : "bg-primary text-white"
            }`}
          >
            {session.is_active ? "Encerrar votação" : "Reabrir votação"}
          </button>
          <button
            onClick={() => handleToggle(session.is_active, !session.reveal_winner)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              session.reveal_winner
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
            }`}
          >
            {session.reveal_winner ? "Revelar vencedor ✓" : "Revelar vencedor"}
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium mb-2">Link para a família votar:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
            />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white"
            >
              Copiar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-3">Sugerir nome</h3>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddName()}
            placeholder="Nome do bebê..."
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm"
          />
          <button
            onClick={handleAddName}
            disabled={saving || !newName.trim()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? "..." : "Adicionar"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-4">
          Nomes ({entries.length}){" "}
          {!session.reveal_winner && entries.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              — votos ocultos para a família
            </span>
          )}
        </h3>
        {entries.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-4xl mb-3">👶</p>
            <p className="font-serif text-xl text-foreground/70">Nenhum nome ainda</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Adicione o primeiro ou compartilhe o link para a família sugerir!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEntries.map((entry, i) => {
              const votes = entry.vote_count ?? 0;
              const pct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-4 rounded-2xl border p-4 ${
                    i === 0 && votes > 0
                      ? "border-primary/25 bg-primary/8"
                      : "border-border bg-card"
                  }`}
                >
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                    {i === 0 && votes > 0 ? "👑" : `${i + 1}°`}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{entry.name}</p>
                    <p className="text-xs text-muted-foreground">por {entry.suggested_by}</p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{votes}</p>
                    <p className="text-xs text-muted-foreground">
                      {votes === 1 ? "voto" : "votos"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="text-xs text-destructive hover:opacity-80"
                    title="Remover nome"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feature 36 — Escola do Bebê
───────────────────────────────────────────────────────────────────────────── */

function EscolaBebêTab({ gest, onNavigate }: { gest: Gest; onNavigate: (tab: string) => void }) {
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const currentWeek = gest?.weeks ?? 0;

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setLoading(false);
        return;
      }
      const res = await getCourseProgress({ data: { accessToken: s.session.access_token } });
      if (res.ok) setProgress(res.progress);
      setLoading(false);
    })();
  }, []);

  const completedCount = COURSE_MODULES.filter((m) =>
    progress.some((p) => p.module_week === m.week),
  ).length;
  const hasCertificate = COURSE_MODULES.length > 0 && completedCount >= COURSE_MODULES.length;
  const unlockedCount = COURSE_MODULES.filter((m) => currentWeek >= m.week).length;
  const nextLesson = COURSE_MODULES.find(
    (m) => currentWeek >= m.week && !progress.some((p) => p.module_week === m.week),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* As lições agora moram DENTRO do caminho — esta aba vira a porta de entrada */}
      <div className="glass-card glass-pink rounded-3xl p-8 text-center">
        <p className="text-5xl">📚</p>
        <h2 className="mt-3 font-serif text-2xl">As lições agora fazem parte da sua jornada!</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Cada semana-chave da gestação tem uma <strong>moeda de lição</strong> no seu caminho:
          aprenda o conteúdo, responda o quiz e ganhe a estrela — tudo dentro do jogo.
        </p>
        <button
          onClick={() => onNavigate("Caminho")}
          className="press mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-float)]"
        >
          🗺️ Ir para o Caminho
        </button>
        {nextLesson && (
          <p className="mt-3 text-xs text-muted-foreground">
            Próxima lição disponível: <strong>semana {nextLesson.week}</strong> — {nextLesson.title}
          </p>
        )}
      </div>

      {/* Progresso resumido */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg">Seu progresso</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {loading
                ? "Carregando..."
                : `${completedCount} de ${COURSE_MODULES.length} lições · ${unlockedCount} já liberadas`}
            </p>
          </div>
          {hasCertificate && (
            <div className="rounded-2xl border border-primary/30 bg-primary/6 px-4 py-2 text-center">
              <p className="text-lg">🎓</p>
              <p className="text-xs font-semibold text-primary">Certificado</p>
            </div>
          )}
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${COURSE_MODULES.length > 0 ? (completedCount / COURSE_MODULES.length) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {COURSE_MODULES.map((m) => {
            const done = progress.some((p) => p.module_week === m.week);
            const unlocked = currentWeek >= m.week;
            return (
              <button
                key={m.week}
                onClick={() => onNavigate("Caminho")}
                title={`Semana ${m.week}: ${m.title}`}
                className={`press flex h-11 w-11 items-center justify-center rounded-xl text-lg ${
                  done
                    ? "bg-amber-100"
                    : unlocked
                      ? "bg-violet-50"
                      : "bg-slate-50 opacity-40 grayscale"
                }`}
              >
                {done ? "⭐" : unlocked ? "📚" : "🔒"}
              </button>
            );
          })}
        </div>
      </div>

      {hasCertificate && (
        <div className="rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/6 to-primary/12 p-8 text-center">
          <p className="mb-2 text-4xl">🎓</p>
          <h3 className="font-serif text-2xl font-bold text-foreground">
            Certificado de Pré-natal
          </h3>
          <p className="mt-2 text-primary">
            Parabéns! Você concluiu todas as lições do curso de pré-natal.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feature 40 — FAQ Personalizado por Semana
───────────────────────────────────────────────────────────────────────────── */

type FAQItem = {
  q: string;
  a: string;
  weeks: [number, number]; // [min, max] inclusive
  tags: string[];
};

const FAQ_ITEMS: FAQItem[] = [
  // 1º Trimestre
  {
    q: "Náuseas e vômitos são normais?",
    a: "Sim, afetam até 80% das gestantes, especialmente no 1º trimestre. São causadas pelo hCG. Coma pequenas porções frequentes, evite odores fortes, prefira alimentos secos pela manhã. Converse com seu médico se vomitar mais de 3-4 vezes ao dia (hiperemese).",
    weeks: [4, 14],
    tags: ["náuseas", "sintomas"],
  },
  {
    q: "Posso sangrar no início da gravidez?",
    a: "Um pequeno sangramento na implantação (por volta de 6-10 dias após a fecundação) pode ocorrer e é normal. Porém, qualquer sangramento deve ser comunicado ao médico. Ele avaliará se é necessário ultrassom para verificar a vitalidade do embrião.",
    weeks: [4, 12],
    tags: ["sangramento"],
  },
  {
    q: "Cólicas leves são normais?",
    a: "Cólicas leves e ocasionais no início da gestação são comuns — o útero está se expandindo. Mas dor intensa, contínua ou acompanhada de sangramento exige avaliação médica urgente.",
    weeks: [4, 14],
    tags: ["cólicas", "dor"],
  },
  {
    q: "Posso continuar tomando meus remédios habituais?",
    a: "Não tome nenhum medicamento sem orientação médica durante a gestação. Alguns são seguros, outros são contraindicados. Leve uma lista de todos os seus medicamentos para o pré-natal.",
    weeks: [4, 42],
    tags: ["medicamentos"],
  },
  {
    q: "Com que frequência preciso ir às consultas do pré-natal?",
    a: "O calendário mínimo do pré-natal: mensal até 32 semanas, quinzenal até 36, e semanal a partir daí. Gestações de alto risco têm consultas mais frequentes. Não pule nenhuma — cada consulta tem um objetivo específico.",
    weeks: [4, 40],
    tags: ["consultas", "pré-natal"],
  },
  {
    q: "É seguro ter relações sexuais na gestação?",
    a: "Em gestações sem complicações, o sexo é completamente seguro. O bebê está protegido pelo líquido amniótico e tampão mucoso. Evite posições que pressionem a barriga. Em caso de sangramento, placenta prévia ou ameaça de parto prematuro, pode ser contraindicado.",
    weeks: [4, 38],
    tags: ["sexo", "relações"],
  },
  // 1º-2º Trimestre
  {
    q: "Quais exames são feitos na semana 11-14?",
    a: "A morfológica do 1º trimestre avalia a translucência nucal (rastreamento de síndrome de Down), batimentos cardíacos e anatomia inicial. Junto com exames de sangue (PAPP-A e beta-hCG livre), compõe o rastreamento combinado do 1º trimestre.",
    weeks: [10, 16],
    tags: ["exames", "morfológica"],
  },
  {
    q: "O que é síndrome de Down e como é o rastreamento?",
    a: "A síndrome de Down (trissomia 21) ocorre em 1 a cada 800 nascimentos. O rastreamento combinado do 1º trimestre (translucência nucal + exames de sangue) estima o risco. Se alto, pode ser indicada amniocentese ou biopsia de vilosidade corial para diagnóstico definitivo.",
    weeks: [10, 20],
    tags: ["Down", "rastreamento"],
  },
  // 2º Trimestre
  {
    q: "Quando sentirei os primeiros movimentos?",
    a: "Primíparas geralmente sentem entre 18-22 semanas. Quem já teve filhos pode perceber antes, entre 16-18 semanas. No início parece um borbulhar ou 'borboletas'. Não ficou preocupada se demorar — cada corpo é diferente.",
    weeks: [14, 22],
    tags: ["movimentos", "chutes"],
  },
  {
    q: "Posso viajar de avião grávida?",
    a: "Até 28 semanas, viagens aéreas são geralmente seguras com autorização médica. Entre 28-36 semanas, algumas companhias exigem atestado médico. Após 36 semanas, a maioria das companhias não aceita. Levante a cada hora, hidrate-se bem e use meia de compressão.",
    weeks: [14, 36],
    tags: ["viagem", "avião"],
  },
  {
    q: "O que é o exame morfológico do 2º trimestre?",
    a: "A morfológica do 2º trimestre (20-24 semanas) avalia detalhadamente a anatomia fetal: cabeça, coração (4 câmaras), pulmões, rins, fígado, coluna, membros e face. É o exame mais completo da gestação. Um especialista em medicina fetal realiza o exame.",
    weeks: [18, 26],
    tags: ["morfológica", "exames"],
  },
  {
    q: "Preciso fazer o teste de diabetes gestacional?",
    a: "Sim, o TOTG (teste oral de tolerância à glicose) é feito entre 24-28 semanas para todas as gestantes. Se você tem fatores de risco (obesidade, histórico familiar, bebê grande), pode ser feito antes. O diabetes gestacional tem tratamento eficaz.",
    weeks: [22, 30],
    tags: ["diabetes", "TOTG", "exames"],
  },
  // 2º-3º Trimestre
  {
    q: "O que são contrações de Braxton Hicks?",
    a: "São contrações irregulares, sem dor intensa, que preparam o útero para o parto. São normais a partir do 2º trimestre. Diferem do trabalho de parto por serem irregulares, curtas e cessam com mudança de posição. Se ficarem regulares e progressivas, ligue para o médico.",
    weeks: [20, 40],
    tags: ["contrações", "Braxton Hicks"],
  },
  {
    q: "O bebê está em posição correta para o parto?",
    a: "A maioria dos bebês se vira para a posição cefálica (cabeça para baixo) entre as semanas 32-36. Se ainda estiver pélvico (nádegas para baixo) na semana 36, o médico pode tentar uma versão cefálica externa ou planejar a cesárea.",
    weeks: [28, 38],
    tags: ["posição fetal", "pélvico"],
  },
  {
    q: "Posso continuar trabalhando durante a gravidez?",
    a: "Na maioria dos casos sim, até próximo ao parto. A licença-maternidade no Brasil começa a partir de 28 semanas, mas muitas mulheres trabalham até 37-38 semanas. Em gestações de alto risco, o afastamento pode ser necessário antes.",
    weeks: [4, 38],
    tags: ["trabalho", "licença"],
  },
  // 3º Trimestre
  {
    q: "O que é pré-eclâmpsia e como identificar?",
    a: "Pré-eclâmpsia é pressão alta na gestação acompanhada de proteína na urina, geralmente após 20 semanas. Sinais: pressão ≥140x90, inchaço súbito de mãos e rosto, dor de cabeça intensa, visão turva, dor no estômago. Procure o médico imediatamente.",
    weeks: [20, 42],
    tags: ["pré-eclâmpsia", "pressão alta", "urgência"],
  },
  {
    q: "Quanto líquido amniótico é normal?",
    a: "O volume de líquido amniótico é avaliado no ultrassom (ILA — índice de líquido amniótico). Oligoâmnio (pouco líquido) e polidrâmnio (muito líquido) precisam de avaliação. O bebê engole o líquido e urina dentro do útero, mantendo o equilíbrio.",
    weeks: [16, 42],
    tags: ["líquido amniótico"],
  },
  {
    q: "Quais são os sinais de parto prematuro?",
    a: "Contrações regulares antes de 37 semanas, pressão pélvica intensa, dor lombar nova, sangramento, perda de líquido ou muco. Na dúvida, vá ao hospital. Não espere: cada semana dentro do útero conta muito para o bebê prematuro.",
    weeks: [20, 37],
    tags: ["parto prematuro", "urgência"],
  },
  {
    q: "Como saber se é trabalho de parto verdadeiro?",
    a: "Trabalho de parto verdadeiro: contrações regulares a cada 5 minutos, duração de 1 minuto, por 1 hora (regra 5-1-1), que não cessam com mudança de posição e ficam progressivamente mais fortes e frequentes. Falso trabalho: irregular, cessa com repouso.",
    weeks: [36, 42],
    tags: ["parto", "contrações"],
  },
  {
    q: "Posso ter epidural?",
    a: "A anestesia peridural (epidural) é segura e muito usada no parto. Reduz a dor sem impedir os movimentos. Pode ser administrada em qualquer fase do trabalho de parto ativo. Converse com o seu médico sobre seu plano de parto.",
    weeks: [34, 42],
    tags: ["parto", "epidural", "dor"],
  },
  {
    q: "O que levar para a maternidade?",
    a: "Para a mãe: documentos (RG, carteirinha, pré-natal), roupas confortáveis, itens de higiene, calcinha descartável, sutiã de amamentação, absorvente pós-parto. Para o bebê: roupinhas, fraldas, manta, cadeirinha de carro (obrigatória para ir embora). Monte a bolsa a partir de 34 semanas.",
    weeks: [32, 42],
    tags: ["maternidade", "parto", "preparação"],
  },
];

function FAQTab({ gest, onNavigate }: { gest: Gest; onNavigate: (tab: string) => void }) {
  const currentWeek = gest?.weeks ?? 0;
  const [open, setOpen] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(currentWeek === 0);

  const filtered = FAQ_ITEMS.filter((item) => {
    const matchesWeek =
      showAll || currentWeek === 0
        ? true
        : currentWeek >= item.weeks[0] && currentWeek <= item.weeks[1];
    const matchesSearch =
      !search ||
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesWeek && matchesSearch;
  });

  return (
    <div className="max-w-2xl space-y-5">
      {/* ── Suporte em 2 passos: chat primeiro, e-mail se precisar ── */}
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <h2 className="font-serif text-xl">Precisa de ajuda? 💬</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nosso suporte funciona em 2 passos — comece sempre pelo chat.
        </p>
        <div className="mt-4 space-y-2.5">
          <button
            onClick={() => onNavigate("Chat IA")}
            className="press flex w-full items-center gap-3 rounded-2xl bg-primary p-4 text-left text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">
              1️⃣
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">Fale com o chat</span>
              <span className="block text-xs opacity-85">
                Resposta na hora, 24h — resolve a maioria das dúvidas
              </span>
            </span>
          </button>
          <a
            href={`mailto:${DOCTOR.supportEmail}?subject=${encodeURIComponent("Preciso de ajuda — app Obstétrica")}&body=${encodeURIComponent("Olá! Já tentei pelo chat e ainda preciso de ajuda com: ")}`}
            className="press flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-lg">
              2️⃣
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-foreground">
                Não resolveu? Mande um e-mail
              </span>
              <span className="block text-xs text-muted-foreground">
                {DOCTOR.supportEmail} — resposta em até 1 dia útil
              </span>
            </span>
          </a>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          🚨 Emergência médica não é suporte: ligue 192 (SAMU) ou vá à maternidade.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5">
        <h2 className="font-serif text-xl mb-1">Perguntas frequentes</h2>
        {currentWeek > 0 && (
          <p className="text-sm text-muted-foreground">
            Mostrando perguntas relevantes para a semana {currentWeek}
          </p>
        )}
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pergunta..."
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm"
          />
          <button
            onClick={() => setShowAll((v) => !v)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              showAll ? "bg-primary text-white" : "bg-secondary text-foreground"
            }`}
          >
            {showAll ? "Ver da minha semana" : "Ver todas"}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="font-serif text-lg text-foreground/70">Nenhuma pergunta encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-sm font-medium pr-4">{item.q}</span>
                <span className="shrink-0 text-muted-foreground text-sm">
                  {open === i ? "▲" : "▼"}
                </span>
              </button>
              {open === i && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Sem. {item.weeks[0]}–{item.weeks[1]}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-center text-muted-foreground">
        Não encontrou sua dúvida?{" "}
        <button
          onClick={() => onNavigate("Chat IA")}
          className="text-primary font-medium hover:underline"
        >
          Pergunte ao assistente de IA
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feature 41 — Botão do Pânico
───────────────────────────────────────────────────────────────────────────── */

function PânicoTab({
  profile,
  onNavigate,
}: {
  profile: Profile | null;
  onNavigate: (tab: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "sent" | "error" | "save_error">(
    "idle",
  );
  const [location, setLocation] = useState<{ lat: number; lng: number; address?: string } | null>(
    null,
  );
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [cooldown]);

  async function handlePanic() {
    if (cooldown > 0 || status === "locating") return;
    setStatus("locating");

    if (!navigator?.geolocation) {
      setStatus("error");
      return;
    }

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }),
      );
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      let address: string | null = null;
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        );
        const json = await resp.json();
        address = json.display_name ?? null;
      } catch {
        // location name is optional
      }

      setLocation({ lat, lng, address: address ?? undefined });

      const { data: s } = await supabase.auth.getSession();
      const res = s.session
        ? await savePanicEvent({
            data: {
              accessToken: s.session.access_token,
              latitude: lat,
              longitude: lng,
              address,
            },
          })
        : { ok: false as const };

      if (!res.ok) {
        setStatus("save_error");
        toast.error("Não foi possível registrar o alerta — ligue 192 imediatamente");
        return;
      }

      setStatus("sent");
      setLastSent(new Date());
      setCooldown(60);
    } catch (e) {
      setStatus("error");
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Emergency panel */}
      <div className="rounded-3xl border-2 border-red-300 bg-red-50 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-4">
          Emergência obstétrica
        </p>

        {/* Big panic button */}
        <button
          onClick={handlePanic}
          disabled={cooldown > 0 || status === "locating"}
          className={`w-full rounded-2xl py-8 text-white font-bold text-xl transition-all shadow-lg ${
            cooldown > 0
              ? "bg-gray-400 cursor-not-allowed"
              : status === "sent"
                ? "bg-green-500"
                : "bg-red-600 hover:bg-red-700 active:scale-95"
          }`}
        >
          {status === "locating" ? (
            <span>📍 Localizando...</span>
          ) : status === "sent" ? (
            <span>✓ Alerta enviado</span>
          ) : (
            <span>🆘 BOTÃO DE PÂNICO</span>
          )}
        </button>

        {cooldown > 0 && (
          <p className="mt-2 text-center text-xs text-red-600">
            Disponível novamente em {cooldown}s
          </p>
        )}

        {status === "sent" && location && (
          <div className="mt-3 rounded-xl bg-white p-3 text-sm">
            <p className="font-medium text-green-700">✓ Alerta registrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
            {location.address && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{location.address}</p>
            )}
            {lastSent && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Às {lastSent.toLocaleTimeString("pt-BR")}
              </p>
            )}
            <a
              href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-xs text-primary hover:underline"
            >
              Ver no Google Maps →
            </a>
          </div>
        )}

        {status === "error" && (
          <div className="mt-3 rounded-xl bg-white p-3 text-sm text-primary">
            <p className="font-medium">Não foi possível obter localização.</p>
            <p className="text-xs mt-1">
              Permita o acesso à localização no navegador e tente novamente. Mesmo assim, os números
              abaixo estão disponíveis.
            </p>
          </div>
        )}

        {status === "save_error" && (
          <div className="mt-3 rounded-xl bg-white p-3 text-sm text-red-700">
            <p className="font-medium">O alerta não pôde ser registrado.</p>
            <p className="text-xs mt-1">
              Sua localização foi obtida, mas o alerta não pôde ser registrado. Ligue{" "}
              <strong>192</strong> e avise seu contato de emergência diretamente.
            </p>
            {location && (
              <p className="text-xs text-muted-foreground mt-1">
                📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                {location.address ? ` — ${location.address}` : ""}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Emergency numbers — large tap targets */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Ligue agora com um toque
        </p>
        <div className="space-y-2">
          {[
            {
              label: "SAMU",
              subtitle: "Serviço de Atendimento Móvel de Urgência",
              number: "192",
              color: "bg-red-600",
            },
            {
              label: "Bombeiros / Resgate",
              subtitle: "Resgate de emergência",
              number: "193",
              color: "bg-primary/60",
            },
            { label: "CVV", subtitle: "Apoio emocional 24h", number: "188", color: "bg-primary" },
          ].map(({ label, subtitle, number, color }) => (
            <a
              key={number}
              href={`tel:${number}`}
              className={`flex items-center gap-4 rounded-2xl ${color} px-5 py-4 text-white shadow-sm`}
            >
              <span className="text-3xl font-bold">{number}</span>
              <div>
                <p className="font-semibold">{label}</p>
                <p className="text-xs opacity-90">{subtitle}</p>
              </div>
            </a>
          ))}

          {profile?.emergency_phone && (
            <a
              href={`tel:${profile.emergency_phone}`}
              className="flex items-center gap-4 rounded-2xl bg-primary px-5 py-4 text-white shadow-sm"
            >
              <span className="text-2xl">📞</span>
              <div>
                <p className="font-semibold">
                  {profile.emergency_contact ?? "Contato de emergência"}
                </p>
                <p className="text-xs opacity-90">{profile.emergency_phone}</p>
              </div>
            </a>
          )}
        </div>
      </div>

      {/* Sinais de emergência */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Quando ir IMEDIATAMENTE ao hospital
        </p>
        <ul className="space-y-2 text-sm">
          {[
            "🩸 Sangramento intenso",
            "💧 Bolsa rompeu (líquido claro saindo)",
            "😵 Contrações a cada 5 min por 1 hora",
            "👀 Visão turva, dor de cabeça intensa, inchaço súbito",
            "👶 Bebê parou de se mover",
            "🤢 Vômitos incontroláveis",
            "🌡️ Febre acima de 38°C",
          ].map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-xs text-muted-foreground px-4">
        O botão registra sua localização GPS; seu acompanhante designado poderá vê-la na página de
        acompanhamento (últimos 30 minutos). Configure o contato de emergência em{" "}
        <button
          type="button"
          onClick={() => onNavigate("Perfil")}
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          Perfil
        </button>
        .
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feature 45 — Clima & Qualidade do Ar
───────────────────────────────────────────────────────────────────────────── */

type WeatherData = {
  temp: number;
  apparentTemp: number;
  humidity: number;
  weatherCode: number;
  aqi: number | null;
  pm25: number | null;
};

function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "🌤️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

function weatherDesc(code: number): string {
  if (code === 0) return "Céu limpo";
  if (code <= 3) return "Parcialmente nublado";
  if (code <= 48) return "Névoa / Nevoeiro";
  if (code <= 57) return "Chuviscos";
  if (code <= 67) return "Chuva";
  if (code <= 77) return "Neve";
  if (code <= 82) return "Pancadas de chuva";
  return "Tempestade";
}

function aqiLabel(aqi: number): { label: string; color: string } {
  if (aqi <= 20) return { label: "Ótima", color: "text-green-600" };
  if (aqi <= 40) return { label: "Boa", color: "text-lime-600" };
  if (aqi <= 60) return { label: "Moderada", color: "text-amber-600" };
  if (aqi <= 80) return { label: "Ruim", color: "text-primary" };
  return { label: "Muito ruim", color: "text-red-600" };
}

function ClimaTab({ gest }: { gest: Gest }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function fetchWeather() {
    setLoading(true);
    setError(null);
    if (!navigator?.geolocation) {
      setError("Seu navegador não suporta geolocalização. Tente em Chrome ou Firefox.");
      setLoading(false);
      return;
    }
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }),
      );
      const { latitude: lat, longitude: lon } = pos.coords;

      const [wx, aq] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=auto`,
        ).then((r) => r.json()),
        fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5&timezone=auto`,
        )
          .then((r) => r.json())
          .catch(() => null),
      ]);

      setWeather({
        temp: Math.round(wx.current.temperature_2m),
        apparentTemp: Math.round(wx.current.apparent_temperature),
        humidity: Math.round(wx.current.relative_humidity_2m),
        weatherCode: wx.current.weather_code,
        aqi: aq?.current?.european_aqi ?? null,
        pm25: aq?.current?.pm2_5 ?? null,
      });
      setLastUpdate(new Date());
    } catch (e) {
      setError(
        "Não foi possível obter sua localização. Permita o acesso no navegador e tente novamente.",
      );
    }
    setLoading(false);
  }

  const isHot = weather && weather.temp >= 35;
  const isVeryHot = weather && weather.temp >= 38;
  const aqiBad = weather?.aqi != null && weather.aqi > 40;
  const aqiVeryBad = weather?.aqi != null && weather.aqi > 60;
  const hasAlert = isHot || aqiBad;

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-serif text-xl">Clima e qualidade do ar</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Alertas específicos para gestantes
            </p>
          </div>
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {!weather && !loading && (
          <button
            onClick={fetchWeather}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-medium text-white"
          >
            📍 Ver condições atuais
          </button>
        )}

        {loading && (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Obtendo localização...
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-primary/6 border border-primary/20 p-4 text-sm text-primary">
            {error}
          </div>
        )}

        {weather && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-secondary/40 p-4">
                <p className="text-4xl text-center">{weatherEmoji(weather.weatherCode)}</p>
                <p
                  className={`mt-2 text-center text-3xl font-bold ${isVeryHot ? "text-red-600" : isHot ? "text-primary" : ""}`}
                >
                  {weather.temp}°C
                </p>
                <p className="text-center text-xs text-muted-foreground mt-0.5">
                  {weatherDesc(weather.weatherCode)}
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  Sensação: {weather.apparentTemp}°C
                </p>
              </div>
              <div className="rounded-2xl bg-secondary/40 p-4 flex flex-col justify-center gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Umidade</p>
                  <p className="text-xl font-semibold">{weather.humidity}%</p>
                </div>
                {weather.aqi != null && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Qualidade do ar
                    </p>
                    <p className={`text-xl font-semibold ${aqiLabel(weather.aqi).color}`}>
                      {aqiLabel(weather.aqi).label}
                    </p>
                    <p className="text-xs text-muted-foreground">IQA: {weather.aqi}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={fetchWeather}
              className="mt-3 w-full rounded-xl border border-border py-2 text-xs text-muted-foreground hover:bg-secondary"
            >
              Atualizar
            </button>
          </>
        )}
      </div>

      {/* Alerts */}
      {weather && hasAlert && (
        <div className="space-y-3">
          {isVeryHot && (
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">
                ⚠️ Onda de calor — Risco alto para gestantes
              </p>
              <ul className="space-y-1.5 text-sm text-red-800">
                <li>
                  🌡️ Temperatura extrema ({weather.temp}°C) — superaquecimento fetal é perigoso
                </li>
                <li>💧 Beba pelo menos 3L de água ao longo do dia</li>
                <li>❄️ Fique em ambientes refrigerados (ar-condicionado ou ventilador)</li>
                <li>🚫 Evite sol das 10h às 17h sem necessidade</li>
                <li>👁️ Procure o médico se sentir tontura, coração acelerado ou parar de urinar</li>
              </ul>
            </div>
          )}
          {isHot && !isVeryHot && (
            <div className="rounded-2xl border border-primary/20 bg-primary/6 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                🌡️ Temperatura elevada ({weather.temp}°C)
              </p>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li>💧 Aumente a ingestão de água — mínimo 2,5L por dia</li>
                <li>👗 Use roupas leves e frescas (algodão, linho)</li>
                <li>🕙 Evite sol entre 10h e 16h</li>
                <li>🧴 Aplique protetor solar FPS 50+ se sair</li>
                <li>🍋 Aposte em frutas hidratantes: melancia, pepino, laranja</li>
              </ul>
            </div>
          )}
          {aqiVeryBad && (
            <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-2">
                😷 Qualidade do ar muito ruim (IQA: {weather.aqi})
              </p>
              <ul className="space-y-1.5 text-sm text-red-800">
                <li>🏠 FIQUE EM CASA — feche janelas e portas</li>
                <li>🌬️ Use purificador de ar se disponível</li>
                <li>🚫 Cancele atividades ao ar livre</li>
                <li>😮‍💨 Procure o médico se sentir falta de ar, tosse ou dor no peito</li>
              </ul>
            </div>
          )}
          {aqiBad && !aqiVeryBad && (
            <div className="rounded-2xl border border-primary/25 bg-primary/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                😷 Qualidade do ar moderada (IQA: {weather.aqi})
              </p>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li>🌬️ Limite exercícios físicos intensos ao ar livre</li>
                <li>🕙 Prefira horários com menor tráfego (manhã cedo ou noite)</li>
                <li>💧 Mantenha boa hidratação para ajudar as vias aéreas</li>
                <li>🤧 Se sentir irritação nasal ou tosse persistente, informe ao médico</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {weather && !hasAlert && (
        <div className="rounded-2xl border border-green-300 bg-green-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-1">
            ✅ Condições favoráveis para gestantes
          </p>
          <p className="text-sm text-green-800">
            {weather.temp < 28
              ? "Temperatura agradável! Ótimo para uma caminhada leve de 20-30 minutos."
              : "Temperatura amena. Hidrate-se bem e aproveite com moderação."}
            {weather.aqi != null && weather.aqi <= 20
              ? " O ar está limpo — excelente para respirar fundo!"
              : ""}
          </p>
        </div>
      )}

      {!weather && !loading && (
        <div className="rounded-2xl border border-border bg-secondary/30 p-5 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Por que isso é importante na gestação?</p>
          <ul className="space-y-1">
            <li>🌡️ Calor extremo pode causar desidratação e risco ao feto</li>
            <li>😷 Poluição do ar está ligada a parto prematuro e baixo peso ao nascer</li>
            <li>💧 Gestantes precisam de mais hidratação — especialmente no calor</li>
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Feature 50 — Portal Pós-parto
───────────────────────────────────────────────────────────────────────────── */

const EPDS_QUESTIONS = [
  {
    q: "Tenho sido capaz de rir e ver o lado divertido das coisas",
    opts: ["Tanto quanto antes", "Não tanto agora", "Definitivamente menos", "Não consigo mais"],
    reverse: false,
  },
  {
    q: "Tenho aguardado com satisfação as coisas boas que estavam por acontecer",
    opts: [
      "Sim, tanto quanto antes",
      "Um pouco menos que antes",
      "Definitivamente menos",
      "Quase nada",
    ],
    reverse: false,
  },
  {
    q: "Me culpei sem necessidade quando as coisas correram mal",
    opts: ["Nunca", "Raramente", "Às vezes", "Sim, na maioria das vezes"],
    reverse: false,
  },
  {
    q: "Tenho estado ansiosa ou preocupada sem motivo",
    opts: ["Não, de jeito nenhum", "Quase nunca", "Sim, às vezes", "Sim, com muita frequência"],
    reverse: false,
  },
  {
    q: "Tenho sentido medo ou ficado apavorada sem motivo",
    opts: ["Não, nunca", "Não muito", "Sim, às vezes", "Sim, bastante"],
    reverse: false,
  },
  {
    q: "As coisas têm me oprimido",
    opts: [
      "Tenho lidado tão bem quanto antes",
      "Tenho lidado na maioria das vezes",
      "Às vezes não consigo lidar",
      "Não tenho conseguido lidar",
    ],
    reverse: false,
  },
  {
    q: "Tenho me sentido tão infeliz que tenho tido dificuldade em dormir",
    opts: ["Nunca", "Raramente", "Às vezes", "Sim, na maioria das vezes"],
    reverse: false,
  },
  {
    q: "Tenho me sentido triste ou muito mal",
    opts: ["Nunca", "Raramente", "Sim, com bastante frequência", "Sim, na maioria das vezes"],
    reverse: false,
  },
  {
    q: "Tenho estado tão infeliz que tenho chorado",
    opts: ["Nunca", "Às vezes", "Sim, com bastante frequência", "Sim, na maioria das vezes"],
    reverse: false,
  },
  {
    q: "O pensamento de me machucar ocorreu a mim",
    opts: ["Nunca", "Quase nunca", "Às vezes", "Sim, com bastante frequência"],
    reverse: false,
  },
];

const VACCINE_SCHEDULE = [
  { key: "bcg", name: "BCG", disease: "Tuberculose", ageLabel: "Ao nascer" },
  { key: "hepb_0", name: "Hepatite B (1ª)", disease: "Hepatite B", ageLabel: "Ao nascer" },
  { key: "hepb_1", name: "Hepatite B (2ª)", disease: "Hepatite B", ageLabel: "1 mês" },
  { key: "penta_1", name: "Pentavalente (1ª)", disease: "DTP + Hib + HepB", ageLabel: "2 meses" },
  { key: "vip_1", name: "VIP (1ª)", disease: "Poliomielite", ageLabel: "2 meses" },
  { key: "pneumo_1", name: "Pneumocócica 10v (1ª)", disease: "Pneumococo", ageLabel: "2 meses" },
  { key: "rota_1", name: "Rotavírus (1ª)", disease: "Rotavírus", ageLabel: "2 meses" },
  { key: "meningo_1", name: "Meningocócica C (1ª)", disease: "Meningite C", ageLabel: "3 meses" },
  { key: "penta_2", name: "Pentavalente (2ª)", disease: "DTP + Hib + HepB", ageLabel: "4 meses" },
  { key: "vip_2", name: "VIP (2ª)", disease: "Poliomielite", ageLabel: "4 meses" },
  { key: "pneumo_2", name: "Pneumocócica 10v (2ª)", disease: "Pneumococo", ageLabel: "4 meses" },
  { key: "rota_2", name: "Rotavírus (2ª)", disease: "Rotavírus", ageLabel: "4 meses" },
  { key: "penta_3", name: "Pentavalente (3ª)", disease: "DTP + Hib + HepB", ageLabel: "6 meses" },
  { key: "vip_3", name: "VIP (3ª)", disease: "Poliomielite", ageLabel: "6 meses" },
  { key: "fa_1", name: "Febre Amarela", disease: "Febre Amarela", ageLabel: "9 meses" },
  {
    key: "scr_1",
    name: "Tríplice Viral (1ª)",
    disease: "Sarampo/Caxumba/Rubéola",
    ageLabel: "12 meses",
  },
  { key: "hepa_1", name: "Hepatite A (1ª)", disease: "Hepatite A", ageLabel: "12 meses" },
  {
    key: "meningo_ref",
    name: "Meningocócica C (reforço)",
    disease: "Meningite C",
    ageLabel: "12 meses",
  },
  { key: "varicela_1", name: "Varicela (1ª)", disease: "Catapora", ageLabel: "12 meses" },
  {
    key: "dtp_ref1",
    name: "DTP (1º reforço)",
    disease: "Difteria/Tétano/Coqueluche",
    ageLabel: "15 meses",
  },
  { key: "vop_1", name: "VOP (1ª)", disease: "Poliomielite", ageLabel: "15 meses" },
  {
    key: "pneumo_ref",
    name: "Pneumocócica (reforço)",
    disease: "Pneumococo",
    ageLabel: "15 meses",
  },
  {
    key: "scr_2",
    name: "Tríplice Viral (2ª)",
    disease: "Sarampo/Caxumba/Rubéola",
    ageLabel: "15 meses",
  },
];

const MILESTONES_DEF = [
  { key: "primeiro_sorriso", label: "Primeiro sorriso social", emoji: "😊", weekApprox: 6 },
  { key: "vira_cabeca", label: "Vira a cabeça para sons", emoji: "👂", weekApprox: 8 },
  { key: "segura_cabeca", label: "Sustenta a cabeça", emoji: "💪", weekApprox: 12 },
  { key: "rola", label: "Rola sozinho", emoji: "🔄", weekApprox: 16 },
  { key: "gargalhada", label: "Ri alto / gargalha", emoji: "😂", weekApprox: 16 },
  { key: "senta", label: "Senta sem apoio", emoji: "🪑", weekApprox: 26 },
  { key: "first_tooth", label: "Primeiro dente", emoji: "🦷", weekApprox: 26 },
  { key: "papas", label: "Primeiras papas/alimentos", emoji: "🥣", weekApprox: 26 },
  { key: "engatinha", label: "Engatinha", emoji: "🐣", weekApprox: 34 },
  { key: "fica_em_pe", label: "Fica de pé com apoio", emoji: "🧍", weekApprox: 38 },
  { key: "primeiro_passo", label: "Primeiro passo", emoji: "👣", weekApprox: 52 },
  { key: "primeira_palavra", label: "Primeira palavra", emoji: "💬", weekApprox: 52 },
];

function PosPartoTab({
  profile,
  onNavigate,
}: {
  profile: Profile | null;
  onNavigate: (tab: string) => void;
}) {
  const [subTab, setSubTab] = useState<"saúde" | "amamentação" | "marcos" | "vacinas" | "retorno">(
    "saúde",
  );

  if (!profile?.birth_date) {
    return (
      <div className="max-w-md mx-auto rounded-3xl border border-border bg-card p-8 text-center space-y-4">
        <p className="text-4xl">🍼</p>
        <h2 className="font-serif text-xl">Portal Pós-parto</h2>
        <p className="text-sm text-muted-foreground">
          Ative o portal após o nascimento do bebê preenchendo a data de nascimento em{" "}
          <button
            type="button"
            onClick={() => onNavigate("Perfil")}
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Perfil → Pós-parto
          </button>
          .
        </p>
        <div className="rounded-xl bg-secondary/50 p-4 text-left text-sm space-y-1">
          <p className="font-medium">Recursos disponíveis:</p>
          <p>🧠 Rastreio de depressão pós-parto (EPDS)</p>
          <p>🤱 Registro de amamentações</p>
          <p>⭐ Marcos do bebê</p>
          <p>💉 Calendário de vacinas</p>
          <p>📅 Consultas de retorno</p>
        </div>
      </div>
    );
  }

  const birthDate = new Date(profile.birth_date + "T00:00:00");
  const babyAgeDays = Math.floor((Date.now() - birthDate.getTime()) / 86400000);
  const babyAgeWeeks = Math.floor(babyAgeDays / 7);
  const babyName = profile.baby_name ?? "bebê";

  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: "saúde", label: "Bem-estar" },
    { key: "amamentação", label: "Amamentação" },
    { key: "marcos", label: "Marcos" },
    { key: "vacinas", label: "Vacinas" },
    { key: "retorno", label: "Retorno" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5 flex items-center gap-4">
        <span className="text-4xl">🍼</span>
        <div>
          <p className="font-semibold">
            {babyName} nasceu!{" "}
            {babyAgeWeeks > 0
              ? `${babyAgeWeeks} semana${babyAgeWeeks > 1 ? "s" : ""}`
              : `${babyAgeDays} dia${babyAgeDays !== 1 ? "s" : ""}`}{" "}
            de vida
          </p>
          <p className="text-xs text-muted-foreground">
            Nascimento: {birthDate.toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        {subTabs.map((st) => (
          <button
            key={st.key}
            onClick={() => setSubTab(st.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              subTab === st.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {subTab === "saúde" && <PpdSection babyAgeDays={babyAgeDays} />}
      {subTab === "amamentação" && <BreastfeedingSection />}
      {subTab === "marcos" && <MilestonesSection babyAgeWeeks={babyAgeWeeks} babyName={babyName} />}
      {subTab === "vacinas" && <VaccinesSection birthDate={birthDate} />}
      {subTab === "retorno" && <RetornoSection birthDate={birthDate} profile={profile} />}
    </div>
  );
}

// ── PPD Section ────────────────────────────────────────────────────────────

function PpdSection({ babyAgeDays }: { babyAgeDays: number }) {
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [history, setHistory] = useState<PpdScreening[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setLoadingHistory(false);
        return;
      }
      const res = await getMyPpdScreenings({ data: { accessToken: s.session.access_token } });
      if (res.ok) setHistory(res.screenings);
      setLoadingHistory(false);
    })();
  }, []);

  function getScore(ans: (number | null)[]): number {
    return EPDS_QUESTIONS.reduce((sum, q, i) => {
      const v = ans[i] ?? 0;
      return sum + (q.reverse ? 3 - v : v);
    }, 0);
  }

  async function handleSubmit() {
    if (answers.some((a) => a === null)) return;
    const s = getScore(answers as number[]);
    setScore(s);
    setSubmitted(true);
    const { data: sess } = await supabase.auth.getSession();
    if (sess.session) {
      await savePpdScreening({
        data: { accessToken: sess.session.access_token, score: s, answers: answers as number[] },
      });
      const res = await getMyPpdScreenings({ data: { accessToken: sess.session.access_token } });
      if (res.ok) setHistory(res.screenings);
    }
  }

  function scoreColor(s: number) {
    if (s <= 9) return "text-green-600";
    if (s <= 12) return "text-amber-600";
    return "text-red-600";
  }

  function scoreLabel(s: number) {
    if (s <= 9) return "Sem indicativo de depressão pós-parto";
    if (s <= 12) return "Possível depressão leve — monitore e converse com seu médico";
    return "Indicativo de depressão pós-parto — busque apoio profissional";
  }

  const q10Score = submitted ? (answers[9] ?? 0) : 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-1">Rastreio de depressão pós-parto (EPDS)</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Escala de Edimburgo — 10 perguntas sobre como você se sentiu nos últimos 7 dias
        </p>

        {!submitted ? (
          <div className="space-y-6">
            {EPDS_QUESTIONS.map((q, qi) => (
              <div key={qi}>
                <p className="text-sm font-medium mb-2">
                  {qi + 1}. {q.q}
                </p>
                <div className="space-y-1.5">
                  {q.opts.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                      className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                        answers[qi] === oi
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={handleSubmit}
              disabled={answers.some((a) => a === null)}
              className="w-full rounded-full bg-primary py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              Ver resultado
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-secondary/40 p-5 text-center">
              <p className="text-4xl font-bold">
                <span className={scoreColor(score!)}>{score}</span>
                <span className="text-xl text-muted-foreground"> / 30</span>
              </p>
              <p className={`mt-2 font-medium ${scoreColor(score!)}`}>{scoreLabel(score!)}</p>
            </div>

            {score! >= 13 && (
              <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4">
                <p className="font-semibold text-red-700 mb-2">Apoio disponível agora:</p>
                <div className="space-y-2">
                  <a
                    href="tel:188"
                    className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="text-xl">📞</span>
                    <div>
                      <p className="font-semibold text-sm">CVV — Centro de Valorização da Vida</p>
                      <p className="text-lg font-bold text-red-600">188</p>
                    </div>
                  </a>
                </div>
                <p className="mt-2 text-xs text-red-700">
                  Informe o seu médico sobre seu resultado na próxima consulta.
                </p>
              </div>
            )}

            {submitted && q10Score >= 1 && (
              <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4">
                <p className="font-bold text-red-700">🚨 Resposta à questão 10</p>
                <p className="text-sm text-red-700 mt-1">
                  Você indicou ter pensamentos de se machucar. Por favor, ligue imediatamente para o
                  CVV (188) ou vá ao pronto-socorro mais próximo.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setAnswers(Array(10).fill(null));
                setSubmitted(false);
                setScore(null);
              }}
              className="w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-secondary"
            >
              Refazer o rastreio
            </button>
          </div>
        )}
      </div>

      {!loadingHistory && history.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-3">Histórico</h3>
          <div className="space-y-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3"
              >
                <span className="text-sm">
                  {new Date(h.screened_at).toLocaleDateString("pt-BR")}
                </span>
                <span className={`font-semibold ${scoreColor(h.score)}`}>{h.score}/30</span>
                <span className="text-xs text-muted-foreground">
                  {scoreLabel(h.score).split(" — ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground">
        A EPDS é um rastreio, não um diagnóstico. Apenas um profissional de saúde pode diagnosticar
        depressão pós-parto. O resultado deve ser compartilhado com o seu médico.
        {babyAgeDays < 42 && (
          <span> Recomenda-se repetir o rastreio com 6 semanas após o parto.</span>
        )}
      </div>
    </div>
  );
}

// ── Breastfeeding Section ─────────────────────────────────────────────────

function BreastfeedingSection() {
  const [logs, setLogs] = useState<BreastfeedingLog[]>([]);
  const [activeSide, setActiveSide] = useState("esquerdo");
  const [activeLog, setActiveLog] = useState<string | null>(null);
  const [activeStart, setActiveStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!activeLog || !activeStart) return;
    const update = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - activeStart.getTime()) / 1000)));
    update();
    const t = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", update);
    };
  }, [activeLog, activeStart]);

  async function loadLogs() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setLoading(false);
      return;
    }
    const res = await getBreastfeedingLogs({ data: { accessToken: s.session.access_token } });
    if (res.ok) {
      setLogs(res.logs);
      // Retomar mamada em andamento (ex.: após recarregar a página)
      const open = res.logs.find((l) => !l.ended_at);
      if (open) {
        setActiveLog(open.id);
        setActiveStart(new Date(open.started_at));
        setActiveSide(open.side);
      }
    }
    setLoading(false);
  }

  async function handleStart() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await startBreastfeeding({
      data: { accessToken: s.session.access_token, side: activeSide },
    });
    if (res.ok && res.id) {
      setActiveLog(res.id);
      setActiveStart(new Date());
      setElapsed(0);
    }
  }

  async function handleEnd() {
    if (!activeLog) return;
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    await endBreastfeeding({
      data: { accessToken: s.session.access_token, id: activeLog, notes: notes || null },
    });
    setActiveLog(null);
    setActiveStart(null);
    setElapsed(0);
    setNotes("");
    await loadLogs();
  }

  const todayLogs = logs.filter(
    (l) => new Date(l.started_at).toDateString() === new Date().toDateString(),
  );
  const todayCount = todayLogs.length;
  const todayMinutes = todayLogs.reduce((sum, l) => {
    if (!l.ended_at) return sum;
    return (
      sum + Math.round((new Date(l.ended_at).getTime() - new Date(l.started_at).getTime()) / 60000)
    );
  }, 0);

  return (
    <div className="max-w-xl space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-primary">{todayCount}</p>
          <p className="text-xs text-muted-foreground">mamadas hoje</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-primary">{todayMinutes}</p>
          <p className="text-xs text-muted-foreground">minutos hoje</p>
        </div>
      </div>

      {/* Timer */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-4">Registrar mamada</h3>
        {!activeLog ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              {["esquerdo", "direito", "ambos", "mamadeira"].map((side) => (
                <button
                  key={side}
                  onClick={() => setActiveSide(side)}
                  className={`flex-1 rounded-xl py-2 text-xs font-medium capitalize transition-colors ${
                    activeSide === side
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {side === "esquerdo"
                    ? "🤱 Esq."
                    : side === "direito"
                      ? "🤱 Dir."
                      : side === "ambos"
                        ? "🤱 Ambos"
                        : "🍼 Mamadeira"}
                </button>
              ))}
            </div>
            <button
              onClick={handleStart}
              className="w-full rounded-2xl bg-primary py-4 text-base font-semibold text-white"
            >
              ▶ Iniciar mamada
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Em andamento — {activeSide}
            </p>
            <p className="text-5xl font-bold tabular-nums text-primary">
              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </p>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observação opcional..."
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm"
            />
            <button
              onClick={handleEnd}
              className="w-full rounded-2xl bg-secondary py-3 text-sm font-medium text-foreground"
            >
              ■ Finalizar mamada
            </button>
          </div>
        )}
      </div>

      {/* Recent logs */}
      {!loading && logs.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Últimos 7 dias</h3>
          <div className="space-y-2">
            {logs.slice(0, 20).map((log) => {
              const dur = log.ended_at
                ? Math.round(
                    (new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60000,
                  )
                : null;
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="text-xl">{log.side === "mamadeira" ? "🍼" : "🤱"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{log.side}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.started_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {dur != null && (
                    <span className="text-sm font-semibold text-primary">{dur}min</span>
                  )}
                  {!log.ended_at && (
                    <span className="text-xs text-primary font-medium">em andamento</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Milestones Section ────────────────────────────────────────────────────

function MilestonesSection({ babyAgeWeeks, babyName }: { babyAgeWeeks: number; babyName: string }) {
  const [milestones, setMilestones] = useState<BabyMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState(ymdLocal());

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setLoading(false);
        return;
      }
      const res = await getMilestones({ data: { accessToken: s.session.access_token } });
      if (res.ok) setMilestones(res.milestones);
      setLoading(false);
    })();
  }, []);

  function isDone(key: string) {
    return milestones.some((m) => m.milestone_key === key);
  }

  async function toggleMilestone(key: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    if (isDone(key)) {
      await removeMilestone({ data: { accessToken: s.session.access_token, milestoneKey: key } });
      setMilestones((m) => m.filter((x) => x.milestone_key !== key));
    } else {
      await setMilestone({
        data: {
          accessToken: s.session.access_token,
          milestoneKey: key,
          achievedAt: dateInput,
          notes: null,
          customLabel: null,
        },
      });
      setMilestones((m) => [
        ...m,
        { id: "", milestone_key: key, custom_label: null, achieved_at: dateInput, notes: null },
      ]);
    }
    setMarking(null);
  }

  const doneMilestones = MILESTONES_DEF.filter((m) => isDone(m.key));
  const upcoming = MILESTONES_DEF.filter(
    (m) => !isDone(m.key) && m.weekApprox > babyAgeWeeks,
  ).slice(0, 3);

  if (loading) return <TabSkeleton />;

  return (
    <div className="max-w-xl space-y-6">
      {doneMilestones.length > 0 && (
        <div className="rounded-3xl border border-primary/20 bg-primary/6 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
            🎉 {doneMilestones.length} marcos conquistados!
          </p>
          <div className="flex flex-wrap gap-2">
            {doneMilestones.map((m) => (
              <span
                key={m.key}
                className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
              >
                {m.emoji} {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Em breve para {babyName}
          </p>
          <div className="space-y-2">
            {upcoming.map((m) => (
              <div key={m.key} className="flex items-center gap-3 text-sm">
                <span className="text-xl">{m.emoji}</span>
                <span>{m.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  ~{m.weekApprox}ª semana
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="font-semibold flex-1">Todos os marcos</h3>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
          />
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Selecione a data e clique para marcar como conquistado
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MILESTONES_DEF.map((m) => {
            const done = isDone(m.key);
            const rec = milestones.find((x) => x.milestone_key === m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMilestone(m.key)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  done
                    ? "border-primary/25 bg-primary/8"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{m.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.label}</p>
                    {done && rec && (
                      <p className="text-xs text-primary">
                        ✅ {new Date(rec.achieved_at + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {!done && (
                      <p className="text-xs text-muted-foreground">~{m.weekApprox}ª semana</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Vaccines Section ──────────────────────────────────────────────────────

function VaccinesSection({ birthDate }: { birthDate: Date }) {
  const [vaccines, setVaccines] = useState<BabyVaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateInput, setDateInput] = useState(ymdLocal());

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        setLoading(false);
        return;
      }
      const res = await getBabyVaccines({ data: { accessToken: s.session.access_token } });
      if (res.ok) setVaccines(res.vaccines);
      setLoading(false);
    })();
  }, []);

  function isDone(key: string) {
    return vaccines.some((v) => v.vaccine_key === key);
  }

  async function toggleVaccine(key: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    if (isDone(key)) {
      await removeVaccine({ data: { accessToken: s.session.access_token, vaccineKey: key } });
      setVaccines((v) => v.filter((x) => x.vaccine_key !== key));
    } else {
      await markVaccineGiven({
        data: {
          accessToken: s.session.access_token,
          vaccineKey: key,
          administeredAt: dateInput,
          batch: null,
        },
      });
      setVaccines((v) => [
        ...v,
        { id: "", vaccine_key: key, administered_at: dateInput, batch: null },
      ]);
    }
  }

  const done = vaccines.length;
  const total = VACCINE_SCHEDULE.length;

  if (loading) return <TabSkeleton />;

  return (
    <div className="max-w-xl space-y-5">
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Calendário de vacinas</h3>
            <p className="text-xs text-muted-foreground">Calendário Nacional de Vacinação (SUS)</p>
          </div>
          <span className="text-sm font-semibold text-primary">
            {done}/{total}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Data de aplicação:</label>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1 text-xs"
          />
        </div>
      </div>

      <div className="space-y-2">
        {VACCINE_SCHEDULE.map((v) => {
          const done = isDone(v.key);
          const rec = vaccines.find((x) => x.vaccine_key === v.key);
          return (
            <button
              key={v.key}
              onClick={() => toggleVaccine(v.key)}
              className={`w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                done
                  ? "border-green-300 bg-green-50"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span
                className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center text-xs ${done ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground"}`}
              >
                {done ? "✓" : ""}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{v.name}</p>
                <p className="text-xs text-muted-foreground">{v.disease}</p>
                {done && rec && (
                  <p className="text-xs text-green-700">
                    Aplicada em{" "}
                    {new Date(rec.administered_at + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {v.ageLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Return Visits Section ─────────────────────────────────────────────────

function RetornoSection({ birthDate, profile }: { birthDate: Date; profile: Profile }) {
  const [babyWeight, setBabyWeight] = useState("");
  const [weightDate, setWeightDate] = useState(ymdLocal());
  const [weights, setWeights] = useState<BabyWeight[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return;
      const res = await getBabyWeights({ data: { accessToken: s.session.access_token } });
      if (res.ok) setWeights(res.weights);
    })();
  }, []);

  async function handleAddWeight() {
    if (!babyWeight || parseFloat(babyWeight) <= 0) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (s.session) {
      const weightG = Math.round(parseFloat(babyWeight) * 1000);
      await addBabyWeight({
        data: { accessToken: s.session.access_token, measuredAt: weightDate, weightG },
      });
      const res = await getBabyWeights({ data: { accessToken: s.session.access_token } });
      if (res.ok) setWeights(res.weights);
      setBabyWeight("");
    }
    setSaving(false);
  }

  const returnVisits = [
    {
      label: "Revisão pós-parto (mãe)",
      daysAfter: 7,
      note: "Verificar cicatriz, pressão, involução uterina",
    },
    { label: "Consulta pediátrica (bebê)", daysAfter: 15, note: "Peso, reflexos, icterícia" },
    { label: "Revisão 40 dias (mãe)", daysAfter: 40, note: "Consulta completa de puerpério" },
    { label: "Consulta 1 mês (bebê)", daysAfter: 30, note: "Desenvolvimento, vacinas" },
    { label: "Consulta 2 meses (bebê)", daysAfter: 60, note: "Vacinas do 2º mês" },
    { label: "Consulta 4 meses (bebê)", daysAfter: 120, note: "Vacinas do 4º mês" },
    {
      label: "Consulta 6 meses (bebê)",
      daysAfter: 180,
      note: "Início da alimentação complementar",
    },
  ];

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Consultas de retorno</h3>
        <div className="space-y-2">
          {returnVisits.map((v) => {
            const date = new Date(birthDate.getTime() + v.daysAfter * 86400000);
            const isPast = date < new Date();
            return (
              <div
                key={v.label}
                className={`flex items-start gap-3 rounded-2xl border p-4 ${
                  isPast ? "border-border bg-secondary/30 opacity-60" : "border-border bg-card"
                }`}
              >
                <span className="text-xl mt-0.5">{isPast ? "✅" : "📅"}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{v.label}</p>
                  <p className="text-xs text-muted-foreground">{v.note}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {date.toLocaleDateString("pt-BR")}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6">
        <h3 className="font-semibold mb-3">Peso do bebê</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="number"
            step="0.01"
            value={babyWeight}
            onChange={(e) => setBabyWeight(e.target.value)}
            placeholder="Peso em kg (ex: 3.5)"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2 text-sm"
          />
          <input
            type="date"
            value={weightDate}
            onChange={(e) => setWeightDate(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
          <button
            onClick={handleAddWeight}
            disabled={saving || !babyWeight}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            +
          </button>
        </div>
        {weights.length > 0 && (
          <div className="space-y-2">
            {weights.map((w, i) => {
              const prev = weights[i - 1];
              const gain = prev ? w.weight_g - prev.weight_g : null;
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-2.5"
                >
                  <span className="text-xs text-muted-foreground">
                    {new Date(w.measured_at + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                  <span className="font-semibold">{(w.weight_g / 1000).toFixed(2)} kg</span>
                  {gain != null && (
                    <span className={`text-xs ${gain >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {gain >= 0 ? "+" : ""}
                      {gain}g
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 16 — Conquistas
───────────────────────────────────────────────────────── */
function ConquistasTab() {
  const [unlocked, setUnlocked] = useState<{ achievement_key: string; unlocked_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        setLoading(false);
        return;
      }
      const res = await checkAndAwardAchievements({
        data: { accessToken: s.session.access_token },
      });
      if (res.ok) {
        setUnlocked(res.unlocked);
        const recent = res.unlocked
          .filter((a) => Date.now() - new Date(a.unlocked_at).getTime() < 30000)
          .map((a) => a.achievement_key);
        setNewBadges(recent);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <TabSkeleton />;

  const unlockedKeys = new Set(unlocked.map((u) => u.achievement_key));
  const unlockedCount = ACHIEVEMENT_DEFS.filter((d) => unlockedKeys.has(d.key)).length;
  const totalCount = ACHIEVEMENT_DEFS.length;
  const pct = Math.round((unlockedCount / totalCount) * 100);

  const categories = [
    { key: "bebe", label: "Bebê", emoji: "👶" },
    { key: "saude", label: "Saúde", emoji: "❤️" },
    { key: "diario", label: "Diário", emoji: "📝" },
    { key: "educacao", label: "Educação", emoji: "🎓" },
    { key: "familia", label: "Família", emoji: "👨‍👩‍👧" },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Suas conquistas</p>
            <p className="mt-1 font-serif text-2xl">
              {unlockedCount} de {totalCount}
            </p>
            <p className="text-sm text-muted-foreground">badges desbloqueadas</p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary/20 text-base font-bold text-primary">
            {pct}%
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {newBadges.length > 0 && (
        <div className="rounded-3xl border border-primary/25 bg-primary/8 p-5 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-semibold text-foreground">
            {newBadges.length === 1
              ? "Nova conquista desbloqueada!"
              : `${newBadges.length} novas conquistas!`}
          </p>
        </div>
      )}

      {categories.map((cat) => {
        const defs = ACHIEVEMENT_DEFS.filter((d) => d.category === cat.key);
        return (
          <div key={cat.key}>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <span>{cat.emoji}</span> {cat.label}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {defs.map((def) => {
                const isUnlocked = unlockedKeys.has(def.key);
                const unlockedAt = unlocked.find((u) => u.achievement_key === def.key)?.unlocked_at;
                const isNew = newBadges.includes(def.key);
                return (
                  <div
                    key={def.key}
                    className={`rounded-2xl border p-4 text-center transition-all ${
                      isNew
                        ? "border-primary/25 bg-primary/8 shadow-md"
                        : isUnlocked
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-secondary/20 opacity-50"
                    }`}
                  >
                    <div className={`text-3xl mb-2 ${!isUnlocked && "grayscale"}`}>{def.emoji}</div>
                    <p className="text-xs font-semibold">{def.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-tight">
                      {def.description}
                    </p>
                    {isUnlocked && unlockedAt && (
                      <p className="mt-1.5 text-xs text-primary">
                        {new Date(unlockedAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {!isUnlocked && (
                      <p className="mt-1.5 text-xs text-muted-foreground">🔒 bloqueada</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 13 — Loja Curada
───────────────────────────────────────────────────────── */

type ShopProduct = {
  id: string;
  name: string;
  description: string;
  category: "suplementos" | "conforto" | "amamentacao" | "enxoval" | "livros";
  price: string;
  originalPrice: string;
  discount: number;
  link: string;
  weeks_min?: number;
  weeks_max?: number;
  badge?: string;
};

const CURATED_PRODUCTS: ShopProduct[] = [
  {
    id: "p1",
    name: "Ácido Fólico 5mg",
    description: "Essencial no 1º trimestre para prevenção de defeitos do tubo neural.",
    category: "suplementos",
    originalPrice: "R$ 24,00",
    price: "R$ 18,00",
    discount: 25,
    link: "https://www.amazon.com.br/s?k=acido+folico+gestante",
    weeks_min: 1,
    weeks_max: 20,
    badge: "MAIS VENDIDO",
  },
  {
    id: "p2",
    name: "Sulfato Ferroso + Vitamina C",
    description: "Combo para absorção ideal do ferro, prevenindo anemia gestacional.",
    category: "suplementos",
    originalPrice: "R$ 28,00",
    price: "R$ 22,00",
    discount: 21,
    link: "https://www.amazon.com.br/s?k=sulfato+ferroso+vitamina+c",
    weeks_min: 16,
  },
  {
    id: "p3",
    name: "DHA / Ômega-3 Gestante",
    description: "Desenvolvimento cerebral do bebê. 200mg/dia de DHA recomendado.",
    category: "suplementos",
    originalPrice: "R$ 55,00",
    price: "R$ 45,00",
    discount: 18,
    link: "https://www.amazon.com.br/s?k=dha+omega3+gestante",
  },
  {
    id: "p4",
    name: "Travesseiro de Gestante Formato U",
    description: "Apoio lombar, pélvico e para os joelhos. Fundamental após a semana 20.",
    category: "conforto",
    originalPrice: "R$ 159,00",
    price: "R$ 130,00",
    discount: 18,
    link: "https://www.amazon.com.br/s?k=travesseiro+gestante+formato+u",
    weeks_min: 20,
    badge: "MAIS VENDIDO",
  },
  {
    id: "p5",
    name: "Cinta de Suporte Gestacional",
    description: "Alivia dores lombares e suporta o abdômen no 3º trimestre.",
    category: "conforto",
    originalPrice: "R$ 75,00",
    price: "R$ 60,00",
    discount: 20,
    link: "https://www.amazon.com.br/s?k=cinta+abdominal+gestante",
    weeks_min: 28,
  },
  {
    id: "p6",
    name: "Meias de Compressão Gestante",
    description: "Previnem varizes e edemas — problema comum na gravidez.",
    category: "conforto",
    originalPrice: "R$ 45,00",
    price: "R$ 35,00",
    discount: 22,
    link: "https://www.amazon.com.br/s?k=meias+compressao+gestante",
    weeks_min: 14,
  },
  {
    id: "p7",
    name: "Sutiã de Amamentação",
    description: "Alças largas, abertura fácil e tecido respirável para o pós-parto.",
    category: "amamentacao",
    originalPrice: "R$ 57,00",
    price: "R$ 45,00",
    discount: 21,
    link: "https://www.amazon.com.br/s?k=sutia+amamentacao+confortavel",
    weeks_min: 30,
  },
  {
    id: "p8",
    name: "Almofada de Amamentação",
    description: "Posiciona o bebê corretamente durante a mamada, aliviando tensão.",
    category: "amamentacao",
    originalPrice: "R$ 88,00",
    price: "R$ 70,00",
    discount: 20,
    link: "https://www.amazon.com.br/s?k=almofada+amamentacao",
    weeks_min: 30,
  },
  {
    id: "p9",
    name: "Absorvente para Seios Lavável",
    description: "Para vazamentos de colostro no final da gestação e na amamentação.",
    category: "amamentacao",
    originalPrice: "R$ 25,00",
    price: "R$ 20,00",
    discount: 20,
    link: "https://www.amazon.com.br/s?k=absorvente+seios+amamentacao+lavavel",
    weeks_min: 34,
  },
  {
    id: "p10",
    name: "Kit Enxoval Recém-nascido",
    description: "Body, mijão e macacão em algodão orgânico para o RN.",
    category: "enxoval",
    originalPrice: "R$ 99,00",
    price: "R$ 80,00",
    discount: 19,
    link: "https://www.amazon.com.br/s?k=kit+enxoval+recem+nascido+algodao",
    weeks_min: 20,
    badge: "PREPARE-SE",
  },
  {
    id: "p11",
    name: "Banheirinha Dobrável para Bebê",
    description: "Ergonômica, anti-escorregante, economiza espaço.",
    category: "enxoval",
    originalPrice: "R$ 112,00",
    price: "R$ 90,00",
    discount: 20,
    link: "https://www.amazon.com.br/s?k=banheira+bebe+dobravel",
    weeks_min: 24,
  },
  {
    id: "p12",
    name: "Monitor Doppler Fetal",
    description: "Ouça o coração do seu bebê em casa entre as consultas.",
    category: "enxoval",
    originalPrice: "R$ 189,00",
    price: "R$ 150,00",
    discount: 21,
    link: "https://www.amazon.com.br/s?k=doppler+fetal+caseiro",
    weeks_min: 12,
    badge: "OFERTA",
  },
  {
    id: "p13",
    name: "Gravidez Semana a Semana — Livro",
    description: "O guia mais completo em português, com fotos e explicações médicas.",
    category: "livros",
    originalPrice: "R$ 69,00",
    price: "R$ 55,00",
    discount: 20,
    link: "https://www.amazon.com.br/s?k=gravidez+semana+a+semana+livro",
  },
  {
    id: "p14",
    name: "O Bebê da Barriga — Livro",
    description: "Leitura afetiva sobre desenvolvimento fetal, ideal para o casal.",
    category: "livros",
    originalPrice: "R$ 50,00",
    price: "R$ 40,00",
    discount: 20,
    link: "https://www.amazon.com.br/s?k=bebe+da+barriga+livro+gestacao",
  },
  {
    id: "p15",
    name: "Protetor Solar FPS 50+ Gestante",
    description: "Fórmula sem oxi-benzona, segura para a gestação e contra melasma.",
    category: "suplementos",
    originalPrice: "R$ 44,00",
    price: "R$ 35,00",
    discount: 20,
    link: "https://www.amazon.com.br/s?k=protetor+solar+gestante+fps50",
  },
];

const SHOP_CATEGORIES = [
  { key: "all", label: "Tudo" },
  { key: "suplementos", label: "Suplementos" },
  { key: "conforto", label: "Conforto" },
  { key: "amamentacao", label: "Amamentação" },
  { key: "enxoval", label: "Enxoval" },
  { key: "livros", label: "Livros" },
];

// Placeholder visual por categoria (simula foto do produto)
const CAT_VISUAL: Record<
  ShopProduct["category"],
  { bg: string; dark: string; emoji: string; label: string }
> = {
  suplementos: {
    bg: "from-emerald-50 to-teal-100",
    dark: "from-[#0d3322] to-[#1a5c3a]",
    emoji: "💊",
    label: "Suplementos",
  },
  conforto: {
    bg: "from-rose-50 to-rose-100",
    dark: "from-[#2d0a14] to-[#5c1a28]",
    emoji: "🛏️",
    label: "Conforto",
  },
  amamentacao: {
    bg: "from-rose-50 to-pink-100",
    dark: "from-[#3d0b1a] to-[#6b1a32]",
    emoji: "🤱",
    label: "Amamentação",
  },
  enxoval: {
    bg: "from-stone-50 to-stone-100",
    dark: "from-[#1a1410] to-[#2d2218]",
    emoji: "🍼",
    label: "Enxoval",
  },
  livros: {
    bg: "from-amber-50 to-orange-100",
    dark: "from-[#2d1800] to-[#5c3300]",
    emoji: "📖",
    label: "Livros",
  },
};

function ProductSheet({
  product,
  onClose,
  onSelectRelated,
}: {
  product: ShopProduct | null;
  onClose: () => void;
  onSelectRelated: (p: ShopProduct) => void;
}) {
  const vis = product ? CAT_VISUAL[product.category] : null;
  const related = product
    ? CURATED_PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(
        0,
        4,
      )
    : [];

  useEffect(() => {
    document.body.style.overflow = product ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [product]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          product ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-white overflow-hidden transition-transform duration-300 ease-out ${
          product ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "88dvh" }}
      >
        {product && vis && (
          <div className="overflow-y-auto overscroll-contain">
            {/* Handle + fechar */}
            <div className="sticky top-0 z-10 flex items-center justify-center px-4 pt-3 pb-2 bg-white border-b border-gray-100">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
              <button
                onClick={onClose}
                className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Imagem */}
            <div
              className={`relative w-full bg-gradient-to-br ${vis.bg} flex items-center justify-center`}
              style={{ height: 210 }}
            >
              <span className="text-8xl select-none drop-shadow-md">{vis.emoji}</span>
              {product.badge && (
                <span className="absolute top-3 left-3 bg-[#ff7733] text-white text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wide leading-none">
                  {product.badge}
                </span>
              )}
              <span className="absolute bottom-3 left-3 bg-[#00a650] text-white text-[12px] font-bold px-2 py-1 rounded-sm leading-none">
                {product.discount}% OFF
              </span>
            </div>

            {/* Conteúdo */}
            <div className="p-4 space-y-4 pb-8">
              {/* Nome + preços */}
              <div>
                <h2 className="text-[18px] font-semibold text-gray-900 leading-snug">
                  {product.name}
                </h2>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-[13px] text-gray-400 line-through">
                    {product.originalPrice}
                  </span>
                  <span className="text-[26px] font-bold text-gray-900 leading-none">
                    {product.price}
                  </span>
                  <span className="text-[12px] font-bold text-[#00a650]">
                    {product.discount}% OFF
                  </span>
                </div>
                <p className="text-[11px] font-medium text-[#00a650] mt-1">Envio grátis</p>
              </div>

              {/* Recomendação médica */}
              <div className="rounded-xl bg-primary/[0.06] border border-primary/15 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1.5">
                  👨‍⚕️ Por que seu médico recomenda
                </p>
                <p className="text-[13px] text-gray-700 leading-relaxed">{product.description}</p>
              </div>

              {/* Semana recomendada */}
              {(product.weeks_min != null || product.weeks_max != null) && (
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-gray-500">📅 Semana recomendada:</span>
                  <span className="font-semibold text-gray-800">
                    {product.weeks_min != null && product.weeks_max != null
                      ? `Sem. ${product.weeks_min}–${product.weeks_max}`
                      : product.weeks_min != null
                        ? `A partir da sem. ${product.weeks_min}`
                        : `Até a sem. ${product.weeks_max}`}
                  </span>
                </div>
              )}

              {/* Selo de confiança */}
              <p className="text-[10px] text-gray-400">
                ✓ Curado e recomendado pelo seu médico — Ginecologia e Obstetrícia, especialista em
                gestação de alto risco
              </p>

              {/* CTA Amazon */}
              <a
                href={product.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff9900] py-4 text-[15px] font-bold text-white shadow-sm active:scale-[0.98] transition-transform"
              >
                Comprar na Amazon →
              </a>

              {/* Produtos relacionados */}
              {related.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-px bg-gray-100" />
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 shrink-0">
                      Também recomendados
                    </p>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {related.map((r) => {
                      const rv = CAT_VISUAL[r.category];
                      return (
                        <button
                          key={r.id}
                          onClick={() => onSelectRelated(r)}
                          className="flex shrink-0 flex-col rounded-2xl overflow-hidden bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] active:scale-[0.96] transition-transform text-left"
                          style={{ width: 120 }}
                        >
                          <div
                            className={`w-full bg-gradient-to-br ${rv.dark} flex items-center justify-center relative`}
                            style={{ height: 90 }}
                          >
                            <span
                              className="text-[36px] leading-none"
                              style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.2))" }}
                            >
                              {rv.emoji}
                            </span>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-2 pt-4 pb-1.5">
                              <span className="text-white text-[10px] font-bold">
                                −{r.discount}%
                              </span>
                            </div>
                          </div>
                          <div className="px-2 pt-2 pb-2.5">
                            <p className="text-[10px] font-medium line-clamp-2 text-gray-800 leading-snug">
                              {r.name}
                            </p>
                            <div className="flex items-baseline gap-1 mt-1.5">
                              <span className="text-[9px] text-gray-400 line-through">
                                {r.originalPrice}
                              </span>
                              <span className="text-[13px] font-bold text-gray-900 leading-none">
                                {r.price}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function LojaTab({ gest }: { gest: Gest }) {
  const [category, setCategory] = useState("all");
  const [weekFilter, setWeekFilter] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [filtersHidden, setFiltersHidden] = useState(false);
  const lastScrollY = useRef(0);
  const currentWeek = gest?.weeks ?? null;

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > 140 && y > lastScrollY.current + 8) {
        setFiltersHidden(true);
      } else if (y < lastScrollY.current - 6) {
        setFiltersHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const filtered = CURATED_PRODUCTS.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (weekFilter && currentWeek !== null) {
      const afterMin = p.weeks_min == null || currentWeek >= p.weeks_min - 2;
      const beforeMax = p.weeks_max == null || currentWeek <= p.weeks_max + 2;
      if (!afterMin || !beforeMax) return false;
    }
    return true;
  });

  // Produtos em destaque desta semana
  const weekHighlights =
    currentWeek !== null
      ? CURATED_PRODUCTS.filter((p) => {
          const afterMin = p.weeks_min == null || currentWeek >= p.weeks_min;
          const beforeMax = p.weeks_max == null || currentWeek <= p.weeks_max;
          return afterMin && beforeMax;
        }).slice(0, 2)
      : [];

  return (
    <div className="-mx-4 bg-white px-4 pb-8 pt-4 space-y-4">
      {/* ── Header ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-primary/70">
            Curadoria do seu médico
          </p>
          <h2 className="font-serif text-[22px] font-medium leading-tight text-gray-900 mt-0.5">
            Seleção da semana
          </h2>
        </div>
        {currentWeek !== null && (
          <button
            onClick={() => setWeekFilter((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              weekFilter ? "bg-primary text-white" : "border border-primary/30 text-primary"
            }`}
          >
            <span className="text-[10px]">⬤</span> Sem. {currentWeek}
          </button>
        )}
      </div>

      {/* ── Destaque da semana — cards horizontais premium ── */}
      {weekFilter && weekHighlights.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          {weekHighlights.map((p) => {
            const vis = CAT_VISUAL[p.category];
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                className="flex shrink-0 overflow-hidden rounded-2xl shadow-sm text-left active:scale-[0.97] transition-transform"
                style={{ width: 220 }}
              >
                <div
                  className={`bg-gradient-to-br ${vis.dark} flex items-center justify-center`}
                  style={{ width: 72, flexShrink: 0 }}
                >
                  <span className="text-[36px]">{vis.emoji}</span>
                </div>
                <div className="flex flex-col justify-center bg-white px-3 py-3 flex-1 min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary/70 mb-0.5">
                    {vis.label}
                  </span>
                  <p className="text-[11px] font-medium leading-tight line-clamp-2 text-gray-800">
                    {p.name}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-[10px] text-gray-400 line-through">
                      {p.originalPrice}
                    </span>
                    <span className="text-[14px] font-bold text-gray-900">{p.price}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filtros — sticky, some on scroll down ── */}
      <div
        style={{ top: "var(--safe-top)" }}
        className={`sticky z-20 -mx-4 px-4 py-2.5 bg-white/95 backdrop-blur-sm border-b border-gray-100 transition-transform duration-200 ease-in-out ${
          filtersHidden ? "-translate-y-[130%]" : "translate-y-0"
        }`}
      >
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {SHOP_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all ${
                category === c.key
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground/45 hover:text-foreground/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de produtos ─────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="font-serif text-lg text-foreground/70">Nenhum produto neste filtro</p>
          <button
            onClick={() => setWeekFilter(false)}
            className="mt-2 text-xs text-primary underline"
          >
            Ver todos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((product) => {
            const vis = CAT_VISUAL[product.category];
            return (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.09)] active:scale-[0.96] transition-transform text-left"
              >
                {/* Imagem escura — premium */}
                <div
                  className={`relative w-full bg-gradient-to-br ${vis.dark} flex items-center justify-center`}
                  style={{ aspectRatio: "1 / 1" }}
                >
                  <span
                    className="text-[62px] select-none leading-none"
                    style={{ filter: "drop-shadow(0 0 18px rgba(255,255,255,0.25))" }}
                  >
                    {vis.emoji}
                  </span>

                  {/* Label categoria — canto superior direito */}
                  <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-widest text-white/50">
                    {vis.label}
                  </span>

                  {/* Badge destaque — canto superior esquerdo */}
                  {product.badge && (
                    <span className="absolute top-2 left-2 bg-[#ff7733] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide leading-none">
                      {product.badge}
                    </span>
                  )}

                  {/* Faixa de desconto no rodapé da imagem */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pt-6 pb-2">
                    <span className="text-white text-[12px] font-bold">−{product.discount}%</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex flex-col px-2.5 pt-2.5 pb-3">
                  <p className="text-[12px] font-medium leading-snug line-clamp-2 text-gray-800">
                    {product.name}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-400 line-through leading-none">
                      {product.originalPrice}
                    </span>
                    <span className="text-[17px] font-bold text-gray-900 leading-none">
                      {product.price}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] font-medium text-[#00a650]">Envio grátis</span>
                    <span className="text-[9px] font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded-full">
                      ✓ Recomendado
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-center text-[10px] text-gray-400 pb-4">
        Seleção curada · comprar pelo link apoia o portal
      </p>

      <ProductSheet
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onSelectRelated={(p) => setSelectedProduct(p)}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 11 — Consulta Particular
───────────────────────────────────────────────────────── */
function ConsultaParticularTab({ profile }: { profile: Profile | null }) {
  const [consultations, setConsultations] = useState<PrivateConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"list" | "new">("list");
  const [selectedType, setSelectedType] = useState(CONSULT_TYPES[0].key);
  const [preferredDates, setPreferredDates] = useState(["", "", ""]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // PIX do PRÓPRIO médico da paciente (não uma chave central). Começa no
  // fallback central e, se a paciente tiver médico com chave PIX, atualiza.
  const [pix, setPix] = useState<{ key: string; name: string }>({
    key: DOCTOR.pixKey,
    name: DOCTOR.pixName,
  });
  const PIX_KEY = pix.key;
  const PIX_NAME = pix.name;

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await getMyPrivateConsultations({ data: { accessToken: s.session.access_token } });
    if (res.ok) setConsultations(res.consultations);
    // PIX do médico da paciente (fallback central se não houver)
    const pixRes = await getMyDoctorPix({ data: { accessToken: s.session.access_token } });
    if (pixRes.ok && pixRes.pix?.key) {
      setPix({ key: pixRes.pix.key, name: pixRes.pix.name || DOCTOR.pixName });
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRequest() {
    setSubmitting(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }
      const res = await requestPrivateConsultation({
        data: {
          accessToken: s.session.access_token,
          consultType: selectedType,
          preferredDates: preferredDates.filter(Boolean),
          message: message || null,
        },
      });
      if (!res.ok) {
        toast.error("Não foi possível enviar a solicitação. Tente novamente.");
        return;
      }
      setNewId(res.consultation.id);
      setStep("list");
      await load();
    } catch {
      toast.error("Não foi possível enviar a solicitação. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkPayment(id: string) {
    setMarkingId(id);
    try {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        toast.error("Sua sessão expirou. Faça login novamente.");
        return;
      }
      const res = await markPaymentSent({ data: { accessToken: s.session.access_token, id } });
      if (!res.ok) {
        toast.error("Não foi possível registrar o pagamento. Tente novamente.");
        return;
      }
      await load();
    } catch {
      toast.error("Não foi possível registrar o pagamento. Tente novamente.");
    } finally {
      setMarkingId(null);
    }
  }

  const selectedConsultType = CONSULT_TYPES.find((c) => c.key === selectedType) ?? CONSULT_TYPES[0];

  const statusConfig: Record<string, { label: string; color: string; emoji: string }> = {
    pendente_pagamento: {
      label: "Aguardando pagamento",
      color: "border-primary/20 bg-primary/6",
      emoji: "⏳",
    },
    pagamento_enviado: {
      label: "Pagamento enviado — aguardando confirmação",
      color: "border-border bg-secondary/60",
      emoji: "💸",
    },
    confirmado: {
      label: "Confirmado — aguardando agendamento",
      color: "border-green-200 bg-green-50",
      emoji: "✅",
    },
    realizado: { label: "Consulta realizada", color: "border-border bg-secondary/30", emoji: "🏁" },
    cancelado: { label: "Cancelado", color: "border-red-200 bg-red-50", emoji: "❌" },
  };

  if (loading) return <TabSkeleton />;

  if (step === "new") {
    return (
      <div className="max-w-xl space-y-6">
        <button onClick={() => setStep("list")} className="text-sm text-primary">
          ← Voltar
        </button>

        <div className="rounded-3xl border border-border bg-card p-6">
          <h2 className="font-serif text-xl mb-4">Nova consulta particular</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de consulta</label>
              <div className="space-y-3">
                {CONSULT_TYPES.map((ct) => (
                  <label
                    key={ct.key}
                    className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition-all ${
                      selectedType === ct.key ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      value={ct.key}
                      checked={selectedType === ct.key}
                      onChange={() => setSelectedType(ct.key)}
                      className="mt-1 accent-primary"
                    />
                    <div>
                      <p className="font-medium text-sm">{ct.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ct.desc}</p>
                      <p className="text-sm font-semibold text-primary mt-1">{ct.price}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Datas e horários preferidos (opcional)
              </label>
              <div className="space-y-2">
                {preferredDates.map((d, i) => (
                  <input
                    key={i}
                    type="datetime-local"
                    value={d}
                    onChange={(e) => {
                      const next = [...preferredDates];
                      next[i] = e.target.value;
                      setPreferredDates(next);
                    }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Informe até 3 opções — o seu médico confirmará a disponibilidade.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Mensagem (opcional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Descreva brevemente o motivo da consulta..."
                className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm resize-none"
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6">
          <p className="font-semibold mb-3">💳 Pagamento via PIX</p>
          <p className="text-sm text-muted-foreground mb-3">
            Após solicitar, efetue o pagamento via PIX e marque como pago. Seu médico confirmará e
            entrará em contato.
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-background border border-border px-4 py-2.5">
              <span className="text-xs text-muted-foreground">Chave PIX</span>
              <span className="font-mono text-sm font-medium">{PIX_KEY}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-background border border-border px-4 py-2.5">
              <span className="text-xs text-muted-foreground">Favorecido</span>
              <span className="text-sm font-medium">{PIX_NAME}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-background border border-border px-4 py-2.5">
              <span className="text-xs text-muted-foreground">Valor</span>
              <span className="text-sm font-semibold text-primary">
                {selectedConsultType.price}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleRequest}
          disabled={submitting}
          className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitting ? "Solicitando..." : "Solicitar consulta"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-primary mb-1">
          Consultas particulares
        </p>
        <h2 className="font-serif text-2xl">Consulta com {DOCTOR.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Videochamadas particulares sem intermediário. Pagamento via PIX direto ao médico.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CONSULT_TYPES.map((ct) => (
            <div key={ct.key} className="rounded-2xl border border-border bg-secondary/20 p-4">
              <p className="text-sm font-medium">{ct.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{ct.desc}</p>
              <p className="mt-2 font-bold text-primary">{ct.price}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => setStep("new")}
          className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white"
        >
          + Solicitar consulta
        </button>
      </div>

      {newId && (
        <div className="rounded-3xl border border-green-200 bg-green-50 p-5">
          <p className="font-semibold text-green-700">✅ Solicitação enviada!</p>
          <p className="text-sm text-green-600 mt-1">
            {consultations.find((c) => c.id === newId)?.pix_qr_code_base64
              ? "Escaneie o QR Code PIX abaixo ou copie o código para pagar. A confirmação é automática."
              : "Use a chave PIX abaixo para pagar e depois toque em “Marquei o pagamento” — seu médico confirmará manualmente."}
          </p>
        </div>
      )}

      {consultations.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-serif text-xl text-foreground/70">Nenhuma consulta ainda</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Solicite sua primeira consulta particular acima.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {consultations.map((c) => {
            const st = statusConfig[c.status] ?? statusConfig["pendente_pagamento"];
            const typeInfo = CONSULT_TYPES.find((t) => t.key === c.consult_type);
            return (
              <div key={c.id} className={`rounded-2xl border p-5 ${st.color}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {st.emoji} {typeInfo?.label ?? c.consult_type}
                    </p>
                    <p className="text-xs mt-0.5 text-muted-foreground">{st.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Solicitado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    {c.preferred_dates.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Datas sugeridas:{" "}
                        {c.preferred_dates
                          .map((d) => new Date(d).toLocaleString("pt-BR"))
                          .join(", ")}
                      </p>
                    )}
                    {c.message && (
                      <p className="text-xs mt-1 italic text-muted-foreground">"{c.message}"</p>
                    )}
                  </div>
                  {typeInfo && (
                    <span className="shrink-0 font-bold text-sm text-primary">
                      {typeInfo.price}
                    </span>
                  )}
                </div>
                {c.status === "pendente_pagamento" && (
                  <div className="mt-4 space-y-3">
                    {c.pix_qr_code_base64 ? (
                      <>
                        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white/80 p-4">
                          <img
                            src={`data:image/png;base64,${c.pix_qr_code_base64}`}
                            alt="QR Code PIX"
                            className="h-44 w-44 rounded-xl"
                          />
                          <p className="text-xs text-center text-muted-foreground">
                            Escaneie com o app do seu banco ou copie o código abaixo
                          </p>
                        </div>
                        {c.pix_qr_code && (
                          <button
                            onClick={() => navigator.clipboard.writeText(c.pix_qr_code!)}
                            className="w-full rounded-full border border-primary px-4 py-2 text-xs font-medium text-primary hover:bg-primary/5"
                          >
                            📋 Copiar código PIX (copia e cola)
                          </button>
                        )}
                        <p className="text-xs text-center text-muted-foreground">
                          A confirmação é automática — assim que o PIX for processado você receberá
                          a confirmação.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="rounded-xl bg-white/70 border border-border p-3 text-xs space-y-1">
                          <p className="font-medium">
                            Chave PIX: <span className="font-mono">{PIX_KEY}</span>
                          </p>
                          <p>
                            Favorecido: {PIX_NAME} · Valor: {typeInfo?.price ?? "—"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleMarkPayment(c.id)}
                          disabled={markingId === c.id}
                          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
                        >
                          {markingId === c.id ? "..." : "✓ Marquei o pagamento"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        Após confirmar o pagamento, seu médico entrará em contato para confirmar o horário.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 40a — Ciclo Menstrual
───────────────────────────────────────────────────────── */

const TPM_SYMPTOMS = [
  "Cólicas",
  "Dor de cabeça",
  "Irritabilidade",
  "Inchaço",
  "Fadiga",
  "Acne",
  "Sensibilidade nos seios",
  "Insônia",
  "Desejos alimentares",
  "Ansiedade",
];

function cycleLengthDays(cycle: MenstrualCycle): number | null {
  if (!cycle.end_date) return null;
  const start = new Date(cycle.start_date + "T00:00:00");
  const end = new Date(cycle.end_date + "T00:00:00");
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function avgCycleLength(cycles: MenstrualCycle[]): number {
  if (cycles.length < 2) return 28;
  const gaps: number[] = [];
  for (let i = 0; i < cycles.length - 1; i++) {
    const a = new Date(cycles[i + 1].start_date + "T00:00:00").getTime();
    const b = new Date(cycles[i].start_date + "T00:00:00").getTime();
    gaps.push(Math.round((b - a) / 86400000));
  }
  return Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length);
}

function CicloMenstrualTab() {
  const [cycles, setCycles] = useState<MenstrualCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newFlow, setNewFlow] = useState("normal");
  const [newSymptoms, setNewSymptoms] = useState<string[]>([]);
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await getRecentCycles({ data: { accessToken: s.session.access_token } });
    if (res.ok) setCycles(res.cycles);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLogStart() {
    setSubmitting(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setSubmitting(false);
      return;
    }
    const res = await logCycleStart({
      data: {
        accessToken: s.session.access_token,
        startDate: newStartDate,
        flowIntensity: newFlow,
        symptoms: newSymptoms,
        notes: newNotes || null,
      },
    });
    if (res.ok) {
      setShowForm(false);
      setNewSymptoms([]);
      setNewNotes("");
      await load();
    } else {
      toast.error("Não foi possível salvar o ciclo. Tente novamente.");
    }
    setSubmitting(false);
  }

  async function handleMarkEnd(cycleId: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) return;
    const res = await updateCycleEnd({
      data: { accessToken: s.session.access_token, cycleId, endDate },
    });
    if (!res.ok) {
      toast.error("Não foi possível salvar o fim do ciclo. Tente novamente.");
      return;
    }
    setEndingId(null);
    await load();
  }

  async function handleDelete(cycleId: string) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) return;
    const res = await deleteCycle({ data: { accessToken: s.session.access_token, cycleId } });
    if (!res.ok) {
      toast.error("Não foi possível excluir o ciclo. Tente novamente.");
      return;
    }
    await load();
  }

  const avgLen = avgCycleLength(cycles);
  const lastCycle = cycles[0] ?? null;
  const nextPeriod = lastCycle
    ? new Date(new Date(lastCycle.start_date + "T00:00:00").getTime() + avgLen * 86400000)
    : null;
  const fertileWindowStart = nextPeriod ? new Date(nextPeriod.getTime() - 16 * 86400000) : null;
  const fertileWindowEnd = nextPeriod ? new Date(nextPeriod.getTime() - 10 * 86400000) : null;
  const daysToNext = nextPeriod ? Math.round((nextPeriod.getTime() - Date.now()) / 86400000) : null;

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header + predictions */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary mb-1">Próximo período</p>
          {nextPeriod ? (
            <>
              <p className="font-serif text-2xl mt-1">
                {nextPeriod.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {daysToNext !== null && daysToNext > 0
                  ? `em ${daysToNext} dias`
                  : daysToNext === 0
                    ? "pode ser hoje"
                    : `${Math.abs(daysToNext ?? 0)} dias atrás`}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Ciclo médio: {avgLen} dias</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              Registre pelo menos 2 ciclos para calcular.
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary mb-1">
            Janela fértil estimada
          </p>
          {fertileWindowStart && fertileWindowEnd ? (
            <>
              <p className="font-serif text-lg mt-1">
                {fertileWindowStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}{" "}
                — {fertileWindowEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Baseado no ciclo médio. Para concepção, use métodos mais precisos.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">
              Disponível após 2 ciclos registrados.
            </p>
          )}
        </div>
      </div>

      {/* Log button */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white"
        >
          + Registrar período
        </button>
      ) : (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold">Novo registro de período</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Data de início *</label>
              <input
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Intensidade do fluxo</label>
              <select
                value={newFlow}
                onChange={(e) => setNewFlow(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="leve">Leve</option>
                <option value="normal">Normal</option>
                <option value="intenso">Intenso</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Sintomas</label>
            <div className="flex flex-wrap gap-2">
              {TPM_SYMPTOMS.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    setNewSymptoms((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                    )
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    newSymptoms.includes(s)
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground hover:text-primary"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Observações</label>
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLogStart}
              disabled={submitting}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-full border border-border px-5 py-2 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Cycle history */}
      {cycles.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-serif text-xl text-foreground/70">Nenhum ciclo registrado</p>
          <p className="mt-2 text-sm text-muted-foreground">Registre seu primeiro ciclo acima.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold">Histórico de ciclos</h3>
          {cycles.map((cycle, i) => {
            const duration = cycleLengthDays(cycle);
            const gapToNext =
              i > 0
                ? Math.round(
                    (new Date(cycles[i - 1].start_date + "T00:00:00").getTime() -
                      new Date(cycle.start_date + "T00:00:00").getTime()) /
                      86400000,
                  )
                : null;
            const isActive = !cycle.end_date;
            return (
              <div
                key={cycle.id}
                className={`rounded-2xl border p-4 ${isActive ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                          Ativo
                        </span>
                      )}
                      <p className="font-medium text-sm">
                        {new Date(cycle.start_date + "T00:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                        {cycle.end_date &&
                          ` — ${new Date(cycle.end_date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {duration !== null && <span>Duração: {duration} dias</span>}
                      {gapToNext !== null && <span>Ciclo: {gapToNext} dias</span>}
                      {cycle.flow_intensity && <span>Fluxo: {cycle.flow_intensity}</span>}
                    </div>
                    {cycle.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {cycle.symptoms.map((s) => (
                          <span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isActive &&
                      (endingId === cycle.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="rounded-xl border border-border bg-background px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => handleMarkEnd(cycle.id)}
                            className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white"
                          >
                            Ok
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEndingId(cycle.id)}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                        >
                          Encerrar
                        </button>
                      ))}
                    <button
                      onClick={() => handleDelete(cycle.id)}
                      className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground hover:border-red-300 hover:text-red-500"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature 40b — Preventivos
───────────────────────────────────────────────────────── */

type ExamDef = {
  key: string;
  name: string;
  emoji: string;
  frequency: string;
  frequencyMonths: number;
  description: string;
  ageFrom?: number;
};

const PREVENTIVE_EXAMS: ExamDef[] = [
  {
    key: "papanicolau",
    name: "Papanicolau",
    emoji: "🔬",
    frequency: "Anual",
    frequencyMonths: 12,
    description:
      "Rastreamento do câncer de colo do útero. Após 2 exames normais seguidos, pode ser feito a cada 3 anos.",
  },
  {
    key: "mamografia",
    name: "Mamografia",
    emoji: "🩻",
    frequency: "Anual (40+)",
    frequencyMonths: 12,
    description:
      "Rastreamento do câncer de mama. A partir de 40 anos ou 35 anos em caso de histórico familiar.",
    ageFrom: 40,
  },
  {
    key: "ultrassom_tv",
    name: "Ultrassom Pélvico",
    emoji: "📡",
    frequency: "Anual",
    frequencyMonths: 12,
    description:
      "Avaliação dos ovários, útero e endométrio. Detecta cistos, miomas e outras alterações.",
  },
  {
    key: "glicemia",
    name: "Glicemia em Jejum",
    emoji: "🩸",
    frequency: "Anual",
    frequencyMonths: 12,
    description: "Rastreamento de diabetes e pré-diabetes.",
  },
  {
    key: "colesterol",
    name: "Perfil Lipídico",
    emoji: "💉",
    frequency: "A cada 5 anos",
    frequencyMonths: 60,
    description: "Colesterol total, HDL, LDL e triglicérides. Risco cardiovascular.",
  },
  {
    key: "tsh",
    name: "TSH / T4 Livre",
    emoji: "🦋",
    frequency: "A cada 2 anos",
    frequencyMonths: 24,
    description: "Função da tireoide. Importante para mulheres em idade fértil.",
    ageFrom: 35,
  },
  {
    key: "pressao_arterial",
    name: "Pressão Arterial",
    emoji: "💊",
    frequency: "Semestral",
    frequencyMonths: 6,
    description:
      "Controle da pressão arterial. Hipertensão é silenciosa — medir regularmente é fundamental.",
  },
  {
    key: "dentista",
    name: "Dentista",
    emoji: "🦷",
    frequency: "Semestral",
    frequencyMonths: 6,
    description:
      "Saúde bucal com impacto direto na saúde geral. Cáries e inflamações gengivas elevam risco sistêmico.",
  },
  {
    key: "dermatologista",
    name: "Mapeamento de Pintas",
    emoji: "☀️",
    frequency: "Anual",
    frequencyMonths: 12,
    description: "Dermatoscopia para rastreamento do melanoma e outros cânceres de pele.",
  },
  {
    key: "oftalmologista",
    name: "Oftalmologista",
    emoji: "👁️",
    frequency: "A cada 2 anos",
    frequencyMonths: 24,
    description: "Avaliação da visão, pressão intraocular e saúde ocular.",
  },
];

function nextDueDate(lastDone: string | null, frequencyMonths: number): Date | null {
  if (!lastDone) return null;
  const d = new Date(lastDone + "T00:00:00");
  d.setMonth(d.getMonth() + frequencyMonths);
  return d;
}

function PreventivosTab() {
  const [reminders, setReminders] = useState<PreventiveReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await getPreventiveReminders({ data: { accessToken: s.session.access_token } });
    if (res.ok) setReminders(res.reminders);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!editingKey) return;
    setSaving(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setSaving(false);
      return;
    }
    await setPreventiveReminder({
      data: {
        accessToken: s.session.access_token,
        examKey: editingKey,
        lastDoneDate: editDate || null,
        notes: editNotes || null,
      },
    });
    setEditingKey(null);
    await load();
    setSaving(false);
  }

  if (loading) return <TabSkeleton />;

  const reminderMap = Object.fromEntries(reminders.map((r) => [r.exam_key, r]));
  const today = new Date();

  // Group: overdue, due soon (within 60 days), ok
  const examGroups = PREVENTIVE_EXAMS.map((exam) => {
    const r = reminderMap[exam.key];
    const nextDue = r?.last_done_date ? nextDueDate(r.last_done_date, exam.frequencyMonths) : null;
    const daysUntil = nextDue ? Math.round((nextDue.getTime() - today.getTime()) / 86400000) : null;
    let status: "overdue" | "soon" | "ok" | "never" = "never";
    if (r?.last_done_date) {
      if (daysUntil !== null) {
        if (daysUntil < 0) status = "overdue";
        else if (daysUntil <= 60) status = "soon";
        else status = "ok";
      }
    }
    return { exam, r, nextDue, daysUntil, status };
  });

  const overdueCount = examGroups.filter((e) => e.status === "overdue").length;
  const soonCount = examGroups.filter((e) => e.status === "soon").length;
  const neverCount = examGroups.filter((e) => e.status === "never").length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Em atraso",
            value: overdueCount,
            color: "text-red-600 bg-red-50 border-red-200",
          },
          {
            label: "Em breve",
            value: soonCount,
            color: "text-primary bg-primary/6 border-primary/20",
          },
          {
            label: "Não registrado",
            value: neverCount,
            color: "text-muted-foreground bg-secondary border-border",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Exam list */}
      <div className="space-y-3">
        {examGroups.map(({ exam, r, nextDue, daysUntil, status }) => {
          const isEditing = editingKey === exam.key;
          const statusColor =
            status === "overdue"
              ? "border-red-200 bg-red-50"
              : status === "soon"
                ? "border-primary/20 bg-primary/6"
                : status === "ok"
                  ? "border-green-200 bg-green-50"
                  : "border-border bg-card";
          const statusEmoji =
            status === "overdue" ? "⚠️" : status === "soon" ? "🔔" : status === "ok" ? "✅" : "📋";

          return (
            <div key={exam.key} className={`rounded-2xl border p-4 ${statusColor}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-xl shrink-0 mt-0.5">{exam.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{exam.name}</p>
                      <span className="text-sm">{statusEmoji}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{exam.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Frequência recomendada: {exam.frequency}
                    </p>
                    {r?.last_done_date && (
                      <p className="text-xs mt-1">
                        Último:{" "}
                        {new Date(r.last_done_date + "T00:00:00").toLocaleDateString("pt-BR")}
                        {nextDue && ` · Próximo: ${nextDue.toLocaleDateString("pt-BR")} `}
                        {daysUntil !== null && (
                          <span
                            className={
                              daysUntil < 0
                                ? "text-red-600 font-medium"
                                : daysUntil <= 60
                                  ? "text-primary font-medium"
                                  : "text-green-600"
                            }
                          >
                            {daysUntil < 0
                              ? `(${Math.abs(daysUntil)} dias em atraso)`
                              : daysUntil === 0
                                ? "(hoje)"
                                : `(em ${daysUntil} dias)`}
                          </span>
                        )}
                      </p>
                    )}
                    {r?.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">"{r.notes}"</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingKey(isEditing ? null : exam.key);
                    setEditDate(r?.last_done_date ?? "");
                    setEditNotes(r?.notes ?? "");
                  }}
                  className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                >
                  {isEditing ? "Fechar" : r?.last_done_date ? "Atualizar" : "Registrar"}
                </button>
              </div>
              {isEditing && (
                <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Data do último exame</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Observações</label>
                      <input
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Resultado, local, médico..."
                        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground pb-4">
        Frequências baseadas nas diretrizes da FEBRASGO e CFM. Consulte seu médico para orientações
        individualizadas.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MÉDICO TAB — perfil completo do médico associado (DOCTOR config)
// ─────────────────────────────────────────────────────────────────────────────
function MédicoTab() {
  const [token, setToken] = useState<string | null>(null);
  const [link, setLink] = useState<MyDoctorLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DoctorPublic[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function loadLink() {
    const tk = await getToken();
    setToken(tk);
    if (!tk) {
      setLoading(false);
      return;
    }
    const res = await getMyDoctorLink({ data: { accessToken: tk } });
    if (res.ok) setLink(res.link);
    setLoading(false);
  }

  useEffect(() => {
    void loadLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const tk = token ?? (await getToken());
    if (!tk) return;
    setSearching(true);
    const res = await searchDoctors({ data: { accessToken: tk, query: query.trim() } });
    setResults(res.ok ? res.doctors : []);
    setSearched(true);
    setSearching(false);
  }

  async function sendRequest(d: DoctorPublic) {
    const tk = token ?? (await getToken());
    if (!tk) return;
    setBusyId(d.id);
    const res = await requestDoctor({ data: { accessToken: tk, doctorId: d.id } });
    setBusyId(null);
    if (res.ok) {
      toast.success(
        res.status === "accepted"
          ? "Você já está vinculada a esse médico."
          : "Solicitação enviada! Aguarde o médico aceitar.",
      );
      setShowSearch(false);
      await loadLink();
    } else {
      toast.error("Não foi possível enviar a solicitação.");
    }
  }

  async function cancelPending() {
    const tk = token ?? (await getToken());
    if (!tk || !link?.pending) return;
    setBusyId("cancel");
    await cancelDoctorRequest({ data: { accessToken: tk, requestId: link.pending.id } });
    setBusyId(null);
    await loadLink();
  }

  if (loading)
    return <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>;

  const doctor = link?.doctor ?? null;
  const pending = link?.pending ?? null;

  return (
    <div className="space-y-6 pb-8">
      {doctor ? (
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Meu obstetra
          </p>
          <h2 className="mt-1 font-serif text-2xl text-foreground">
            {doctor.display_name || "Obstetra"}
          </h2>
          {(doctor.title || doctor.specialty) && (
            <p className="text-sm text-muted-foreground">
              {[doctor.title, doctor.specialty].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Você está vinculada a este obstetra. No <strong>Chat IA</strong>, o assistente responde
            com o estilo e as condutas que o seu médico validou.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/agendamento"
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Agendar consulta
            </Link>
            <button
              onClick={() => setShowSearch((s) => !s)}
              className="rounded-full border border-primary/40 px-4 py-2 text-sm font-medium text-primary"
            >
              Trocar de médico
            </button>
          </div>
        </div>
      ) : pending ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            Solicitação enviada
          </p>
          <h2 className="mt-1 font-serif text-xl text-foreground">
            Aguardando {pending.doctor.display_name || "o médico"} aceitar
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Assim que o médico aceitar, você poderá conversar com a IA do consultório dele aqui no
            app.
          </p>
          <button
            onClick={cancelPending}
            disabled={busyId === "cancel"}
            className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground disabled:opacity-40"
          >
            Cancelar solicitação
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Meu obstetra
          </p>
          <h2 className="mt-1 font-serif text-xl text-foreground">Encontre o seu obstetra</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Busque pelo nome do seu médico e envie uma solicitação. Quando ele aceitar, seu
            acompanhamento fica conectado — e o Chat IA passa a responder como o consultório dele.
          </p>
        </div>
      )}

      {(!doctor || showSearch) && !pending && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <form onSubmit={doSearch} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome do médico ou especialidade…"
              className="flex-1 rounded-full border border-input bg-card px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={searching}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {searching ? "Buscando…" : "Buscar"}
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {searched && results.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum médico encontrado. Confira o nome ou peça o convite ao seu obstetra.
              </p>
            )}
            {results.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {d.display_name || "Obstetra"}
                  </p>
                  {(d.title || d.specialty) && (
                    <p className="text-xs text-muted-foreground">
                      {[d.title, d.specialty].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => sendRequest(d)}
                  disabled={busyId === d.id}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                >
                  {busyId === d.id ? "Enviando…" : "Solicitar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Exames ---------- */
const EXAM_CATEGORIES = [
  { value: "ultrassom", label: "Ultrassom" },
  { value: "laboratorial", label: "Laboratorial" },
  { value: "cardiotocografia", label: "Cardiotocografia" },
  { value: "outros", label: "Outros" },
];

function ExamesTab({ gest }: { gest: Gest }) {
  const [exams, setExams] = useState<ExamFile[]>([]);
  const [filter, setFilter] = useState("todos");
  const [form, setForm] = useState({ name: "", category: "ultrassom", week: "", notes: "" });
  const [imageData, setImageData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<ExamFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await (supabase as any)
      .from("exam_files")
      .select("*")
      .order("created_at", { ascending: false });
    setExams(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 1200;
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setImageData(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!form.name) return;
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSubmitting(false);
      return;
    }
    const { error } = await (supabase as any).from("exam_files").insert({
      user_id: u.user.id,
      name: form.name,
      category: form.category,
      week: form.week ? Number(form.week) : null,
      notes: form.notes || null,
      image_data: imageData,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível salvar o exame. Tente novamente.");
      return;
    }
    setForm({ name: "", category: "ultrassom", week: "", notes: "" });
    setImageData(null);
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este exame?")) return;
    const { error } = await (supabase as any).from("exam_files").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o exame. Tente novamente.");
      return;
    }
    load();
  }

  const filtered = filter === "todos" ? exams : exams.filter((e) => e.category === filter);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-xl">Adicionar exame</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Fotografe ou importe a imagem do laudo para guardar no seu histórico.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Nome do exame *
            </label>
            <input
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Ex.: Morfológico 2º trimestre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Categoria
            </label>
            <select
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {EXAM_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Semana gestacional
            </label>
            <input
              type="number"
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Ex.: 20"
              value={form.week}
              onChange={(e) => setForm({ ...form, week: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Observações
            </label>
            <input
              className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Médico, clínica, resultado..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary"
          >
            {imageData ? "Trocar foto" : "Adicionar foto do laudo"}
          </button>
          {imageData && (
            <img
              src={imageData}
              alt="pré-visualização da imagem"
              className="h-12 w-12 rounded-lg object-cover ring-2 ring-primary/40"
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
        <button
          onClick={save}
          disabled={submitting || !form.name}
          className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Salvando…" : "Salvar exame"}
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {[{ value: "todos", label: "Todos" }, ...EXAM_CATEGORIES].map((c) => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${filter === c.value ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum exame registrado ainda.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((exam) => (
            <div key={exam.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              {exam.image_data ? (
                <button onClick={() => setPreview(exam)} className="flex-shrink-0">
                  <img
                    src={exam.image_data}
                    alt={exam.name}
                    className="h-16 w-16 rounded-xl object-cover ring-1 ring-border"
                  />
                </button>
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl">
                  📄
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{exam.name}</p>
                <p className="text-xs text-primary mt-0.5">
                  {EXAM_CATEGORIES.find((c) => c.value === exam.category)?.label ?? exam.category}
                  {exam.week ? ` · Sem. ${exam.week}` : ""}
                </p>
                {exam.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{exam.notes}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(exam.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => remove(exam.id)}
                className="text-muted-foreground hover:text-destructive text-lg flex-shrink-0"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-h-[90vh] max-w-2xl overflow-auto rounded-2xl bg-white p-2">
            <img src={preview.image_data!} alt={preview.name} className="max-w-full rounded-xl" />
            <p className="mt-2 text-center text-sm font-medium text-foreground">{preview.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Plano de Parto ---------- */
const PAIN_RELIEF_OPTIONS = [
  "Epidural / peridural",
  "Técnicas de respiração",
  "Banho quente / banheira",
  "Massagem",
  "Óxido nitroso (gás)",
  "Sem medicação — quero tentar natural",
];

function PlanoPártoTab({ profile }: { profile: Profile | null }) {
  const DEFAULTS: BirthPlan = {
    birth_type: "",
    pain_relief: [],
    who_present: "",
    cord_cutting: "",
    skin_to_skin: true,
    breastfeeding: "",
    lighting: "",
    music: "",
    notes: "",
  };
  const [plan, setPlan] = useState<BirthPlan>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("birth_plans").select("*").maybeSingle();
      if (data) setPlan(data as BirthPlan);
      setLoading(false);
    })();
  }, []);

  async function savePlan() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Sua sessão expirou. Faça login novamente.");
      return;
    }
    const { error } = await (supabase as any)
      .from("birth_plans")
      .upsert(
        { ...plan, user_id: u.user.id, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) {
      toast.error("Não foi possível salvar o plano. Tente novamente.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function toggleRelief(opt: string) {
    setPlan((p) => ({
      ...p,
      pain_relief: p.pain_relief.includes(opt)
        ? p.pain_relief.filter((x) => x !== opt)
        : [...p.pain_relief, opt],
    }));
  }

  if (loading)
    return <div className="py-12 text-center text-muted-foreground text-sm">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-2xl">Plano de parto</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Registre suas preferências para compartilhar com o seu médico e a equipe da maternidade. O
          plano é um ponto de partida — decisões clínicas sempre prevalecem.
        </p>
      </div>

      {/* Tipo de parto */}
      <div className="rounded-3xl border border-border bg-card p-6 space-y-3">
        <p className="font-serif text-lg">Tipo de parto desejado</p>
        {[
          { value: "normal", label: "Parto normal / vaginal" },
          { value: "cesarea", label: "Cesárea" },
          { value: "sem_preferencia", label: "Sem preferência — confio na decisão médica" },
        ].map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="birth_type"
              value={opt.value}
              checked={plan.birth_type === opt.value}
              onChange={() => setPlan({ ...plan, birth_type: opt.value })}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">{opt.label}</span>
          </label>
        ))}
      </div>

      {/* Alívio da dor */}
      <div className="rounded-3xl border border-border bg-card p-6 space-y-3">
        <p className="font-serif text-lg">Alívio da dor (marque os que aceitar)</p>
        {PAIN_RELIEF_OPTIONS.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={plan.pain_relief.includes(opt)}
              onChange={() => toggleRelief(opt)}
              className="accent-primary"
            />
            <span className="text-sm text-foreground">{opt}</span>
          </label>
        ))}
      </div>

      {/* Presença e procedimentos */}
      <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
        <p className="font-serif text-lg">Presença e procedimentos</p>
        <PlanoField
          label="Quem você quer presente no parto"
          value={plan.who_present}
          onChange={(v) => setPlan({ ...plan, who_present: v })}
          placeholder="Ex.: meu parceiro, minha mãe"
        />
        <PlanoField
          label="Clampeamento do cordão umbilical"
          value={plan.cord_cutting}
          onChange={(v) => setPlan({ ...plan, cord_cutting: v })}
          placeholder="Ex.: tardio, meu parceiro quer cortar"
        />
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={plan.skin_to_skin}
            onChange={() => setPlan({ ...plan, skin_to_skin: !plan.skin_to_skin })}
            className="accent-primary"
          />
          <span className="text-sm text-foreground">
            Contato pele a pele imediato após o nascimento
          </span>
        </label>
        <PlanoField
          label="Amamentação na sala de parto"
          value={plan.breastfeeding}
          onChange={(v) => setPlan({ ...plan, breastfeeding: v })}
          placeholder="Ex.: quero tentar na primeira hora"
        />
      </div>

      {/* Ambiente */}
      <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
        <p className="font-serif text-lg">Ambiente</p>
        <PlanoField
          label="Iluminação"
          value={plan.lighting}
          onChange={(v) => setPlan({ ...plan, lighting: v })}
          placeholder="Ex.: luz baixa, sem refletores diretos"
        />
        <PlanoField
          label="Música / som"
          value={plan.music}
          onChange={(v) => setPlan({ ...plan, music: v })}
          placeholder="Ex.: playlist pessoal, silêncio"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Observações gerais
          </label>
          <textarea
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            rows={4}
            placeholder="Alergias, medo específico, pedidos especiais..."
            value={plan.notes}
            onChange={(e) => setPlan({ ...plan, notes: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={savePlan}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          {saved ? "Salvo ✓" : "Salvar plano"}
        </button>
        <button
          onClick={() => window.print()}
          className="rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:text-primary"
        >
          Imprimir / salvar PDF
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Imprima ou tire um print para levar à maternidade. Leve também uma cópia para a consulta com
        o seu médico.
      </p>
    </div>
  );
}

function PlanoField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ---------- Apoio Emocional ---------- */
function ApoioEmocionalTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-primary/20 bg-[image:var(--gradient-warm)] p-8">
        <p className="font-serif text-2xl text-foreground">Você não está sozinha.</p>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Perdas gestacionais, diagnósticos difíceis e momentos de medo fazem parte da jornada de
          muitas mulheres — e cada uma delas merece acolhimento, não silêncio.
        </p>
        <p className="mt-3 text-sm italic text-muted-foreground">
          "Cada gestação tem sua própria história. Cuidar de você é tão importante quanto cuidar do
          bebê." — {DOCTOR.name}
        </p>
      </div>

      {/* O que é normal sentir */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-xl">O que é normal sentir</p>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          {[
            "Medo intenso antes de cada ultrassom após uma perda anterior",
            "Sensação de que não pode comemorar antes do bebê nascer",
            "Ansiedade e tristeza coexistindo com alegria — tudo ao mesmo tempo",
            "Raiva, culpa e vazio depois de uma perda gestacional",
            "Dificuldade de vínculo durante a gestação por medo de perder novamente",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Quando buscar ajuda */}
      <div className="rounded-3xl border border-primary/20 bg-primary/6 p-6">
        <p className="font-serif text-lg text-foreground">Quando buscar ajuda profissional</p>
        <ul className="mt-3 space-y-2 text-sm text-foreground">
          {[
            "Tristeza profunda por mais de 2 semanas que não passa",
            "Dificuldade de cuidar de si mesma ou de outras responsabilidades",
            "Pensamentos de não querer continuar a gravidez por medo",
            "Ansiedade que impede o sono ou as atividades do dia a dia",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1">•</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-primary">
          Converse com o seu médico na sua próxima consulta. Ele pode indicar acompanhamento
          psicológico especializado em gestação.
        </p>
      </div>

      {/* Redes de apoio */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-xl">Redes de apoio</p>
        <div className="mt-4 space-y-3">
          {[
            {
              name: "ALMA — Apoio em Luto Materno",
              desc: "Comunidade de apoio para mães que vivenciaram perdas gestacionais. Grupos online e presenciais.",
              url: "https://www.almaluto.com.br",
            },
            {
              name: "CVV — Centro de Valorização da Vida",
              desc: "Apoio emocional 24h — ligue 188 (gratuito) ou acesse o chat online.",
              url: "https://www.cvv.org.br",
            },
            {
              name: "FEBRASGO — Saúde Mental na Gestação",
              desc: "Informações sobre depressão perinatal e ansiedade na gestação.",
              url: "https://www.febrasgo.org.br",
            },
          ].map((r) => (
            <a
              key={r.name}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl border border-border p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <p className="font-medium text-sm text-foreground">{r.name} ↗</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Escrever no diário */}
      <div className="rounded-3xl bg-secondary/40 p-6 text-center">
        <p className="font-serif text-xl">Escreva o que sente</p>
        <p className="mt-2 text-sm text-muted-foreground">
          O diário é um espaço só seu — sem julgamentos, sem respostas certas.
        </p>
        <button
          onClick={() => onNavigate("Diário")}
          className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Abrir meu diário
        </button>
      </div>
    </div>
  );
}
