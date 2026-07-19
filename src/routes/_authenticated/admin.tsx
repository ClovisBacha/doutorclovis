import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getPlatformOverview,
  getRetentionMetrics,
  setDoctorStatus,
  listPlatformCoupons,
  createPlatformCoupon,
  togglePlatformCoupon,
  type PlatformOverview,
  type PlatformDoctor,
  type RetentionMetrics,
  type PlatformCoupon,
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

const PLANS = ["trial", "free", "starter", "pro", "clinica", "elite", "black"] as const;

function AdminConsole() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [tab, setTab] = useState<"visao" | "medicos" | "cupons" | "varredura">("visao");

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
            ["cupons", "Cupons"],
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
        {tab === "cupons" && <CuponsTab />}
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

      <RetentionCard />
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
