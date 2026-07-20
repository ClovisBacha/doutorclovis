/**
 * Seções novas do console do dono: Crescimento, Alertas, NPS, Comunicados,
 * Flags, Auditoria e Reembolsos. Cada uma busca sozinha (super-admin) e usa as
 * primitivas de admin-ui para manter tudo visualmente consistente e navegável.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getGrowthMetrics,
  getChurnAlerts,
  type GrowthMetrics,
  type ChurnAlerts,
} from "@/lib/insights.functions";
import {
  createAnnouncement,
  listAnnouncementsAdmin,
  toggleAnnouncement,
  type Announcement,
} from "@/lib/announcements.functions";
import { listFlags, setFlag, type PlatformFlag } from "@/lib/flags.functions";
import { getNpsReport, type NpsReport } from "@/lib/nps.functions";
import { getAuditLog, type AuditEntry } from "@/lib/audit.functions";
import { getPaymentIncidents, type PaymentIncidentsReport } from "@/lib/payments.functions";
import {
  adminToken,
  brl,
  brl0,
  Kpi,
  Panel,
  Bar,
  EmptyHint,
  CsvButton,
  downloadCsv,
} from "@/components/admin-ui";

// ═══════════════════════════ Crescimento ═══════════════════════════

export function CrescimentoTab() {
  const [m, setM] = useState<GrowthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await getGrowthMetrics({ data: { accessToken: await adminToken() } });
        if (res.ok && res.metrics) setM(res.metrics);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (loading) return <div className="skeleton h-40 rounded-3xl" />;
  if (!m) return <EmptyHint>Não foi possível carregar. Aplique as migrações pendentes.</EmptyHint>;

  const fd = m.funnel.doctors;
  const fp = m.funnel.patients;
  const ue = m.unitEconomics;
  const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Forecast */}
      <Panel
        title="Previsão de receita (MRR)"
        subtitle="Projeção com base em testes convertendo e churn estimado."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="MRR atual" value={brl0(m.forecast.currentMrrCents)} tone="emerald" />
          {m.forecast.months.map((mo) => (
            <Kpi
              key={mo.label}
              label={`Projeção ${mo.label}`}
              value={brl0(mo.projectedMrrCents)}
              tone="sky"
            />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Premissas: {Math.round(m.forecast.assumptions.trialConversion * 100)}% dos testes viram
          pagantes, churn de {Math.round(m.forecast.assumptions.monthlyChurn * 100)}%/mês.
          Ajustáveis quando houver histórico real.
        </p>
      </Panel>

      {/* Funil */}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Funil de médicos">
          <div className="space-y-2.5">
            <Bar label="Cadastrados" value={fd.registered} max={fd.registered} tone="sky" />
            <Bar
              label="Ativaram"
              value={fd.activated}
              max={fd.registered}
              tone="primary"
              caption={`${pctOf(fd.activated, fd.registered)}%`}
            />
            <Bar
              label="Pagando"
              value={fd.paying}
              max={fd.registered}
              tone="emerald"
              caption={`${pctOf(fd.paying, fd.registered)}%`}
            />
            <Bar
              label="Retidos (1º ciclo)"
              value={fd.retained}
              max={fd.registered}
              tone="amber"
              caption={`${pctOf(fd.retained, fd.registered)}%`}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Ativou = tem paciente ou já paga.
          </p>
        </Panel>
        <Panel title="Funil de pacientes">
          <div className="space-y-2.5">
            <Bar label="Cadastradas" value={fp.total} max={fp.total} tone="sky" />
            <Bar
              label="Ativaram"
              value={fp.activated}
              max={fp.total}
              tone="primary"
              caption={`${pctOf(fp.activated, fp.total)}%`}
            />
            <Bar
              label="Premium"
              value={fp.premium}
              max={fp.total}
              tone="emerald"
              caption={`${pctOf(fp.premium, fp.total)}%`}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Ativou = fez ≥1 registro no app.</p>
        </Panel>
      </div>

      {/* Unit economics */}
      <Panel
        title="Unit economics (LTV / CAC)"
        subtitle="Quanto vale cada assinante e quanto custa adquirir por canal."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="ARPU médico"
            value={brl0(ue.doctorArpuCents)}
            tone="primary"
            hint="receita média/mês"
          />
          <Kpi
            label="LTV médico"
            value={brl0(ue.doctorLtvCents)}
            tone="emerald"
            hint={`${ue.assumptions.doctorLifetimeMonths} meses`}
          />
          <Kpi label="ARPU premium" value={brl0(ue.patientArpuCents)} tone="sky" />
          <Kpi
            label="LTV premium"
            value={brl0(ue.patientLtvCents)}
            tone="emerald"
            hint={`${ue.assumptions.patientLifetimeMonths} meses`}
          />
        </div>
        {ue.channels.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Canal</th>
                  <th className="px-3 py-2 text-right font-medium">Cadastros</th>
                  <th className="px-3 py-2 text-right font-medium">CAC</th>
                  <th className="px-3 py-2 text-right font-medium">Comissão total</th>
                </tr>
              </thead>
              <tbody>
                {ue.channels.map((c) => (
                  <tr key={c.code} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{c.code}</span>{" "}
                      <span className="text-muted-foreground">{c.name}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.signups}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.signups ? brl(c.cacCents) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {brl(c.commissionTotalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Custo / margem de IA */}
      <Panel
        title="Custo e margem de IA"
        subtitle="Uso do Segundo Cérebro no mês vs. receita — a margem por trás da IA."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Respostas no mês" value={m.aiCost.hitsThisMonth} tone="sky" />
          <Kpi
            label="Custo de IA (mês)"
            value={brl0(m.aiCost.costThisMonthCents)}
            tone="amber"
            hint={`~${brl(m.aiCost.costPerHitCents)}/resposta`}
          />
          <Kpi label="MRR" value={brl0(m.aiCost.mrrCents)} tone="emerald" />
          <Kpi
            label="Margem (mês)"
            value={brl0(m.aiCost.marginThisMonthCents)}
            tone="primary"
            hint="MRR − custo de IA"
          />
        </div>
        {m.aiCost.byDoctor.length > 0 && (
          <div className="mt-4 space-y-2">
            {m.aiCost.byDoctor.slice(0, 8).map((d) => (
              <Bar
                key={d.name}
                label={d.name}
                value={d.hits}
                max={m.aiCost.byDoctor[0].hits}
                caption={brl(d.costCents)}
                tone="amber"
              />
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Custo por resposta é uma estimativa (ajuste em insights.functions.ts).
        </p>
      </Panel>

      {/* Coortes */}
      <Panel
        title="Coortes de retenção (pacientes)"
        subtitle="Por mês de cadastro: quantas ativaram e quantas seguem ativas."
      >
        {m.cohorts.length === 0 ? (
          <EmptyHint>Sem coortes ainda.</EmptyHint>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Mês</th>
                  <th className="px-3 py-2 text-right font-medium">Tamanho</th>
                  <th className="px-3 py-2 text-right font-medium">Ativaram</th>
                  <th className="px-3 py-2 text-right font-medium">Ativas 30d</th>
                </tr>
              </thead>
              <tbody>
                {m.cohorts.map((c) => (
                  <tr key={c.month} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 tabular-nums">{c.month}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.size}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-primary">
                      {c.activatedPct}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">
                      {c.active30dPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Leaderboard */}
      <Panel
        title="Leaderboard de engajamento (médicos)"
        subtitle="Score = cérebro×3 + pacientes×2 + respostas no mês."
      >
        {m.leaderboard.length === 0 ? (
          <EmptyHint>Sem dados de engajamento ainda.</EmptyHint>
        ) : (
          <div className="space-y-2">
            {m.leaderboard.map((d, i) => (
              <div key={d.doctorId} className="flex items-center gap-3">
                <span className="w-6 text-right font-serif text-lg text-muted-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-medium">{d.name}</span>
                <span className="text-xs text-muted-foreground">
                  🧠 {d.brainEntries} · 👩‍🍼 {d.patients} · ⚡ {d.brainHitsThisMonth}
                </span>
                <span className="w-12 text-right font-semibold tabular-nums text-primary">
                  {d.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ═══════════════════════════ Alertas ═══════════════════════════

const SEV_CLS: Record<string, string> = {
  alta: "border-rose-200 bg-rose-50 text-rose-600",
  media: "border-amber-200 bg-amber-50 text-amber-600",
  baixa: "border-sky-200 bg-sky-50 text-sky-600",
};

export function AlertasTab() {
  const [a, setA] = useState<ChurnAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await getChurnAlerts({ data: { accessToken: await adminToken() } });
        if (res.ok && res.result) setA(res.result);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (loading) return <div className="skeleton h-40 rounded-3xl" />;
  if (!a) return <EmptyHint>Não foi possível carregar os alertas.</EmptyHint>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Em atraso" value={a.counts.past_due} tone="rose" />
        <Kpi label="Teste terminando" value={a.counts.trial_ending} tone="amber" />
        <Kpi label="Premium em risco" value={a.counts.premium_lapsing} tone="amber" />
        <Kpi label="Sem pacientes" value={a.counts.no_patients} tone="sky" />
        <Kpi label="Cérebro vazio" value={a.counts.inactive_doctor} tone="sky" />
      </div>
      <Panel
        title="Alertas de churn e risco"
        subtitle="Ordenados por severidade — aja nos vermelhos primeiro."
      >
        {a.alerts.length === 0 ? (
          <EmptyHint>Tudo tranquilo — nenhum alerta no momento. 🎉</EmptyHint>
        ) : (
          <div className="space-y-2">
            {a.alerts.map((al, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2"
              >
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${SEV_CLS[al.severity]}`}
                >
                  {al.severity}
                </span>
                <span className="font-medium">{al.who}</span>
                <span className="flex-1 text-sm text-muted-foreground">{al.detail}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ═══════════════════════════ NPS ═══════════════════════════

function npsColor(nps: number) {
  if (nps >= 50) return "text-emerald-600";
  if (nps >= 0) return "text-amber-600";
  return "text-rose-600";
}

export function NpsTab() {
  const [r, setR] = useState<NpsReport | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await getNpsReport({ data: { accessToken: await adminToken() } });
        if (res.ok && res.report) setR(res.report);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (loading) return <div className="skeleton h-40 rounded-3xl" />;
  if (!r) return <EmptyHint>Não foi possível carregar o NPS.</EmptyHint>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">NPS geral</p>
          <p className={`mt-1 font-serif text-5xl font-bold ${npsColor(r.overall.nps)}`}>
            {r.overall.nps}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.overall.responses} respostas · média {r.overall.avg}
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Médicos</p>
          <p className={`mt-1 font-serif text-5xl font-bold ${npsColor(r.byRole.medico.nps)}`}>
            {r.byRole.medico.nps}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.byRole.medico.responses} respostas
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pacientes</p>
          <p className={`mt-1 font-serif text-5xl font-bold ${npsColor(r.byRole.paciente.nps)}`}>
            {r.byRole.paciente.nps}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {r.byRole.paciente.responses} respostas
          </p>
        </div>
      </div>

      <Panel title="Composição" subtitle="Promotores (9–10) − Detratores (0–6) = NPS.">
        <div className="flex gap-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-emerald-600">
            <p className="text-xl font-bold tabular-nums">{r.overall.promoters}</p>
            <p className="text-[11px] uppercase">Promotores</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-2 text-center">
            <p className="text-xl font-bold tabular-nums">{r.overall.passives}</p>
            <p className="text-[11px] uppercase text-muted-foreground">Neutros</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-center text-rose-600">
            <p className="text-xl font-bold tabular-nums">{r.overall.detractors}</p>
            <p className="text-[11px] uppercase">Detratores</p>
          </div>
        </div>
        {r.trend.length > 0 && (
          <div className="mt-4 space-y-2">
            {r.trend.map((t) => (
              <Bar
                key={t.month}
                label={t.month}
                value={t.nps}
                max={100}
                caption={`${t.responses} resp.`}
                tone="primary"
              />
            ))}
          </div>
        )}
      </Panel>

      {r.recentComments.length > 0 && (
        <Panel title="Comentários recentes">
          <div className="space-y-2">
            {r.recentComments.map((c, i) => (
              <div key={i} className="rounded-xl border border-border/70 px-3 py-2">
                <p className="text-sm">{c.comment}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {c.role} · nota {c.score} · {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ═══════════════════════════ Comunicados ═══════════════════════════

export function ComunicadosTab() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"todos" | "medicos" | "pacientes">("todos");
  const [level, setLevel] = useState<"info" | "success" | "warning">("info");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await listAnnouncementsAdmin({ data: { accessToken: await adminToken() } });
    if (res.ok) setRows(res.announcements);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (title.trim().length < 2 || body.trim().length < 2) return;
    setSaving(true);
    const res = await createAnnouncement({
      data: {
        accessToken: await adminToken(),
        title: title.trim(),
        body: body.trim(),
        audience,
        level,
      },
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Comunicado publicado.");
      setTitle("");
      setBody("");
      load();
    } else {
      toast.error(
        res.reason === "migracao"
          ? "Aplique a migração (APLICAR_PENDENTES.sql)."
          : "Não foi possível publicar.",
      );
    }
  }
  async function toggle(a: Announcement) {
    await toggleAnnouncement({
      data: { accessToken: await adminToken(), id: a.id, active: !a.active },
    });
    load();
  }

  return (
    <div className="space-y-5">
      <Panel title="Novo comunicado" subtitle="Aparece como banner no app do público escolhido.">
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Mensagem"
            rows={3}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as any)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="todos">Todos</option>
              <option value="medicos">Só médicos</option>
              <option value="pacientes">Só pacientes</option>
            </select>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as any)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="info">Info</option>
              <option value="success">Novidade</option>
              <option value="warning">Aviso</option>
            </select>
            <button
              onClick={create}
              disabled={saving}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Comunicados">
        {loading ? (
          <div className="skeleton h-20 rounded-2xl" />
        ) : rows.length === 0 ? (
          <EmptyHint>Nenhum comunicado ainda.</EmptyHint>
        ) : (
          <div className="space-y-2">
            {rows.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${a.active ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.audience} · {a.level} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={() => toggle(a)}
                  className="rounded-full border border-border px-3 py-1 text-xs hover:text-primary"
                >
                  {a.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ═══════════════════════════ Flags ═══════════════════════════

export function FlagsTab() {
  const [flags, setFlags] = useState<PlatformFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await listFlags({ data: { accessToken: await adminToken() } });
    if (res.ok) setFlags(res.flags);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function save(f: PlatformFlag, patch: Partial<PlatformFlag>) {
    setBusy(f.key);
    const next = { ...f, ...patch };
    const res = await setFlag({
      data: {
        accessToken: await adminToken(),
        key: f.key,
        enabled: next.enabled,
        rolloutPct: next.rollout_pct,
        description: next.description ?? undefined,
      },
    });
    setBusy(null);
    if (res.ok) {
      setFlags((prev) => prev.map((x) => (x.key === f.key ? next : x)));
    } else {
      toast.error(
        res.reason === "migracao"
          ? "Aplique a migração (APLICAR_PENDENTES.sql)."
          : "Falha ao salvar.",
      );
    }
  }

  if (loading) return <div className="skeleton h-40 rounded-3xl" />;

  return (
    <Panel
      title="Feature flags / kill switch"
      subtitle="Ligue/desligue features sem deploy. Rollout controla a % de usuários."
    >
      <div className="space-y-3">
        {flags.map((f) => (
          <div key={f.key} className="rounded-xl border border-border/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm">{f.key}</p>
                {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
              </div>
              <button
                onClick={() => save(f, { enabled: !f.enabled })}
                disabled={busy === f.key}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ${
                  f.enabled ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {f.enabled ? "Ligado" : "Desligado"}
              </button>
            </div>
            {f.enabled && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Rollout</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={f.rollout_pct}
                  onChange={(e) =>
                    setFlags((prev) =>
                      prev.map((x) =>
                        x.key === f.key ? { ...x, rollout_pct: Number(e.target.value) } : x,
                      ),
                    )
                  }
                  onMouseUp={() => save(f, { rollout_pct: f.rollout_pct })}
                  onTouchEnd={() => save(f, { rollout_pct: f.rollout_pct })}
                  className="flex-1"
                />
                <span className="w-10 text-right text-xs font-semibold tabular-nums">
                  {f.rollout_pct}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Sem linha salva, a feature fica ligada (a ausência nunca quebra nada). Desligar aqui é um
        kill switch imediato.
      </p>
    </Panel>
  );
}

// ═══════════════════════════ Auditoria ═══════════════════════════

export function AuditoriaTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await getAuditLog({ data: { accessToken: await adminToken(), limit: 200 } });
        if (res.ok) setEntries(res.entries);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (loading) return <div className="skeleton h-40 rounded-3xl" />;

  return (
    <Panel
      title="Log de auditoria"
      subtitle="Ações sensíveis do administrador (LGPD). Registro imutável."
      action={
        entries.length > 0 ? (
          <CsvButton
            onClick={() =>
              downloadCsv("auditoria.csv", [
                ["data", "quem", "ação", "alvo", "detalhes"],
                ...entries.map((e) => [
                  new Date(e.created_at).toLocaleString("pt-BR"),
                  e.actor_email ?? "",
                  e.action,
                  e.target ?? "",
                  e.meta ? JSON.stringify(e.meta) : "",
                ]),
              ])
            }
          />
        ) : undefined
      }
    >
      {entries.length === 0 ? (
        <EmptyHint>Nenhum registro ainda.</EmptyHint>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Quem</th>
                <th className="px-3 py-2 font-medium">Ação</th>
                <th className="px-3 py-2 font-medium">Alvo</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-xs">{e.actor_email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{e.action}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.target ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ═══════════════════════════ Reembolsos / disputas ═══════════════════════════

export function ReembolsosTab() {
  const [r, setR] = useState<PaymentIncidentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await getPaymentIncidents({ data: { accessToken: await adminToken() } });
        if (res.ok && res.report) setR(res.report);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (loading) return <div className="skeleton h-40 rounded-3xl" />;
  if (!r) return <EmptyHint>Não foi possível carregar.</EmptyHint>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Reembolsos" value={r.totals.refundCount} tone="amber" />
        <Kpi label="Valor reembolsado" value={brl0(r.totals.refundCents)} tone="amber" />
        <Kpi label="Disputas" value={r.totals.disputeCount} tone="rose" />
        <Kpi label="Valor em disputa" value={brl0(r.totals.disputeCents)} tone="rose" />
      </div>
      <Panel title="Incidentes de pagamento" subtitle="Reembolsos e disputas capturados do Stripe.">
        {r.incidents.length === 0 ? (
          <EmptyHint>Nenhum reembolso ou disputa registrado. 🎉</EmptyHint>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {r.incidents.map((i) => (
                  <tr key={i.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {new Date(i.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${i.kind === "dispute" ? "border-rose-200 bg-rose-50 text-rose-600" : "border-amber-200 bg-amber-50 text-amber-600"}`}
                      >
                        {i.kind === "dispute" ? "Disputa" : "Reembolso"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {brl(i.amount_cents)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{i.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
