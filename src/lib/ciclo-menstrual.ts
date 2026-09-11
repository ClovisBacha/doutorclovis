import type { MenstrualCycle } from "@/lib/saudefeminina.functions";

/**
 * A MATEMÁTICA DO CICLO MENSTRUAL — pura, sem tela.
 *
 * ⚠️ **SAIU DE `minha-conta.tsx` COMO UM MOVE, e nada mais.** Cada declaração
 * aqui é byte a byte a que estava lá; a única diferença é o `export` na frente,
 * que a torna importável. Um move que também "melhora" é uma reescrita, e aí a
 * mudança de comportamento se esconde no meio do diff.
 *
 * ⚠️ **E ela sai porque é COMPARTILHADA.** `ymd` tem catorze usos fora da aba do
 * ciclo, e `addDays`, `diffDays`, `startOfDay`, `classifyDay`, `cycleDayFor`,
 * `phaseForCycleDay` e `CycleModel` também servem outras telas do arquivo. Sem
 * tirá-las daqui, mover a ABA do ciclo exigiria exportá-las de um arquivo de
 * ROTA — que é exatamente a dívida que estes cortes existem para pagar.
 *
 * É a régua da casa outra vez: **função pura em `lib/`, componente só desenha.**
 * As dezessete foram conferidas antes de sair: nenhuma toca `window`,
 * `document`, `supabase`, `localStorage`, `fetch` ou JSX.
 */

export type CyclePhase = "menstruacao" | "folicular" | "fertil" | "ovulacao" | "lutea";

export type CycleModel = {
  cycleLen: number;
  periodLen: number;
  lastStart: Date;
  actualPeriod: Set<string>;
};

export const PHASE_META: Record<
  CyclePhase,
  { label: string; emoji: string; dot: string; chip: string; desc: string }
> = {
  menstruacao: {
    label: "Menstruação",
    emoji: "🩸",
    dot: "text-rose-500",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    desc: "Fase de descanso. Escute seu corpo.",
  },
  folicular: {
    label: "Fase folicular",
    emoji: "🌱",
    dot: "text-amber-400",
    chip: "bg-amber-400/15 text-amber-600 dark:text-amber-300",
    desc: "A energia vai voltando aos poucos.",
  },
  fertil: {
    label: "Janela fértil",
    emoji: "🌿",
    dot: "text-emerald-400",
    chip: "bg-emerald-400/15 text-emerald-600 dark:text-emerald-300",
    desc: "Maior chance de concepção estimada.",
  },
  ovulacao: {
    label: "Ovulação",
    emoji: "✨",
    dot: "text-emerald-600",
    chip: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
    desc: "Pico de fertilidade estimado.",
  },
  lutea: {
    label: "Fase lútea",
    emoji: "🌙",
    dot: "text-violet-400",
    chip: "bg-violet-400/15 text-violet-600 dark:text-violet-300",
    desc: "A TPM pode aparecer nos últimos dias.",
  },
};

export const WEEKDAYS_PT = ["D", "S", "T", "Q", "Q", "S", "S"];

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function fromYmd(s: string): Date {
  return new Date(s + "T00:00:00");
}

export function avgCycleLength(cycles: MenstrualCycle[]): number {
  if (cycles.length < 2) return 28;
  const gaps: number[] = [];
  for (let i = 0; i < cycles.length - 1; i++) {
    const a = new Date(cycles[i + 1].start_date + "T00:00:00").getTime();
    const b = new Date(cycles[i].start_date + "T00:00:00").getTime();
    gaps.push(Math.round((b - a) / 86400000));
  }
  return Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length);
}

export function avgPeriodLength(cycles: MenstrualCycle[]): number {
  const durs = cycles
    .map(cycleLengthDays)
    .filter((n): n is number => n !== null && n >= 2 && n <= 12);
  if (!durs.length) return 5;
  return Math.round(durs.reduce((s, v) => s + v, 0) / durs.length);
}

export function cycleDayFor(date: Date, model: CycleModel): number {
  const off = diffDays(model.lastStart, date);
  return (((off % model.cycleLen) + model.cycleLen) % model.cycleLen) + 1;
}

