import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getPlatformOverview,
  getPlatformInsights,
  getRetentionMetrics,
  setDoctorStatus,
  listPlatformCoupons,
  createPlatformCoupon,
  togglePlatformCoupon,
  type PlatformOverview,
  type PlatformDoctor,
  type PlatformInsights,
  type RetentionMetrics,
  type PlatformCoupon,
} from "@/lib/platform.functions";
import {
  listAffiliates,
  createAffiliate,
  toggleAffiliate,
  type Affiliate,
} from "@/lib/affiliates.functions";
import {
  getCorporateLeadsAdmin,
  createCorporateAccountAdmin,
  updateLeadStatusAdmin,
  type CorporateLead,
  type CorporateAccount,
} from "@/lib/corporativo.functions";
import {
  CrescimentoTab,
  AlertasTab,
  NpsTab,
  ComunicadosTab,
  FlagsTab,
  AuditoriaTab,
  ReembolsosTab,
} from "./admin-sections";
import { downloadCsv, CsvButton } from "@/components/admin-ui";

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

const PLANS = ["trial", "free", "starter", "pro", "clinica", "elite", "black"] as const;

type AdminTab =
  | "visao"
  | "crescimento"
  | "alertas"
  | "nps"
  | "financeiro"
  | "reembolsos"
  | "medicos"
  | "empresas"
  | "cupons"
  | "afiliados"
  | "comunicados"
  | "flags"
  | "auditoria"
  | "varredura";

// Navegação agrupada — cada grupo é uma família de telas, fácil de escanear.
const NAV_GROUPS: { group: string; items: { key: AdminTab; label: string; icon: string }[] }[] = [
  { group: "Início", items: [{ key: "visao", label: "Visão geral", icon: "🏠" }] },
  {
    group: "Crescimento",
    items: [
      { key: "crescimento", label: "Crescimento", icon: "📈" },
      { key: "alertas", label: "Alertas", icon: "🚨" },
      { key: "nps", label: "NPS", icon: "⭐" },
    ],
  },
  {
    group: "Financeiro",
    items: [
      { key: "financeiro", label: "Financeiro", icon: "💰" },
      { key: "reembolsos", label: "Reembolsos", icon: "↩️" },
    ],
  },
  {
    group: "Pessoas",
    items: [
      { key: "medicos", label: "Médicos", icon: "🩺" },
      { key: "empresas", label: "Empresas", icon: "🏢" },
    ],
  },
  {
    group: "Marketing",
    items: [
      { key: "cupons", label: "Cupons", icon: "🎟️" },
      { key: "afiliados", label: "Afiliados", icon: "🤝" },
      { key: "comunicados", label: "Comunicados", icon: "📣" },
    ],
  },
  {
    group: "Sistema",
    items: [
      { key: "flags", label: "Feature flags", icon: "🚦" },
      { key: "auditoria", label: "Auditoria", icon: "🛡️" },
      { key: "varredura", label: "Varredura", icon: "🔍" },
    ],
  },
];

