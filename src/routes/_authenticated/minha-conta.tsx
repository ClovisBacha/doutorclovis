import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/admin.functions";
import {
  babyForWeek,
  computeGestation,
  consultaForWeek,
  dueDateFromLmp,
  trimesterForWeek,
} from "@/lib/gestacao";
import { assessSymptoms } from "@/lib/triage.functions";
import { RED_SYMPTOMS, YELLOW_SYMPTOMS, type RiskLevel } from "@/lib/triage";
import {
  submitPreConsulta,
  getMyPreConsultas,
  type PreConsultaForm,
} from "@/lib/preconsulta.functions";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha Conta — Dr. Clóvis Bacha" },
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
  notes: string | null;
};
type DoctorQ = { id: string; question: string; answered: boolean; created_at: string };
type Invite = { id: string; token: string; companion_name: string | null; created_at: string };

type Gest = ReturnType<typeof computeGestation>;

const TABS = [
  "Bebê",
  "Calendário",
  "Diário",
  "Chutes",
  "Contrações",
  "Saúde",
  "Nutrição",
  "Alertas",
  "Pré-consulta",
  "Perguntas",
  "Checklist",
  "Consultas",
  "Acompanhante",
  "Carteirinha",
  "Chat IA",
  "Perfil",
] as const;
type Tab = (typeof TABS)[number];

function MinhaContaPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Bebê");
  const [isAdmin, setIsAdmin] = useState(false);

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
      }
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (loading)
    return (
      <div className="mx-auto max-w-5xl px-5 py-20 text-center text-muted-foreground">
        Carregando...
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

  return (
    <section className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Minha conta
          </p>
          <h1 className="mt-2 font-serif text-3xl md:text-4xl">
            Olá, {firstName} 💛
          </h1>
          {profile?.baby_name && (
            <p className="mt-1 text-sm text-muted-foreground">Acompanhando {profile.baby_name}</p>
          )}
          {gest && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {gest.weeks}s {gest.days}d de gestação
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link
              to="/painel"
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Painel do médico
            </Link>
          )}
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-primary">
            Sair
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "Bebê" && <BabyTab profile={profile} gest={gest} />}
        {tab === "Calendário" && <PrenatalCalendarTab profile={profile} gest={gest} />}
        {tab === "Diário" && <JournalTab profile={profile} gest={gest} />}
        {tab === "Chutes" && <KicksTab weeks={gest?.weeks ?? null} babyName={profile?.baby_name ?? null} />}
        {tab === "Contrações" && <ContracoesTab weeks={gest?.weeks ?? null} />}
        {tab === "Saúde" && <HealthTab gest={gest} profile={profile} />}
        {tab === "Nutrição" && <NutricaoTab profile={profile} gest={gest} />}
        {tab === "Alertas" && <AlertsTab weeks={gest?.weeks ?? null} />}
        {tab === "Pré-consulta" && <PreConsultaTab profile={profile} gest={gest} />}
        {tab === "Perguntas" && <QuestionsTab gest={gest} />}
        {tab === "Checklist" && <ChecklistTab gest={gest} />}
        {tab === "Consultas" && <ConsultasTab />}
        {tab === "Acompanhante" && <CompanionTab babyName={profile?.baby_name ?? null} />}
        {tab === "Carteirinha" && <CardTab profile={profile} gest={gest} />}
        {tab === "Chat IA" && <ChatTab profile={profile} gest={gest} />}
        {tab === "Perfil" && <ProfileTab profile={profile} onSaved={setProfile} />}
      </div>
    </section>
  );
}

