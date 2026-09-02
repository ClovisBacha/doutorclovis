import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Stagger, StaggerItem } from "@/components/motion-primitives";
import { TabSkeleton } from "@/components/tab-skeleton";
import { NaoConsegueLer } from "@/components/nao-consegui-ler";
import {
  deleteCycle,
  getRecentCycles,
  logCycleStart,
  updateCycleEnd,
  type MenstrualCycle,
} from "@/lib/saudefeminina.functions";
import {
  PHASE_META,
  WEEKDAYS_PT,
  addDays,
  buildCycleModel,
  classifyDay,
  cycleDayFor,
  cycleLengthDays,
  diffDays,
  phaseForCycleDay,
  startOfDay,
  upcomingMarks,
  ymd,
  type CycleModel,
} from "@/lib/ciclo-menstrual";

/**
 * A ABA DO CICLO MENSTRUAL — o segundo corte de `minha-conta.tsx`.
 *
 * ⚠️ **MOVE, e nada mais.** As quatro peças são byte a byte as que estavam no
 * arquivo de rota; a única diferença é o `export` na aba, para o arquivo de
 * rota poder importá-la.
 *
 * O anel de fases (`CicloHero`) e o calendário do mês (`CicloCalendario`) vêm
 * junto porque são exclusivos desta aba — duas ocorrências cada no repositório
 * inteiro, a declaração e o uso. A MATEMÁTICA, essa não veio: ela é
 * compartilhada com outras telas e saiu antes, para `@/lib/ciclo-menstrual`.
 */

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