function AdminConsole() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [tab, setTab] = useState<AdminTab>("visao");

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

  const activeLabel = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === tab)?.label ?? "";

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
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

      {/* Navegação mobile: chips roláveis */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2 md:hidden">
        {NAV_GROUPS.flatMap((g) => g.items).map((i) => (
          <button
            key={i.key}
            onClick={() => setTab(i.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              tab === i.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            <span className="mr-1">{i.icon}</span>
            {i.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex gap-8">
        {/* Sidebar desktop: grupos */}
        <nav className="hidden w-52 shrink-0 md:block">
          {NAV_GROUPS.map((g) => (
            <div key={g.group} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.group}
              </p>
              <div className="space-y-0.5">
                {g.items.map((i) => (
                  <button
                    key={i.key}
                    onClick={() => setTab(i.key)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      tab === i.key
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <span>{i.icon}</span>
                    {i.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1">
          <h2 className="mb-5 hidden font-serif text-2xl md:block">{activeLabel}</h2>
          {tab === "visao" && data && <OverviewTab data={data} />}
          {tab === "crescimento" && <CrescimentoTab />}
          {tab === "alertas" && <AlertasTab />}
          {tab === "nps" && <NpsTab />}
          {tab === "financeiro" && <FinanceiroTab />}
          {tab === "reembolsos" && <ReembolsosTab />}
          {tab === "medicos" && data && <DoctorsTab data={data} onChanged={load} />}
          {tab === "empresas" && <EmpresasAdminTab />}
          {tab === "cupons" && <CuponsTab />}
          {tab === "afiliados" && <AfiliadosTab />}
          {tab === "comunicados" && <ComunicadosTab />}
          {tab === "flags" && <FlagsTab />}
          {tab === "auditoria" && <AuditoriaTab />}
          {tab === "varredura" && <VarreduraTab />}
        </div>
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

      <RetentionCard />
    </div>
  );
}

/**
 * Financeiro da plataforma: TODAS as consultas pagas do site, agrupadas por
 * médico. Dá ao dono o controle inteiro — quanto entrou por perfil de médico
 * e quantas consultas foram efetivamente pagas através da Obstétrica.
 */
const brl = (cents: number) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const brl0 = (cents: number) => `R$ ${Math.round(cents / 100).toLocaleString("pt-BR")}`;

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  elite: "Reconhecido",
  black: "Black",
  clinica: "Clínica",
  trial: "Trial",
  free: "Grátis",
};

const SUB_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Pagando", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  trialing: { label: "Em teste", cls: "bg-sky-50 text-sky-600 border-sky-200" },
  past_due: { label: "Em atraso", cls: "bg-amber-50 text-amber-600 border-amber-200" },
  canceled: { label: "Cancelado", cls: "bg-rose-50 text-rose-600 border-rose-200" },
};

/**
 * Financeiro & Negócio — o dashboard do DONO. Tudo do site em uma tela:
 * receita real (assinaturas ativas), planos mais vendidos, e a tabela-mãe por
 * médico (pacientes, premium, agendamentos, consultas pagas, cérebro). No fim,
 * as comissões a pagar aos micro-influenciadores e o uso dos cupons.
 */
function FinanceiroTab() {
  const [ins, setIns] = useState<PlatformInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        const tk = s.session?.access_token;
        if (!tk) return;
        const res = await getPlatformInsights({ data: { accessToken: tk } });
        if (res.ok && res.insights) setIns(res.insights);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="skeleton h-40 rounded-3xl" />;
  if (!ins)
    return (
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar o financeiro. Confira se as migrações pendentes
        (APLICAR_PENDENTES.sql) foram aplicadas no Supabase.
      </p>
    );

  const rev = ins.revenue;
  const maxPlan = Math.max(1, ...ins.subscriptions.byPlan.map((p) => p.count));

  return (
    <div className="space-y-8">
      {/* Receita recorrente real */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Receita recorrente (assinaturas ativas)
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="MRR total"
            value={brl0(rev.totalMrrCents)}
            tone="amber"
            hint="médicos + pacientes premium"
          />
          <KpiCard label="MRR médicos" value={brl0(rev.doctorMrrCents)} tone="emerald" />
          <KpiCard label="MRR pacientes premium" value={brl0(rev.patientMrrCents)} tone="sky" />
          <KpiCard
            label="Faturamento consultas"
            value={brl0(rev.consultRevenueCents)}
            tone="primary"
            hint="consultas pagas no site"
          />
        </div>
      </div>

      {/* Volume da plataforma */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Volume da plataforma
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Médicos pagando" value={ins.subscriptions.doctorsPaying} tone="emerald" />
          <KpiCard label="Pacientes premium" value={ins.subscriptions.patientsPremium} tone="sky" />
          <KpiCard
            label="Agendamentos"
            value={ins.appointments.total}
            tone="primary"
            hint={`${ins.appointments.thisMonth} neste mês`}
          />
          <KpiCard
            label="Consultas pagas"
            value={ins.transactions.paidConsultations}
            tone="amber"
          />
        </div>
      </div>

      {/* Planos mais vendidos */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <p className="font-serif text-lg">Planos mais vendidos</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Assinaturas de médico ativas, por plano (mensal vs anual).
        </p>
        {ins.subscriptions.byPlan.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma assinatura ativa ainda.</p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {ins.subscriptions.byPlan.map((p) => (
              <div key={p.plan} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium">
                  {PLAN_LABEL[p.plan] ?? p.plan}
                </span>
                <div className="h-6 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="flex h-full items-center rounded-full bg-primary/80 px-2 text-[11px] font-semibold text-primary-foreground"
                    style={{ width: `${Math.max(8, (p.count / maxPlan) * 100)}%` }}
                  >
                    {p.count}
                  </div>
                </div>
                <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {p.monthly} mensal · {p.annual} anual
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabela-mãe: tudo por médico */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Por médico — o controle inteiro
          </p>
          {ins.perDoctor.length > 0 && (
            <CsvButton
              onClick={() =>
                downloadCsv("financeiro-por-medico.csv", [
                  [
                    "medico",
                    "email",
                    "plano",
                    "status",
                    "mrr_reais",
                    "pacientes",
                    "premium",
                    "agendamentos",
                    "agendamentos_mes",
                    "consultas_pagas",
                    "faturamento_consultas_reais",
                    "cerebro_entradas",
                    "cerebro_respostas_mes",
                  ],
                  ...ins.perDoctor.map((d) => [
                    d.name,
                    d.email ?? "",
                    d.plan,
                    d.subStatus ?? "",
                    (d.mrrCents / 100).toFixed(2),
                    d.patients,
                    d.patientsPremium,
                    d.appointments,
                    d.appointmentsThisMonth,
                    d.paidConsults,
                    (d.consultRevenueCents / 100).toFixed(2),
                    d.brainEntries,
                    d.brainHitsThisMonth,
                  ]),
                ])
              }
            />
          )}
        </div>
        <div className="overflow-x-auto rounded-3xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Médico</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 text-right font-medium">MRR</th>
                <th className="px-4 py-3 text-right font-medium">Pacientes</th>
                <th className="px-4 py-3 text-right font-medium">Premium</th>
                <th className="px-4 py-3 text-right font-medium">Agend. (mês)</th>
                <th className="px-4 py-3 text-right font-medium">Consultas $</th>
                <th className="px-4 py-3 text-right font-medium">Cérebro</th>
              </tr>
            </thead>
            <tbody>
              {ins.perDoctor.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum médico cadastrado ainda.
                  </td>
                </tr>
              )}
              {ins.perDoctor.map((d) => {
                const st = d.subStatus ? SUB_STATUS_LABEL[d.subStatus] : null;
                return (
                  <tr key={d.doctorId} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.name}</p>
                      {d.email && <p className="text-xs text-muted-foreground">{d.email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{PLAN_LABEL[d.plan] ?? d.plan}</span>
                      {st && (
                        <span
                          className={`ml-1 inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}
                        >
                          {st.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {d.mrrCents ? brl0(d.mrrCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{d.patients}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-sky-600">
                      {d.patientsPremium}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {d.appointments}
                      {d.appointmentsThisMonth > 0 && (
                        <span className="text-emerald-600"> (+{d.appointmentsThisMonth})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {d.paidConsults > 0 ? (
                        <span>
                          {d.paidConsults}
                          <span className="text-muted-foreground">
                            {" "}
                            · {brl0(d.consultRevenueCents)}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {d.brainEntries} · {d.brainHitsThisMonth}/mês
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          MRR = mensalidade da assinatura ativa (anual normalizado ao mensal de lista). Premium =
          pacientes do médico com assinatura Premium ativa. Cérebro = entradas treinadas · respostas
          no mês.
        </p>
      </div>

      {/* Agendamentos por status */}
      {ins.appointments.byStatus.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="font-serif text-lg">Agendamentos por status</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ins.appointments.byStatus.map((s) => (
              <span
                key={s.status}
                className="rounded-full border border-border bg-muted/40 px-3 py-1 text-sm"
              >
                {s.status}: <span className="font-semibold tabular-nums">{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Comissões dos afiliados / micro-influenciadores */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <p className="font-serif text-lg">Comissões — micro-influenciadores</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Por código: quantas pacientes trouxe, o faturado, e a comissão. Pague pela coluna{" "}
          <strong>este mês</strong> (comissão gerada no ciclo); o <strong>total</strong> é o
          acumulado da vida toda (não desconta repasses já feitos).
        </p>
        {ins.affiliates.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum afiliado cadastrado. Crie códigos na aba <strong>Afiliados</strong>.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Influenciador</th>
                  <th className="px-3 py-2 text-right font-medium">Cadastros</th>
                  <th className="px-3 py-2 text-right font-medium">Faturado</th>
                  <th className="px-3 py-2 text-right font-medium">Comissão (mês)</th>
                  <th className="px-3 py-2 text-right font-medium">Total acumulado</th>
                </tr>
              </thead>
              <tbody>
                {ins.affiliates.map((a) => (
                  <tr key={a.code} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">
                      {a.code}
                      {!a.active && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(off)</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.signups}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {brl(a.revenueCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-600">
                      {brl(a.commissionMonthCents)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {brl(a.commissionTotalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Uso dos cupons de plataforma */}
      {ins.coupons.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="font-serif text-lg">Cupons — uso</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 text-right font-medium">Usos</th>
                  <th className="px-3 py-2 text-right font-medium">Limite</th>
                </tr>
              </thead>
              <tbody>
                {ins.coupons.map((c) => (
                  <tr key={c.code} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">
                      {c.code}
                      {!c.active && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(off)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.kind}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {c.redemptions}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {c.maxRedemptions ?? "∞"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Atualizado {new Date(ins.generatedAt).toLocaleString("pt-BR")}. Receita baseada na tabela de
        assinaturas do Stripe (estado real), não no plano marcado no cadastro.
      </p>
    </div>
  );
}

/**
 * Ativação & Retenção (instrumentação): mostra se paciente/médico ATIVAM e
 * VOLTAM. É o painel que tira o fundador da cegueira (crítica do comitê).
 * Busca sozinho (getRetentionMetrics, super-admin).
 */
function RetentionCard() {
  const [m, setM] = useState<RetentionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        const tk = s.session?.access_token;
        if (!tk) return;
        const res = await getRetentionMetrics({ data: { accessToken: tk } });
        if (res.ok && res.metrics) setM(res.metrics);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="skeleton h-40 rounded-3xl" />;
  if (!m) return null;

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="font-serif text-lg">Ativação & Retenção</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        A pergunta que decide a empresa: as pessoas ativam e voltam?
      </p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pacientes
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Total" value={m.patients.total} />
        <KpiCard
          label="Ativaram (fizeram algo)"
          value={`${m.patients.activated} · ${m.patients.activatedPct}%`}
          tone="emerald"
        />
        <KpiCard
          label="Voltaram (2+ dias)"
          value={`${m.patients.returning} · ${m.patients.returningPct}%`}
          tone="primary"
          hint="% sobre quem ativou"
        />
        <KpiCard label="Ativas 7 dias" value={m.patients.active7d} tone="sky" />
        <KpiCard label="Ativas 30 dias" value={m.patients.active30d} tone="sky" />
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Médicos
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total" value={m.doctors.total} />
        <KpiCard label="Ativos" value={m.doctors.active} tone="emerald" />
        <KpiCard
          label="Treinaram a IA"
          value={`${m.doctors.trained} · ${m.doctors.trainedPct}%`}
          tone="primary"
          hint="≥1 entrada no cérebro"
        />
        <KpiCard label="Com pacientes" value={m.doctors.withPatients} tone="sky" />
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        "Ativar" = fez ao menos 1 registro (diário/saúde/chutes). "Voltar" = teve atividade em 2+
        dias distintos. Sinais de PMF: retenção alta e crescente.
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

  async function change(patch: {
    active?: boolean;
    verified?: boolean;
    plan?: (typeof PLANS)[number];
  }) {
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
          {d.verified ? (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
              ✓ verificado
            </span>
          ) : (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              não verificado
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
        onClick={() => change({ verified: !d.verified })}
        disabled={busy}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50 ${
          d.verified
            ? "border border-amber-300 bg-amber-50 text-amber-700"
            : "bg-emerald-600 text-white"
        }`}
        title="Só médicos verificados aparecem na busca pública de médicos"
      >
        {d.verified ? "Remover selo" : "Verificar"}
      </button>
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

/**
 * Cupons de plataforma (só o super-admin): gere códigos que liberam o Premium
 * do app. Use em campanhas, parcerias ou cortesias — a paciente aplica o código
 * no popup "Tenho um cupom" e ganha o Premium na hora.
 */
function CuponsTab() {
  const [coupons, setCoupons] = useState<PlatformCoupon[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await listPlatformCoupons({ data: { accessToken: await token() } });
      if (res.ok) setCoupons(res.coupons);
      else if ("missingTable" in res && res.missingTable) {
        setMissing(true);
        setCoupons([]);
      } else setCoupons([]);
    } catch {
      setCoupons([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (creating) return;
    setCreating(true);
    try {
      const max = maxUses.trim() ? parseInt(maxUses, 10) : null;
      const res = await createPlatformCoupon({
        data: {
          accessToken: await token(),
          ...(code.trim() ? { code: code.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          maxRedemptions: max && max > 0 ? max : null,
        },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "duplicado"
            ? "Esse código já existe."
            : "reason" in res && res.reason === "migracao"
              ? "Rode o APLICAR_PENDENTES.sql no Supabase para ativar os cupons."
              : "Não foi possível criar o cupom.",
        );
        return;
      }
      toast.success(`Cupom ${res.code} criado 🎟️`);
      setCode("");
      setNote("");
      setMaxUses("");
      await load();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  async function toggle(c: PlatformCoupon) {
    const res = await togglePlatformCoupon({
      data: { accessToken: await token(), id: c.id, active: !c.active },
    });
    if (res.ok) load();
    else toast.error("Não foi possível atualizar.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl">Cupons de Premium</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Códigos que VOCÊ gera para liberar o Premium do app (campanhas, parcerias, cortesias). A
          paciente aplica em "Tenho um cupom" e ganha na hora. Deixe o código em branco para gerar
          um automático; deixe usos em branco para ilimitado.
        </p>
      </div>

      {missing && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Rode o <strong>APLICAR_PENDENTES.sql</strong> no Supabase para ativar os cupons.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground">
            Código (opcional)
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="AUTO"
            maxLength={16}
            className="mt-1 w-36 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="block text-[11px] font-medium text-muted-foreground">
            Rótulo interno (opcional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: Campanha Instagram"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground">Usos</label>
          <input
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="∞"
            className="mt-1 w-20 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {creating ? "Criando…" : "+ Gerar cupom"}
        </button>
      </div>

      {coupons === null ? (
        <div className="skeleton h-20 rounded-2xl" />
      ) : coupons.length === 0 ? (
        !missing && (
          <p className="text-sm text-muted-foreground">
            Nenhum cupom ainda. Gere o primeiro acima.
          </p>
        )
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5">Código</th>
                <th className="px-4 py-2.5">Rótulo</th>
                <th className="px-4 py-2.5">Usos</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.note ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {c.redemptions}
                    {c.max_redemptions != null ? ` / ${c.max_redemptions}` : " / ∞"}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggle(c)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        c.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {c.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Afiliados (influenciadores) no console do dono. Códigos ?ref= que atribuem
 * a paciente e creditam comissão por fatura paga. Migrado do painel do médico
 * para o /admin — é uma função da PLATAFORMA, não do consultório.
 */
function AfiliadosTab() {
  const [rows, setRows] = useState<Affiliate[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [pct, setPct] = useState("50");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await listAffiliates({ data: { accessToken: await token() } });
      if (res.ok) setRows(res.affiliates);
      else if ("missingTable" in res && res.missingTable) {
        setMissing(true);
        setRows([]);
      } else setRows([]);
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (creating || code.trim().length < 3 || name.trim().length < 2) return;
    setCreating(true);
    try {
      const res = await createAffiliate({
        data: {
          accessToken: await token(),
          code: code.trim(),
          name: name.trim(),
          commissionPct: Math.min(90, Math.max(1, parseInt(pct, 10) || 50)),
        },
      });
      if (!res.ok) {
        toast.error(
          "reason" in res && res.reason === "duplicado"
            ? "Esse código já existe."
            : "reason" in res && res.reason === "migracao"
              ? "Rode o APLICAR_PENDENTES.sql no Supabase."
              : "Não foi possível criar o código.",
        );
        return;
      }
      toast.success(`Código ${code.trim().toUpperCase()} criado 🎉`);
      setCode("");
      setName("");
      await load();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  const brl = (c: number) =>
    (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl">Afiliados (influenciadores)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O influenciador divulga <span className="font-medium text-foreground">/?ref=CÓDIGO</span>{" "}
          e ganha a comissão de cada Premium pago pelas pacientes que trouxe — creditada
          automaticamente. Aqui você cria os códigos e acompanha o repasse.
        </p>
      </div>

      {missing && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Rode o <strong>APLICAR_PENDENTES.sql</strong> no Supabase para ativar os afiliados.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-4">
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground">Código</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="MARIA"
            className="mt-1 w-32 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="block text-[11px] font-medium text-muted-foreground">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Maria Influencer"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground">% comissão</label>
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className="mt-1 w-20 rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={create}
          disabled={creating || code.trim().length < 3 || name.trim().length < 2}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {creating ? "Criando…" : "+ Criar código"}
        </button>
      </div>

      {rows === null ? (
        <div className="h-20 animate-pulse rounded-2xl bg-secondary" />
      ) : rows.length === 0 ? (
        !missing && <p className="text-sm text-muted-foreground">Nenhum afiliado ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5">Código</th>
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5">%</th>
                <th className="px-4 py-2.5">Pacientes</th>
                <th className="px-4 py-2.5">Faturado</th>
                <th className="px-4 py-2.5">Comissão</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.code} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-mono font-semibold">{a.code}</td>
                  <td className="px-4 py-2.5">{a.name}</td>
                  <td className="px-4 py-2.5">{a.commission_pct}%</td>
                  <td className="px-4 py-2.5 tabular-nums">{a.signups}</td>
                  <td className="px-4 py-2.5 tabular-nums">{brl(a.revenueCents)}</td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-emerald-600">
                    {brl(a.commissionCents)}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={async () => {
                        const res = await toggleAffiliate({
                          data: { accessToken: await token(), code: a.code, active: !a.active },
                        });
                        if (res.ok) load();
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        a.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {a.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Contas corporativas (empresas parceiras) no console do dono: leads recebidos
 * e criação de contas com código de acesso. Também é função de PLATAFORMA.
 */
function EmpresasAdminTab() {
  const [leads, setLeads] = useState<CorporateLead[]>([]);
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    companyName: "",
    contactEmail: "",
    planType: "basico" as "basico" | "standard" | "premium",
    maxSeats: "10",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await getCorporateLeadsAdmin({ data: { accessToken: await token() } });
      if (res.ok) {
        setLeads(res.leads);
        setAccounts(res.accounts);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (creating || form.companyName.trim().length < 2 || !form.contactEmail.includes("@")) return;
    setCreating(true);
    try {
      const res = await createCorporateAccountAdmin({
        data: {
          accessToken: await token(),
          companyName: form.companyName.trim(),
          contactEmail: form.contactEmail.trim(),
          planType: form.planType,
          maxSeats: Math.max(1, parseInt(form.maxSeats, 10) || 10),
          notes: form.notes.trim() || null,
        },
      });
      if (!res.ok) {
        toast.error("Não foi possível criar a conta.");
        return;
      }
      toast.success(`Conta criada · código ${res.account.access_code}`);
      setForm({ companyName: "", contactEmail: "", planType: "basico", maxSeats: "10", notes: "" });
      await load();
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="skeleton h-40 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl">Empresas parceiras</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contas corporativas: crie um código de acesso e as funcionárias entram no app pelo código.
          Leads chegam pela página /empresas.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium">Nova conta corporativa</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            placeholder="Nome da empresa"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            placeholder="E-mail de contato"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.planType}
            onChange={(e) => setForm({ ...form, planType: e.target.value as any })}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="basico">Básico</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
          <input
            value={form.maxSeats}
            onChange={(e) => setForm({ ...form, maxSeats: e.target.value.replace(/\D/g, "") })}
            placeholder="Vagas"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {creating ? "Criando…" : "+ Criar conta"}
        </button>
      </div>

      <div>
        <h3 className="mb-2 font-medium">Contas ativas ({accounts.length})</h3>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta corporativa ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5">Empresa</th>
                  <th className="px-4 py-2.5">Plano</th>
                  <th className="px-4 py-2.5">Vagas</th>
                  <th className="px-4 py-2.5">Código</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium">{a.company_name}</td>
                    <td className="px-4 py-2.5">{a.plan_type}</td>
                    <td className="px-4 py-2.5 tabular-nums">{a.max_seats}</td>
                    <td className="px-4 py-2.5 font-mono font-semibold">{a.access_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium">Leads recebidos ({leads.length})</h3>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lead ainda.</p>
        ) : (
          <div className="space-y-2">
            {leads.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{l.company_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.contact_name} · {l.contact_email}
                    {l.employee_count ? ` · ${l.employee_count} func.` : ""}
                  </p>
                </div>
                <select
                  value={l.status}
                  onChange={async (e) => {
                    const res = await updateLeadStatusAdmin({
                      data: { accessToken: await token(), id: l.id, status: e.target.value },
                    });
                    if (res.ok) load();
                  }}
                  className="rounded-full border border-border bg-background px-3 py-1 text-xs"
                >
                  <option value="novo">Novo</option>
                  <option value="contatado">Contatado</option>
                  <option value="fechado">Fechado</option>
                  <option value="perdido">Perdido</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
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
