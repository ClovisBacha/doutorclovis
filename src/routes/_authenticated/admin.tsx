import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getPlatformOverview,
  setDoctorStatus,
  type PlatformOverview,
  type PlatformDoctor,
} from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: AdminConsole,
});

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

/* ── Diretório de varredura: todas as áreas do produto num clique ── */

const PATIENT_TABS = [
  "Bebê",
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
];

const PUBLIC_PAGES: { path: string; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/sobre", label: "Sobre" },
  { path: "/gestacao", label: "Gestação semana a semana" },
  { path: "/calculadora", label: "Calculadora gestacional" },
  { path: "/dpp", label: "Calculadora de DPP" },
  { path: "/batimentos", label: "Batimentos" },
  { path: "/tamanho-real", label: "Tamanho real" },
  { path: "/agendamento", label: "Agendamento" },
  { path: "/primeira-consulta", label: "Primeira consulta" },
  { path: "/hospitais", label: "Hospitais" },
  { path: "/lives", label: "Lives" },
  { path: "/mural", label: "Mural" },
  { path: "/depoimentos", label: "Depoimentos" },
  { path: "/mitos", label: "Mitos" },
  { path: "/bastidores", label: "Bastidores" },
  { path: "/cards", label: "Cards" },
  { path: "/modo-acompanhante", label: "Modo acompanhante" },
  { path: "/diabetes-gestacional", label: "Diabetes gestacional" },
  { path: "/epds", label: "EPDS" },
  { path: "/empresas", label: "Para empresas" },
  { path: "/medicos", label: "Para médicos (vendas)" },
  { path: "/medicos/cadastro", label: "Cadastro de médico" },
  { path: "/privacidade", label: "Privacidade" },
];

const PANEL_AREAS: { path: string; label: string }[] = [
  { path: "/painel", label: "Painel do médico (Dashboard 📊)" },
  { path: "/minha-conta", label: "App da paciente (home)" },
];

function LinkCard({ path, label }: { path: string; label: string }) {
  return (
    <a
      href={path}
      target="_blank"
      rel="noopener noreferrer"
      className="card-3d flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm hover:border-primary/40"
    >
      <span className="truncate">{label}</span>
      <span className="ml-2 shrink-0 text-xs text-muted-foreground">↗</span>
    </a>
  );
}

const PLANS = ["trial", "free", "starter", "pro", "clinica", "elite"] as const;