/* ---------- Bebê ---------- */
function BabyTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  if (!profile || !gest) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Configure a data da sua última menstruação ou os dados do ultrassom em{" "}
          <strong>Perfil</strong> para começar o acompanhamento.
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

        <div className="mt-6 rounded-2xl bg-[var(--gradient-warm)] p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">
            {babyLabel} esta semana
          </p>
          <p className="mt-2 font-serif text-2xl text-primary">{baby.size}</p>
          <p className="text-sm text-muted-foreground">Peso aproximado: {baby.weight}</p>
          <p className="mt-1 text-sm text-muted-foreground">Tamanho de: {baby.fruit}</p>
          <p className="mt-4 text-sm leading-relaxed text-foreground">{baby.desc}</p>
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
    await (supabase as any).from("journal_entries").insert({
      user_id: u.user.id,
      content: content.trim(),
      mood,
    });
    setContent("");
    load();
  }

  async function remove(id: string) {
    await (supabase as any).from("journal_entries").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">
          {firstName ? `${firstName}, como você está se sentindo hoje?` : "Como você está se sentindo hoje?"}
        </p>
        {gest && (
          <p className="mt-1 text-xs text-muted-foreground">
            Semana {gest.weeks} — {trimester === 1 ? "1º trimestre" : trimester === 2 ? "2º trimestre" : "3º trimestre"}
          </p>
        )}

        {/* Prompt suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => setContent((c) => (c ? c + "\n" + p : p))}
              className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10"
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
              className={`rounded-full px-3 py-2 text-xl ${mood === m ? "bg-primary/15 ring-2 ring-primary" : "bg-secondary"}`}
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
          className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
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
    const { data } = await (supabase as any)
      .from("kick_sessions")
      .insert({ user_id: u.user.id, kick_count: 0 })
      .select()
      .single();
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
    await (supabase as any)
      .from("kick_sessions")
      .update({ ended_at: new Date().toISOString(), kick_count: finalCount })
      .eq("id", active.id);
    setActive(null);
    setCount(0);
    load();
  }

  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  // Stats from history
  const completeSessions = history.filter((s) => s.kick_count >= 10);
  const avgMins =
    completeSessions.length > 0
      ? Math.round(
          completeSessions.reduce((acc, s) => {
            const dur =
              s.ended_at
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
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900">
          {weeks < 20
            ? `Você está na semana ${weeks}. Os movimentos começam a ser sentidos entre as semanas 18 e 25. Continue o pré-natal normalmente.`
            : `Você está na semana ${weeks}. Já pode começar a perceber os movimentos de ${label}! A contagem formal de chutes começa na semana 28.`}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Contador de chutes</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isMonitoringPhase
            ? `A partir da semana 28, conte 10 movimentos de ${label}. O ideal é sentir 10 em até 2 horas.`
            : "A contagem de movimentos é recomendada a partir da 28ª semana de gestação."}
        </p>
        {!active ? (
          <button
            onClick={start}
            className="mt-6 rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground"
          >
            Iniciar sessão
          </button>
        ) : (
          <div className="mt-6">
            <button
              onClick={tap}
              className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95"
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
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Tempo médio (10 chutes)</p>
            <p className="mt-2 font-serif text-3xl">
              {avgMins != null ? `${avgMins} min` : "—"}
            </p>
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
  { category: "mae", label: "Documentos (RG, CPF, cartão SUS)" },
  { category: "mae", label: "Carteira da gestante" },
  { category: "mae", label: "Camisola com abertura frontal" },
  { category: "mae", label: "Roupão e chinelos" },
  { category: "mae", label: "Itens de higiene pessoal" },
  { category: "bebe", label: "5 bodies tamanho RN" },
  { category: "bebe", label: "5 macacões / mijões" },
  { category: "bebe", label: "Fraldas RN (1 pacote)" },
  { category: "bebe", label: "Manta de algodão" },
  { category: "bebe", label: "Saída de maternidade" },
  { category: "acompanhante", label: "Trocas de roupa" },
  { category: "acompanhante", label: "Lanches e água" },
  { category: "acompanhante", label: "Carregador de celular" },
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
    const { data } = await (supabase as any)
      .from("checklist_items")
      .select("*")
      .order("created_at", { ascending: true });
    if (!data || data.length === 0) {
      const seed = DEFAULT_ITEMS.map((d) => ({ ...d, user_id: u.user!.id, done: false }));
      await (supabase as any).from("checklist_items").insert(seed);
      const { data: again } = await (supabase as any)
        .from("checklist_items")
        .select("*")
        .order("created_at", { ascending: true });
      setItems(again ?? []);
    } else {
      setItems(data);
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
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-blue-300 bg-blue-50 text-blue-900"
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

      <div className="rounded-3xl border border-dashed border-border bg-card p-6">
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
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
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
      pre_pregnancy_weight_kg: form.pre_pregnancy_weight_kg ? Number(form.pre_pregnancy_weight_kg) : null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (supabase as any)
      .from("patient_profiles")
      .upsert(payload)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setMsg(error.message);
    } else {
      onSaved(data);
      setMsg("Salvo com sucesso ✓");
    }
  }

  return (
    <div className="space-y-6">
      {/* Completion card */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Perfil completo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {completionPct < 100
                ? "Complete seu perfil para aproveitar todas as funcionalidades."
                : "Seu perfil está completo!"}
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
        <p className="font-serif text-lg">Dados corporais</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Usados para calcular seu IMC pré-gestacional e a curva de ganho de peso recomendada (IOM 2009).
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
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
  if (bmi < 18.5) { rMin = 0.44; rMax = 0.58; }
  else if (bmi < 25) { rMin = 0.35; rMax = 0.50; }
  else if (bmi < 30) { rMin = 0.23; rMax = 0.33; }
  else { rMin = 0.17; rMax = 0.27; }

  if (week <= 12) {
    const f = week / 12;
    return { min: f * 0.5, max: f * 2.0 };
  }
  return { min: 0.5 + (week - 12) * rMin, max: 2.0 + (week - 12) * rMax };
}

function HealthTab({ gest, profile }: { gest: Gest; profile: Profile | null }) {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [form, setForm] = useState({
    weight_kg: "", systolic: "", diastolic: "",
    spo2: "", heart_rate_bpm: "", steps: "", sleep_hours: "", notes: "",
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
  useEffect(() => { load(); }, []);

  async function add() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!form.weight_kg && !form.systolic && !form.spo2 && !form.heart_rate_bpm) return;
    await (supabase as any).from("health_logs").insert({
      user_id: u.user.id,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      systolic: form.systolic ? Number(form.systolic) : null,
      diastolic: form.diastolic ? Number(form.diastolic) : null,
      spo2: form.spo2 ? Number(form.spo2) : null,
      heart_rate_bpm: form.heart_rate_bpm ? Number(form.heart_rate_bpm) : null,
      steps: form.steps ? Number(form.steps) : null,
      sleep_hours: form.sleep_hours ? Number(form.sleep_hours) : null,
      notes: form.notes || null,
    });
    setForm({ weight_kg: "", systolic: "", diastolic: "", spo2: "", heart_rate_bpm: "", steps: "", sleep_hours: "", notes: "" });
    load();
  }
  async function remove(id: string) {
    await (supabase as any).from("health_logs").delete().eq("id", id);
    load();
  }

  const last = logs[0];
  const allWeightLogs = logs.filter((l) => l.weight_kg != null).reverse();
  const weights = allWeightLogs.slice(-12);

  // Stats
  const firstWeight = allWeightLogs[0]?.weight_kg ? Number(allWeightLogs[0].weight_kg) : null;
  const lastWeight = allWeightLogs[allWeightLogs.length - 1]?.weight_kg ? Number(allWeightLogs[allWeightLogs.length - 1].weight_kg) : null;
  const totalGain = firstWeight != null && lastWeight != null ? (lastWeight - firstWeight).toFixed(1) : null;

  const lastBp = logs.find((l) => l.systolic != null && l.diastolic != null);
  const bpStatus = lastBp?.systolic != null && lastBp?.diastolic != null
    ? lastBp.systolic >= 160 || lastBp.diastolic >= 110
      ? { label: "PA muito elevada", color: "rose" }
      : lastBp.systolic >= 140 || lastBp.diastolic >= 90
        ? { label: "PA elevada", color: "amber" }
        : { label: "PA normal", color: "emerald" }
    : null;

  // IOM weight curve — Feature #9
  const prePregW = profile?.pre_pregnancy_weight_kg ? Number(profile.pre_pregnancy_weight_kg) : null;
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
  const iomChartW = 400, iomChartH = 180;
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
    iomMinY = 50; iomMaxY = 90;
  }
  const yRange = Math.max(iomMaxY - iomMinY, 1);

  function toSvgX(week: number) { return (week / 42) * iomChartW; }
  function toSvgY(w: number) { return iomChartH - ((w - iomMinY) / yRange) * (iomChartH - 20) - 10; }

  const bandMinPts = Array.from({ length: 43 }, (_, i) => `${toSvgX(i)},${toSvgY(prePregW! + iomGain(i, bmi!).min)}`).join(" ");
  const bandMaxPts = Array.from({ length: 43 }, (_, i) => `${toSvgX(i)},${toSvgY(prePregW! + iomGain(i, bmi!).max)}`).join(" ");
  const bandPolygon = bandMinPts + " " + Array.from({ length: 43 }, (_, i) => `${toSvgX(42 - i)},${toSvgY(prePregW! + iomGain(42 - i, bmi!).max)}`).join(" ");
  const actualPts = weightByWeek.map((p) => `${toSvgX(p.week)},${toSvgY(p.weight)}`).join(" ");

  const bmiLabel = bmi == null ? null
    : bmi < 18.5 ? "abaixo do peso"
    : bmi < 25 ? "peso normal"
    : bmi < 30 ? "sobrepeso"
    : "obesidade";

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Último peso</p>
          <p className="mt-2 font-serif text-3xl">{last?.weight_kg ? `${last.weight_kg} kg` : "—"}</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Ganho total</p>
          <p className="mt-2 font-serif text-3xl">
            {totalGain != null ? `${Number(totalGain) > 0 ? "+" : ""}${totalGain} kg` : "—"}
          </p>
        </div>
        <div className={`rounded-3xl border p-5 ${bpStatus?.color === "rose" ? "border-rose-300 bg-rose-50" : bpStatus?.color === "amber" ? "border-amber-300 bg-amber-50" : "border-border bg-card"}`}>
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Última PA</p>
          <p className="mt-2 font-serif text-3xl">
            {lastBp?.systolic && lastBp?.diastolic ? `${lastBp.systolic}/${lastBp.diastolic}` : "—"}
          </p>
          {bpStatus && (
            <p className={`mt-1 text-xs font-medium ${bpStatus.color === "rose" ? "text-rose-700" : bpStatus.color === "amber" ? "text-amber-700" : "text-emerald-700"}`}>
              {bpStatus.label}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-primary">SpO₂ / FC</p>
          <p className="mt-2 font-serif text-2xl">
            {last?.spo2 ? `${last.spo2}%` : "—"}
            {last?.heart_rate_bpm ? <span className="ml-1 text-lg text-muted-foreground"> {last.heart_rate_bpm}bpm</span> : null}
          </p>
        </div>
      </div>

      {/* IOM weight corridor chart — Feature #9 */}
      {showIomChart ? (
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-primary">Curva de ganho de peso (IOM 2009)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                IMC pré-gestacional: {bmi!.toFixed(1)} ({bmiLabel}) · Faixa recomendada em verde
              </p>
            </div>
          </div>
          <svg viewBox={`0 0 ${iomChartW} ${iomChartH}`} className="mt-3 h-44 w-full">
            {/* Corridor band */}
            <polygon points={bandPolygon} fill="hsl(var(--primary))" fillOpacity="0.12" />
            {/* Min line */}
            <polyline points={bandMinPts} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
            {/* Max line */}
            <polyline points={bandMaxPts} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
            {/* Actual weight line */}
            {weightByWeek.length > 1 && (
              <polyline points={actualPts} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinejoin="round" />
            )}
            {/* Data points */}
            {weightByWeek.map((p, i) => (
              <circle key={i} cx={toSvgX(p.week)} cy={toSvgY(p.weight)} r="4" fill="hsl(var(--primary))" />
            ))}
            {/* X-axis labels */}
            {[0, 10, 20, 28, 36, 40].map((w) => (
              <text key={w} x={toSvgX(w)} y={iomChartH - 1} fontSize="8" fill="hsl(var(--muted-foreground))" textAnchor="middle">
                {w}s
              </text>
            ))}
          </svg>
          <p className="mt-1 text-xs text-muted-foreground">
            Linha sólida = seu peso · Faixa = zona saudável para seu IMC. Configure altura e peso pré-gestacional em <strong>Perfil</strong>.
          </p>
        </div>
      ) : prePregW == null && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
          Configure sua <strong>altura</strong> e <strong>peso pré-gestacional</strong> em <strong>Perfil</strong> para ver a curva de ganho de peso recomendada pelo IOM.
        </div>
      )}

      {/* Wearable data summary — Feature #6 */}
      {logs.some((l) => l.spo2 || l.heart_rate_bpm || l.steps || l.sleep_hours) && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "SpO₂", value: logs.find((l) => l.spo2)?.spo2, unit: "%" },
            { label: "FC", value: logs.find((l) => l.heart_rate_bpm)?.heart_rate_bpm, unit: "bpm" },
            { label: "Passos", value: logs.find((l) => l.steps)?.steps, unit: "" },
            { label: "Sono", value: logs.find((l) => l.sleep_hours)?.sleep_hours, unit: "h" },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-serif text-2xl">{m.value != null ? `${m.value}${m.unit}` : "—"}</p>
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
          <p><strong>Apple Health (iPhone):</strong> Abra o app Saúde → Resumo → veja SpO2, FC, Sono e Passos → registre manualmente os valores aqui.</p>
          <p><strong>Google Fit (Android):</strong> Abra o Google Fit → Diário → copie os valores do dia → registre abaixo nos campos de wearable.</p>
          <p><strong>Garmin / Fitbit / Samsung Health:</strong> Acesse o app do seu dispositivo → Dashboard → Atividade do Dia → copie os valores desejados.</p>
          <p className="text-xs">A integração automática requer aplicativo nativo. Por ora, o registro manual mantém seu histórico no portal.</p>
        </div>
      </details>

      {/* New log form */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Novo registro</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
          <Field label="Peso (kg)" type="number" value={form.weight_kg} onChange={(v) => setForm({ ...form, weight_kg: v })} />
          <Field label="Sistólica" type="number" value={form.systolic} onChange={(v) => setForm({ ...form, systolic: v })} />
          <Field label="Diastólica" type="number" value={form.diastolic} onChange={(v) => setForm({ ...form, diastolic: v })} />
          <Field label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
        </div>
        <button
          onClick={() => setShowWearable((v) => !v)}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          {showWearable ? "▲ Ocultar wearable" : "▼ Adicionar dados do wearable"}
        </button>
        {showWearable && (
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <Field label="SpO₂ (%)" type="number" value={form.spo2} onChange={(v) => setForm({ ...form, spo2: v })} />
            <Field label="FC (bpm)" type="number" value={form.heart_rate_bpm} onChange={(v) => setForm({ ...form, heart_rate_bpm: v })} />
            <Field label="Passos" type="number" value={form.steps} onChange={(v) => setForm({ ...form, steps: v })} />
            <Field label="Sono (horas)" type="number" value={form.sleep_hours} onChange={(v) => setForm({ ...form, sleep_hours: v })} />
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
          <div key={l.id} className="flex items-start justify-between rounded-xl border border-border bg-card p-4 text-sm">
            <span className="text-muted-foreground shrink-0">
              {new Date(l.log_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
            <span className="flex-1 px-3 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              {l.weight_kg && <span>⚖️ {l.weight_kg} kg</span>}
              {l.systolic && l.diastolic && <span>💓 {l.systolic}/{l.diastolic}</span>}
              {(l as any).spo2 && <span>🫁 {(l as any).spo2}% SpO₂</span>}
              {(l as any).heart_rate_bpm && <span>❤️ {(l as any).heart_rate_bpm}bpm</span>}
              {(l as any).steps && <span>🚶 {(l as any).steps} passos</span>}
              {(l as any).sleep_hours && <span>🌙 {(l as any).sleep_hours}h sono</span>}
              {l.notes && <span className="text-muted-foreground">{l.notes}</span>}
            </span>
            <button onClick={() => remove(l.id)} className="text-xs text-muted-foreground hover:text-destructive shrink-0">×</button>
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
    if (!u.user) return;
    await (supabase as any)
      .from("doctor_questions")
      .insert({ user_id: u.user.id, question: q });
    setText("");
    load();
  }
  async function toggle(q: DoctorQ) {
    await (supabase as any)
      .from("doctor_questions")
      .update({ answered: !q.answered })
      .eq("id", q.id);
    setItems((arr) => arr.map((x) => (x.id === q.id ? { ...x, answered: !x.answered } : x)));
  }
  async function remove(id: string) {
    await (supabase as any).from("doctor_questions").delete().eq("id", id);
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
            {showSuggestions ? "▲ Ocultar sugestões" : "▼ Ver perguntas comuns do " + (trimester === 1 ? "1º" : trimester === 2 ? "2º" : "3º") + " trimestre"}
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
    const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    await (supabase as any).from("companion_invites").insert({
      user_id: u.user.id,
      token,
      companion_name: name || null,
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
    setLoading(false);
  }

  const styles: Record<RiskLevel, { box: string; dot: string; titulo: string }> = {
    vermelho: {
      box: "border-rose-300 bg-rose-50",
      dot: "bg-rose-500",
      titulo: "Procure atendimento agora",
    },
    amarelo: {
      box: "border-amber-300 bg-amber-50",
      dot: "bg-amber-500",
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
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
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

/* ---------- Carteirinha digital ---------- */
function CardTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  if (!profile)
    return <p className="text-sm text-muted-foreground">Preencha seu perfil primeiro.</p>;
  const due = profile.due_date ?? (profile.lmp_date ? dueDateFromLmp(profile.lmp_date) : null);
  const qrData = encodeURIComponent(
    `Gestante: ${profile.display_name ?? "—"}\nBebê: ${profile.baby_name ?? "—"}\nIG: ${gest ? `${gest.weeks}s${gest.days}d` : "—"}\nDPP: ${due ?? "—"}\nTipo sanguíneo: ${profile.blood_type ?? "—"}\nAlergias: ${profile.allergies ?? "—"}\nMédico: Dr. Clóvis Bacha`,
  );
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrData}`;

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-3xl bg-[var(--gradient-warm)] p-8 shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">Carteirinha digital</p>
        <h2 className="mt-2 font-serif text-2xl">{profile.display_name ?? "—"}</h2>
        {profile.baby_name && (
          <p className="text-sm text-muted-foreground">Bebê: {profile.baby_name}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Info label="IG atual" value={gest ? `${gest.weeks}s ${gest.days}d` : "—"} />
          <Info
            label="DPP"
            value={due ? new Date(due + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
          />
          <Info label="Tipo sanguíneo" value={profile.blood_type ?? "—"} />
          <Info label="Alergias" value={profile.allergies ?? "Nenhuma"} />
          <Info label="Emergência" value={profile.emergency_contact ?? "—"} />
          <Info label="Telefone" value={profile.emergency_phone ?? "—"} />
        </div>

        <div className="mt-6 flex flex-col items-center border-t border-primary/20 pt-5">
          <img
            src={qrUrl}
            alt="QR Code de emergência"
            className="h-44 w-44 rounded-lg bg-white p-2"
          />
          <p className="mt-2 text-xs text-muted-foreground">Escaneie em caso de emergência</p>
          <p className="mt-3 text-xs font-medium text-primary">
            Dr. Clóvis Bacha — Ginecologia & Obstetrícia
          </p>
        </div>
      </div>
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

function ChatTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  const ctx = buildPatientContext(profile, gest);
  const firstName = profile?.display_name?.split(" ")[0];

  const greeting = [
    firstName ? `Olá, ${firstName}!` : "Olá!",
    gest
      ? `Você está na semana ${gest.weeks} — vou responder levando em conta sua gestação.`
      : "",
    "Sou o assistente virtual do consultório do Dr. Clóvis Bacha. Como posso ajudar?",
  ]
    .filter(Boolean)
    .join(" ");

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    // Prepend patient context to first user message so the AI knows who she is
    const enrichedText = ctx && messages.length === 1 ? `[Contexto: ${ctx}]\n\n${text}` : text;
    const displayMsg: ChatMsg = { role: "user", content: text };
    const apiMsg: ChatMsg = { role: "user", content: enrichedText };

    const displayNext = [...messages, displayMsg];
    const apiNext = [...messages, apiMsg];

    setMessages(displayNext);
    setInput("");
    setLoading(true);
    try {
      const uiMessages = apiNext.map((m, i) => ({
        id: String(i),
        role: m.role,
        parts: [{ type: "text", text: m.content }],
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: uiMessages }),
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages([...displayNext, { role: "assistant", content: "" }]);
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
        setMessages([...displayNext, { role: "assistant", content: acc }]);
      }
    } catch {
      setMessages([
        ...displayNext,
        { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-3xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <p className="font-serif text-lg">Assistente IA</p>
        <p className="text-xs text-muted-foreground">
          Dúvidas gerais sobre gestação — não substitui consulta médica.
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
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Digite sua pergunta..."
          className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-60"
        >
          {loading ? "..." : "Enviar"}
        </button>
      </div>
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
  { week: 6, type: "consult", label: "1ª consulta pré-natal", detail: "Confirmação da gestação, exames iniciais e início do ácido fólico." },
  { week: 8, type: "exam", label: "Exames iniciais (sangue e urina)", detail: "Hemograma, sorologias, tipagem sanguínea, urina EAS." },
  { week: 11, type: "exam", label: "Translucência nucal", detail: "Ultrassom entre 11s–13s6d + PAPP-A e beta-hCG." },
  { week: 12, type: "milestone", label: "Fim do 1º trimestre 🎉", detail: "Risco de aborto reduz significativamente." },
  { week: 14, type: "consult", label: "Consulta mensal" },
  { week: 16, type: "consult", label: "Consulta mensal" },
  { week: 18, type: "exam", label: "Ultrassom morfológico", detail: "Avaliação detalhada da anatomia fetal. Entre 18–22 semanas." },
  { week: 20, type: "milestone", label: "Metade da gestação! 🌟", detail: "Bebê começa a ser sentido com mais frequência." },
  { week: 24, type: "exam", label: "Curva glicêmica (TOTG)", detail: "Rastreio de diabetes gestacional. Jejum de 8h." },
  { week: 26, type: "consult", label: "Consulta mensal" },
  { week: 26, type: "exam", label: "Hemograma e exames de rotina" },
  { week: 28, type: "milestone", label: "Início do 3º trimestre", detail: "Conte os movimentos diariamente a partir de agora." },
  { week: 30, type: "consult", label: "Consultas quinzenais", detail: "A partir da 30ª semana, consultas a cada 2 semanas." },
  { week: 32, type: "exam", label: "Ultrassom de crescimento fetal", detail: "Avaliação de crescimento e Doppler quando indicado." },
  { week: 34, type: "consult", label: "Consulta quinzenal" },
  { week: 35, type: "exam", label: "Cultura Streptococcus Grupo B", detail: "Swab vaginal/retal entre 35–37 semanas." },
  { week: 36, type: "consult", label: "Consultas semanais", detail: "A partir da 36ª semana, consultas semanais." },
  { week: 37, type: "milestone", label: "A TERMO! Bebê pronto para nascer 🎉", detail: "Semana 37 marca o início do período a termo." },
  { week: 38, type: "exam", label: "Cardiotocografia (CTG)", detail: "Avaliação do bem-estar fetal e planejamento do parto." },
  { week: 40, type: "milestone", label: "DPP — Data Provável do Parto 👶" },
];

const TYPE_COLOR: Record<Milestone["type"], string> = {
  exam: "bg-blue-100 text-blue-700 border-blue-200",
  consult: "bg-violet-100 text-violet-700 border-violet-200",
  vaccine: "bg-amber-100 text-amber-700 border-amber-200",
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
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Pré-natal: ${label}`,
    dates: `${ymd}/${ymd}`,
    details: "Acompanhamento pré-natal — Dr. Clóvis Bacha",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function PrenatalCalendarTab({ profile, gest }: { profile: Profile | null; gest: Gest }) {
  if (!profile || (!profile.lmp_date && !profile.reference_date)) {
    return (
      <div className="rounded-3xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          Configure a DUM ou os dados do ultrassom em <strong>Perfil</strong> para gerar o calendário personalizado.
        </p>
      </div>
    );
  }

  const currentWeek = gest?.weeks ?? 0;
  const today = new Date();

  function downloadAllIcs() {
    const events: string[] = [];
    PRENATAL_MILESTONES.forEach((m) => {
      const d = weekToDate(m.week, profile!);
      if (!d) return;
      const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
      events.push(
        "BEGIN:VEVENT",
        `UID:prenatal-${m.week}-${m.label.slice(0,10).replace(/\s/g,"")}@doutorclovis`,
        `DTSTART;VALUE=DATE:${ymd}`,
        `DTEND;VALUE=DATE:${ymd}`,
        `SUMMARY:Pré-natal S${m.week}: ${m.label}`,
        m.detail ? `DESCRIPTION:${m.detail}` : "",
        "END:VEVENT",
      ).filter(Boolean);
    });
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Dr Clovis Bacha//Prenatal Calendar//PT-BR",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "prenatal-dr-clovis.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-primary">Calendário do Pré-natal</p>
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
          const isCurrent = m.week === currentWeek || (m.week === Math.ceil(currentWeek / 2) * 2 && Math.abs(m.week - currentWeek) <= 1);
          const isUpcoming = !isPast && date != null && date.getTime() - today.getTime() < 21 * 86400000;

          return (
            <div key={idx} className={`relative rounded-2xl border p-4 transition-all ${
              isPast ? "border-border bg-card opacity-60" :
              isUpcoming ? "border-primary/40 bg-primary/5 shadow-sm" :
              "border-border bg-card"
            }`}>
              {/* Timeline dot */}
              <div className={`absolute -left-4 top-5 h-3 w-3 rounded-full border-2 ${
                isPast ? "border-border bg-background" :
                isUpcoming ? "border-primary bg-primary" :
                "border-primary/40 bg-background"
              }`} />

              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLOR[m.type]}`}>
                      {TYPE_LABEL[m.type]}
                    </span>
                    <span className="text-xs text-muted-foreground">Semana {m.week}</span>
                    {isPast && <span className="text-xs text-emerald-600">✓ concluído</span>}
                    {isUpcoming && !isPast && <span className="text-xs font-medium text-primary">Em breve!</span>}
                  </div>
                  <p className={`mt-1 text-sm font-medium ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
                    {m.label}
                  </p>
                  {m.detail && <p className="mt-0.5 text-xs text-muted-foreground">{m.detail}</p>}
                  {date && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
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
const INTENSITY_COLOR = ["", "bg-blue-100 text-blue-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700"];

function analyzeContractions(list: Contraction[]): {
  status: "normal" | "atencao" | "alerta" | "urgente";
  label: string;
  detail: string;
} {
  if (list.length < 2) return { status: "normal", label: "Monitorando", detail: "Registre mais contrações para análise do padrão." };

  const completed = list.filter((c) => c.ended_at != null);
  if (completed.length < 2) return { status: "normal", label: "Monitorando", detail: "Continue registrando." };

  // Average duration (seconds)
  const avgDur =
    completed.reduce((sum, c) => {
      const dur = (new Date(c.ended_at!).getTime() - new Date(c.started_at).getTime()) / 1000;
      return sum + dur;
    }, 0) / completed.length;

  // Average interval between contractions (minutes)
  const sorted = [...list].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  let intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const interval = (new Date(sorted[i].started_at).getTime() - new Date(sorted[i - 1].started_at).getTime()) / 60000;
    intervals.push(interval);
  }
  const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length;

  if (avgInterval <= 3 && avgDur >= 60)
    return { status: "urgente", label: "⚠️ Vá para a maternidade agora", detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — trabalho de parto avançado.` };
  if (avgInterval <= 5 && avgDur >= 45)
    return { status: "alerta", label: "Trabalho de parto ativo", detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — ligue para o consultório.` };
  if (avgInterval <= 10 && avgDur >= 30)
    return { status: "atencao", label: "Atenção — padrão irregular", detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — monitore de perto.` };
  return { status: "normal", label: "Padrão normal", detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s.` };
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

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active]);

  async function startContraction() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await (supabase as any)
      .from("contraction_logs")
      .insert({ user_id: u.user.id, intensity })
      .select()
      .single();
    setActive(data);
    startRef.current = Date.now();
    setElapsed(0);
    load();
  }

  async function stopContraction() {
    if (!active) return;
    await (supabase as any)
      .from("contraction_logs")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", active.id);
    setActive(null);
    setElapsed(0);
    load();
  }

  async function clearSession() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // Only remove last 6 hours of contractions
    const sixHoursAgo = new Date(Date.now() - 6 * 3600000).toISOString();
    await (supabase as any).from("contraction_logs").delete().eq("user_id", u.user.id).gte("started_at", sixHoursAgo);
    setActive(null);
    load();
  }

  const elapsedSecs = Math.floor(elapsed / 1000);
  const elapsedMins = Math.floor(elapsedSecs / 60);
  const recentContractions = contractions.slice(0, 10);
  const analysis = analyzeContractions(recentContractions);

  const statusStyle: Record<string, string> = {
    normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
    atencao: "border-amber-200 bg-amber-50 text-amber-800",
    alerta: "border-rose-200 bg-rose-50 text-rose-800",
    urgente: "border-rose-400 bg-rose-100 text-rose-900",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
        Use este diário se sentir contrações regulares. <strong>Em dúvida, ligue para o consultório.</strong> Em emergência, ligue <strong>192 (SAMU)</strong>.
      </div>

      {/* Analysis banner */}
      {recentContractions.length >= 2 && (
        <div className={`rounded-2xl border p-4 ${statusStyle[analysis.status]}`}>
          <p className="font-semibold">{analysis.label}</p>
          <p className="mt-0.5 text-sm">{analysis.detail}</p>
          {analysis.status === "urgente" && (
            <a href="tel:192" className="mt-3 inline-block rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white">
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
                className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-rose-500 text-white shadow-xl transition-transform active:scale-95"
              >
                <div>
                  <div className="font-serif text-4xl">
                    {String(elapsedMins).padStart(2, "0")}:{String(elapsedSecs % 60).padStart(2, "0")}
                  </div>
                  <div className="text-xs uppercase tracking-widest opacity-80 mt-1">Toque p/ parar</div>
                </div>
              </button>
              <p className="mt-3 text-sm font-medium text-rose-600 animate-pulse">Contração ativa...</p>
            </div>
          ) : (
            <button
              onClick={startContraction}
              className="mx-auto flex h-44 w-44 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95"
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
            <button onClick={clearSession} className="text-xs text-muted-foreground hover:text-destructive">
              Limpar sessão
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {recentContractions.map((c, idx) => {
              const dur = c.ended_at
                ? Math.round((new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000)
                : null;
              const interval = idx < recentContractions.length - 1
                ? Math.round((new Date(c.started_at).getTime() - new Date(recentContractions[idx + 1].started_at).getTime()) / 60000)
                : null;
              return (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                  <span className="text-muted-foreground">
                    {new Date(c.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${INTENSITY_COLOR[c.intensity] ?? ""}`}>
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
  useEffect(() => { loadHistory(); }, []);

  function toggleSymptom(s: string) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(s) ? f.symptoms.filter((x) => x !== s) : [...f.symptoms, s],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return;
    const res = await submitPreConsulta({
      data: {
        accessToken: s.session.access_token,
        weeks: gest?.weeks ?? null,
        ...form,
      },
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      loadHistory();
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-emerald-300 bg-emerald-50 p-10 text-center">
        <p className="text-4xl">✓</p>
        <h2 className="mt-3 font-serif text-2xl text-emerald-800">Formulário enviado!</h2>
        <p className="mt-2 text-sm text-emerald-700">
          O Dr. Clóvis receberá seu resumo antes da consulta. Pode chegar com tranquilidade!
        </p>
        <button
          onClick={() => { setDone(false); setForm({ weight: "", systolic: "", diastolic: "", symptoms: [], medications: "", questions: "", emotional_state: "", other_notes: "" }); }}
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
        <strong>Para o Dr. Clóvis Bacha:</strong> preencha antes de cada consulta. Seu resumo chega formatado para o médico — sem precisar lembrar de tudo na hora!
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
            <Field label="Peso atual (kg)" type="number" value={form.weight} onChange={(v) => setForm((f) => ({ ...f, weight: v }))} />
            <Field label="Pressão sistólica" type="number" value={form.systolic} onChange={(v) => setForm((f) => ({ ...f, systolic: v }))} />
            <Field label="Pressão diastólica" type="number" value={form.diastolic} onChange={(v) => setForm((f) => ({ ...f, diastolic: v }))} />
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
            placeholder="Anote suas dúvidas aqui — elas chegam direto para o Dr. Clóvis antes da consulta."
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
                    <span className={`rounded-full px-2 py-0.5 text-xs ${h.seen_by_doctor ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
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
    { nutrient: "Ácido Fólico", why: "Previne defeitos do tubo neural", foods: "Feijão, lentilha, espinafre, brócolis" },
    { nutrient: "Ferro", why: "Suporte ao volume de sangue", foods: "Carne vermelha magra, feijão + vitamina C" },
    { nutrient: "Vitamina B6", why: "Alivia enjoo matinal", foods: "Banana, batata, frango, atum" },
    { nutrient: "Água", why: "Hidratação e redução do enjoo", foods: "8–10 copos/dia; água de coco, chás claros" },
  ],
  2: [
    { nutrient: "Cálcio", why: "Formação óssea do bebê", foods: "Leite, iogurte, sardinha, brócolis" },
    { nutrient: "Ômega-3", why: "Desenvolvimento do cérebro fetal", foods: "Salmão, sardinha, sementes de chia, linhaça" },
    { nutrient: "Proteína", why: "Crescimento muscular e placentário", foods: "Ovos, frango, leguminosas, queijos pasteurizados" },
    { nutrient: "Vitamina D", why: "Absorção de cálcio e imunidade", foods: "Ovos, cogumelos, exposição solar moderada" },
  ],
  3: [
    { nutrient: "Fibras", why: "Combate a constipação", foods: "Aveia, ameixa, mamão, folhas verdes" },
    { nutrient: "Magnésio", why: "Reduz câimbras nas pernas", foods: "Castanha-do-pará, banana, sementes de abóbora" },
    { nutrient: "Ferro", why: "Preparo para o parto", foods: "Fígado (cozido), feijão preto, espinafre" },
    { nutrient: "Vitamina C", why: "Aumenta absorção do ferro", foods: "Acerola, laranja, morango, kiwi" },
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
      setMessages([...next, { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
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
      <div className="flex flex-col rounded-3xl border border-border bg-card" style={{ height: "55vh" }}>
        <div className="border-b border-border p-4">
          <p className="font-serif text-lg">Nutricionista Virtual</p>
          <p className="text-xs text-muted-foreground">
            Orientações personalizadas para sua gestação — não substitui avaliação nutricional individual.
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

function ConsultasTab() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<ConsultaNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [activeNoteTab, setActiveNoteTab] = useState<"transcript" | "orientacoes" | "medicamentos" | "exames">("transcript");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    setLoadingNotes(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await (supabase as any)
      .from("consultation_notes")
      .select("*")
      .eq("user_id", u.user.id)
      .order("recorded_at", { ascending: false });
    setNotes(data ?? []);
    setLoadingNotes(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setResult(null);
      setAudioBlob(null);
      setAudioUrl(null);
      setSavedMsg(null);
    } catch {
      alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
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
      fd.append("audio", audioBlob, "consulta.webm");
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
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any).from("consultation_notes").insert({
      user_id: u.user.id,
      title: result.titulo ?? "Consulta",
      raw_transcript: result.transcript ?? null,
      orientacoes: result.orientacoes?.join("\n") ?? null,
      medicamentos: result.medicamentos?.join("\n") ?? null,
      proximos_exames: result.proximos_exames?.join("\n") ?? null,
      proxima_consulta: result.proxima_consulta ?? null,
    });
    setSaving(false);
    if (error) {
      setSavedMsg("Erro ao salvar: " + error.message);
    } else {
      setSavedMsg("Nota salva com sucesso ✓");
      setResult(null);
      setAudioBlob(null);
      setAudioUrl(null);
      loadNotes();
    }
  }

  return (
    <div className="space-y-6">
      {/* Recording card */}
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="font-serif text-lg">Gravar consulta</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Grave o áudio da consulta e a IA extrai orientações, medicamentos e exames automaticamente.
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
                {activeNoteTab === "orientacoes" && (
                  result.orientacoes?.length ? (
                    <ul className="space-y-1.5">
                      {result.orientacoes.map((o, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 text-primary">•</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">Nenhuma orientação identificada.</p>
                )}
                {activeNoteTab === "medicamentos" && (
                  result.medicamentos?.length ? (
                    <ul className="space-y-1.5">
                      {result.medicamentos.map((m, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 text-primary">💊</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">Nenhum medicamento mencionado.</p>
                )}
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
                    ) : <p className="text-muted-foreground">Nenhum exame solicitado.</p>}
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
          <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>
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
                      <p className="whitespace-pre-line text-muted-foreground">{n.proximos_exames}</p>
                    </div>
                  )}
                  {n.proxima_consulta && (
                    <p className="text-xs text-muted-foreground">Próxima consulta: {n.proxima_consulta}</p>
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