function CicloHero({ model }: { model: CycleModel }) {
  const today = startOfDay(new Date());
  const dayInCycle = cycleDayFor(today, model);
  const { phase } = classifyDay(today, model);
  const meta = PHASE_META[phase];
  const marks = upcomingMarks(model, today);
  const daysToNext = marks.nextPeriod ? diffDays(today, marks.nextPeriod) : null;

  // Anel de fases: um ponto por dia do ciclo.
  const cx = 110;
  const cy = 110;
  const radius = 90;
  const dots = Array.from({ length: model.cycleLen }, (_, i) => {
    const angle = (i / model.cycleLen) * 2 * Math.PI - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    const p = phaseForCycleDay(i + 1, model.cycleLen, model.periodLen);
    const isToday = i + 1 === dayInCycle;
    return { x, y, dot: PHASE_META[p].dot, isToday };
  });

  const fmt = (d: Date | null, opts?: Intl.DateTimeFormatOptions) =>
    d ? d.toLocaleDateString("pt-BR", opts ?? { day: "2-digit", month: "short" }) : "—";

  return (
    <div className="rounded-3xl card-material p-6">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-8">
        {/* Anel */}
        <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
          <svg viewBox="0 0 220 220" className="h-full w-full" aria-hidden="true">
            {dots.map((d, i) => (
              <g key={i}>
                {d.isToday && (
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={8.5}
                    className="fill-background stroke-foreground"
                    strokeWidth={1.5}
                  />
                )}
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={d.isToday ? 5 : 4.2}
                  className={`fill-current ${d.dot}`}
                />
              </g>
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl leading-none">{meta.emoji}</span>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Dia do ciclo
            </p>
            <p className="font-serif text-4xl leading-none">{dayInCycle}</p>
          </div>
        </div>

        {/* Resumo */}
        <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
          <div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${meta.chip}`}
            >
              {meta.emoji} {meta.label}
            </span>
            <p className="mt-2 text-sm text-muted-foreground">{meta.desc}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-secondary/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Próximo período
              </p>
              <p className="font-serif text-lg">{fmt(marks.nextPeriod)}</p>
              {daysToNext !== null && (
                <p className="text-[11px] text-muted-foreground">
                  {daysToNext === 0
                    ? "pode ser hoje"
                    : daysToNext === 1
                      ? "em 1 dia"
                      : `em ${daysToNext} dias`}
                </p>
              )}
            </div>
            <div className="rounded-2xl bg-secondary/60 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ovulação</p>
              <p className="font-serif text-lg">{fmt(marks.ovulation)}</p>
              <p className="text-[11px] text-muted-foreground">estimada</p>
            </div>
            <div className="col-span-2 rounded-2xl bg-secondary/60 px-3 py-2.5 sm:col-span-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Janela fértil
              </p>
              <p className="font-serif text-base">
                {fmt(marks.fertileStart)} – {fmt(marks.fertileEnd)}
              </p>
              <p className="text-[11px] text-muted-foreground">ciclo de {model.cycleLen} dias</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-muted-foreground md:text-left">
        Estimativas com base no seu histórico. Não substituem métodos contraceptivos nem
        acompanhamento médico.
      </p>
    </div>
  );
}

function CicloCalendario({ model }: { model: CycleModel }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = startOfDay(new Date());
  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthLabel = base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const gridStart = addDays(base, -base.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  function cellClass(d: Date): string {
    const inMonth = d.getMonth() === base.getMonth();
    const isToday = ymd(d) === ymd(today);
    const { phase, actual } = classifyDay(d, model);
    let tone = "text-foreground/70";
    if (actual) tone = "bg-rose-500 text-white font-semibold";
    else if (phase === "menstruacao")
      tone = "border border-dashed border-rose-400 text-rose-500 dark:text-rose-300";
    else if (phase === "ovulacao") tone = "bg-emerald-600 text-white font-semibold";
    else if (phase === "fertil") tone = "bg-emerald-400/25 text-emerald-700 dark:text-emerald-300";
    const ring = isToday ? " ring-2 ring-foreground ring-offset-2 ring-offset-card" : "";
    const dim = inMonth ? "" : " opacity-35";
    return `flex aspect-square items-center justify-center rounded-full text-xs ${tone}${ring}${dim}`;
  }

  const legend: { label: string; swatch: string }[] = [
    { label: "Período", swatch: "bg-rose-500" },
    { label: "Previsão", swatch: "border border-dashed border-rose-400" },
    { label: "Fértil", swatch: "bg-emerald-400/40" },
    { label: "Ovulação", swatch: "bg-emerald-600" },
  ];

  return (
    <div className="rounded-3xl card-material p-5">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setMonthOffset((m) => m - 1)}
          aria-label="Mês anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-primary"
        >
          ‹
        </button>
        <p className="font-serif text-lg capitalize">{monthLabel}</p>
        <button
          onClick={() => setMonthOffset((m) => m + 1)}
          aria-label="Próximo mês"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-primary"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS_PT.map((w, i) => (
          <div
            key={i}
            className="pb-1 text-center text-[11px] font-medium uppercase text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {days.map((d, i) => (
          <div key={i} className={cellClass(d)}>
            {d.getDate()}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {legend.map((l) => (
          <span
            key={l.label}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
          >
            <span className={`h-3 w-3 shrink-0 rounded-full ${l.swatch}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CicloMenstrualTab() {
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
  /* ⚠️ Falha de leitura NÃO é lista vazia — ver `NaoConsegueLer`. */
  const [instavel, setInstavel] = useState(false);

  async function load() {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session?.access_token) {
      setLoading(false);
      return;
    }
    const res = await getRecentCycles({ data: { accessToken: s.session.access_token } });
    /* ⚠️ A data da última menstruação é a base da DUM e da DPP. "Nenhum ciclo
       registrado" sobre uma falha faz ela registrar um ciclo duplicado, ou
       informar uma data errada ao médico. */
    if (res.ok) {
      setCycles(res.cycles);
      setInstavel(false);
    } else {
      setInstavel(true);
    }
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

  const model = useMemo(() => buildCycleModel(cycles), [cycles]);

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      {/* Ciclo visual — estilo Apple Health */}
      {model ? (
        <Stagger className="space-y-4">
          <StaggerItem>
            <CicloHero model={model} />
          </StaggerItem>
          <StaggerItem>
            <CicloCalendario model={model} />
          </StaggerItem>
        </Stagger>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="mb-2 text-4xl">🌸</p>
          <p className="font-serif text-lg">Seu ciclo, visual e previsível</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Registre seu período abaixo para ver o anel de fases, a janela fértil e a previsão do
            próximo ciclo — como no app de saúde do celular.
          </p>
        </div>
      )}

      {/* Log button */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white"
        >
          + Registrar período
        </button>
      ) : (
        <div className="rounded-3xl card-material p-6 space-y-4">
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
              {submitting ? "Salvando…" : "Salvar"}
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
      {instavel ? (
        <NaoConsegueLer
          oQue="seus ciclos"
          sossego="O que você registrou continua salvo."
          aoTentar={() => void load()}
        />
      ) : cycles.length === 0 ? (
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
                      aria-label="Excluir este ciclo"
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