function AdminConsole() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [tab, setTab] = useState<"visao" | "medicos" | "varredura">("visao");

  async function load() {
    const tk = await token();
    const res = await getPlatformOverview({ data: { accessToken: tk } });
    if (res.ok && res.overview) {
      setAllowed(true);
      setData(res.overview);
    } else {
      setAllowed(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (allowed === null)
    return (
      <div className="mx-auto max-w-5xl px-5 py-16 text-center text-muted-foreground">
        Carregando…
      </div>
    );

  if (!allowed)
    return (
      <section className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 font-serif text-3xl">Console da plataforma</h1>
        <p className="mt-2 text-muted-foreground">
          Área exclusiva do administrador da plataforma. Sua conta não tem acesso.
        </p>
      </section>
    );

  return (
    <section className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Super-admin · dono da plataforma
          </p>
          <h1 className="mt-1 font-serif text-3xl md:text-4xl">Console da plataforma</h1>
          {data && <p className="mt-1 text-xs text-muted-foreground">{data.ownerEmail}</p>}
        </div>
        <button
          onClick={load}
          className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
        >
          ↺ Atualizar
        </button>
      </div>

      {/* Abas */}
      <div className="mt-6 flex gap-2 border-b border-border">
        {(
          [
            ["visao", "Visão geral"],
            ["medicos", "Médicos"],
            ["varredura", "Varredura do site"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === k
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "visao" && data && <OverviewTab data={data} />}
        {tab === "medicos" && data && <DoctorsTab data={data} onChanged={load} />}
        {tab === "varredura" && <VarreduraTab />}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "emerald" | "amber" | "sky";
}) {
  const tones: Record<string, string> = {
    primary: "border-primary/25 bg-primary/5 text-primary",
    emerald: "border-emerald-300/40 bg-emerald-50/60 text-emerald-600",
    amber: "border-amber-300/50 bg-amber-50/60 text-amber-600",
    sky: "border-sky-300/40 bg-sky-50/60 text-sky-600",
  };
  return (
    <div className={`card-3d rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OverviewTab({ data }: { data: PlatformOverview }) {
  const t = data.totals;
  const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard
          label="Médicos na plataforma"
          value={t.doctorsTotal}
          hint={`${t.doctorsActive} ativos`}
        />
        <KpiCard label="Pacientes no total" value={t.patientsTotal} tone="sky" />
        <KpiCard
          label="Respostas do cérebro no mês"
          value={t.brainHitsThisMonth}
          tone="emerald"
          hint="app + WhatsApp"
        />
        <KpiCard
          label="Receita mensal estimada"
          value={brl(t.mrrEstimate)}
          tone="amber"
          hint="médicos ativos × plano"
        />
        <KpiCard label="Médicos ativos" value={t.doctorsActive} tone="emerald" />
        <KpiCard
          label="Ticket médio"
          value={brl(t.doctorsActive ? Math.round(t.mrrEstimate / t.doctorsActive) : 0)}
          tone="primary"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Atualizado {new Date(data.generatedAt).toLocaleString("pt-BR")}. A receita usa os preços de
        referência por plano (ajustáveis em <code>platform.functions.ts</code>).
      </p>
    </div>
  );
}

function DoctorsTab({ data, onChanged }: { data: PlatformOverview; onChanged: () => void }) {
  if (data.doctors.length === 0)
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center">
        <p className="text-4xl">🩺</p>
        <p className="mt-3 font-medium">Nenhum médico assinante ainda</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Os cadastros em <code>/medicos/cadastro</code> aparecem aqui.
        </p>
      </div>
    );
  return (
    <div className="space-y-3">
      {data.doctors.map((d) => (
        <DoctorRow key={d.id} d={d} onChanged={onChanged} />
      ))}
    </div>
  );
}

function DoctorRow({ d, onChanged }: { d: PlatformDoctor; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function change(patch: { active?: boolean; plan?: (typeof PLANS)[number] }) {
    setBusy(true);
    const res = await setDoctorStatus({
      data: { accessToken: await token(), doctorId: d.id, ...patch },
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Atualizado ✓");
      onChanged();
    } else {
      toast.error("Não foi possível atualizar.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {d.display_name}
          {!d.active && (
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
              inativo
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {d.email ?? "—"} · {d.patients} pacientes · {d.brainEntries} no cérebro
        </p>
      </div>
      <select
        value={d.plan}
        disabled={busy}
        onChange={(e) => change({ plan: e.target.value as (typeof PLANS)[number] })}
        className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
      >
        {PLANS.map((p) => (
          <option key={p} value={p}>
            {p === "clinica" ? "clinica (Pro Equipe)" : p}
          </option>
        ))}
      </select>
      <button
        onClick={() => change({ active: !d.active })}
        disabled={busy}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
          d.active ? "bg-rose-500" : "bg-emerald-500"
        }`}
      >
        {d.active ? "Desativar" : "Ativar"}
      </button>
    </div>
  );
}

function VarreduraTab() {
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Abra qualquer área do produto num clique (nova aba) para revisar tudo de ponta a ponta.
      </p>

      <div>
        <h2 className="mb-3 font-serif text-lg">Painel & apps</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PANEL_AREAS.map((r) => (
            <LinkCard key={r.path} {...r} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-serif text-lg">App da paciente — {PATIENT_TABS.length} abas</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Cada link abre <code>/minha-conta</code> direto na aba (requer estar logado numa conta de
          paciente). Para varrer as fases da jornada gamificada, ajuste a DUM no Perfil.
        </p>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {PATIENT_TABS.map((t) => (
            <LinkCard key={t} path={`/minha-conta?tab=${encodeURIComponent(t)}`} label={t} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-serif text-lg">Páginas públicas — {PUBLIC_PAGES.length}</h2>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {PUBLIC_PAGES.map((r) => (
            <LinkCard key={r.path} {...r} />
          ))}
        </div>
      </div>
    </div>
  );
}
