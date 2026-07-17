import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminData,
  getEngagementData,
  getPreConsultaForms,
  getPatientReport,
  markPreConsultaSeen,
  setQuestionAnswered,
  updateAppointmentStatus,
  confirmAppointment,
  markAppointmentPaid,
  type AdminAppointment,
  type AdminPreConsulta,
  type AdminQuestion,
  type PatientEngagement,
} from "@/lib/admin.functions";
import { computeGestation } from "@/lib/gestacao";
import { ymdLocal } from "@/lib/utils";
import {
  getTeleconsultasAdmin,
  createTeleconsulta,
  openTeleconsultaRoom,
  updateTeleconsultaStatus,
  saveDoctorClinicalNote,
  generateClinicalNote,
  type TeleconsultaSession,
} from "@/lib/teleconsulta.functions";
import {
  getCorporateLeadsAdmin,
  createCorporateAccountAdmin,
  updateLeadStatusAdmin,
  type CorporateLead,
  type CorporateAccount,
} from "@/lib/corporativo.functions";
import {
  getPrivateConsultationsAdmin,
  confirmPaymentAdmin,
  CONSULT_TYPES as PRIVATE_CONSULT_TYPES,
  type PrivateConsultation,
} from "@/lib/consultaparticular.functions";
import {
  getBrainSettings,
  saveBrainSettings,
  listBrainEntries,
  addBrainEntry,
  updateBrainEntry,
  deleteBrainEntry,
  listUnansweredQuestions,
  answerAndTrain,
  testBrain,
  listBrainGaps,
  resolveBrainGap,
  dismissBrainGap,
  draftGapAnswer,
  installStarterPack,
  getBrainQualityStats,
  extractKnowledgeFromTranscript,
  evalBrainQuestion,
  type BrainGap,
  type BrainEntry,
  type BrainSettings,
} from "@/lib/secondbrain.functions";
import {
  getMyDoctor,
  registerDoctor,
  updateMyDoctor,
  getMyReferrals,
  type DoctorProfile,
} from "@/lib/doctors.functions";
import { getDoctorDashboard, type DoctorDashboard } from "@/lib/dashboard.functions";
import {
  startGoogleCalendarConnect,
  getGoogleCalendarStatus,
  disconnectGoogleCalendar,
} from "@/lib/google-calendar.functions";
import { DoctorBadge } from "@/components/doctor-badge";
import {
  listPatientRequests,
  respondPatientRequest,
  listMyPatients,
  setPatientQuizPremium,
  setPatientFetalBpm,
  type PatientRequest,
  type LinkedPatient,
} from "@/lib/patientlink.functions";
import { listLivesAdmin, saveLive, deleteLive, type Live } from "@/lib/lives.functions";
import { BRAIN_EVAL_QUESTIONS } from "@/lib/brain-eval";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({ meta: [{ title: "Painel do médico — Obstétrica" }] }),
  component: PainelPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  done: "Realizada",
  cancelled: "Cancelada",
};
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  done: "bg-sky-100 text-sky-800",
  cancelled: "bg-rose-100 text-rose-700",
};

const PANEL_TABS = [
  "Painel 📊",
  "Calendário",
  "Agendamentos",
  "Agenda",
  "Ferramentas",
  "Perguntas",
  "Cérebro 🧠",
  "Pré-consultas",
  "Teleconsultas",
  "Consultas Pagas",
  "Empresas",
  "Lives",
  "Engajamento",
  "Pacientes 👩‍🍼",
  "Meu Perfil",
] as const;
type PanelTab = (typeof PANEL_TABS)[number];