export function phaseForCycleDay(day: number, cycleLen: number, periodLen: number): CyclePhase {
  const ov = cycleLen - 13;
  if (day <= periodLen) return "menstruacao";
  if (day === ov) return "ovulacao";
  if (day >= ov - 5 && day <= ov + 1) return "fertil";
  if (day < ov) return "folicular";
  return "lutea";
}

export function classifyDay(date: Date, model: CycleModel): { phase: CyclePhase; actual: boolean } {
  if (model.actualPeriod.has(ymd(date))) return { phase: "menstruacao", actual: true };
  const phase = phaseForCycleDay(cycleDayFor(date, model), model.cycleLen, model.periodLen);
  return { phase, actual: false };
}

export function upcomingMarks(model: CycleModel, today: Date) {
  let nextPeriod: Date | null = null;
  let ovulation: Date | null = null;
  const horizon = model.cycleLen * 2 + 2;
  for (let i = 1; i <= horizon; i++) {
    const d = addDays(today, i);
    const c = classifyDay(d, model);
    const prev = classifyDay(addDays(d, -1), model);
    if (!nextPeriod && c.phase === "menstruacao" && prev.phase !== "menstruacao") nextPeriod = d;
    if (!ovulation && c.phase === "ovulacao") ovulation = d;
    if (nextPeriod && ovulation) break;
  }
  const fertileStart = ovulation ? addDays(ovulation, -5) : null;
  const fertileEnd = ovulation ? addDays(ovulation, 1) : null;
  return { nextPeriod, ovulation, fertileStart, fertileEnd };
}

export function buildCycleModel(cycles: MenstrualCycle[]): CycleModel | null {
  if (!cycles.length) return null;
  const cycleLen = Math.max(18, Math.min(45, avgCycleLength(cycles)));
  const periodLen = avgPeriodLength(cycles);
  const lastStart = fromYmd(cycles[0].start_date);
  const actualPeriod = new Set<string>();
  for (const c of cycles) {
    const s = fromYmd(c.start_date);
    const e = c.end_date ? fromYmd(c.end_date) : addDays(s, periodLen - 1);
    for (let d = new Date(s); d <= e; d = addDays(d, 1)) actualPeriod.add(ymd(d));
  }
  return { cycleLen, periodLen, lastStart, actualPeriod };
}

/**
 * ATÉ QUANDO A PREVISÃO VALE.
 *
 * ⚠️ `buildCycleModel` projeta o ciclo médio para a frente a partir do ÚLTIMO
 * período registrado — e não sabe a idade dele. Com um período de nove meses
 * atrás, `cycleDayFor` devolve um "dia do ciclo" que é só a data de hoje
 * módulo 28: um número fabricado, com "próximo período" e "janela fértil"
 * fabricados junto. Foi assim que o anel previu período para uma gestante.
 *
 * A gestação é o motivo mais comum de o histórico envelhecer, mas não é o
 * único: o pós-parto (a promessa "volta depois do parto" não pode voltar
 * projetando o período de antes da gravidez) e quem simplesmente parou de
 * registrar caem na mesma régua. Uma bandeira de "gestante" sozinha deixaria
 * os outros dois de fora.
 *
 * 90 dias é o teto do modelo (45) vezes dois: dois ciclos inteiros sem
 * registro, e a projeção passa a ser chute.
 */
export const PREVISAO_VALE_ATE_DIAS = 90;

export function previsaoAindaVale(lastStart: Date, today: Date): boolean {
  const dias = Math.floor(
    (startOfDay(today).getTime() - startOfDay(lastStart).getTime()) / 86400000,
  );
  return dias >= 0 && dias <= PREVISAO_VALE_ATE_DIAS;
}

export function cycleLengthDays(cycle: MenstrualCycle): number | null {
  if (!cycle.end_date) return null;
  const start = new Date(cycle.start_date + "T00:00:00");
  const end = new Date(cycle.end_date + "T00:00:00");
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}