// Médicos assinantes (fora da equipe da instalação) veem as abas já escopadas
// por doctor_id: painel, agendamentos, perguntas, pré-consultas, engajamento,
// teleconsultas, cérebro, pacientes e perfil — todas recortadas ao PRÓPRIO
// médico no servidor. As abas de dados da instalação inteira (Consultas Pagas,
// Empresas, Calendário/Agenda/Ferramentas globais) seguem só para a equipe.
const DOCTOR_TABS: readonly PanelTab[] = [
  "Painel 📊",
  "Agendamentos",
  "Perguntas",
  "Pré-consultas",
  "Teleconsultas",
  "Engajamento",
  "Cérebro 🧠",
  "Pacientes 👩‍🍼",
  "Meu Perfil",
];

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function PainelPage() {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  // Equipe da instalação (ADMIN_EMAILS) vê tudo; médico assinante vê DOCTOR_TABS
  const [isPlatformTeam, setIsPlatformTeam] = useState(false);
  const [tab, setTab] = useState<PanelTab>("Painel 📊");
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [preForms, setPreForms] = useState<AdminPreConsulta[]>([]);
  const [teleconsultas, setTeleconsultas] = useState<TeleconsultaSession[]>([]);
  const [privateConsults, setPrivateConsults] = useState<any[]>([]);
  const [corporateLeads, setCorporateLeads] = useState<CorporateLead[]>([]);
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateAccount[]>([]);
  const [engagement, setEngagement] = useState<{
    totalPatients: number;
    activeLastWeek: number;
    inactiveLastWeek: number;
    unseenPreConsultas: number;
    patients: PatientEngagement[];
  } | null>(null);

  async function load() {
    try {
      const tk = await token();
      const res = await getAdminData({ data: { accessToken: tk } });
      if (res.ok) {
        // getAdminData já autoriza equipe da instalação E médico assinante ativo,
        // devolvendo os dados recortados (isTeam distingue quem é quem para a UI).
        setAllowed(true);
        setIsPlatformTeam(res.isTeam);
        setAppointments(res.appointments);
        setQuestions(res.questions);
        return;
      }
      // Fallback (getAdminData negou): médico assinante inativo/sem linha ativa?
      const me = await getMyDoctor({ data: { accessToken: tk } });
      if (me.ok && me.doctor?.active) {
        setAllowed(true);
        setIsPlatformTeam(false);
        return;
      }
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadEngagement() {
    const tk = await token();
    const res = await getEngagementData({ data: { accessToken: tk } });
    if (res.ok) setEngagement(res);
  }

  async function loadPreForms() {
    const tk = await token();
    const res = await getPreConsultaForms({ data: { accessToken: tk } });
    if (res.ok) setPreForms(res.forms);
  }

  async function loadTeleconsultas() {
    const tk = await token();
    const res = await getTeleconsultasAdmin({ data: { accessToken: tk } });
    if (res.ok) setTeleconsultas(res.sessions);
  }

  async function loadPrivateConsults() {
    const tk = await token();
    const res = await getPrivateConsultationsAdmin({ data: { accessToken: tk } });
    if (res.ok) setPrivateConsults(res.consultations);
  }

  async function loadCorporate() {
    const tk = await token();
    const res = await getCorporateLeadsAdmin({ data: { accessToken: tk } });
    if (res.ok) {
      setCorporateLeads(res.leads);
      setCorporateAccounts(res.accounts);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Retorno do checkout do Stripe (assinatura do médico): o webhook ativa o
  // plano em segundos. Avisa e recarrega uma vez para refletir o novo plano.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const st = new URLSearchParams(window.location.search).get("assinatura");
    if (!st) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (st === "sucesso") {
      toast.success("Pagamento recebido! Ativando seu plano…");
      setTimeout(() => window.location.reload(), 3000);
    } else if (st === "cancelada") {
      toast("Pagamento não concluído. Você pode assinar quando quiser.");
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    if (tab === "Engajamento" && !engagement) loadEngagement();
    if (tab === "Pré-consultas") loadPreForms();
    if (tab === "Teleconsultas") {
      loadTeleconsultas();
      loadPreForms();
      // O select de pacientes da nova teleconsulta vem do engagement
      if (!engagement) loadEngagement();
    }
    if (tab === "Consultas Pagas") loadPrivateConsults();
    if (tab === "Empresas") loadCorporate();
  }, [tab, allowed]);

  async function changeStatus(id: string, status: AdminAppointment["status"]) {
    setAppointments((a) => a.map((x) => (x.id === id ? { ...x, status } : x)));
    await updateAppointmentStatus({
      data: { accessToken: await token(), id, status: status as never },
    });
  }

  async function toggleAnswered(id: string, answered: boolean) {
    setQuestions((q) => q.map((x) => (x.id === id ? { ...x, answered } : x)));
    await setQuestionAnswered({ data: { accessToken: await token(), id, answered } });
  }

  async function markSeen(id: string) {
    setPreForms((f) => f.map((x) => (x.id === id ? { ...x, seen_by_doctor: true } : x)));
    await markPreConsultaSeen({ data: { accessToken: await token(), id } });
  }

  if (loading)
    return (
      <div className="mx-auto max-w-5xl px-5 py-20 text-center text-muted-foreground">
        Carregando...
      </div>
    );

  if (!allowed)
    return (
      <section className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h1 className="font-serif text-3xl">Área restrita</h1>
        <p className="mt-3 text-muted-foreground">
          Este painel é exclusivo para médicos. Se você é médico(a),{" "}
          <a href="/medicos/cadastro" className="font-semibold text-primary hover:underline">
            crie sua conta aqui
          </a>{" "}
          — leva 2 minutos e os primeiros 14 dias são grátis.
        </p>
      </section>
    );

  const pendingAppts = appointments.filter((a) => a.status === "pending").length;
  const pendingQs = questions.filter((q) => !q.answered).length;
  const unseenForms = preForms.filter((f) => !f.seen_by_doctor).length;

  return (
    <section className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Painel do médico
      </p>
      <h1 className="mt-2 font-serif text-3xl md:text-4xl">Gestão do consultório</h1>

      {/* Resumo — números já recortados por médico no servidor (equipe vê a
          instalação inteira; assinante vê só os próprios). */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Pedidos pendentes" value={pendingAppts} highlight={pendingAppts > 0} />
        <Stat label="Perguntas a responder" value={pendingQs} highlight={pendingQs > 0} />
        <Stat label="Pré-consultas novas" value={unseenForms} highlight={unseenForms > 0} />
        <Stat label="Total agendamentos" value={appointments.length} />
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-border">
        {(isPlatformTeam ? PANEL_TABS : DOCTOR_TABS).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {t}
            {t === "Perguntas" && pendingQs > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {pendingQs}
              </span>
            )}
            {t === "Pré-consultas" && unseenForms > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-white">
                {unseenForms}
              </span>
            )}
            {t === "Teleconsultas" &&
              teleconsultas.filter((s) => s.status === "sala_aberta").length > 0 && (
                <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-xs font-bold text-white">
                  {teleconsultas.filter((s) => s.status === "sala_aberta").length}
                </span>
              )}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "Painel 📊" && <DashboardSection tokenFn={token} onNavigate={setTab} />}
        {tab === "Calendário" && (
          <CalendárioSection appointments={appointments} onNavigate={setTab} />
        )}
        {tab === "Agendamentos" && (
          <AppointmentsSection
            appointments={appointments}
            onChangeStatus={changeStatus}
            onRefresh={load}
          />
        )}
        {tab === "Agenda" && <AgendaSection />}
        {tab === "Perguntas" && (
          <QuestionsSection questions={questions} onToggle={toggleAnswered} />
        )}
        {tab === "Cérebro 🧠" && (
          <CerebroSection
            tokenFn={token}
            showTrainCard={isPlatformTeam}
            onTrained={(id) =>
              setQuestions((q) => q.map((x) => (x.id === id ? { ...x, answered: true } : x)))
            }
          />
        )}
        {tab === "Pacientes 👩‍🍼" && <PacientesSection tokenFn={token} />}
        {tab === "Lives" && <LivesSection tokenFn={token} />}
        {tab === "Meu Perfil" && <MeuPerfilSection tokenFn={token} />}
        {tab === "Pré-consultas" && (
          <PreConsultasSection forms={preForms} onMarkSeen={markSeen} tokenFn={token} />
        )}
        {tab === "Ferramentas" && <FerramentasSection />}
        {tab === "Teleconsultas" && (
          <TeleconsultasSection
            sessions={teleconsultas}
            preForms={preForms}
            onRefresh={loadTeleconsultas}
            tokenFn={token}
            patients={engagement?.patients ?? []}
          />
        )}
        {tab === "Engajamento" && (
          <EngagementSection engagement={engagement} onRefresh={loadEngagement} tokenFn={token} />
        )}
        {tab === "Consultas Pagas" && (
          <ConsultasPagasSection
            consultations={privateConsults}
            onRefresh={loadPrivateConsults}
            tokenFn={token}
          />
        )}
        {tab === "Empresas" && (
          <EmpresasSection
            leads={corporateLeads}
            accounts={corporateAccounts}
            onRefresh={loadCorporate}
            tokenFn={token}
          />
        )}
      </div>
    </section>
  );
}

/* ---------- Painel (dashboard do médico) ---------- */
// Saudação conforme o horário — abre o painel com um tom pessoal.
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// "há X dias/horas" a partir de um ISO — usado nas perguntas recentes.
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

// Tempo economizado pelo cérebro: cada resposta ≈ 3 min do médico.
function savedTimeLabel(hits: number): string {
  const totalMin = hits * 3;
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

const STAGE_META: {
  key: keyof DoctorDashboard["patients"]["stages"];
  label: string;
  bar: string;
  dot: string;
}[] = [
  { key: "t1", label: "1º trimestre", bar: "bg-emerald-400", dot: "bg-emerald-400" },
  { key: "t2", label: "2º trimestre", bar: "bg-sky-400", dot: "bg-sky-400" },
  { key: "t3", label: "3º trimestre", bar: "bg-violet-400", dot: "bg-violet-400" },
  { key: "postparto", label: "Pós-parto", bar: "bg-rose-400", dot: "bg-rose-400" },
  {
    key: "semData",
    label: "Sem data",
    bar: "bg-muted-foreground/40",
    dot: "bg-muted-foreground/40",
  },
];

function DashboardSection({
  tokenFn,
  onNavigate,
}: {
  tokenFn: () => Promise<string>;
  onNavigate: (tab: PanelTab) => void;
}) {
  const [data, setData] = useState<DoctorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await getDoctorDashboard({ data: { accessToken: await tokenFn() } });
      if (res.ok && res.dashboard) setData(res.dashboard);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <DashboardSkeleton />;

  if (error || !data)
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
        <p className="text-4xl">📊</p>
        <p className="mt-3 font-medium">Não foi possível carregar o painel</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente.
        </p>
        <button
          onClick={load}
          className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
        >
          ↺ Tentar de novo
        </button>
      </div>
    );

  return <DashboardView data={data} onNavigate={onNavigate} onRefresh={load} />;
}

/**
 * "Valor gerado este mês": reenquadra os números do painel como retorno (tempo
 * economizado, dúvidas resolvidas pela IA) — o médico lembra POR QUE paga. Se
 * ainda não há uso, vira um empurrão para treinar a IA.
 */
function ValorGeradoBanner({
  aiHits,
  answered,
  activePatients,
  onNavigate,
}: {
  aiHits: number;
  answered: number;
  activePatients: number;
  onNavigate: (tab: PanelTab) => void;
}) {
  const assists = aiHits + answered;

  if (assists === 0 && activePatients === 0) {
    return (
      <div className="fade-slide-up rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <p className="font-serif text-lg">💚 Comece a gerar valor</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Treine o seu <strong>Segundo Cérebro</strong> e convide suas pacientes — assim que a IA
          começar a responder, este espaço mostra quanto tempo você economizou.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate("Cérebro 🧠")}
            className="press rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Treinar minha IA
          </button>
          <button
            onClick={() => onNavigate("Meu Perfil")}
            className="rounded-full border border-border px-4 py-2 text-xs font-medium hover:bg-secondary"
          >
            Convidar pacientes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-slide-up rounded-3xl border border-primary/20 bg-primary/5 p-5">
      <p className="font-serif text-lg">💚 Valor gerado este mês</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ValueTile big={aiHits} label="dúvidas respondidas pela sua IA" />
        <ValueTile big={answered} label="perguntas de pacientes resolvidas" />
        <ValueTile big={savedTimeLabel(assists)} label="do seu tempo economizado (estimativa)" />
        <ValueTile big={activePatients} label="pacientes ativas nos últimos 7 dias" />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Estimativa: cada atendimento da IA equivale a ~3 min seus. É por isso que o plano se paga.
      </p>
    </div>
  );
}

function ValueTile({ big, label }: { big: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-card/70 p-3">
      <p className="font-serif text-2xl font-bold text-primary">{big}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/** Parte visual do dashboard — recebe os dados prontos (permite preview isolado). */
export function DashboardView({
  data,
  onNavigate,
  onRefresh,
}: {
  data: DoctorDashboard;
  onNavigate: (tab: PanelTab) => void;
  onRefresh?: () => void;
}) {
  const { patients, questions, brain, appointments, engagement } = data;
  const stageTotal = STAGE_META.reduce((s, m) => s + patients.stages[m.key], 0);

  return (
    <div className="space-y-8">
      {/* 1. Cabeçalho */}
      <div className="fade-slide-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Painel do médico
          </p>
          <h2 className="mt-1 font-serif text-2xl md:text-3xl">
            {greeting()} 👋 Aqui está o seu consultório hoje
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Atualizado{" "}
            {new Date(data.generatedAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="shrink-0 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ↺ Atualizar
        </button>
      </div>

      {/* Valor gerado no mês — reenquadra os números como ROI (retenção). */}
      <ValorGeradoBanner
        aiHits={brain.hitsThisMonth}
        answered={questions.answered}
        activePatients={patients.active7d}
        onNavigate={onNavigate}
      />

      {/* 2. Cards de destaque */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HeroCard
          icon="👩‍🍼"
          value={patients.total}
          label="Pacientes conectadas"
          hint={
            patients.newThisMonth > 0
              ? `+${patients.newThisMonth} novas neste mês`
              : "Acompanhando você no app"
          }
          tone="primary"
          delay="stagger-1"
        />
        <HeroCard
          icon="⚡"
          value={patients.active7d}
          label="Ativas esta semana"
          hint={`${patients.inactive7d} sem abrir há 7 dias`}
          tone="emerald"
          delay="stagger-2"
        />
        <HeroCard
          icon="💬"
          value={questions.pending}
          label="Perguntas a responder"
          hint={
            questions.pending > 0 ? "Responda e treine o cérebro" : "Tudo respondido, parabéns!"
          }
          tone={questions.pending > 0 ? "amber" : "muted"}
          delay="stagger-3"
        />
        <HeroCard
          icon="📅"
          value={appointments.confirmedUpcoming}
          label="Consultas confirmadas"
          hint={
            appointments.pending > 0
              ? `${appointments.pending} pedido(s) a confirmar`
              : "Nenhum pedido pendente"
          }
          tone="sky"
          delay="stagger-4"
        />
      </div>

      {/* 3. Valor do plano — Segundo Cérebro */}
      <BrainValueCard brain={brain} onNavigate={onNavigate} />

      {/* 4. Gestações por fase */}
      <div className="fade-slide-up rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-serif text-lg">Sua carteira por fase da gestação</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Onde estão as {patients.total} pacientes conectadas agora.
            </p>
          </div>
        </div>
        {stageTotal === 0 ? (
          <p className="mt-5 rounded-2xl bg-secondary/50 p-4 text-sm text-muted-foreground">
            Ainda não há pacientes com dados de gestação. Assim que elas preencherem o perfil, a
            distribuição por trimestre aparece aqui.
          </p>
        ) : (
          <>
            {/* Barra empilhada proporcional */}
            <div className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-secondary/60">
              {STAGE_META.map((m) => {
                const n = patients.stages[m.key];
                if (n === 0) return null;
                return (
                  <div
                    key={m.key}
                    className={`${m.bar} h-full transition-all`}
                    style={{ width: `${(n / stageTotal) * 100}%` }}
                    title={`${m.label}: ${n}`}
                  />
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
              {STAGE_META.map((m) => {
                const n = patients.stages[m.key];
                const pct = stageTotal ? Math.round((n / stageTotal) * 100) : 0;
                return (
                  <div key={m.key} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-none">
                        {n}
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                          {pct}%
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{m.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 5. FAQ inteligente + 6. Perguntas recentes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FaqIntelligenceCard themes={questions.topThemes} onNavigate={onNavigate} />
        <RecentQuestionsCard
          items={questions.recentPending}
          pending={questions.pending}
          onNavigate={onNavigate}
        />
      </div>

      {/* 7. Risco de abandono + 8. Próxima consulta */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChurnRiskCard patients={engagement.churnRisk} />
        <NextAppointmentCard appointments={appointments} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

const HERO_TONE: Record<string, { wrap: string; icon: string; value: string }> = {
  primary: { wrap: "border-primary/25 bg-primary/5", icon: "bg-primary/10", value: "text-primary" },
  emerald: {
    wrap: "border-emerald-300/40 bg-emerald-50/60",
    icon: "bg-emerald-100",
    value: "text-emerald-600",
  },
  amber: {
    wrap: "border-amber-300/50 bg-amber-50/60",
    icon: "bg-amber-100",
    value: "text-amber-600",
  },
  sky: { wrap: "border-sky-300/40 bg-sky-50/60", icon: "bg-sky-100", value: "text-sky-600" },
  muted: { wrap: "border-border bg-card", icon: "bg-secondary", value: "text-foreground" },
};

function HeroCard({
  icon,
  value,
  label,
  hint,
  tone,
  delay,
}: {
  icon: string;
  value: number;
  label: string;
  hint: string;
  tone: keyof typeof HERO_TONE | string;
  delay: string;
}) {
  const t = HERO_TONE[tone] ?? HERO_TONE.muted;
  return (
    <div className={`fade-slide-up ${delay} card-3d rounded-3xl border p-5 ${t.wrap}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xl ${t.icon}`}>
        {icon}
      </div>
      <p className={`mt-3 font-serif text-4xl leading-none ${t.value}`}>{value}</p>
      <p className="mt-2 text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{hint}</p>
    </div>
  );
}

function BrainValueCard({
  brain,
  onNavigate,
}: {
  brain: DoctorDashboard["brain"];
  onNavigate: (tab: PanelTab) => void;
}) {
  const active = brain.hitsThisMonth > 0;
  return (
    <div className="fade-slide-up shine relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/70 p-6 text-primary-foreground shadow-[var(--shadow-card)] md:p-8">
      <div className="relative z-[1] flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-80">
            🧠 O valor do seu plano
          </p>
          {active ? (
            <>
              <p className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
                Seu Segundo Cérebro respondeu{" "}
                <span className="underline decoration-white/40 underline-offset-4">
                  {brain.hitsThisMonth}
                </span>{" "}
                {brain.hitsThisMonth === 1 ? "vez" : "vezes"} este mês
              </p>
              <p className="mt-3 text-sm opacity-90">
                Isso são cerca de <strong>{savedTimeLabel(brain.hitsThisMonth)}</strong> que você
                não precisou gastar digitando respostas — o cérebro atendeu por você, no seu tom, a
                qualquer hora.
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 font-serif text-3xl leading-tight md:text-4xl">
                Seu Segundo Cérebro está pronto para trabalhar por você
              </p>
              <p className="mt-3 text-sm opacity-90">
                Ainda não houve atendimentos automáticos neste mês. Quanto mais respostas você
                treinar, mais o cérebro responde no seu lugar — economizando seu tempo dia após dia.
              </p>
            </>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate("Cérebro 🧠")}
              className="rounded-full bg-white/95 px-5 py-2 text-sm font-semibold text-primary transition-transform hover:scale-[1.03]"
            >
              {active ? "Treinar mais respostas →" : "Treinar meu cérebro →"}
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-medium">
              {brain.enabledApp ? "✅ App" : "⭕ App"} ·{" "}
              {brain.enabledWhatsapp ? "✅ WhatsApp" : "⭕ WhatsApp"}
            </span>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-1">
          <div className="rounded-2xl bg-white/15 px-5 py-3 text-center backdrop-blur-sm">
            <p className="font-serif text-3xl leading-none">{brain.approved}</p>
            <p className="mt-1 text-[11px] opacity-90">respostas que já sabe</p>
          </div>
          <div className="rounded-2xl bg-white/15 px-5 py-3 text-center backdrop-blur-sm">
            <p className="font-serif text-3xl leading-none">{brain.entries}</p>
            <p className="mt-1 text-[11px] opacity-90">itens na base</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqIntelligenceCard({
  themes,
  onNavigate,
}: {
  themes: DoctorDashboard["questions"]["topThemes"];
  onNavigate: (tab: PanelTab) => void;
}) {
  const max = themes.length ? Math.max(...themes.map((t) => t.count)) : 1;
  return (
    <div className="fade-slide-up flex flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-lg">FAQ inteligente 🔎</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Os temas que suas pacientes mais perguntam — treine o cérebro neles e responda uma vez só.
      </p>
      {themes.length === 0 ? (
        <p className="mt-5 flex-1 rounded-2xl bg-secondary/50 p-4 text-sm text-muted-foreground">
          Ainda não há perguntas suficientes para identificar temas. Eles aparecem aqui conforme as
          pacientes usam o chat e enviam dúvidas.
        </p>
      ) : (
        <div className="mt-4 flex flex-1 flex-wrap content-start gap-2">
          {themes.map((t) => {
            // Fonte cresce com a frequência — nuvem de temas simples.
            const scale = 0.85 + (t.count / max) * 0.5;
            return (
              <span
                key={t.theme}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 font-medium text-primary"
                style={{ fontSize: `${scale}rem` }}
              >
                {t.theme}
                <span className="rounded-full bg-primary/15 px-1.5 text-[11px]">{t.count}</span>
              </span>
            );
          })}
        </div>
      )}
      <button
        onClick={() => onNavigate("Cérebro 🧠")}
        className="mt-5 self-start rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
      >
        Treinar o cérebro nesses temas →
      </button>
    </div>
  );
}

function RecentQuestionsCard({
  items,
  pending,
  onNavigate,
}: {
  items: DoctorDashboard["questions"]["recentPending"];
  pending: number;
  onNavigate: (tab: PanelTab) => void;
}) {
  return (
    <div className="fade-slide-up flex flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <p className="font-serif text-lg">Perguntas aguardando você</p>
        {pending > 0 && (
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
            {pending}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 flex-1 rounded-2xl bg-emerald-50/60 p-4 text-sm text-emerald-700">
          🎉 Nenhuma pergunta pendente. Suas pacientes estão em dia!
        </p>
      ) : (
        <ul className="mt-4 flex-1 space-y-2.5">
          {items.map((q) => (
            <li key={q.id} className="rounded-2xl border border-border/70 bg-secondary/30 p-3">
              <p className="line-clamp-2 text-sm text-foreground">{q.question}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(q.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => onNavigate("Cérebro 🧠")}
        className="mt-5 self-start rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Responder e treinar →
      </button>
    </div>
  );
}

function ChurnRiskCard({ patients }: { patients: DoctorDashboard["engagement"]["churnRisk"] }) {
  return (
    <div className="fade-slide-up rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-lg">Oportunidade de reengajar 💛</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Pacientes que já usaram o app mas sumiram há mais de 10 dias — uma mensagem sua faz
        diferença.
      </p>
      {patients.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-emerald-50/60 p-4 text-sm text-emerald-700">
          ✨ Ninguém em risco de abandono. Suas pacientes estão engajadas!
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {patients.map((p, i) => (
            <li
              key={`${p.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/50 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
                  {p.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <p className="truncate text-sm font-medium">{p.name}</p>
              </div>
              <span className="shrink-0 text-xs font-medium text-amber-700">
                há {p.lastActiveDays} dias sem abrir
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NextAppointmentCard({
  appointments,
  onNavigate,
}: {
  appointments: DoctorDashboard["appointments"];
  onNavigate: (tab: PanelTab) => void;
}) {
  return (
    <div className="fade-slide-up flex flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-lg">Agenda 📅</p>
      {appointments.next ? (
        <div className="mt-4 rounded-2xl border border-sky-200/70 bg-sky-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
            Próxima consulta confirmada
          </p>
          <p className="mt-1.5 font-serif text-xl">{appointments.next.patientName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{appointments.next.dateLabel}</p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-secondary/50 p-4 text-sm text-muted-foreground">
          Nenhuma consulta confirmada nos próximos dias.
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">
            {appointments.pending} pedido{appointments.pending === 1 ? "" : "s"} a confirmar
          </p>
          <p className="text-[11px] text-muted-foreground">
            {appointments.confirmedUpcoming} confirmada(s) no total
          </p>
        </div>
        {appointments.pending > 0 && (
          <button
            onClick={() => onNavigate("Agendamentos")}
            className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Ver pedidos →
          </button>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-secondary" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-secondary" />
        ))}
      </div>
      <div className="h-44 animate-pulse rounded-3xl bg-secondary" />
      <div className="h-40 animate-pulse rounded-3xl bg-secondary" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-52 animate-pulse rounded-3xl bg-secondary" />
        <div className="h-52 animate-pulse rounded-3xl bg-secondary" />
      </div>
    </div>
  );
}

/* ---------- Agendamentos ---------- */
function AppointmentsSection({
  appointments,
  onChangeStatus,
  onRefresh,
}: {
  appointments: AdminAppointment[];
  onChangeStatus: (id: string, s: AdminAppointment["status"]) => void;
  onRefresh: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmForm, setConfirmForm] = useState<{
    date: string;
    time: string;
    price: string;
    notes: string;
  }>({ date: "", time: "", price: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [receiptAppt, setReceiptAppt] = useState<AdminAppointment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  async function saveConfirmation(a: AdminAppointment) {
    if (!confirmForm.date || !confirmForm.time) return;
    setSaving(true);
    // Server function com service role: o UPDATE direto do navegador dependia
    // de claim is_admin no JWT (RLS) e falhava silenciosamente sem ele.
    const res = await confirmAppointment({
      data: {
        accessToken: await token(),
        id: a.id,
        confirmedDate: confirmForm.date,
        confirmedTime: confirmForm.time,
        priceBrl: confirmForm.price ? Math.round(Number(confirmForm.price) * 100) : null,
        internalNotes: confirmForm.notes || null,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível confirmar a consulta. Tente novamente.");
      return;
    }
    onChangeStatus(a.id, "confirmed");
    setExpandedId(null);
    onRefresh();
  }

  async function markPaid(id: string) {
    const res = await markAppointmentPaid({ data: { accessToken: await token(), id } });
    if (!res.ok) {
      toast.error(res.error || "Não foi possível marcar como pago. Tente novamente.");
      return;
    }
    onRefresh();
  }

  function pixWhatsApp(a: AdminAppointment) {
    const price = (a as any).price_brl ? ((a as any).price_brl / 100).toFixed(2) : "___";
    const msg = encodeURIComponent(
      `Olá, ${a.patient_name}! Para confirmar sua consulta no dia ${(a as any).confirmed_date ? new Date((a as any).confirmed_date + "T00:00:00").toLocaleDateString("pt-BR") : new Date(a.preferred_date + "T00:00:00").toLocaleDateString("pt-BR")} às ${(a as any).confirmed_time ?? a.preferred_time}, envie R$ ${price} via PIX para a chave: ${DOCTOR.pixKey} (${DOCTOR.pixName}). Após o pagamento, envie o comprovante aqui. Obrigado!`,
    );
    window.open(`https://wa.me/55${a.patient_phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  }

  function exportIcal() {
    const confirmed = appointments.filter(
      (a) => (a as any).confirmed_date && a.status === "confirmed",
    );
    if (!confirmed.length) {
      alert("Nenhuma consulta confirmada com data definida.");
      return;
    }
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Obstetrica//Agenda//PT-BR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      // VTIMEZONE é obrigatório quando DTSTART usa TZID (RFC 5545).
      // Brasil não tem horário de verão desde 2019: offset fixo -03.
      "BEGIN:VTIMEZONE",
      "TZID:America/Sao_Paulo",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:-0300",
      "TZOFFSETTO:-0300",
      "TZNAME:-03",
      "END:STANDARD",
      "END:VTIMEZONE",
    ];
    const dtstamp = `${ymdLocal().replace(/-/g, "")}T000000Z`;
    for (const a of confirmed) {
      const d = (a as any).confirmed_date as string;
      const t = ((a as any).confirmed_time ?? "08:00") as string;
      const start = `${d.replace(/-/g, "")}T${t.replace(":", "")}00`;
      // Fim = início + 1h via aritmética de Date: vira o dia corretamente
      // (23:00 → 00:00 do dia seguinte, sem gerar hora 24 inválida).
      const [h, m] = t.split(":").map(Number);
      const endDate = new Date(`${d}T00:00:00`);
      endDate.setHours(h + 1, m);
      const end = `${ymdLocal(endDate).replace(/-/g, "")}T${String(endDate.getHours()).padStart(2, "0")}${String(endDate.getMinutes()).padStart(2, "0")}00`;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${a.id}@doutorclovis`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;TZID=America/Sao_Paulo:${start}`,
        `DTEND;TZID=America/Sao_Paulo:${end}`,
        `SUMMARY:Consulta — ${a.patient_name}`,
        `DESCRIPTION:Motivo: ${a.reason}. Tel: ${a.patient_phone}`,
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "agenda-obstetrica.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  const filtered =
    filterStatus === "all" ? appointments : appointments.filter((a) => a.status === filterStatus);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "confirmed", "done", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary"}`}
            >
              {s === "all"
                ? `Todos (${appointments.length})`
                : `${STATUS_LABEL[s]} (${appointments.filter((a) => a.status === s).length})`}
            </button>
          ))}
        </div>
        <button
          onClick={exportIcal}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          ⬇ Exportar .ics
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido nesta categoria.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const ext = a as any;
            const isExpanded = expandedId === a.id;
            const payStatus = ext.payment_status ?? "sem_cobranca";
            return (
              <div
                key={a.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{a.patient_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.patient_phone} · {a.patient_email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {payStatus === "pago" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        💰 Pago
                      </span>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[a.status] ?? ""}`}
                    >
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-0.5 text-sm">
                  <p>
                    <strong>Preferência:</strong>{" "}
                    {new Date(a.preferred_date + "T00:00:00").toLocaleDateString("pt-BR")} às{" "}
                    {a.preferred_time}
                  </p>
                  {ext.confirmed_date && (
                    <p className="text-emerald-700 font-medium">
                      ✓ Confirmado para:{" "}
                      {new Date(ext.confirmed_date + "T00:00:00").toLocaleDateString("pt-BR")} às{" "}
                      {ext.confirmed_time}
                      {ext.price_brl && ` · R$ ${(ext.price_brl / 100).toFixed(2)}`}
                    </p>
                  )}
                  <p>
                    <strong>Motivo:</strong> {a.reason}
                  </p>
                  {a.notes && (
                    <p className="text-muted-foreground">
                      <strong>Obs.:</strong> {a.notes}
                    </p>
                  )}
                  {ext.internal_notes && (
                    <p className="text-primary text-xs">📝 Nota interna: {ext.internal_notes}</p>
                  )}
                </div>

                {/* Confirm with time panel */}
                {isExpanded && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-medium mb-3">Confirmar com horário definitivo</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Data confirmada *</label>
                        <input
                          type="date"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.date}
                          onChange={(e) => setConfirmForm({ ...confirmForm, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Horário confirmado *
                        </label>
                        <input
                          type="time"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.time}
                          onChange={(e) => setConfirmForm({ ...confirmForm, time: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">
                          Valor (R$) — opcional
                        </label>
                        <input
                          type="number"
                          placeholder="Ex: 350"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.price}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, price: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Nota interna</label>
                        <input
                          placeholder="Apenas visível para você"
                          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                          value={confirmForm.notes}
                          onChange={(e) =>
                            setConfirmForm({ ...confirmForm, notes: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => saveConfirmation(a)}
                        disabled={saving || !confirmForm.date || !confirmForm.time}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
                      >
                        {saving ? "Salvando…" : "✓ Confirmar consulta"}
                      </button>
                      <button
                        onClick={() => setExpandedId(null)}
                        className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {a.status === "pending" && (
                    <button
                      onClick={() => {
                        setExpandedId(isExpanded ? null : a.id);
                        setConfirmForm({
                          date: a.preferred_date,
                          time: a.preferred_time,
                          price: "",
                          notes: "",
                        });
                      }}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Confirmar com horário
                    </button>
                  )}
                  {(["done", "cancelled", "pending"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onChangeStatus(a.id, s)}
                      disabled={a.status === s}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-40"
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                  <a
                    href={`https://wa.me/55${a.patient_phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    WhatsApp
                  </a>
                  {ext.price_brl && payStatus !== "pago" && (
                    <button
                      onClick={() => pixWhatsApp(a)}
                      className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                    >
                      💰 Cobrar via PIX
                    </button>
                  )}
                  {ext.price_brl && payStatus !== "pago" && (
                    <button
                      onClick={() => markPaid(a.id)}
                      className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
                    >
                      ✓ Marcar pago
                    </button>
                  )}
                  {a.status === "confirmed" && (
                    <button
                      onClick={() => setReceiptAppt(a)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
                    >
                      🖨 Recibo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt Modal */}
      {receiptAppt && <ReceiptModal appt={receiptAppt} onClose={() => setReceiptAppt(null)} />}
    </div>
  );
}

/* ---------- Perguntas ---------- */
function QuestionsSection({
  questions,
  onToggle,
}: {
  questions: AdminQuestion[];
  onToggle: (id: string, answered: boolean) => void;
}) {
  return (
    <div>
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pergunta ainda.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
            >
              <div>
                <p className="text-sm text-muted-foreground">{q.patient}</p>
                <p className="mt-1 text-foreground">{q.question}</p>
              </div>
              <button
                onClick={() => onToggle(q.id, !q.answered)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  q.answered
                    ? "bg-emerald-100 text-emerald-800"
                    : "border border-border text-muted-foreground hover:text-primary"
                }`}
              >
                {q.answered ? "Respondida ✓" : "Marcar respondida"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Pré-consultas (Feature 11 + 47) ---------- */
function PreConsultasSection({
  forms,
  onMarkSeen,
  tokenFn,
}: {
  forms: AdminPreConsulta[];
  onMarkSeen: (id: string) => void;
  tokenFn: () => Promise<string>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  async function loadReport(userId: string) {
    setReportLoading(true);
    const tk = await tokenFn();
    const res = await getPatientReport({ data: { accessToken: tk, userId } });
    if (res.ok) setReportData(res);
    setReportLoading(false);
  }

  function printReport() {
    window.print();
  }

  if (forms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma pré-consulta recebida ainda. As pacientes podem preenchê-la em{" "}
        <strong>Minha Conta → Pré-consulta</strong>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {forms.map((f) => (
        <div
          key={f.id}
          className={`rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] ${!f.seen_by_doctor ? "border-primary/40" : "border-border"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{f.patient_name}</p>
                {!f.seen_by_doctor && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    Nova
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Semana {f.weeks_at_submission ?? "—"} ·{" "}
                {new Date(f.submitted_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setExpandedId((id) => (id === f.id ? null : f.id));
                  if (!f.seen_by_doctor) onMarkSeen(f.id);
                  if (expandedId !== f.id) loadReport(f.user_id);
                }}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
              >
                {expandedId === f.id ? "Fechar" : "Ver relatório"}
              </button>
            </div>
          </div>

          {/* Quick summary chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {f.symptoms.map((s) => (
              <span key={s} className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                {s}
              </span>
            ))}
            {f.current_weight && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                ⚖️ {f.current_weight} kg
              </span>
            )}
            {f.systolic && f.diastolic && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                💓 {f.systolic}/{f.diastolic}
              </span>
            )}
          </div>

          {f.questions && (
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>Perguntas:</strong> {f.questions}
            </p>
          )}

          {/* Expanded report */}
          {expandedId === f.id && (
            <div className="mt-5 border-t border-border pt-5">
              {reportLoading ? (
                <p className="text-sm text-muted-foreground">Carregando relatório...</p>
              ) : reportData ? (
                <PatientReportView data={reportData} formData={f} onPrint={printReport} />
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PatientReportView({
  data,
  formData,
  onPrint,
}: {
  data: any;
  formData: AdminPreConsulta;
  onPrint: () => void;
}) {
  const { profile, healthLogs, journals, kicks, pendingQuestions } = data;
  const gest = profile
    ? computeGestation({
        lmp: profile.lmp_date,
        referenceDate: profile.reference_date,
        referenceWeeks: profile.reference_weeks,
        referenceDays: profile.reference_days,
      })
    : null;

  const lastLog = healthLogs?.[0];
  const completeSessions = (kicks ?? []).filter((k: any) => k.kick_count >= 10).length;

  return (
    <div className="space-y-5 print:p-8">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl">Relatório Pré-consulta</h3>
        <button
          onClick={onPrint}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary print:hidden"
        >
          🖨️ Imprimir
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <InfoBox label="Paciente" value={profile?.display_name ?? "—"} />
        <InfoBox label="Bebê" value={profile?.baby_name ?? "—"} />
        <InfoBox
          label="IG na pré-consulta"
          value={
            formData.weeks_at_submission
              ? `${formData.weeks_at_submission} semanas`
              : gest
                ? `${gest.weeks}s${gest.days}d`
                : "—"
          }
        />
      </div>

      {/* Vitals */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
          Sinais Vitais (pré-consulta)
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoBox
            label="Peso"
            value={
              formData.current_weight
                ? `${formData.current_weight} kg`
                : lastLog?.weight_kg
                  ? `${lastLog.weight_kg} kg (último reg.)`
                  : "—"
            }
          />
          <InfoBox
            label="Pressão arterial"
            value={
              formData.systolic && formData.diastolic
                ? `${formData.systolic}/${formData.diastolic} mmHg`
                : lastLog?.systolic
                  ? `${lastLog.systolic}/${lastLog.diastolic} mmHg (último reg.)`
                  : "—"
            }
          />
          <InfoBox label="Estado emocional" value={formData.emotional_state ?? "—"} />
        </div>
      </div>

      {/* Symptoms */}
      {formData.symptoms.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Sintomas relatados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {formData.symptoms.map((s: string) => (
              <span key={s} className="rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Medications */}
      {formData.medications && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-1">
            Medicamentos em uso
          </p>
          <p className="text-sm">{formData.medications}</p>
        </div>
      )}

      {/* Questions */}
      {(formData.questions || pendingQuestions?.length > 0) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
            Perguntas para o médico
          </p>
          {formData.questions && (
            <p className="text-sm mb-2 rounded-lg bg-primary/5 p-3">{formData.questions}</p>
          )}
          {pendingQuestions?.map((q: any) => (
            <p key={q.id} className="text-sm mb-1 text-muted-foreground">
              • {q.question}
            </p>
          ))}
        </div>
      )}

      {/* Activity summary */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
          Atividade nas últimas 2 semanas
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoBox label="Registros de saúde" value={String(healthLogs?.length ?? 0)} />
          <InfoBox label="Entradas no diário" value={String(journals?.length ?? 0)} />
          <InfoBox label="Sessões de chutes completas" value={String(completeSessions)} />
        </div>
      </div>

      {formData.other_notes && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-1">
            Observações adicionais
          </p>
          <p className="text-sm">{formData.other_notes}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Engajamento (Feature 46) ---------- */
function EngagementSection({
  engagement,
  onRefresh,
  tokenFn,
}: {
  engagement: {
    totalPatients: number;
    activeLastWeek: number;
    inactiveLastWeek: number;
    unseenPreConsultas: number;
    patients: PatientEngagement[];
  } | null;
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
}) {
  const [reportData, setReportData] = useState<Record<string, any>>({});
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadPatientReport(userId: string) {
    if (reportData[userId]) {
      setExpandedId((id) => (id === userId ? null : userId));
      return;
    }
    setLoadingReport(userId);
    const tk = await tokenFn();
    const res = await getPatientReport({ data: { accessToken: tk, userId } });
    if (res.ok) setReportData((d) => ({ ...d, [userId]: res }));
    setLoadingReport(null);
    setExpandedId(userId);
  }

  if (!engagement) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground mb-3">Clique para carregar o dashboard.</p>
        <button
          onClick={onRefresh}
          className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground"
        >
          Carregar dados
        </button>
      </div>
    );
  }

  const { totalPatients, activeLastWeek, inactiveLastWeek, unseenPreConsultas, patients } =
    engagement;
  const inactivePatients = patients.filter((p) => !p.isActive);
  const activePatients = patients.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Últimos 7 dias</p>
        <button onClick={onRefresh} className="text-xs text-primary hover:underline">
          ↺ Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total de pacientes" value={totalPatients} />
        <Stat label="Ativas (7 dias)" value={activeLastWeek} highlight={activeLastWeek > 0} />
        <Stat label="Inativas (7 dias)" value={inactiveLastWeek} highlight={inactiveLastWeek > 0} />
        <Stat
          label="Pré-consultas novas"
          value={unseenPreConsultas}
          highlight={unseenPreConsultas > 0}
        />
      </div>

      {/* Inactive patients - need attention */}
      {inactivePatients.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">
            Sem atividade há mais de 7 dias ({inactivePatients.length})
          </p>
          <div className="space-y-2">
            {inactivePatients.map((p) => {
              const gest = computeGestation({
                lmp: p.lmp_date,
                referenceDate: p.reference_date,
                referenceWeeks: p.reference_weeks,
                referenceDays: p.reference_days,
              });
              return (
                <div key={p.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.display_name ?? "Paciente sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {gest
                          ? `${gest.weeks}s${gest.days}d de gestação`
                          : "Sem dados gestacionais"}
                        {p.lastActivityAt &&
                          ` · Último acesso: ${new Date(p.lastActivityAt).toLocaleDateString("pt-BR")}`}
                        {!p.lastActivityAt && " · Nunca acessou"}
                      </p>
                    </div>
                    <button
                      onClick={() => loadPatientReport(p.id)}
                      disabled={loadingReport === p.id}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      {loadingReport === p.id ? "..." : "Ver relatório"}
                    </button>
                  </div>
                  {expandedId === p.id && reportData[p.id] && (
                    <div className="mt-4 border-t border-amber-200 pt-4">
                      <EngagementReportSnippet data={reportData[p.id]} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active patients */}
      {activePatients.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
            Ativas nos últimos 7 dias ({activePatients.length})
          </p>
          <div className="space-y-2">
            {activePatients.map((p) => {
              const gest = computeGestation({
                lmp: p.lmp_date,
                referenceDate: p.reference_date,
                referenceWeeks: p.reference_weeks,
                referenceDays: p.reference_days,
              });
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{p.display_name ?? "Paciente"}</p>
                        {p.hasUnseenForm && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                            Pré-consulta nova
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {gest ? `${gest.weeks}s${gest.days}d` : "Sem dados gestacionais"}
                        {p.baby_name && ` · ${p.baby_name}`}
                        {p.lastActivityAt &&
                          ` · Último acesso: ${new Date(p.lastActivityAt).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                    <button
                      onClick={() => loadPatientReport(p.id)}
                      disabled={loadingReport === p.id}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
                    >
                      {loadingReport === p.id ? "..." : "Ver relatório"}
                    </button>
                  </div>
                  {expandedId === p.id && reportData[p.id] && (
                    <div className="mt-4 border-t border-emerald-200 pt-4">
                      <EngagementReportSnippet data={reportData[p.id]} />
                    </div>
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

function EngagementReportSnippet({ data }: { data: any }) {
  const { healthLogs, journals, kicks, pendingQuestions, latestPreConsulta } = data;
  const lastLog = healthLogs?.[0];
  return (
    <div className="grid gap-3 sm:grid-cols-4 text-sm">
      <InfoBox label="Último peso" value={lastLog?.weight_kg ? `${lastLog.weight_kg} kg` : "—"} />
      <InfoBox
        label="Última PA"
        value={lastLog?.systolic ? `${lastLog.systolic}/${lastLog.diastolic}` : "—"}
      />
      <InfoBox label="Entradas no diário" value={String(journals?.length ?? 0)} />
      <InfoBox label="Perguntas pendentes" value={String(pendingQuestions?.length ?? 0)} />
      {latestPreConsulta && (
        <div className="sm:col-span-4 rounded-lg bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary mb-1">Última pré-consulta</p>
          {latestPreConsulta.questions && (
            <p className="text-muted-foreground">{latestPreConsulta.questions}</p>
          )}
          {latestPreConsulta.symptoms?.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              Sintomas: {latestPreConsulta.symptoms.join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Shared components ---------- */
function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 text-center shadow-[var(--shadow-card)] ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}
    >
      <p className={`font-serif text-3xl ${highlight ? "text-primary" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/* ---------- Teleconsultas ---------- */

function TeleconsultasSection({
  sessions,
  preForms,
  onRefresh,
  tokenFn,
  patients,
}: {
  sessions: TeleconsultaSession[];
  preForms: AdminPreConsulta[];
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
  patients: import("@/lib/admin.functions").PatientEngagement[];
}) {
  const [form, setForm] = useState({ patientUserId: "", scheduledFor: "", doctorNotes: "" });
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [openingRoom, setOpeningRoom] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  // Se a sala foi criada via Google Agenda (convida médico + paciente por
  // e-mail) ou via fallback (só e-mail à paciente) — muda o texto de confirmação.
  const [invitedBoth, setInvitedBoth] = useState(false);
  const [noteBullets, setNoteBullets] = useState<Record<string, string>>({});
  const [generatedNote, setGeneratedNote] = useState<Record<string, string>>({});
  const [generatingNote, setGeneratingNote] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState<string | null>(null);

  const STATUS_LABEL_TC: Record<string, string> = {
    agendada: "Agendada",
    sala_aberta: "Sala aberta ✅",
    encerrada: "Encerrada",
  };
  const STATUS_STYLE_TC: Record<string, string> = {
    agendada: "bg-amber-100 text-amber-700",
    sala_aberta: "bg-emerald-100 text-emerald-700",
    encerrada: "bg-secondary text-muted-foreground",
  };

  async function openRoom(s: TeleconsultaSession) {
    setOpeningRoom(s.id);
    const tk = await tokenFn();
    const res = await openTeleconsultaRoom({
      data: {
        accessToken: tk,
        id: s.id,
        patientUserId: s.patient_user_id,
        scheduledFor: s.scheduled_for,
      },
    });
    setOpeningRoom(null);
    if (res.ok) {
      setInvitedBoth("invited" in res ? !!res.invited : false);
      setEmailSent(s.id);
      setTimeout(() => setEmailSent(null), 5000);
    }
    onRefresh();
  }

  async function closeRoom(id: string) {
    const tk = await tokenFn();
    await updateTeleconsultaStatus({ data: { accessToken: tk, id, status: "encerrada" } });
    setActiveVideoId(null);
    onRefresh();
  }

  async function create() {
    if (!form.patientUserId) return;
    setCreating(true);
    const tk = await tokenFn();
    await createTeleconsulta({
      data: {
        accessToken: tk,
        patientUserId: form.patientUserId,
        scheduledFor: form.scheduledFor || null,
        doctorNotes: form.doctorNotes || null,
      },
    });
    setCreating(false);
    setShowForm(false);
    setForm({ patientUserId: "", scheduledFor: "", doctorNotes: "" });
    onRefresh();
  }

  async function doGenerateNote(s: TeleconsultaSession) {
    const pre = preForms.find((f) => f.user_id === s.patient_user_id);
    const bullets = noteBullets[s.id] ?? "";
    if (!bullets.trim()) return;
    setGeneratingNote(s.id);
    const tk = await tokenFn();
    const res = await generateClinicalNote({
      data: {
        accessToken: tk,
        bullets,
        patient: {
          name: s.patient_name ?? "Paciente",
          weeksAtSubmission: pre?.weeks_at_submission ?? null,
          weight: pre?.current_weight ?? null,
          systolic: pre?.systolic ?? null,
          diastolic: pre?.diastolic ?? null,
          symptoms: pre?.symptoms ?? [],
          medications: pre?.medications ?? null,
          questions: pre?.questions ?? null,
          emotionalState: pre?.emotional_state ?? null,
        },
      },
    });
    setGeneratingNote(null);
    if (res.ok) setGeneratedNote((p) => ({ ...p, [s.id]: res.note }));
  }

  async function doSaveNote(id: string) {
    const note = generatedNote[id] ?? noteBullets[id] ?? "";
    if (!note.trim()) return;
    setSavingNote(id);
    const tk = await tokenFn();
    await saveDoctorClinicalNote({ data: { accessToken: tk, id, clinicalNote: note } });
    setSavingNote(null);
    onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-serif text-2xl">Teleconsultas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra a sala de vídeo, veja a pré-consulta da paciente e gere a nota clínica com IA.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          + Agendar
        </button>
      </div>

      {showForm && (
        <div className="rounded-3xl border border-border bg-card p-6 space-y-4">
          <p className="font-serif text-lg">Nova teleconsulta</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Paciente
              </label>
              <select
                value={form.patientUserId}
                onChange={(e) => setForm((f) => ({ ...f, patientUserId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione a paciente...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name ?? p.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data e hora
              </label>
              <input
                type="datetime-local"
                value={form.scheduledFor}
                onChange={(e) => setForm((f) => ({ ...f, scheduledFor: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Observações para a paciente
            </label>
            <input
              type="text"
              value={form.doctorNotes}
              onChange={(e) => setForm((f) => ({ ...f, doctorNotes: e.target.value }))}
              placeholder="Ex: Trazer resultados dos últimos exames"
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={create}
            disabled={creating || !form.patientUserId}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {creating ? "Criando..." : "Criar teleconsulta"}
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">Nenhuma teleconsulta cadastrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sessions.map((s) => {
            const pre = preForms.find((f) => f.user_id === s.patient_user_id);
            const isVideoOpen = activeVideoId === s.id;
            return (
              <div key={s.id} className="rounded-3xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-lg">{s.patient_name ?? "Paciente"}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {s.scheduled_for
                          ? new Date(s.scheduled_for).toLocaleString("pt-BR", {
                              dateStyle: "long",
                              timeStyle: "short",
                            })
                          : "Horário a definir"}
                      </p>
                      {s.doctor_notes && (
                        <p className="mt-1 text-xs text-muted-foreground">{s.doctor_notes}</p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE_TC[s.status]}`}
                    >
                      {STATUS_LABEL_TC[s.status]}
                    </span>
                  </div>

                  {/* Patient notes */}
                  {s.patient_notes && (
                    <p className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 text-xs italic text-muted-foreground">
                      <span className="font-medium not-italic">Notas da paciente: </span>
                      {s.patient_notes}
                    </p>
                  )}

                  {/* Pre-consultation summary */}
                  {pre && s.status !== "encerrada" && (
                    <div className="mt-4 rounded-2xl bg-primary/5 border border-primary/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                        Pré-consulta preenchida pela paciente
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-foreground sm:grid-cols-4">
                        {pre.weeks_at_submission && (
                          <span>
                            <span className="text-muted-foreground">IG: </span>
                            {pre.weeks_at_submission}s
                          </span>
                        )}
                        {pre.current_weight && (
                          <span>
                            <span className="text-muted-foreground">Peso: </span>
                            {pre.current_weight} kg
                          </span>
                        )}
                        {pre.systolic && pre.diastolic && (
                          <span>
                            <span className="text-muted-foreground">PA: </span>
                            {pre.systolic}/{pre.diastolic} mmHg
                          </span>
                        )}
                        {pre.emotional_state && (
                          <span>
                            <span className="text-muted-foreground">Emocional: </span>
                            {pre.emotional_state}
                          </span>
                        )}
                      </div>
                      {pre.symptoms.length > 0 && (
                        <p className="mt-1 text-xs">
                          <span className="text-muted-foreground">Sintomas: </span>
                          {pre.symptoms.join(", ")}
                        </p>
                      )}
                      {pre.medications && (
                        <p className="mt-1 text-xs">
                          <span className="text-muted-foreground">Medicamentos: </span>
                          {pre.medications}
                        </p>
                      )}
                      {pre.questions && (
                        <p className="mt-1 text-xs">
                          <span className="text-muted-foreground">Dúvidas: </span>
                          {pre.questions}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {s.status === "agendada" && (
                      <button
                        onClick={() => openRoom(s)}
                        disabled={openingRoom === s.id}
                        className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {openingRoom === s.id ? "Criando sala…" : "🟢 Abrir sala agora"}
                      </button>
                    )}
                    {emailSent === s.id && (
                      <span className="text-xs text-emerald-700 font-medium">
                        {invitedBoth
                          ? "✓ Convite (Google Agenda) enviado ao médico e à paciente"
                          : "✓ Link enviado à paciente por e-mail"}
                      </span>
                    )}
                    {s.status === "sala_aberta" && s.meet_url && (
                      <>
                        <a
                          href={s.meet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                        >
                          🎥 Entrar no Google Meet
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(s.meet_url!)}
                          className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-secondary"
                        >
                          Copiar link
                        </button>
                        <button
                          onClick={() => closeRoom(s.id)}
                          className="rounded-full border border-destructive/30 px-4 py-2 text-xs text-destructive hover:bg-destructive/5"
                        >
                          Encerrar consulta
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* AI Note generator (available when sala_aberta or encerrada) */}
                {(s.status === "sala_aberta" || s.status === "encerrada") && (
                  <div className="border-t border-border p-6 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      🤖 Nota clínica IA — Gerador SOAP
                    </p>

                    {s.clinical_note && !generatedNote[s.id] ? (
                      <div className="rounded-2xl bg-muted/40 p-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Nota salva:
                        </p>
                        <pre className="whitespace-pre-wrap text-xs text-foreground font-sans leading-relaxed">
                          {s.clinical_note}
                        </pre>
                        <button
                          onClick={() =>
                            setGeneratedNote((p) => ({ ...p, [s.id]: s.clinical_note! }))
                          }
                          className="mt-3 text-xs text-primary underline"
                        >
                          Editar nota
                        </button>
                      </div>
                    ) : (
                      <>
                        <textarea
                          value={noteBullets[s.id] ?? ""}
                          onChange={(e) =>
                            setNoteBullets((p) => ({ ...p, [s.id]: e.target.value }))
                          }
                          rows={4}
                          placeholder={`Ex:\n- Paciente refere dor em baixo ventre leve\n- MF presentes, BCF 148bpm\n- PA 120/80, sem edema\n- USG: crescimento adequado, LA normal`}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => doGenerateNote(s)}
                            disabled={generatingNote === s.id || !(noteBullets[s.id] ?? "").trim()}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                          >
                            {generatingNote === s.id ? "Gerando..." : "✨ Gerar nota SOAP"}
                          </button>
                        </div>

                        {generatedNote[s.id] && (
                          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                            <pre className="whitespace-pre-wrap text-xs text-foreground font-sans leading-relaxed">
                              {generatedNote[s.id]}
                            </pre>
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => doSaveNote(s.id)}
                                disabled={savingNote === s.id}
                                className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                              >
                                {savingNote === s.id ? "Salvando..." : "💾 Salvar nota"}
                              </button>
                              <button
                                onClick={() =>
                                  navigator.clipboard.writeText(generatedNote[s.id] ?? "")
                                }
                                className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                              >
                                Copiar
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Consultas Pagas ---------- */
function ConsultasPagasSection({
  consultations,
  onRefresh,
  tokenFn,
}: {
  consultations: any[];
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleConfirm(id: string, status: "confirmado" | "realizado" | "cancelado") {
    setUpdatingId(id);
    const tk = await tokenFn();
    await confirmPaymentAdmin({ data: { accessToken: tk, id, status } });
    onRefresh();
    setUpdatingId(null);
  }

  const statusColors: Record<string, string> = {
    pendente_pagamento: "bg-amber-50 border-amber-200",
    pagamento_enviado: "bg-blue-50 border-blue-200",
    confirmado: "bg-green-50 border-green-200",
    realizado: "bg-secondary border-border",
    cancelado: "bg-red-50 border-red-200",
  };
  const statusLabels: Record<string, string> = {
    pendente_pagamento: "⏳ Aguardando pagamento",
    pagamento_enviado: "💸 Pagamento enviado",
    confirmado: "✅ Confirmado",
    realizado: "🏁 Realizado",
    cancelado: "❌ Cancelado",
  };

  if (consultations.length === 0)
    return (
      <p className="text-sm text-muted-foreground">Nenhuma consulta particular solicitada ainda.</p>
    );

  return (
    <div className="space-y-3">
      {consultations.map((c: any) => {
        const typeInfo = PRIVATE_CONSULT_TYPES.find((t) => t.key === c.consult_type);
        const color = statusColors[c.status] ?? "bg-card border-border";
        return (
          <div key={c.id} className={`rounded-2xl border p-5 ${color}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">
                  {c.patient_profiles?.display_name ?? "Paciente"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typeInfo?.label ?? c.consult_type} · {typeInfo?.price ?? ""}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
                <p className="text-xs mt-1">{statusLabels[c.status] ?? c.status}</p>
                {c.preferred_dates?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Datas sugeridas:{" "}
                    {c.preferred_dates
                      .map((d: string) => new Date(d).toLocaleString("pt-BR"))
                      .join(", ")}
                  </p>
                )}
                {c.message && (
                  <p className="text-xs mt-0.5 italic text-muted-foreground">"{c.message}"</p>
                )}
              </div>
              {c.status === "pagamento_enviado" && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => handleConfirm(c.id, "confirmado")}
                    disabled={updatingId === c.id}
                    className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    ✓ Confirmar
                  </button>
                  <button
                    onClick={() => handleConfirm(c.id, "cancelado")}
                    disabled={updatingId === c.id}
                    className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-40"
                  >
                    × Cancelar
                  </button>
                </div>
              )}
              {c.status === "confirmado" && (
                <button
                  onClick={() => handleConfirm(c.id, "realizado")}
                  disabled={updatingId === c.id}
                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  Marcar realizada
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Empresas ---------- */
function EmpresasSection({
  leads,
  accounts,
  onRefresh,
  tokenFn,
}: {
  leads: CorporateLead[];
  accounts: CorporateAccount[];
  onRefresh: () => void;
  tokenFn: () => Promise<string>;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPlan, setNewPlan] = useState<"basico" | "standard" | "premium">("basico");
  const [newSeats, setNewSeats] = useState("10");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  const PLANS = { basico: "Básico (10)", standard: "Standard (50)", premium: "Premium (100)" };

  async function handleCreateAccount() {
    setCreating(true);
    const tk = await tokenFn();
    await createCorporateAccountAdmin({
      data: {
        accessToken: tk,
        companyName: newCompany,
        contactEmail: newEmail,
        planType: newPlan,
        maxSeats: Number(newSeats) || 10,
        notes: newNotes || null,
      },
    });
    setShowCreateForm(false);
    setNewCompany("");
    setNewEmail("");
    setNewNotes("");
    onRefresh();
    setCreating(false);
  }

  async function handleLeadStatus(id: string, status: string) {
    setUpdatingLeadId(id);
    const tk = await tokenFn();
    await updateLeadStatusAdmin({ data: { accessToken: tk, id, status } });
    onRefresh();
    setUpdatingLeadId(null);
  }

  const leadStatusColors: Record<string, string> = {
    novo: "bg-blue-50 border-blue-200",
    em_contato: "bg-amber-50 border-amber-200",
    convertido: "bg-green-50 border-green-200",
    descartado: "bg-secondary border-border opacity-60",
  };

  return (
    <div className="space-y-8">
      {/* Active accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Contas corporativas ativas</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white"
          >
            + Nova conta
          </button>
        </div>

        {showCreateForm && (
          <div className="rounded-2xl border border-border bg-card p-5 mb-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">Empresa *</label>
                <input
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">E-mail de contato *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Plano</label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as any)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                >
                  {Object.entries(PLANS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Vagas (max)</label>
                <input
                  type="number"
                  value={newSeats}
                  onChange={(e) => setNewSeats(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notas internas</label>
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateAccount}
                disabled={creating || !newCompany || !newEmail}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                {creating ? "Criando..." : "Criar conta"}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-full border border-border px-4 py-1.5 text-xs font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta corporativa criada ainda.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{acc.company_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {acc.contact_email} ·{" "}
                      {PLANS[acc.plan_type as keyof typeof PLANS] ?? acc.plan_type}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Vagas: {acc.max_seats}</p>
                    {acc.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{acc.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-mono font-bold text-primary">
                      {acc.access_code}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">código de acesso</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leads */}
      <div>
        <h3 className="font-semibold mb-4">
          Leads / Solicitações de demonstração ({leads.length})
        </h3>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
        ) : (
          <div className="space-y-2">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className={`rounded-2xl border p-4 ${leadStatusColors[lead.status] ?? "bg-card border-border"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{lead.company_name}</p>
                    <p className="text-xs">
                      {lead.contact_name} · {lead.contact_email}
                    </p>
                    {lead.contact_phone && (
                      <p className="text-xs text-muted-foreground">{lead.contact_phone}</p>
                    )}
                    {lead.employee_count && (
                      <p className="text-xs text-muted-foreground">{lead.employee_count}</p>
                    )}
                    {lead.message && <p className="text-xs mt-1 italic">"{lead.message}"</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {lead.status === "novo" && (
                      <>
                        <button
                          onClick={() => handleLeadStatus(lead.id, "em_contato")}
                          disabled={updatingLeadId === lead.id}
                          className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Em contato
                        </button>
                        <button
                          onClick={() => handleLeadStatus(lead.id, "convertido")}
                          disabled={updatingLeadId === lead.id}
                          className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                        >
                          Convertido
                        </button>
                        <button
                          onClick={() => handleLeadStatus(lead.id, "descartado")}
                          disabled={updatingLeadId === lead.id}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground disabled:opacity-40"
                        >
                          Descartar
                        </button>
                      </>
                    )}
                    {lead.status === "em_contato" && (
                      <button
                        onClick={() => handleLeadStatus(lead.id, "convertido")}
                        disabled={updatingLeadId === lead.id}
                        className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Marcar convertido
                      </button>
                    )}
                    {(lead.status === "convertido" || lead.status === "descartado") && (
                      <span className="text-xs font-medium capitalize">
                        {lead.status === "convertido" ? "✅ Convertido" : "✗ Descartado"}
                      </span>
                    )}
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

/* ---------- Ferramentas clínicas ---------- */

const PRESCRIPTIONS = [
  {
    title: "Suplementação pré-natal padrão",
    icon: "💊",
    text: `Sulfato ferroso 40mg (elementar) — 1 comprimido VO 1x/dia, em jejum
Ácido fólico 5mg — 1 comprimido VO 1x/dia`,
  },
  {
    title: "Suplementação de cálcio",
    icon: "🦴",
    text: `Carbonato de cálcio 1250mg (= 500mg Ca elementar) — 2 comprimidos VO/dia, fracionados às refeições`,
  },
  {
    title: "Náuseas e vômitos (1º tri)",
    icon: "🤢",
    text: `Opção 1: Ondansetrona 4mg — 1 cp VO 8/8h (máx 12mg/dia)
Opção 2: Metoclopramida 10mg — 1 cp VO 3x/dia antes das refeições
Opção 3: Dimenidrinato 50mg — 1 cp VO 3x/dia`,
  },
  {
    title: "Hipertensão gestacional / pré-eclâmpsia",
    icon: "🫀",
    text: `Metildopa 250mg — 1 cp VO 3x/dia (dose inicial; pode aumentar até 3g/dia)
Alternativa: Nifedipino ação prolongada 30mg VO 1x/dia

Urgência hipertensiva (PA ≥ 160/110):
Nifedipino 10mg VO 1 cp — repetir em 30 min se necessário`,
  },
  {
    title: "Profilaxia pré-eclâmpsia (AAS)",
    icon: "💉",
    text: `AAS 100–150mg VO 1x/dia (à noite)
Início: 11–16 semanas | Duração: até 36 semanas
+ Carbonato de cálcio 1–2g/dia se ingesta baixa`,
  },
  {
    title: "Diabetes gestacional — Metformina",
    icon: "🩸",
    text: `Metformina 500mg VO 2x/dia às refeições (dose inicial)
Aumentar para 1g VO 2x/dia após 1 semana se tolerado
Monitorar: glicemia jejum e pós-prandial 1h e 2h`,
  },
  {
    title: "ITU na gestante (1ª linha)",
    icon: "🦠",
    text: `Cefalexina 500mg VO 6/6h por 7 dias
OU Nitrofurantoína 100mg VO 6/6h por 5–7 dias (evitar no 3º tri)
OU Amoxicilina-clavulanato 875/125mg VO 12/12h por 7 dias

Pielonefrite: internação + Ceftriaxone 1–2g EV/dia`,
  },
  {
    title: "Profilaxia TVP / TEV",
    icon: "🩻",
    text: `Enoxaparina 40mg SC 1x/dia (dose profilática, peso < 80kg)
Enoxaparina 60mg SC 1x/dia (peso 80–120kg)
Início: 12h após parto vaginal | 24h após cesárea
Duração: mínimo 10 dias pós-parto; ampliar em alto risco`,
  },
];

const EXAM_PANELS = [
  {
    title: "1º Trimestre — 8 a 13 semanas",
    icon: "🔬",
    exams: [
      "Hemograma completo",
      "Grupo sanguíneo e fator Rh",
      "Coombs indireto (se Rh negativo)",
      "Glicemia de jejum",
      "Urina tipo 1 + urocultura",
      "TSH",
      "Sorologias: Toxoplasmose IgG/IgM, Rubéola IgG/IgM, CMV IgG/IgM",
      "Sífilis (VDRL + FTA-ABS)",
      "HIV 1 e 2 (anti-HIV)",
      "HBsAg, Anti-HBs, Anti-HCV",
      "Eletroforese de hemoglobinas",
      "Ultrassom obstétrico — datação + translucência nucal (11s–13s6d)",
      "PAPP-A + β-hCG livre (rastreio aneuploidias, junto com TN)",
    ],
  },
  {
    title: "2º Trimestre — 18 a 28 semanas",
    icon: "📋",
    exams: [
      "Ultrassom morfológico (18–22 semanas) — obrigatório",
      "TOTG 75g: glicemia jejum, 1h e 2h (24–28 semanas)",
      "Hemograma",
      "Urina tipo 1 + urocultura",
      "Sorologias de controle (toxo, sífilis, HIV — se negativas no 1º tri)",
      "Ultrassom + Doppler uterino (24–28 sem, se risco de pré-eclâmpsia)",
    ],
  },
  {
    title: "3º Trimestre — 32 a 37 semanas",
    icon: "🏥",
    exams: [
      "Hemograma",
      "Coagulograma: TP, TTPA, fibrinogênio",
      "Urina tipo 1",
      "Pesquisa de Streptococcus agalactiae (SGB) — 35–37 semanas",
      "Cardiotocografia basal (a partir de 32 semanas)",
      "Ultrassom de crescimento fetal",
      "Dopplervelocimetria (artéria umbilical e cerebral média)",
      "Coombs indireto (repetir se Rh negativo)",
      "Classificação sanguínea (repetir se Rh negativo)",
    ],
  },
];

function FerramentasSection() {
  const [openRx, setOpenRx] = useState<number | null>(null);
  const [openExam, setOpenExam] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function printText(title: string, text: string) {
    const w = window.open("", "_blank", "width=600,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Georgia, serif; padding: 40px; color: #111; }
        h2 { font-size: 18px; margin-bottom: 24px; }
        pre { font-family: inherit; font-size: 14px; line-height: 1.8; white-space: pre-wrap; }
        .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 12px; font-size: 12px; color: #666; }
      </style></head><body>
      <h2>${title}</h2><pre>${text}</pre>
      <div class="footer">Emitido em ${new Date().toLocaleDateString("pt-BR")}</div>
      <script>window.print();</script></body></html>`);
  }

  return (
    <div className="space-y-10">
      {/* Receituário */}
      <div>
        <p className="font-serif text-2xl">Receituário Rápido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Prescrições comuns de obstetrícia. Clique para expandir, copiar ou imprimir.
        </p>
        <div className="mt-5 space-y-2">
          {PRESCRIPTIONS.map((rx, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOpenRx(openRx === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/30"
              >
                <span className="flex items-center gap-3 font-medium">
                  <span className="text-xl">{rx.icon}</span>
                  {rx.title}
                </span>
                <span className="text-muted-foreground text-sm">{openRx === i ? "▲" : "▼"}</span>
              </button>
              {openRx === i && (
                <div className="border-t border-border px-5 py-4 space-y-3">
                  <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                    {rx.text}
                  </pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(rx.text, `rx-${i}`)}
                      className="rounded-full border border-border px-4 py-1.5 text-xs text-foreground hover:bg-muted/40"
                    >
                      {copied === `rx-${i}` ? "✅ Copiado!" : "Copiar"}
                    </button>
                    <button
                      onClick={() => printText(rx.title, rx.text)}
                      className="rounded-full bg-primary px-4 py-1.5 text-xs text-primary-foreground"
                    >
                      🖨️ Imprimir
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Solicitações de exame */}
      <div>
        <p className="font-serif text-2xl">Solicitação de Exames</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Painéis padrão por trimestre. Copie ou imprima em um clique.
        </p>
        <div className="mt-5 space-y-2">
          {EXAM_PANELS.map((panel, i) => {
            const examText = panel.exams.join("\n");
            return (
              <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setOpenExam(openExam === i ? null : i)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/30"
                >
                  <span className="flex items-center gap-3 font-medium">
                    <span className="text-xl">{panel.icon}</span>
                    {panel.title}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {openExam === i ? "▲" : `${panel.exams.length} exames ▼`}
                  </span>
                </button>
                {openExam === i && (
                  <div className="border-t border-border px-5 py-4 space-y-3">
                    <ul className="space-y-1">
                      {panel.exams.map((e, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="mt-0.5 text-primary shrink-0">•</span>
                          {e}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyText(examText, `exam-${i}`)}
                        className="rounded-full border border-border px-4 py-1.5 text-xs text-foreground hover:bg-muted/40"
                      >
                        {copied === `exam-${i}` ? "✅ Copiado!" : "Copiar lista"}
                      </button>
                      <button
                        onClick={() =>
                          printText(`Solicitação de Exames — ${panel.title}`, examText)
                        }
                        className="rounded-full bg-primary px-4 py-1.5 text-xs text-primary-foreground"
                      >
                        🖨️ Imprimir solicitação
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        ⚕️ Prescrições e painéis baseados nos protocolos FEBRASGO/SBD/SBH 2022–2024. Sempre confirme
        com o protocolo vigente da sua instituição e ajuste conforme o quadro clínico da paciente.
      </p>
    </div>
  );
}

/* ---------- Calendário (week view) ---------- */
const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function CalendárioSection({
  appointments,
  onNavigate,
}: {
  appointments: AdminAppointment[];
  onNavigate: (tab: PanelTab) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function goToday() {
    setWeekStart(getWeekStart(new Date()));
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const confirmedAppts = appointments.filter(
    (a) => a.status === "confirmed" && (a as any).confirmed_date,
  );

  function getAppts(day: Date) {
    const iso = ymdLocal(day);
    return confirmedAppts
      .filter((a) => (a as any).confirmed_date === iso)
      .sort((a, b) =>
        ((a as any).confirmed_time ?? "").localeCompare((b as any).confirmed_time ?? ""),
      );
  }

  const today = ymdLocal();

  const weekLabel = `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
          >
            ← Anterior
          </button>
          <button
            onClick={goToday}
            className="rounded-full border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary"
          >
            Hoje
          </button>
          <button
            onClick={nextWeek}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
          >
            Próxima →
          </button>
        </div>
        <p className="text-sm font-medium">{weekLabel}</p>
        <button
          onClick={() => onNavigate("Agendamentos")}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Ver todos
        </button>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((day, i) => {
          const iso = ymdLocal(day);
          const isToday = iso === today;
          const dayAppts = getAppts(day);
          return (
            <div
              key={i}
              className={`rounded-2xl border p-2 min-h-[120px] flex flex-col gap-1.5 ${isToday ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="text-center">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}
                >
                  {DOW_LABELS[i]}
                </p>
                <p className={`text-sm font-bold ${isToday ? "text-primary" : ""}`}>
                  {day.getDate()}
                </p>
              </div>
              {dayAppts.map((a) => (
                <div
                  key={a.id}
                  title={`${a.patient_name} — ${(a as any).confirmed_time}`}
                  className="rounded-lg bg-primary/10 px-1.5 py-1 text-[10px] leading-tight text-primary truncate"
                >
                  <span className="font-medium">{(a as any).confirmed_time}</span>{" "}
                  {a.patient_name.split(" ")[0]}
                </div>
              ))}
              {dayAppts.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center mt-1">—</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming confirmed list */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
          Próximas confirmadas
        </p>
        {confirmedAppts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma consulta confirmada com data definida.
          </p>
        ) : (
          <div className="space-y-2">
            {confirmedAppts
              .filter((a) => (a as any).confirmed_date >= today)
              .sort((a, b) => {
                const da = `${(a as any).confirmed_date}T${(a as any).confirmed_time ?? "00:00"}`;
                const db = `${(b as any).confirmed_date}T${(b as any).confirmed_time ?? "00:00"}`;
                return da.localeCompare(db);
              })
              .slice(0, 10)
              .map((a) => {
                const ext = a as any;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-2.5"
                  >
                    <div className="text-center min-w-[48px]">
                      <p className="text-sm font-bold text-primary">
                        {new Date(ext.confirmed_date + "T00:00:00").getDate()}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {new Date(ext.confirmed_date + "T00:00:00").toLocaleDateString("pt-BR", {
                          month: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ext.confirmed_time} · {a.reason}
                      </p>
                    </div>
                    {ext.price_brl && (
                      <p
                        className={`text-xs font-medium shrink-0 ${ext.payment_status === "pago" ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {ext.payment_status === "pago" ? "✓ " : ""}R${" "}
                        {(ext.price_brl / 100).toFixed(2)}
                      </p>
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

/* ---------- Agenda (availability config) ---------- */
interface DoctorAvailability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  enabled: boolean;
}

interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
}

function AgendaSection() {
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [addingBlock, setAddingBlock] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [avail, blocked] = await Promise.all([
      (supabase as any).from("doctor_availability").select("*").order("day_of_week"),
      (supabase as any).from("blocked_dates").select("*").order("date"),
    ]);
    if (avail.data) setAvailability(avail.data);
    if (blocked.data) setBlockedDates(blocked.data);
    setLoading(false);
  }

  async function saveAvailability(row: DoctorAvailability) {
    setSaving(true);
    // .select() para detectar update que não afetou nenhuma linha (ex.: RLS)
    const { data, error } = await (supabase as any)
      .from("doctor_availability")
      .update({
        start_time: row.start_time,
        end_time: row.end_time,
        slot_minutes: row.slot_minutes,
        enabled: row.enabled,
      })
      .eq("id", row.id)
      .select("id");
    setSaving(false);
    if (error || !data?.length) {
      toast.error(
        "Não foi possível salvar o horário. Verifique sua permissão de administrador e tente novamente." +
          (error ? ` (${error.message})` : ""),
      );
      return;
    }
    toast.success("Horário salvo.");
  }

  function updateRow(idx: number, patch: Partial<DoctorAvailability>) {
    setAvailability((prev) => {
      const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      return next;
    });
  }

  async function addBlockedDate() {
    if (!newBlockDate) return;
    setAddingBlock(true);
    const { data, error } = await (supabase as any)
      .from("blocked_dates")
      .insert({ date: newBlockDate, reason: newBlockReason || null })
      .select()
      .single();
    setAddingBlock(false);
    if (error || !data) {
      toast.error(
        "Não foi possível bloquear a data. Tente novamente." + (error ? ` (${error.message})` : ""),
      );
      return;
    }
    setBlockedDates((prev) => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
    setNewBlockDate("");
    setNewBlockReason("");
  }

  async function removeBlockedDate(id: string) {
    // .select() para detectar delete que não afetou nenhuma linha (ex.: RLS)
    const { data, error } = await (supabase as any)
      .from("blocked_dates")
      .delete()
      .eq("id", id)
      .select("id");
    if (error || !data?.length) {
      toast.error(
        "Não foi possível remover a data bloqueada. Tente novamente." +
          (error ? ` (${error.message})` : ""),
      );
      return;
    }
    setBlockedDates((prev) => prev.filter((b) => b.id !== id));
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-8">
      {/* Availability per day */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-serif text-xl">Disponibilidade semanal</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure os dias e horários de atendimento. Salve cada linha individualmente.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {availability.map((row, idx) => (
            <div
              key={row.id}
              className={`rounded-2xl border p-4 transition-colors ${row.enabled ? "border-border bg-card" : "border-dashed border-border bg-secondary/30"}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 w-28">
                  <button
                    onClick={() => updateRow(idx, { enabled: !row.enabled })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${row.enabled ? "bg-primary" : "bg-muted"}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${row.enabled ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </button>
                  <span
                    className={`text-sm font-medium w-8 ${row.enabled ? "" : "text-muted-foreground"}`}
                  >
                    {DOW_LABELS[row.day_of_week]}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Início</label>
                    <input
                      type="time"
                      disabled={!row.enabled}
                      value={row.start_time}
                      onChange={(e) => updateRow(idx, { start_time: e.target.value })}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Fim</label>
                    <input
                      type="time"
                      disabled={!row.enabled}
                      value={row.end_time}
                      onChange={(e) => updateRow(idx, { end_time: e.target.value })}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">
                      Duração (min)
                    </label>
                    <select
                      disabled={!row.enabled}
                      value={row.slot_minutes}
                      onChange={(e) => updateRow(idx, { slot_minutes: Number(e.target.value) })}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs disabled:opacity-40"
                    >
                      {[15, 20, 30, 45, 60].map((v) => (
                        <option key={v} value={v}>
                          {v} min
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => saveAvailability(row)}
                    disabled={saving}
                    className="self-end rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
                  >
                    Salvar
                  </button>
                </div>
                {row.enabled && (
                  <p className="text-xs text-muted-foreground ml-auto hidden sm:block">
                    {Math.floor(
                      (timeToMins(row.end_time) - timeToMins(row.start_time)) / row.slot_minutes,
                    )}{" "}
                    slots/dia
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Blocked dates */}
      <div>
        <p className="font-serif text-xl mb-1">Datas bloqueadas</p>
        <p className="text-sm text-muted-foreground mb-4">
          Férias, feriados ou dias sem atendimento.
        </p>

        {/* Add form */}
        <div className="flex flex-wrap gap-2 mb-4 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-0.5">Data *</label>
            <input
              type="date"
              value={newBlockDate}
              onChange={(e) => setNewBlockDate(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-0.5">Motivo (opcional)</label>
            <input
              placeholder="Ex: Férias"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm w-44"
            />
          </div>
          <button
            onClick={addBlockedDate}
            disabled={addingBlock || !newBlockDate}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            {addingBlock ? "..." : "+ Bloquear data"}
          </button>
        </div>

        {blockedDates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma data bloqueada.</p>
        ) : (
          <div className="space-y-1.5">
            {blockedDates.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium">
                    {new Date(b.date + "T00:00:00").toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {b.reason && <span className="text-xs text-muted-foreground">{b.reason}</span>}
                </div>
                <button
                  onClick={() => removeBlockedDate(b.id)}
                  className="rounded-full border border-rose-300 px-2.5 py-0.5 text-xs text-rose-600 hover:bg-rose-100"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/* ---------- Cérebro 🧠 (Segundo Cérebro do médico) ---------- */

const BRAIN_SOURCE_STYLE: Record<string, string> = {
  manual: "bg-secondary text-muted-foreground",
  pergunta: "bg-violet-100 text-violet-700",
  whatsapp: "bg-emerald-100 text-emerald-800",
};

function BrainToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
      <span className="text-sm">{label}</span>
    </div>
  );
}

function CerebroSection({
  tokenFn,
  onTrained,
  showTrainCard,
}: {
  tokenFn: () => Promise<string>;
  onTrained: (questionId: string) => void;
  // Treinar respondendo lista perguntas das pacientes da INSTALAÇÃO —
  // exclusivo da equipe até o escopo por médico (etapa 2 do roadmap)
  showTrainCard: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-serif text-xl">Seu Segundo Cérebro</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ensine a IA a responder como você responderia: defina seu estilo, responda perguntas reais
          das pacientes e alimente a base de conhecimento. O cérebro é usado pelo chat do app e pelo
          atendimento no WhatsApp.
        </p>
      </div>
      <BrainScoreCard tokenFn={tokenFn} />
      <BrainGapsCard tokenFn={tokenFn} />
      <BrainConsultaCard tokenFn={tokenFn} />
      <BrainEvalCard tokenFn={tokenFn} />
      <BrainSettingsCard tokenFn={tokenFn} />
      {showTrainCard && <BrainTrainCard tokenFn={tokenFn} onTrained={onTrained} />}
      <BrainKnowledgeCard tokenFn={tokenFn} />
      <BrainPlaygroundCard tokenFn={tokenFn} />
    </div>
  );
}

type EvalRow = {
  id: string;
  status: "pendente" | "rodando" | "aprovada" | "reprovada" | "erro";
  issue?: string | null;
  answer?: string;
  usedBrain?: boolean;
};

/**
 * Prova de qualidade (eval): roda a bateria de perguntas críticas contra o
 * cérebro REAL e um juiz independente aprova/reprova cada resposta. É o que
 * permite afirmar "zero conduta inventada" com evidência — sem esperar meses
 * de uso. Rode após treinar o cérebro e antes de divulgar.
 */
function BrainEvalCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [running, setRunning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function runEval() {
    if (running) return;
    setRunning(true);
    setRows(BRAIN_EVAL_QUESTIONS.map((q) => ({ id: q.id, status: "pendente" as const })));
    try {
      const tk = await tokenFn();
      // Sequencial de propósito: progresso ao vivo e sem estourar cota.
      for (const q of BRAIN_EVAL_QUESTIONS) {
        setRows((rs) => rs.map((r) => (r.id === q.id ? { ...r, status: "rodando" } : r)));
        try {
          const res = await evalBrainQuestion({
            data: {
              accessToken: tk,
              question: q.question,
              expect: q.expect,
              criterion: q.criterion,
            },
          });
          if (!res.ok) {
            if ("reason" in res && res.reason === "plan") {
              toast.error("Seu plano atual não inclui a IA.");
              setRows([]);
              return;
            }
            if ("reason" in res && res.reason === "config") {
              toast.error("IA não configurada nesta instalação.");
              setRows([]);
              return;
            }
            setRows((rs) => rs.map((r) => (r.id === q.id ? { ...r, status: "erro" } : r)));
            continue;
          }
          setRows((rs) =>
            rs.map((r) =>
              r.id === q.id
                ? {
                    ...r,
                    status: res.approved ? "aprovada" : "reprovada",
                    issue: res.issue,
                    answer: res.answer,
                    usedBrain: res.usedBrain,
                  }
                : r,
            ),
          );
        } catch {
          setRows((rs) => rs.map((r) => (r.id === q.id ? { ...r, status: "erro" } : r)));
        }
      }
    } finally {
      setRunning(false);
    }
  }

  const done =
    rows.length > 0 && rows.every((r) => r.status !== "pendente" && r.status !== "rodando");
  const approvedCount = rows.filter((r) => r.status === "aprovada").length;

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-serif text-xl">🧪 Prova de qualidade</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {BRAIN_EVAL_QUESTIONS.length} perguntas críticas (urgências, pedidos de receita, exames)
            rodam contra a sua IA e um juiz independente aprova ou reprova cada resposta. Rode após
            treinar o cérebro.
          </p>
        </div>
        <button
          onClick={runEval}
          disabled={running}
          className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {running ? "Avaliando…" : rows.length > 0 ? "Rodar de novo" : "▶ Rodar avaliação"}
        </button>
      </div>

      {done && (
        <p
          className={`mt-4 rounded-2xl border p-3 text-sm font-semibold ${
            approvedCount === rows.length
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {approvedCount === rows.length
            ? `✅ Aprovada em ${approvedCount}/${rows.length} — sua IA respondeu com segurança a toda a bateria.`
            : `⚠️ ${approvedCount}/${rows.length} aprovadas — veja abaixo o que reprovou e ajuste o cérebro.`}
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-4 space-y-2">
          {BRAIN_EVAL_QUESTIONS.map((q) => {
            const r = rows.find((x) => x.id === q.id);
            if (!r) return null;
            const icon =
              r.status === "aprovada"
                ? "✅"
                : r.status === "reprovada"
                  ? "❌"
                  : r.status === "rodando"
                    ? "⏳"
                    : r.status === "erro"
                      ? "⚠️"
                      : "•";
            return (
              <div key={q.id} className="rounded-xl border border-border bg-background p-3">
                <button
                  onClick={() => setOpenId(openId === q.id ? null : q.id)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <span className="min-w-0 flex-1 text-sm">
                    {icon} "{q.question}"
                    {r.usedBrain === true && (
                      <span className="ml-1.5 text-[10px] font-bold uppercase text-primary">
                        · seu cérebro
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {q.expect}
                  </span>
                </button>
                {r.issue && r.status === "reprovada" && (
                  <p className="mt-1.5 text-xs text-destructive">↳ {r.issue}</p>
                )}
                {openId === q.id && r.answer && (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-secondary/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
                    {r.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Consulta → conhecimento: o médico grava a consulta (ou cola a transcrição)
 * e a IA extrai os pares pergunta→resposta que ELE deu, como rascunhos para
 * aprovar. Uma consulta de 30 min rende ~10 entradas na voz literal dele —
 * o jeito mais rápido de o cérebro virar o próprio médico.
 */
function BrainConsultaCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [transcript, setTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const audioRef = useRef<HTMLInputElement>(null);

  async function transcribeAudio(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Áudio acima de 20MB — grave trechos menores.");
      return;
    }
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("audio", file);
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      if (!res.ok) {
        toast.error("Não foi possível transcrever o áudio — tente novamente.");
        return;
      }
      const data = (await res.json()) as { transcript?: string };
      if (!data.transcript?.trim()) {
        toast.error("A transcrição veio vazia — o áudio está audível?");
        return;
      }
      setTranscript(data.transcript.trim());
      toast.success("Transcrição pronta — revise e clique em Extrair conhecimento 👇");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setTranscribing(false);
      if (audioRef.current) audioRef.current.value = "";
    }
  }

  async function extract() {
    const text = transcript.trim();
    if (text.length < 80 || extracting) return;
    setExtracting(true);
    try {
      const tk = await tokenFn();
      const res = await extractKnowledgeFromTranscript({
        data: { accessToken: tk, transcript: text.slice(0, 30000) },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "plan"
            ? "Seu plano atual não inclui a IA."
            : "reason" in res && res.reason === "config"
              ? "IA não configurada nesta instalação."
              : "Não foi possível extrair — tente novamente.",
        );
        return;
      }
      if (res.created === 0) {
        toast("Nenhuma orientação reaproveitável encontrada nesta transcrição.");
        return;
      }
      toast.success(
        `${res.created} rascunhos criados na sua voz 🎙️ — revise e aprove na Base de conhecimento 👇`,
      );
      setTranscript("");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-xl">🎙️ Consulta vira conhecimento</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Grave a consulta no celular (com consentimento da paciente) e envie o áudio — a IA extrai as
        orientações que <strong>você</strong> deu e cria rascunhos genéricos (sem nomes nem dados da
        paciente) para você aprovar. Uma consulta rende ~10 entradas na sua voz.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={audioRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) transcribeAudio(f);
          }}
        />
        <button
          onClick={() => audioRef.current?.click()}
          disabled={transcribing || extracting}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {transcribing ? "Transcrevendo…" : "🎙️ Enviar áudio da consulta"}
        </button>
        <span className="text-xs text-muted-foreground">ou cole a transcrição abaixo</span>
      </div>

      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={4}
        placeholder="Cole aqui a transcrição da consulta (mínimo ~80 caracteres)…"
        className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Nada entra no cérebro sem a sua aprovação — tudo nasce como rascunho.
        </p>
        <button
          onClick={extract}
          disabled={extracting || transcribing || transcript.trim().length < 80}
          className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {extracting ? "Extraindo…" : "🧠 Extrair conhecimento"}
        </button>
      </div>
    </div>
  );
}

/**
 * Placar de qualidade do cérebro — a prova numérica: cobertura das dúvidas,
 * satisfação das pacientes e usos no mês. Some silenciosamente enquanto as
 * tabelas de telemetria não existirem (migração pendente) ou sem dados.
 */
function BrainScoreCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [stats, setStats] = useState<{
    hitsMonth: number;
    gapsOpen: number;
    coveragePct: number | null;
    satisfactionPct: number | null;
    feedbackCount: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const tk = await tokenFn();
        const res = await getBrainQualityStats({ data: { accessToken: tk } });
        if (res.ok) setStats(res);
      } catch {
        /* placar é enhancement — sem dados, sem card */
      }
    })();
  }, [tokenFn]);

  // Sem nenhum sinal ainda (mês zerado e nada aberto) → não polui o painel.
  if (!stats || (stats.hitsMonth === 0 && stats.gapsOpen === 0 && stats.feedbackCount === 0)) {
    return null;
  }

  const tile = "rounded-2xl border border-border bg-card p-4 text-center";
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <p className="font-serif text-xl">📊 Qualidade da sua IA — este mês</p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={tile}>
          <p className="font-serif text-3xl leading-none text-primary">
            {stats.coveragePct != null ? `${stats.coveragePct}%` : "—"}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cobertura das dúvidas
          </p>
        </div>
        <div className={tile}>
          <p className="font-serif text-3xl leading-none text-primary">
            {stats.satisfactionPct != null ? `${stats.satisfactionPct}%` : "—"}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Satisfação (👍)
          </p>
        </div>
        <div className={tile}>
          <p className="font-serif text-3xl leading-none">{stats.hitsMonth}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Respostas com seu cérebro
          </p>
        </div>
        <div className={tile}>
          <p className="font-serif text-3xl leading-none">{stats.gapsOpen}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Lacunas abertas
          </p>
        </div>
      </div>
      {stats.coveragePct != null && stats.coveragePct < 70 && (
        <p className="mt-3 text-xs text-muted-foreground">
          💡 Responda as lacunas abaixo para subir a cobertura — cada resposta vira conhecimento
          permanente.
        </p>
      )}
    </div>
  );
}

/**
 * Fila de lacunas — o coração do autoaprendizado: perguntas reais que a IA
 * NÃO soube cobrir (ou que receberam 👎 da paciente), deduplicadas e ordenadas
 * pelas mais perguntadas. O médico responde aqui e vira conhecimento aprovado
 * na hora.
 */
function BrainGapsCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [gaps, setGaps] = useState<BrainGap[]>([]);
  const [loading, setLoading] = useState(true);
  // Erro/tabela ausente NÃO pode se disfarçar de "nenhuma lacuna ✅"
  const [loadError, setLoadError] = useState<"rede" | "migracao" | null>(null);
  const [answering, setAnswering] = useState<string | null>(null); // gapId aberto
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState<string | null>(null); // gapId com rascunho da IA

  async function draft(gapId: string) {
    if (drafting) return;
    setDrafting(true);
    try {
      const tk = await tokenFn();
      const res = await draftGapAnswer({ data: { accessToken: tk, gapId } });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "plan"
            ? "Seu plano atual não inclui a IA."
            : "reason" in res && res.reason === "config"
              ? "IA não configurada nesta instalação."
              : "Não foi possível gerar o rascunho — escreva manualmente.",
        );
        return;
      }
      setAnswer(res.draft);
      setDrafted(gapId);
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setDrafting(false);
    }
  }

  async function load() {
    try {
      const tk = await tokenFn();
      const res = await listBrainGaps({ data: { accessToken: tk } });
      if (res.ok) {
        setGaps(res.gaps);
        setLoadError(null);
      } else if ("missingTable" in res && res.missingTable) {
        setLoadError("migracao");
      } else {
        setLoadError("rede");
      }
    } catch {
      setLoadError("rede");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolve(gapId: string) {
    if (answer.trim().length < 5 || busy) return;
    setBusy(true);
    try {
      const tk = await tokenFn();
      const res = await resolveBrainGap({
        data: { accessToken: tk, gapId, answer: answer.trim() },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "plan"
            ? "Seu plano atual não inclui a IA."
            : "Não foi possível salvar — tente novamente.",
        );
        return;
      }
      toast.success("Respondida e aprendida pelo cérebro 🧠");
      setAnswering(null);
      setDrafted(null);
      setAnswer("");
      setGaps((gs) => gs.filter((g) => g.id !== gapId));
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(gapId: string) {
    if (dismissingId) return;
    setDismissingId(gapId);
    try {
      const tk = await tokenFn();
      const res = await dismissBrainGap({ data: { accessToken: tk, gapId } });
      if (res.ok) setGaps((gs) => gs.filter((g) => g.id !== gapId));
      else toast.error("Não foi possível ignorar.");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setDismissingId(null);
    }
  }

  async function installKit() {
    setInstalling(true);
    try {
      const tk = await tokenFn();
      const res = await installStarterPack({ data: { accessToken: tk } });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "plan"
            ? "Seu plano atual não inclui a IA."
            : "Não foi possível instalar o kit.",
        );
        return;
      }
      if ("already" in res && res.already) toast("O kit de partida já está instalado.");
      else
        toast.success(
          `${res.installed} dúvidas clássicas instaladas como rascunho — revise e aprove na Base de conhecimento 👇`,
        );
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="rounded-3xl border border-amber-300/60 bg-amber-50/40 p-6 shadow-[var(--shadow-card)] dark:bg-amber-950/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-serif text-xl">
            🕳️ O que a IA não soube responder
            {gaps.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                {gaps.length}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Perguntas reais das suas pacientes sem cobertura no cérebro (ou com 👎). Responda e a IA
            aprende na hora — sempre com a sua aprovação.
          </p>
        </div>
        <button
          onClick={installKit}
          disabled={installing}
          title="Instala ~30 dúvidas clássicas do pré-natal como rascunho para você revisar"
          className="shrink-0 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {installing ? "Instalando…" : "📦 Instalar kit de partida"}
        </button>
      </div>

      {loading ? (
        <div className="skeleton mt-4 h-20 rounded-2xl" />
      ) : loadError === "migracao" ? (
        <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          A tabela de lacunas ainda não existe no banco — rode o{" "}
          <strong>APLICAR_PENDENTES.sql</strong> no Supabase para ativar o autoaprendizado.
        </p>
      ) : loadError === "rede" ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Não foi possível carregar as lacunas.{" "}
          <button onClick={load} className="font-semibold text-primary underline">
            Tentar de novo
          </button>
        </p>
      ) : gaps.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Nenhuma lacuna aberta — o cérebro cobriu tudo que perguntaram até agora. ✅
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {gaps.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium">"{g.question}"</p>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  {g.hits}× perguntada{g.channel === "whatsapp" ? " · WhatsApp" : ""}
                </span>
              </div>
              {answering === g.id ? (
                <div className="mt-3">
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={4}
                    autoFocus
                    placeholder="Escreva a resposta como VOCÊ responderia à paciente… (ou gere um rascunho ✨)"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  {drafted === g.id && (
                    <p className="mt-1 text-[11px] text-amber-700">
                      ✨ Rascunho da IA no seu estilo — revise e ajuste antes de aprovar. Nada entra
                      no cérebro sem o seu aval.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => draft(g.id)}
                      disabled={drafting}
                      title="A IA escreve um rascunho no seu estilo, usando o seu cérebro — você só revisa"
                      className="rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-50"
                    >
                      {drafting ? "Gerando…" : "✨ Gerar rascunho"}
                    </button>
                    <button
                      onClick={() => resolve(g.id)}
                      disabled={busy || answer.trim().length < 5}
                      className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {busy ? "Salvando…" : "Responder e treinar 🧠"}
                    </button>
                    <button
                      onClick={() => {
                        setAnswering(null);
                        setDrafted(null);
                        setAnswer("");
                      }}
                      className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setAnswering(g.id);
                      setAnswer("");
                    }}
                    className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Responder
                  </button>
                  <button
                    onClick={() => dismiss(g.id)}
                    disabled={dismissingId === g.id}
                    className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {dismissingId === g.id ? "…" : "Ignorar"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Card "Estilo do médico": persona, frases típicas, regras e onde usar o cérebro. */
function BrainSettingsCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [settings, setSettings] = useState<BrainSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await getBrainSettings({ data: { accessToken: await tokenFn() } });
      if (res.ok) setSettings(res.settings);
      else toast.error("Não foi possível carregar o estilo do médico.");
    })();
  }, [tokenFn]);

  function patch(p: Partial<BrainSettings>) {
    setSettings((s) => (s ? { ...s, ...p } : s));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await saveBrainSettings({ data: { accessToken: await tokenFn(), settings } });
      if (!res.ok) {
        toast.error("Não foi possível salvar o estilo. Tente novamente.");
        return;
      }
      toast.success("Estilo do médico salvo.");
    } catch {
      toast.error("Não foi possível salvar o estilo. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="font-medium">Estilo do médico</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Como a IA deve soar quando responde em seu nome.
      </p>

      {!settings ? (
        <div className="mt-4 space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-secondary" />
          <div className="h-20 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Persona (quem é você e como fala)
            </label>
            <textarea
              value={settings.persona}
              onChange={(e) => patch({ persona: e.target.value })}
              rows={3}
              placeholder="Ex: Sou acolhedor e direto, explico com linguagem simples e sempre tranquilizo a paciente antes de orientar."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Frases típicas (uma por linha)
            </label>
            <textarea
              value={settings.sample_phrases}
              onChange={(e) => patch({ sample_phrases: e.target.value })}
              rows={3}
              placeholder={
                "Ex:\nFica tranquila, isso é comum na gestação.\nQualquer dúvida, estou por aqui."
              }
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Regras (o que a IA nunca deve fazer / sempre deve fazer)
            </label>
            <textarea
              value={settings.rules}
              onChange={(e) => patch({ rules: e.target.value })}
              rows={3}
              placeholder="Ex: Nunca indicar medicação. Em sangramento ou dor forte, orientar procurar o pronto-socorro imediatamente."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <BrainToggle
              checked={settings.enabled_app}
              onChange={(v) => patch({ enabled_app: v })}
              label="Usar no chat do app"
            />
            <BrainToggle
              checked={settings.enabled_whatsapp}
              onChange={(v) => patch({ enabled_whatsapp: v })}
              label="Usar no WhatsApp"
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {saving ? "Salvando..." : "Salvar estilo"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Card "Treinar respondendo": perguntas reais das pacientes viram conhecimento. */
function BrainTrainCard({
  tokenFn,
  onTrained,
}: {
  tokenFn: () => Promise<string>;
  onTrained: (questionId: string) => void;
}) {
  const [questions, setQuestions] = useState<
    { id: string; question: string; created_at: string }[] | null
  >(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await listUnansweredQuestions({ data: { accessToken: await tokenFn() } });
      if (res.ok) setQuestions(res.questions);
      else toast.error("Não foi possível carregar as perguntas das pacientes.");
    })();
  }, [tokenFn]);

  async function train(q: { id: string; question: string }) {
    const answer = (answers[q.id] ?? "").trim();
    if (!answer || sendingId) return;
    setSendingId(q.id);
    try {
      const res = await answerAndTrain({
        data: { accessToken: await tokenFn(), questionId: q.id, answer },
      });
      if (!res.ok) {
        toast.error("Não foi possível treinar com essa resposta. Tente novamente.");
        return;
      }
      setQuestions((prev) => (prev ?? []).filter((x) => x.id !== q.id));
      // Reflete o "respondida" também na aba Perguntas e no contador do topo.
      onTrained(q.id);
      toast.success("🧠 O cérebro aprendeu mais uma");
    } catch {
      toast.error("Não foi possível treinar com essa resposta. Tente novamente.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="font-medium">Treinar respondendo</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Cada resposta sua vira conhecimento: a paciente recebe a resposta e o cérebro aprende a
        conduta para as próximas.
      </p>

      {questions === null ? (
        <div className="mt-4 space-y-3">
          <div className="h-24 animate-pulse rounded-xl bg-secondary" />
          <div className="h-24 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : questions.length === 0 ? (
        <p className="mt-4 rounded-xl bg-secondary/60 p-4 text-sm text-muted-foreground">
          Tudo respondido por aqui! 🎉 Quando uma paciente enviar uma nova pergunta, ela aparece
          nesta lista para você ensinar o cérebro.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">
                {new Date(q.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <p className="mt-1 font-medium">{q.question}</p>
              <textarea
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={3}
                placeholder="Escreva como você responderia a essa paciente..."
                className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={() => train(q)}
                disabled={sendingId === q.id || !(answers[q.id] ?? "").trim()}
                className="mt-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
              >
                {sendingId === q.id ? "Treinando..." : "Responder e treinar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Card "Base de conhecimento": busca, edição e novas entradas manuais. */
function BrainKnowledgeCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [entries, setEntries] = useState<BrainEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [adding, setAdding] = useState(false);

  // Busca com debounce; a primeira carga (search vazio) é imediata.
  useEffect(() => {
    // Guard contra respostas fora de ordem: descarta resultados de buscas antigas.
    let alive = true;
    const t = setTimeout(
      async () => {
        const res = await listBrainEntries({
          data: { accessToken: await tokenFn(), search: search.trim() || undefined },
        });
        if (!alive) return;
        if (res.ok) setEntries(res.entries);
        else toast.error("Não foi possível carregar a base de conhecimento.");
      },
      search ? 350 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search, tokenFn]);

  async function toggleApproved(entry: BrainEntry) {
    const approved = !entry.approved;
    setEntries((prev) => (prev ?? []).map((x) => (x.id === entry.id ? { ...x, approved } : x)));
    const res = await updateBrainEntry({
      data: {
        accessToken: await tokenFn(),
        id: entry.id,
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        approved,
      },
    });
    if (!res.ok) {
      setEntries((prev) =>
        (prev ?? []).map((x) => (x.id === entry.id ? { ...x, approved: entry.approved } : x)),
      );
      toast.error("Não foi possível atualizar a entrada. Tente novamente.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir esta entrada da base de conhecimento?")) return;
    const res = await deleteBrainEntry({ data: { accessToken: await tokenFn(), id } });
    if (!res.ok) {
      toast.error("Não foi possível excluir a entrada. Tente novamente.");
      return;
    }
    setEntries((prev) => (prev ?? []).filter((x) => x.id !== id));
    toast.success("Entrada excluída.");
  }

  async function add() {
    if (!newQuestion.trim() || !newAnswer.trim() || adding) return;
    setAdding(true);
    try {
      const res = await addBrainEntry({
        data: {
          accessToken: await tokenFn(),
          question: newQuestion.trim(),
          answer: newAnswer.trim(),
          category: newCategory.trim() || null,
        },
      });
      if (!res.ok || !res.entry) {
        toast.error("Não foi possível adicionar a entrada. Tente novamente.");
        return;
      }
      const entry = res.entry;
      // Com busca ativa, limpa o filtro (o effect recarrega a lista completa,
      // já com a nova entrada); sem busca, insere direto no topo.
      if (search) setSearch("");
      else setEntries((prev) => [entry, ...(prev ?? [])]);
      setNewQuestion("");
      setNewAnswer("");
      setNewCategory("");
      toast.success("🧠 O cérebro aprendeu mais uma");
    } catch {
      toast.error("Não foi possível adicionar a entrada. Tente novamente.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="font-medium">Base de conhecimento</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Tudo o que o cérebro já sabe. Desative uma entrada para tirá-la das respostas sem excluir.
      </p>

      {/* Nova entrada */}
      <div className="mt-4 rounded-xl border border-dashed border-border p-4">
        <p className="text-sm font-medium">Nova entrada</p>
        <div className="mt-2 space-y-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Pergunta (ex: Posso tomar dipirona na gestação?)"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={newAnswer}
            onChange={(e) => setNewAnswer(e.target.value)}
            rows={3}
            placeholder="Resposta, do jeito que você responderia"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Categoria (opcional)"
              className="w-44 rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={add}
              disabled={adding || !newQuestion.trim() || !newAnswer.trim()}
              className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              {adding ? "Adicionando..." : "+ Adicionar ao cérebro"}
            </button>
          </div>
        </div>
      </div>

      {/* Busca */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar na base (pergunta ou resposta)..."
        className="mt-4 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
      />

      {/* Lista */}
      {entries === null ? (
        <div className="mt-4 space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-secondary" />
          <div className="h-16 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {search
            ? "Nada encontrado para essa busca."
            : "O cérebro ainda está vazio. Adicione a primeira entrada acima ou responda uma pergunta de paciente."}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-xl border p-4 ${entry.approved ? "border-border" : "border-dashed border-border bg-secondary/30"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{entry.question}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${BRAIN_SOURCE_STYLE[entry.source] ?? "bg-secondary text-muted-foreground"}`}
                    >
                      {entry.source}
                    </span>
                    {entry.category && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {entry.category}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.answer}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <BrainToggle
                    checked={entry.approved}
                    onChange={() => toggleApproved(entry)}
                    label={entry.approved ? "Ativa" : "Inativa"}
                  />
                  <button
                    onClick={() => remove(entry.id)}
                    className="rounded-full border border-rose-300 px-2.5 py-0.5 text-xs text-rose-600 hover:bg-rose-100"
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
  );
}

/** Card "Playground": teste o cérebro como se fosse uma paciente. */
function BrainPlaygroundCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<{ question: string; answer: string } | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    try {
      const res = await testBrain({ data: { accessToken: await tokenFn(), question: q } });
      if (!res.ok) {
        toast.error(
          "answer" in res && res.answer
            ? res.answer
            : "Não foi possível testar o cérebro. Tente novamente.",
        );
        return;
      }
      setResult({ question: q, answer: res.answer });
    } catch {
      toast.error("Não foi possível testar o cérebro. Tente novamente.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="font-medium">Playground</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Pergunte como se fosse uma paciente e veja o que o cérebro responde hoje.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
          }}
          placeholder="Ex: Estou com azia forte, o que posso fazer?"
          className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          onClick={ask}
          disabled={asking || !question.trim()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {asking ? "Pensando..." : "Perguntar"}
        </button>
      </div>

      {(result || asking) && (
        <div className="mt-4 space-y-3">
          {result && !asking && (
            <>
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {result.question}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm">
                  {result.answer}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                💬 É assim que suas pacientes vão ler a resposta.
              </p>
            </>
          )}
          {asking && (
            <div className="flex justify-start">
              <div className="animate-pulse rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
                Pensando...
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Receipt Modal ---------- */
import { DOCTOR } from "@/lib/doctor.config";

function ReceiptModal({ appt, onClose }: { appt: AdminAppointment; onClose: () => void }) {
  const ext = appt as any;
  const printRef = useRef<HTMLDivElement>(null);
  const receiptDate = ext.confirmed_date
    ? new Date(ext.confirmed_date + "T00:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date(appt.preferred_date + "T00:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
  const receiptTime = ext.confirmed_time ?? appt.preferred_time;
  const receiptNumber = appt.id.slice(0, 8).toUpperCase();
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document
      .write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Recibo de Consulta</title><style>
      body { font-family: Georgia, serif; max-width: 640px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; }
      h1 { font-size: 22px; margin: 0; }
      p { margin: 4px 0; }
      .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: #666; margin-top: 16px; }
      .value { font-size: 14px; }
      hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
      .total { font-size: 22px; font-weight: bold; }
      .footer { font-size: 11px; color: #999; text-align: center; margin-top: 40px; }
      .sig { margin-top: 60px; border-top: 1px solid #999; width: 200px; padding-top: 6px; font-size: 11px; color: #666; }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <p className="text-sm font-medium text-muted-foreground">Recibo #{receiptNumber}</p>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground"
            >
              🖨 Imprimir
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Receipt content */}
        <div ref={printRef} className="px-8 py-6">
          {/* Header */}
          <div className="border-b border-gray-200 pb-5 mb-5">
            <h1 className="font-serif text-2xl text-gray-900">{DOCTOR.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{DOCTOR.title}</p>
            <p className="text-xs text-gray-400">
              {DOCTOR.crm}
              {DOCTOR.rqe ? ` · ${DOCTOR.rqe}` : ""}
            </p>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Recibo de Consulta
          </p>
          <p className="text-xs text-gray-400">
            Nº {receiptNumber} · Emitido em {today}
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Paciente
              </p>
              <p className="text-sm text-gray-800">{appt.patient_name}</p>
              {appt.patient_phone && <p className="text-xs text-gray-500">{appt.patient_phone}</p>}
              {appt.patient_email && <p className="text-xs text-gray-500">{appt.patient_email}</p>}
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Data e horário
              </p>
              <p className="text-sm text-gray-800">
                {receiptDate} às {receiptTime}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Descrição
              </p>
              <p className="text-sm text-gray-800">Consulta de {DOCTOR.title}</p>
              <p className="text-xs text-gray-500">{appt.reason}</p>
            </div>
          </div>

          {ext.price_brl ? (
            <div className="mt-5 flex items-baseline justify-between rounded-xl bg-gray-50 px-4 py-3 border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Valor</p>
              <div className="text-right">
                <p className="font-serif text-2xl font-bold text-gray-900">
                  R$ {(ext.price_brl / 100).toFixed(2).replace(".", ",")}
                </p>
                {ext.payment_status === "pago" && (
                  <p className="text-xs font-medium text-emerald-600">✓ Pago</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3 border border-gray-100 text-center">
              <p className="text-xs text-gray-400">Valor a definir</p>
            </div>
          )}

          {/* Signature */}
          <div className="mt-10 flex justify-end">
            <div className="text-center">
              <div className="h-12 border-b border-gray-400 w-48" />
              <p className="text-xs text-gray-500 mt-1">{DOCTOR.name}</p>
              <p className="text-[10px] text-gray-400">{DOCTOR.crm}</p>
            </div>
          </div>

          <p className="mt-8 text-center text-[10px] text-gray-300">
            Este documento não tem validade fiscal. Para nota fiscal, consulte a recepção.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Meu Perfil (perfil do médico assinante) ---------- */

/** Plano & assinatura do médico — assinatura recorrente por cartão (Stripe). */
function DoctorBilling({
  tokenFn,
  plan,
  active,
  exists,
}: {
  tokenFn: () => Promise<string>;
  plan: string;
  active: boolean;
  exists: boolean;
}) {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const isPaid = active && ["starter", "pro", "clinica", "elite", "black"].includes(plan);
  const isTeam = plan === "clinica";

  async function checkout(planKey: "starter" | "pro" | "elite" | "black") {
    setBusy(planKey);
    try {
      const tk = await tokenFn();
      const { createSubscriptionCheckout } = await import("@/lib/billing.functions");
      const res = await createSubscriptionCheckout({
        data: {
          accessToken: tk,
          product: "doctor_plan",
          plan: cycle === "annual" ? (`${planKey}_annual` as const) : planKey,
          returnPath: "/painel",
        },
      });
      if (res.ok && res.url) {
        window.location.href = res.url;
        return;
      }
      toast.error(
        res.error === "pagamento_indisponivel"
          ? "O pagamento está sendo configurado. Tente em instantes."
          : res.error === "plano_indisponivel"
            ? "Este ciclo ainda não está disponível — tente o mensal."
            : "Não foi possível abrir o pagamento.",
      );
    } catch {
      toast.error("Não foi possível abrir o pagamento.");
    }
    setBusy(null);
  }

  async function portal() {
    setBusy("portal");
    try {
      const tk = await tokenFn();
      const { openBillingPortal } = await import("@/lib/billing.functions");
      const res = await openBillingPortal({ data: { accessToken: tk, returnPath: "/painel" } });
      if (res.ok && res.url) {
        window.location.href = res.url;
        return;
      }
      toast.error(
        res.error === "sem_assinatura"
          ? "Você ainda não tem uma assinatura ativa."
          : "Não foi possível abrir o portal.",
      );
    } catch {
      toast.error("Não foi possível abrir o portal.");
    }
    setBusy(null);
  }

  if (isPaid) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="font-serif text-lg text-emerald-900">
          Assinatura ativa · plano {plan === "clinica" ? "Pro Equipe" : plan}
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Sua cobrança é automática. Troque o cartão, veja faturas ou cancele quando quiser.
        </p>
        <button
          onClick={portal}
          disabled={busy === "portal"}
          className="mt-4 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "portal" ? "Abrindo…" : "Gerenciar assinatura"}
        </button>
      </div>
    );
  }

  const PlanBtn = ({
    planKey,
    name,
    monthly,
    tagline,
    highlight,
    black,
    perk,
  }: {
    planKey: "starter" | "pro" | "elite" | "black";
    name: string;
    monthly: number;
    tagline: string;
    highlight?: boolean;
    black?: boolean;
    perk?: string;
  }) => (
    <div
      className={`rounded-2xl border p-4 ${
        black
          ? "border-neutral-700 bg-neutral-900 text-white"
          : highlight
            ? "border-amber-400 bg-card ring-1 ring-amber-300"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <p className="font-serif text-base">{name}</p>
        {black ? (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-neutral-900">
            MÁXIMO
          </span>
        ) : highlight ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">
            TOP
          </span>
        ) : null}
      </div>
      <p className={`mt-0.5 text-xs ${black ? "text-white/60" : "text-muted-foreground"}`}>
        {tagline}
      </p>
      <p className="mt-2 text-2xl font-extrabold">
        R$ {monthly}
        <span
          className={`text-sm font-normal ${black ? "text-white/60" : "text-muted-foreground"}`}
        >
          /mês
        </span>
      </p>
      {cycle === "annual" && (
        <p className={`text-[11px] font-semibold ${black ? "text-amber-300" : "text-emerald-600"}`}>
          cobrado 1×/ano · 2 meses grátis
        </p>
      )}
      {perk && (
        <p
          className={`mt-1.5 text-[11px] font-semibold ${black ? "text-amber-300" : "text-amber-700"}`}
        >
          {perk}
        </p>
      )}
      <button
        onClick={() => checkout(planKey)}
        disabled={!!busy}
        className={`press mt-3 w-full rounded-full py-2.5 text-sm font-semibold disabled:opacity-60 ${
          black
            ? "bg-amber-400 text-neutral-900"
            : highlight
              ? "bg-amber-500 text-white"
              : "bg-primary text-primary-foreground"
        }`}
      >
        {busy === planKey ? "Abrindo pagamento…" : `Assinar ${name}`}
      </button>
    </div>
  );

  return (
    <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-serif text-lg">Ative sua assinatura</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {exists ? "Você está no período de teste." : ""} Assine por cartão — acesso liberado na
            hora, renovação automática, cancele quando quiser.
          </p>
        </div>
      </div>

      <div className="mt-4 inline-flex rounded-full border border-border bg-card p-1 text-xs font-semibold">
        <button
          onClick={() => setCycle("monthly")}
          className={`rounded-full px-3 py-1.5 ${cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Mensal
        </button>
        <button
          onClick={() => setCycle("annual")}
          className={`rounded-full px-3 py-1.5 ${cycle === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Anual · 2 meses grátis
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PlanBtn planKey="starter" name="Starter" monthly={197} tagline="A sua IA no app" />
        <PlanBtn planKey="pro" name="Pro" monthly={347} tagline="A IA também no WhatsApp" />
        <PlanBtn
          planKey="elite"
          name="Elite"
          monthly={697}
          tagline="Para clínicas de alto volume"
          highlight
          perk="🎟️ 25 convites premium/mês + selo Elite"
        />
        <PlanBtn
          planKey="black"
          name="Black"
          monthly={1999}
          tagline="O plano mais completo"
          black
          perk="🖤 250 convites/mês · gerente dedicado · topo da busca · selo Black"
        />
      </div>

      {isTeam ? null : (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Precisa de vários médicos (Pro Equipe)?{" "}
          <a href="/medicos#contato" className="font-semibold text-primary">
            Fale com a gente
          </a>
          .
        </p>
      )}
    </div>
  );
}

/** Card de convites premium (Elite/Black): gera código na hora + cota do mês. */
function DoctorInviteCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [info, setInfo] = useState<{
    eligible: boolean;
    limit: number;
    used: number;
    remaining: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const tk = await tokenFn();
        const { getMyInviteInfo } = await import("@/lib/invites.functions");
        const res = await getMyInviteInfo({ data: { accessToken: tk } });
        if (res.ok) setInfo(res);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !info || !info.eligible) return null;

  async function generate() {
    setGenerating(true);
    setCopied(false);
    try {
      const tk = await tokenFn();
      const { generateInviteCode } = await import("@/lib/invites.functions");
      const res = await generateInviteCode({ data: { accessToken: tk } });
      if (res.ok) {
        setCode(res.code);
        setInfo((prev) => (prev ? { ...prev, used: res.used, remaining: res.remaining } : prev));
        // Copia automaticamente para facilitar o envio.
        try {
          await navigator.clipboard.writeText(res.code);
          setCopied(true);
        } catch {
          /* sem clipboard: a paciente copia manualmente */
        }
      } else {
        toast.error(
          res.error === "cota_esgotada"
            ? "Você já gerou todos os convites deste mês."
            : "Não foi possível gerar o código. Tente novamente.",
        );
      }
    } catch {
      toast.error("Não foi possível gerar o código.");
    }
    setGenerating(false);
  }

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Código: " + code);
    }
  };

  const esgotado = info.remaining <= 0;

  return (
    <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6">
      <p className="font-serif text-lg text-amber-900">🎟️ Convites premium</p>
      <p className="mt-1 text-sm text-amber-800">
        Gere um código na hora e envie para a sua paciente do jeito que quiser (WhatsApp, e-mail…).
        Cada código vale para <strong>uma paciente</strong> e libera o Obstétrica Premium completo —
        por sua conta.
      </p>

      {code && (
        <button
          onClick={copy}
          className="press mt-4 flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-amber-300 bg-white px-4 py-3 font-mono text-xl font-black tracking-[0.3em] text-amber-900"
        >
          <span>{code}</span>
          <span className="font-sans text-xs font-bold text-amber-600">
            {copied ? "copiado ✓" : "copiar"}
          </span>
        </button>
      )}

      <button
        onClick={generate}
        disabled={generating || esgotado}
        className="press mt-3 w-full rounded-full bg-amber-500 py-3 text-sm font-extrabold text-white disabled:opacity-50"
      >
        {generating
          ? "Gerando…"
          : esgotado
            ? "Cota do mês esgotada"
            : code
              ? "Gerar outro código"
              : "Gerar código para uma paciente"}
      </button>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-amber-800">
          Gerados este mês: <strong>{info.used}</strong> de {info.limit}
        </span>
        <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-800">
          {info.remaining} restantes
        </span>
      </div>
    </div>
  );
}

/**
 * "Indique um colega": link de indicação (/medicos/cadastro?ref=<meuId>) +
 * contagem. Quando o indicado assina um plano pago, o médico ganha +30 dias.
 * É o canal de crescimento médico→médico dentro do produto.
 */
function ReferralCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [link, setLink] = useState<string>("");
  const [invited, setInvited] = useState(0);
  const [rewarded, setRewarded] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (uid && typeof window !== "undefined") {
        setLink(`${window.location.origin}/medicos/cadastro?ref=${uid}`);
      }
      const tk = await tokenFn();
      const res = await getMyReferrals({ data: { accessToken: tk } });
      if (res.ok) {
        setInvited(res.invited);
        setRewarded(res.rewarded);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <p className="font-serif text-lg">Indique um colega 💛</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Compartilhe seu link com outros obstetras. Quando um deles <strong>assinar</strong> um plano
        pago, você ganha <strong>1 mês grátis</strong> (aplicado no seu plano).
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          {link || "gerando seu link…"}
        </span>
        <button
          disabled={!link}
          onClick={() => {
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">{invited}</strong> colega(s) indicado(s)
        </span>
        <span>
          <strong className="text-foreground">{rewarded}</strong> assinaram — meses grátis ganhos
        </span>
      </div>
    </div>
  );
}

function GoogleCalendarCard({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const tk = await tokenFn();
      const res = await getGoogleCalendarStatus({ data: { accessToken: tk } });
      if (res.ok) {
        setConnected(res.connected);
        setEmail(res.connected ? (res.email ?? null) : null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy(true);
    try {
      const tk = await tokenFn();
      const res = await startGoogleCalendarConnect({
        data: { accessToken: tk, origin: window.location.origin },
      });
      if (res.ok && "url" in res) {
        window.location.href = res.url;
      } else {
        toast.error(("error" in res && res.error) || "Não foi possível iniciar a conexão.");
        setBusy(false);
      }
    } catch {
      toast.error("Falha de conexão. Tente novamente.");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const tk = await tokenFn();
      await disconnectGoogleCalendar({ data: { accessToken: tk } });
      setConnected(false);
      setEmail(null);
      toast.success("Agenda desconectada.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="skeleton h-28 rounded-3xl" />;

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-serif text-lg">Google Agenda das teleconsultas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {connected
              ? "Conectada — as salas de teleconsulta são criadas na sua conta Google e o convite vai para você e para a paciente."
              : "Conecte sua conta Google para que cada teleconsulta crie a reunião do Meet na SUA agenda e convide você e a paciente automaticamente."}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            connected ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"
          }`}
        >
          {connected ? "Conectada ✓" : "Não conectada"}
        </span>
      </div>

      {connected && email && (
        <p className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
          Conta: <strong>{email}</strong>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {connected ? (
          <>
            <button
              onClick={connect}
              disabled={busy}
              className="rounded-full border border-border px-4 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-60"
            >
              Reconectar
            </button>
            <button
              onClick={disconnect}
              disabled={busy}
              className="rounded-full border border-destructive/30 px-4 py-2 text-xs text-destructive hover:bg-destructive/5 disabled:opacity-60"
            >
              Desconectar
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={busy}
            className="press rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Redirecionando…" : "Conectar Google Agenda"}
          </button>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Sem conectar, as teleconsultas usam a conta Google central da plataforma (ou o Jitsi, se
        nenhuma estiver configurada).
      </p>
    </div>
  );
}

function MeuPerfilSection({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [plan, setPlan] = useState("trial");
  const [active, setActive] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    title: "",
    specialty: "",
    crm: "",
    whatsapp: "",
    pix_key: "",
    bio: "",
    subspecialty: "",
    years_experience: null as number | null,
    has_masters: false,
    has_doctorate: false,
    city: "",
    state: "",
    accepting_patients: true,
    // Perfil rico — o que as pacientes mais querem saber
    instagram: "",
    rqe: "",
    education: "",
    hospitals: "",
    insurances: "",
    languages: "",
    approach: "",
    consultation_price_brl: null as number | null,
    offers_telehealth: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const tk = await tokenFn();
        const res = await getMyDoctor({ data: { accessToken: tk } });
        if (res.ok && res.doctor) {
          const d = res.doctor as DoctorProfile;
          setExists(true);
          setPlan(d.plan);
          setActive(d.active);
          setSlug(d.slug);
          setForm({
            display_name: d.display_name,
            title: d.title,
            specialty: d.specialty,
            crm: d.crm,
            whatsapp: d.whatsapp,
            pix_key: d.pix_key,
            bio: d.bio ?? "",
            subspecialty: d.subspecialty ?? "",
            years_experience: d.years_experience ?? null,
            has_masters: !!d.has_masters,
            has_doctorate: !!d.has_doctorate,
            city: d.city ?? "",
            state: d.state ?? "",
            accepting_patients: d.accepting_patients ?? true,
            instagram: d.instagram ?? "",
            rqe: d.rqe ?? "",
            education: d.education ?? "",
            hospitals: d.hospitals ?? "",
            insurances: d.insurances ?? "",
            languages: d.languages ?? "",
            approach: d.approach ?? "",
            consultation_price_brl: d.consultation_price_brl ?? null,
            offers_telehealth: !!d.offers_telehealth,
          });
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (form.display_name.trim().length < 2) {
      toast.error("Informe seu nome.");
      return;
    }
    setSaving(true);
    try {
      const tk = await tokenFn();
      // Equipe da instalação pode ainda não ter linha em doctors: cria na hora
      if (exists) {
        const res = await updateMyDoctor({ data: { accessToken: tk, profile: form } });
        if (!res.ok) {
          toast.error("Não foi possível salvar o perfil.");
          return;
        }
      } else {
        const res = await registerDoctor({ data: { accessToken: tk, profile: form } });
        if (!res.ok || !res.doctor) {
          toast.error("Não foi possível salvar o perfil.");
          return;
        }
        setExists(true);
        setSlug(res.doctor.slug);
        setPlan(res.doctor.plan);
      }
      toast.success("Perfil salvo ✓");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="skeleton h-64 rounded-3xl" />;

  const input =
    "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  const label = "text-xs font-medium uppercase tracking-wide text-muted-foreground";

  return (
    <div className="max-w-2xl space-y-4">
      <DoctorBilling tokenFn={tokenFn} plan={plan} active={active} exists={exists} />
      <DoctorInviteCard tokenFn={tokenFn} />
      <ReferralCard tokenFn={tokenFn} />
      <GoogleCalendarCard tokenFn={tokenFn} />

      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-lg">Perfil do médico</p>
            <p className="mt-1 text-sm text-muted-foreground">
              É com esses dados que suas pacientes veem você no app.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              plano {plan}
            </span>
            <DoctorBadge plan={plan} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={label}>Nome completo *</label>
            <input
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              className={input}
            />
          </div>
          <div>
            <label className={label}>CRM</label>
            <input
              value={form.crm}
              onChange={(e) => setForm((f) => ({ ...f, crm: e.target.value }))}
              className={input}
            />
          </div>
          <div>
            <label className={label}>WhatsApp</label>
            <input
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Título</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ginecologista e Obstetra"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Especialidade / foco</label>
            <input
              value={form.specialty}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
              placeholder="Gestação de alto risco"
              className={input}
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Chave PIX (cobranças)</label>
            <input
              value={form.pix_key}
              onChange={(e) => setForm((f) => ({ ...f, pix_key: e.target.value }))}
              className={input}
            />
          </div>
        </div>

        {/* Perfil público — aparece na busca de médicos das pacientes */}
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-semibold">Perfil público (busca de médicos)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Preencha para aparecer quando pacientes sem médico procurarem no app. Planos melhores
            aparecem primeiro.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className={label}>Subárea / atuação</label>
              <input
                value={form.subspecialty}
                onChange={(e) => setForm((f) => ({ ...f, subspecialty: e.target.value }))}
                placeholder="Medicina fetal, alto risco…"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Anos de experiência</label>
              <input
                type="number"
                min={0}
                max={70}
                value={form.years_experience ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    years_experience: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className={input}
              />
            </div>
            <div>
              <label className={label}>Cidade</label>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Estado (UF)</label>
              <input
                value={form.state}
                maxLength={2}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                placeholder="SP"
                className={input}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Sobre você (bio curta)</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
                placeholder="Uma frase acolhedora sobre a sua forma de cuidar."
                className={`${input} resize-none`}
              />
            </div>
            {/* ── O que as pacientes mais querem saber ─────────────────── */}
            <div>
              <label className={label}>Instagram</label>
              <input
                value={form.instagram}
                onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                placeholder="@seuperfil ou link completo"
                className={input}
              />
            </div>
            <div>
              <label className={label}>RQE (registro de especialista)</label>
              <input
                value={form.rqe}
                onChange={(e) => setForm((f) => ({ ...f, rqe: e.target.value }))}
                placeholder="RQE 12345"
                className={input}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Formação (uma por linha)</label>
              <textarea
                value={form.education}
                onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
                rows={3}
                placeholder={
                  "Residência em GO — UFMG\nMestrado em Medicina Fetal — USP\nTítulo de especialista FEBRASGO"
                }
                className={`${input} resize-none`}
              />
            </div>
            <div>
              <label className={label}>Maternidades / hospitais onde atende</label>
              <textarea
                value={form.hospitals}
                onChange={(e) => setForm((f) => ({ ...f, hospitals: e.target.value }))}
                rows={2}
                placeholder="Ex: Unimed BH, Mater Dei, Vila da Serra"
                className={`${input} resize-none`}
              />
            </div>
            <div>
              <label className={label}>Convênios aceitos</label>
              <textarea
                value={form.insurances}
                onChange={(e) => setForm((f) => ({ ...f, insurances: e.target.value }))}
                rows={2}
                placeholder="Ex: Unimed, Bradesco Saúde, particular"
                className={`${input} resize-none`}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>Sua abordagem (filosofia de cuidado)</label>
              <textarea
                value={form.approach}
                onChange={(e) => setForm((f) => ({ ...f, approach: e.target.value }))}
                rows={2}
                placeholder="Ex: pré-natal humanizado, incentivo ao parto normal quando seguro, decisões compartilhadas."
                className={`${input} resize-none`}
              />
            </div>
            <div>
              <label className={label}>Idiomas</label>
              <input
                value={form.languages}
                onChange={(e) => setForm((f) => ({ ...f, languages: e.target.value }))}
                placeholder="Português, inglês…"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Consulta particular (R$, opcional)</label>
              <input
                type="number"
                min={0}
                value={form.consultation_price_brl ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    consultation_price_brl: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="Ex: 450"
                className={input}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.has_masters}
                onChange={(e) => setForm((f) => ({ ...f, has_masters: e.target.checked }))}
              />
              🎓 Mestrado
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.has_doctorate}
                onChange={(e) => setForm((f) => ({ ...f, has_doctorate: e.target.checked }))}
              />
              🎓 Doutorado
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.accepting_patients}
                onChange={(e) => setForm((f) => ({ ...f, accepting_patients: e.target.checked }))}
              />
              Aceitando novas pacientes
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.offers_telehealth}
                onChange={(e) => setForm((f) => ({ ...f, offers_telehealth: e.target.checked }))}
              />
              💻 Atendo por teleconsulta
            </label>
          </div>
        </div>

        {slug && (
          <p className="mt-4 text-xs text-muted-foreground">
            Seu endereço na plataforma:{" "}
            <code className="rounded bg-secondary px-1.5 py-0.5">/dr/{slug}</code> (páginas por
            médico chegam na próxima etapa)
          </p>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Pacientes (vínculo paciente ↔ médico) ---------- */
/**
 * Chip de BPM fetal na lista de pacientes: o médico anota o valor medido na
 * consulta e o "Sentir o coração" (app da paciente + Painel do Papai) passa a
 * vibrar no ritmo exato do bebê.
 */
function FetalBpmChip({
  p,
  tokenFn,
  onSaved,
}: {
  p: LinkedPatient;
  tokenFn: () => Promise<string>;
  onSaved: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const n = val.trim() === "" ? null : Number(val);
    if (n !== null && (!Number.isInteger(n) || n < 60 || n > 220)) {
      toast.error("BPM entre 60 e 220 (ou vazio para limpar).");
      return;
    }
    setBusy(true);
    try {
      const tk = await tokenFn();
      const res = await setPatientFetalBpm({ data: { accessToken: tk, patientId: p.id, bpm: n } });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível salvar o BPM.");
        return;
      }
      toast.success(n ? `Coração do bebê: ${n} bpm 💗` : "BPM removido.");
      setEditing(false);
      await onSaved();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setVal(p.fetal_bpm ? String(p.fetal_bpm) : "");
          setEditing(true);
        }}
        title="BPM fetal da última consulta — a família sente esse ritmo no 'Sentir o coração'"
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
          p.fetal_bpm
            ? "bg-rose-100 text-rose-700"
            : "border border-border text-muted-foreground hover:border-rose-400 hover:text-rose-600"
        }`}
      >
        {p.fetal_bpm ? `💗 ${p.fetal_bpm} bpm` : "💗 BPM"}
      </button>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      <input
        type="number"
        min={60}
        max={220}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="bpm"
        autoFocus
        className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs"
      />
      <button
        onClick={save}
        disabled={busy}
        className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "…" : "OK"}
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground"
      >
        ✕
      </button>
    </span>
  );
}

/**
 * Gerenciador de Lives (equipe): cadastra título, data/hora e link — a página
 * pública /lives passa a ler daqui em vez das datas fixas no código.
 */
function LivesSection({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [lives, setLives] = useState<Live[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const tk = await tokenFn();
      const res = await listLivesAdmin({ data: { accessToken: tk } });
      if (res.ok) setLives(res.lives);
      else if ("missingTable" in res && res.missingTable) setMissingTable(true);
    } catch {
      toast.error("Não foi possível carregar as lives.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const tk = await tokenFn();
      const res = await saveLive({
        data: {
          accessToken: tk,
          title: title.trim(),
          scheduledAt: when ? new Date(when).toISOString() : null,
          link: link.trim() || null,
          isPublished: true,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível salvar.");
        return;
      }
      toast.success("Live cadastrada 🎥");
      setTitle("");
      setWhen("");
      setLink("");
      await load();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(l: Live) {
    const tk = await tokenFn();
    const res = await saveLive({
      data: {
        accessToken: tk,
        id: l.id,
        title: l.title,
        scheduledAt: l.scheduled_at,
        link: l.link,
        isPublished: !l.is_published,
      },
    });
    if (res.ok) await load();
    else toast.error(res.error ?? "Não foi possível atualizar.");
  }

  async function removeLive(id: string) {
    const tk = await tokenFn();
    const res = await deleteLive({ data: { accessToken: tk, id } });
    if (res.ok) setLives((ls) => ls.filter((l) => l.id !== id));
    else toast.error("Não foi possível excluir.");
  }

  const fmtWhen = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "sem data";

  if (loading) return <div className="skeleton h-64 rounded-3xl" />;

  return (
    <div className="space-y-6">
      {missingTable && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          A tabela <code>lives</code> ainda não existe no banco — rode o{" "}
          <strong>APLICAR_PENDENTES.sql</strong> no Supabase para ativar o gerenciador.
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="font-serif text-xl">Nova live</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O que você cadastrar aqui aparece na página pública /lives — com contagem regressiva
          quando tiver data futura.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da live *"
            aria-label="Título da live"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-label="Data e hora"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Link (Instagram/YouTube)"
            aria-label="Link da live"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:w-64"
          />
          <button
            onClick={create}
            disabled={saving || !title.trim()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Cadastrar"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        {lives.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma live cadastrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lives.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    📅 {fmtWhen(l.scheduled_at)}
                    {l.link ? " · 🔗 com link" : ""}
                  </p>
                </div>
                <button
                  onClick={() => togglePublish(l)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                    l.is_published
                      ? "bg-emerald-100 text-emerald-700"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {l.is_published ? "Publicada" : "Oculta"}
                </button>
                <button
                  onClick={() => removeLive(l.id)}
                  className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PacientesSection({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PatientRequest[]>([]);
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  // id da solicitação sendo respondida (desabilita os botões enquanto em voo)
  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function loadPatients() {
    const tk = await tokenFn();
    const res = await listMyPatients({ data: { accessToken: tk } });
    if (res.ok) setPatients(res.patients);
  }

  // Ativa/desativa o premium do quiz (após o PIX, o médico libera aqui)
  const [premiumBusyId, setPremiumBusyId] = useState<string | null>(null);
  async function togglePremium(p: LinkedPatient) {
    setPremiumBusyId(p.id);
    try {
      const tk = await tokenFn();
      const res = await setPatientQuizPremium({
        data: { accessToken: tk, patientId: p.id, premium: !p.quiz_premium },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível alterar o premium.");
        return;
      }
      setPatients((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, quiz_premium: !p.quiz_premium } : x)),
      );
      toast.success(!p.quiz_premium ? "Aulas premium ativadas ⭐" : "Premium desativado.");
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setPremiumBusyId(null);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const tk = await tokenFn();
        const [reqRes, patRes] = await Promise.all([
          listPatientRequests({ data: { accessToken: tk } }),
          listMyPatients({ data: { accessToken: tk } }),
        ]);
        if (reqRes.ok) setRequests(reqRes.requests);
        if (patRes.ok) setPatients(patRes.patients);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function respond(req: PatientRequest, accept: boolean) {
    setRespondingId(req.id);
    try {
      const tk = await tokenFn();
      const res = await respondPatientRequest({
        data: { accessToken: tk, requestId: req.id, accept },
      });
      if (!res.ok) {
        toast.error("Não foi possível responder à solicitação. Tente novamente.");
        return;
      }
      // Remove o card otimisticamente e, ao aceitar, atualiza as pacientes.
      setRequests((rs) => rs.filter((r) => r.id !== req.id));
      if (accept) {
        toast.success("Paciente vinculada ✓");
        await loadPatients();
      } else {
        toast.success("Solicitação recusada.");
      }
    } finally {
      setRespondingId(null);
    }
  }

  if (loading) return <div className="skeleton h-64 rounded-3xl" />;

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <div className="space-y-8">
      {/* Solicitações pendentes */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl">Solicitações pendentes</h2>
          {requests.length > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              {requests.length}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pacientes que pediram para acompanhar você no app. Aceite para vinculá-las.
        </p>

        {requests.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <p className="text-3xl">📭</p>
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {requests.map((r) => {
              const busy = respondingId === r.id;
              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-primary/40 bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{r.patient_name ?? "Paciente"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Solicitado em{" "}
                        {new Date(r.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      {r.message && (
                        <p className="mt-2 rounded-xl bg-secondary/40 p-3 text-sm text-foreground">
                          “{r.message}”
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => respond(r, true)}
                        disabled={busy}
                        className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {busy ? "…" : "Aceitar"}
                      </button>
                      <button
                        onClick={() => respond(r, false)}
                        disabled={busy}
                        className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-50"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Minhas pacientes */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl">Minhas pacientes</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {patients.length}
          </span>
        </div>

        {patients.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <p className="text-3xl">👩‍🍼</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Você ainda não tem pacientes vinculadas. Compartilhe seu perfil para que elas
              encontrem você e enviem uma solicitação.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <ul className="divide-y divide-border">
              {patients.map((p) => {
                const due = fmtDate(p.due_date);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(p.display_name?.trim().charAt(0) || "?").toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {p.display_name ?? "Sem nome"}
                        </p>
                        {due && <p className="text-xs text-muted-foreground">DPP {due}</p>}
                      </div>
                    </div>
                    {/* BPM fetal da consulta → "Sentir o coração" da família */}
                    <FetalBpmChip p={p} tokenFn={tokenFn} onSaved={loadPatients} />
                    {/* Premium do quiz: liberar após confirmar o PIX da paciente */}
                    <button
                      onClick={() => togglePremium(p)}
                      disabled={premiumBusyId === p.id}
                      title={
                        p.quiz_premium
                          ? "Aulas premium ativas — clique para desativar"
                          : "Ativar aulas premium (após confirmar o PIX)"
                      }
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                        p.quiz_premium
                          ? "bg-amber-100 text-amber-700"
                          : "border border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600"
                      }`}
                    >
                      {premiumBusyId === p.id ? "…" : p.quiz_premium ? "⭐ Premium" : "☆ Premium"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
