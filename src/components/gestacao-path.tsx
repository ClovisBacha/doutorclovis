import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { babyForWeek, consultaForWeek } from "@/lib/gestacao";

type Gest = { weeks: number; days: number; totalDays: number } | null;

interface GestacaoPathProps {
  profile: { baby_name: string | null } | null;
  gest: Gest;
}

/* ══════════════════════════ FASES (7 semanas cada) ══════════════════════════ */

const PHASES = [
  { n: 1, from: 1, to: 7, emoji: "🌱", name: "Primeiros passos" },
  { n: 2, from: 8, to: 14, emoji: "💗", name: "Coração e forma" },
  { n: 3, from: 15, to: 21, emoji: "🦋", name: "Primeiros chutes" },
  { n: 4, from: 22, to: 28, emoji: "🌈", name: "Crescendo forte" },
  { n: 5, from: 29, to: 35, emoji: "🌙", name: "Reta final" },
  { n: 6, from: 36, to: 40, emoji: "🎉", name: "Chegada" },
];

/** Fase bônus pós-data: só existe para quem passa da semana 40 sem o bebê nascer. */
const BONUS_PHASE = { n: 7, from: 41, to: 42, emoji: "⏳", name: "Bônus: quase lá" };

/** Fases do 4º trimestre (após o nascimento). */
const PHASES_POS = [
  { n: 1, from: 1, to: 4, emoji: "🍼", name: "Chegando em casa" },
  { n: 2, from: 5, to: 8, emoji: "🌙", name: "Criando ritmo" },
  { n: 3, from: 9, to: 12, emoji: "🧸", name: "Descobertas" },
];

type Phase = (typeof PHASES)[number];

function phaseOfWeek(phases: Phase[], week: number) {
  return phases.find((p) => week >= p.from && week <= p.to) ?? phases[phases.length - 1];
}

const MILESTONES: Record<number, { emoji: string; label: string }> = {
  4: { emoji: "🌱", label: "Início da jornada" },
  8: { emoji: "💗", label: "Coração batendo" },
  12: { emoji: "✨", label: "Translucência nucal" },
  16: { emoji: "🫐", label: "Sente a luz" },
  20: { emoji: "🎶", label: "Ultrassom morfológico" },
  24: { emoji: "🏥", label: "Viabilidade fetal" },
  28: { emoji: "💜", label: "3º Trimestre!" },
  32: { emoji: "🌟", label: "Scan de crescimento" },
  36: { emoji: "🏠", label: "Quase em casa" },
  40: { emoji: "🎊", label: "Data prevista do parto!" },
  41: { emoji: "⏳", label: "Pós-data — monitoramento próximo" },
  42: { emoji: "🏥", label: "Avaliação para indução" },
};

/** Figurinha (emoji da fruta) de cada semana gestacional — colecionável no álbum. */
const FRUIT_EMOJI: Record<number, string> = {
  1: "✨",
  2: "✨",
  3: "✨",
  4: "🌾",
  5: "🌱",
  6: "🫘",
  7: "🫐",
  8: "🍓",
  9: "🍇",
  10: "🍓",
  11: "🍐",
  12: "🍋",
  13: "🫛",
  14: "🍋",
  15: "🍎",
  16: "🥑",
  17: "🧅",
  18: "🫑",
  19: "🍅",
  20: "🍌",
  21: "🥕",
  22: "🌽",
  23: "🥭",
  24: "🌽",
  25: "🥦",
  26: "🥬",
  27: "🍆",
  28: "🎃",
  29: "🥬",
  30: "🥒",
  31: "🥥",
  32: "🥬",
  33: "🍍",
  34: "🍈",
  35: "🍈",
  36: "🍈",
  37: "🥬",
  38: "🧅",
  39: "🍉",
  40: "🎃",
  41: "🍈",
  42: "🎃",
};

/** Figurinhas do 4º trimestre (semanas de vida do bebê). */
const POS_EMOJI: Record<number, string> = {
  1: "🤱",
  2: "🍼",
  3: "👶",
  4: "💜",
  5: "🌙",
  6: "😊",
  7: "🎈",
  8: "🧸",
  9: "🪁",
  10: "🌷",
  11: "🎵",
  12: "🎓",
};

/* ══════════════════════ DESAFIOS DIÁRIOS ══════════════════════ */

type Challenge = { id: string; label: string; emoji: string };

const CHALLENGES_T1: Challenge[] = [
  { id: "agua", label: "Beber 8 copos de água hoje", emoji: "💧" },
  { id: "folico", label: "Tomar o ácido fólico", emoji: "💊" },
  { id: "descanso", label: "Tirar 20 minutos só para descansar", emoji: "😴" },
  { id: "fruta", label: "Comer uma fruta rica em vitamina C", emoji: "🍊" },
  { id: "caminhada", label: "Caminhar 15 minutos em ritmo leve", emoji: "🚶‍♀️" },
  { id: "diario", label: "Escrever uma linha no seu Diário", emoji: "📖" },
  { id: "respiracao", label: "Fazer a respiração guiada (Meditações)", emoji: "🧘‍♀️" },
];

const CHALLENGES_T2: Challenge[] = [
  { id: "agua", label: "Beber 8 copos de água hoje", emoji: "💧" },
  { id: "conversa", label: "Conversar com o bebê por 2 minutos", emoji: "💬" },
  { id: "barriga", label: "Tirar uma foto da barriga para o Álbum", emoji: "📸" },
  { id: "caminhada", label: "Caminhar 20 minutos", emoji: "🚶‍♀️" },
  { id: "musica", label: "Colocar uma música para o bebê ouvir", emoji: "🎶" },
  { id: "peso", label: "Registrar seu peso na aba Saúde", emoji: "⚖️" },
  { id: "diario", label: "Escrever uma linha no seu Diário", emoji: "📖" },
  { id: "respiracao", label: "Fazer a respiração guiada (Meditações)", emoji: "🧘‍♀️" },
];

const CHALLENGES_T3: Challenge[] = [
  { id: "chutes", label: "Contar os chutes do bebê (aba Chutes)", emoji: "🦶" },
  { id: "agua", label: "Beber 8 copos de água hoje", emoji: "💧" },
  { id: "mala", label: "Separar 1 item da mala da maternidade", emoji: "🧳" },
  { id: "caminhada", label: "Caminhar 20 minutos em ritmo leve", emoji: "🚶‍♀️" },
  { id: "conversa", label: "Conversar com o bebê — ele já ouve você", emoji: "💬" },
  { id: "peso", label: "Registrar seu peso na aba Saúde", emoji: "⚖️" },
  { id: "respiracao", label: "Treinar a respiração para o parto", emoji: "🧘‍♀️" },
  { id: "nomes", label: "Adicionar um nome à votação da família", emoji: "✨" },
];

/** Pós-data (41–42s): desafios com relevância clínica direta. */
const CHALLENGES_POSDATA: Challenge[] = [
  { id: "movimentos", label: "Contar os movimentos do bebê (aba Chutes)", emoji: "🦶" },
  { id: "contracoes", label: "Monitorar contrações na aba Contrações", emoji: "⏱️" },
  { id: "caminhada", label: "Caminhar 20 minutos em ritmo leve", emoji: "🚶‍♀️" },
  { id: "agua", label: "Beber 8 copos de água hoje", emoji: "💧" },
  { id: "descanso", label: "Descansar — guarde energia para o grande dia", emoji: "😴" },
  { id: "sinais", label: "Revisar os sinais de alerta (aba Alertas)", emoji: "🚨" },
];

/** 4º trimestre por fase. */
const CHALLENGES_POS_1: Challenge[] = [
  { id: "amamentar", label: "Registrar uma mamada (aba Pós-parto)", emoji: "🤱" },
  { id: "agua", label: "Beber água a cada mamada", emoji: "💧" },
  { id: "dormir", label: "Dormir quando o bebê dormir", emoji: "😴" },
  { id: "foto", label: "Tirar uma foto do bebê para o Álbum", emoji: "📸" },
  { id: "emocional", label: "Fazer o check-in emocional (aba Pós-parto)", emoji: "💜" },
  { id: "diario", label: "Escrever uma memória no Diário", emoji: "📖" },
];

const CHALLENGES_POS_2: Challenge[] = [
  { id: "vacinas", label: "Conferir as vacinas do bebê (aba Pós-parto)", emoji: "💉" },
  { id: "marco", label: "Registrar um marco do bebê (aba Pós-parto)", emoji: "👶" },
  { id: "musica", label: "Cantar ou conversar com o bebê", emoji: "🎶" },
  { id: "caminhada", label: "Caminhar 15 minutos com o bebê", emoji: "🚶‍♀️" },
  { id: "emocional", label: "Fazer o check-in emocional (aba Pós-parto)", emoji: "💜" },
  { id: "pesobebe", label: "Registrar o peso do bebê (aba Pós-parto)", emoji: "⚖️" },
];

const CHALLENGES_POS_3: Challenge[] = [
  { id: "brucos", label: "Brincar de bruços com o bebê (tummy time)", emoji: "🧸" },
  { id: "marco", label: "Registrar um marco do bebê (aba Pós-parto)", emoji: "👶" },
  { id: "autocuidado", label: "20 minutos só para você", emoji: "💅" },
  { id: "caminhada", label: "Caminhar 20 minutos com o bebê", emoji: "🚶‍♀️" },
  { id: "vacinas", label: "Conferir as vacinas do bebê (aba Pós-parto)", emoji: "💉" },
  { id: "diario", label: "Escrever uma memória no Diário", emoji: "📖" },
];

/** Desafio determinístico do dia gestacional D (mesmo dia = mesmo desafio). */
function challengeForDay(D: number): Challenge {
  const week = Math.floor(D / 7);
  const pool =
    week >= 41
      ? CHALLENGES_POSDATA
      : week <= 13
        ? CHALLENGES_T1
        : week <= 27
          ? CHALLENGES_T2
          : CHALLENGES_T3;
  return pool[D % pool.length];
}

/** Desafio determinístico do dia pós-parto (D em pseudo-dias, semana 1–12). */
function challengeForPosDay(D: number): Challenge {
  const week = Math.floor(D / 7);
  const pool = week <= 4 ? CHALLENGES_POS_1 : week <= 8 ? CHALLENGES_POS_2 : CHALLENGES_POS_3;
  return pool[D % pool.length];
}

/* ══════════════════════ ORIENTAÇÕES MÉDICAS ══════════════════════ */

const POSDATA_GUIDANCE =
  "Pós-data: consultas 2x por semana com cardiotocografia e avaliação do líquido amniótico. " +
  "Converse com o Dr. Clóvis sobre o planejamento da indução. Conte os movimentos do bebê " +
  "todos os dias — se diminuírem, vá direto à maternidade.";

const POS_GUIDANCE: Record<number, string> = {
  1: "Descanso e amamentação em livre demanda. Teste do pezinho entre o 3º e o 5º dia. Agende a revisão pós-parto (7–10 dias).",
  2: "Atenção aos sinais de alerta: febre, sangramento intenso, dor forte ou tristeza persistente. Se a amamentação doer, procure ajuda com a pega.",
  3: "Baby blues costuma passar até aqui. Se a tristeza persistir ou piorar, faça o check-in emocional e fale com o Dr. Clóvis — você não está sozinha.",
  4: "Agende a consulta puerperal completa (30–40 dias): revisão geral, contracepção e liberação de atividades.",
  5: "As vacinas de 2 meses do bebê estão chegando — deixe agendadas (penta, VIP, pneumo 10, rotavírus).",
  6: "Consulta puerperal em dia? É nela que se libera exercício físico e se define contracepção. Cuide também do seu sono.",
  7: "Crie pequenos rituais de rotina para o bebê: banho, mamada, soneca. A previsibilidade acalma vocês dois.",
  8: "Semana das vacinas de 2 meses. Febre baixa e irritação no dia seguinte podem acontecer — mantenha o bebê hidratado.",
  9: "Se liberada na consulta puerperal, retome exercícios leves de forma gradual. Assoalho pélvico primeiro.",
  10: "Autocuidado não é luxo: reserve um tempo seu por dia. Mãe cuidada cuida melhor.",
  11: "Marcos esperados: sorriso social e mais firmeza no pescoço. Cada bebê tem seu ritmo — registre os do seu.",
  12: "Fim do 4º trimestre! Vacina de meningo C aos 3 meses. Parabéns por chegar até aqui — jornada completa. 🎓",
};

const MOODS = [
  { emoji: "😄", label: "Ótima" },
  { emoji: "🙂", label: "Bem" },
  { emoji: "😐", label: "Normal" },
  { emoji: "😔", label: "Cansada" },
  { emoji: "🤢", label: "Enjoada" },
];

/* ══════════════════════ Persistência local (v1) ══════════════════════ */

const LS = {
  stickers: "dc-path-stickers",
  posStickers: "dc-path-pos-stickers",
  checkin: "dc-path-checkin",
  journeyStart: "dc-path-journey-start",
  doneDays: "dc-path-done-days",
  posDoneDays: "dc-path-pos-done-days",
  dayTasks: (d: number) => `dc-path-day-${d}`,
  posDayTasks: (d: number) => `dc-path-pos-day-${d}`,
  welcomed: "dc-path-welcomed",
  birth: "dc-path-birth",
  celebrated: "dc-path-birth-celebrated",
};

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota/privado */
  }
}

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Checkin = { last: string; streak: number; mood?: string };
type JourneyStart = { date: string; gestDay: number };
type Birth = { date: string };

/* ══════════════════════ Cores por trimestre/fase ══════════════════════ */

function trimMeta(week: number) {
  if (week <= 13)
    return { main: "#ec4899", lip: "#be185d", banner: "bg-pink-500", softText: "text-pink-400" };
  if (week <= 27)
    return { main: "#f59e0b", lip: "#b45309", banner: "bg-amber-500", softText: "text-amber-500" };
  if (week <= 40)
    return {
      main: "#8b5cf6",
      lip: "#6d28d9",
      banner: "bg-violet-500",
      softText: "text-violet-400",
    };
  // Pós-data: tom âmbar quente, sem alarme
  return { main: "#f59e0b", lip: "#b45309", banner: "bg-amber-500", softText: "text-amber-500" };
}

function posMeta(week: number) {
  if (week <= 4)
    return { main: "#38bdf8", lip: "#0369a1", banner: "bg-sky-500", softText: "text-sky-400" };
  if (week <= 8)
    return {
      main: "#8b5cf6",
      lip: "#6d28d9",
      banner: "bg-violet-500",
      softText: "text-violet-400",
    };
  return {
    main: "#34d399",
    lip: "#047857",
    banner: "bg-emerald-500",
    softText: "text-emerald-500",
  };
}

// Lábios bem mais escuros que o corpo: a moeda 3D precisa ler como moeda mesmo cinza
const LOCKED = { main: "#dde5ee", lip: "#9fb0c4" };
const MISSED = { main: "#fbd3e8", lip: "#ef9fca" };

const CONFETTI_COLORS = ["#ec4899", "#f59e0b", "#8b5cf6", "#38bdf8", "#34d399", "#fbbf24"];

function ConfettiBurst({ big = false }: { big?: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: big ? 60 : 26 }, (_, i) => ({
        left: 4 + ((i * 37) % 92),
        delay: (i % 12) * 70,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: (i * 47) % 360,
        size: 6 + (i % 3) * 3,
      })),
    [big],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="dc-confetti absolute"
          style={{
            left: `${p.left}%`,
            top: "-4%",
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            background: p.color,
            transform: `rotate(${p.rot}deg)`,
            animationDelay: `${p.delay}ms`,
            borderRadius: "2px",
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════ Layout do caminho ══════════════════════ */

const DAY_ROW = 84;
const ALBUM_ROW = 116;
const WEEK_HEADER = 44;

type PathNode =
  | { kind: "week-header"; week: number; y: number }
  | { kind: "day"; D: number; week: number; y: number; x: number; row: number }
  | { kind: "album-week"; week: number; y: number; x: number; row: number };

/** Monta os nós da fase: semanas pré-jornada viram nó-álbum; as demais, 7 dias. */
function buildPhaseNodes(
  phase: Phase,
  journeyStartD: number,
): { nodes: PathNode[]; height: number } {
  const nodes: PathNode[] = [];
  let y = 30;
  let row = 0;
  const xOf = (r: number) => 50 + 27 * Math.sin((r * Math.PI) / 4);

  for (let w = phase.from; w <= phase.to; w++) {
    const weekStartD = w * 7;
    const weekEndD = w * 7 + 6;
    if (weekEndD < journeyStartD) {
      nodes.push({ kind: "album-week", week: w, y: y + ALBUM_ROW / 2, x: xOf(row), row });
      y += ALBUM_ROW;
      row++;
    } else {
      nodes.push({ kind: "week-header", week: w, y });
      y += WEEK_HEADER;
      for (let D = Math.max(weekStartD, journeyStartD); D <= weekEndD; D++) {
        nodes.push({ kind: "day", D, week: w, y: y + DAY_ROW / 2, x: xOf(row), row });
        y += DAY_ROW;
        row++;
      }
    }
  }
  return { nodes, height: y + 40 };
}

/* ── Caminho contínuo estilo Duolingo: todas as fases numa página só ── */

const IDAY_ROW = 104;
const IALBUM_ROW = 112;
const IWEEK_HEADER = 72; // folga para o balão "Desafio de hoje" não cobrir o pill da semana
const IBANNER_ROW = 120;

type JourneyNode =
  | PathNode
  | { kind: "phase-banner"; phase: Phase; y: number }
  | { kind: "mascot"; emoji: string; y: number; x: number };

const MASCOTS = ["🧸", "🦢", "🌷", "🍼", "🐘", "🌈", "🐥", "🧦"];

/** Uma página só: banners de seção entre as fases, dias grandes, mascotes ao lado. */
function buildFullJourney(
  phases: Phase[],
  journeyStartD: number,
): { nodes: JourneyNode[]; height: number } {
  const nodes: JourneyNode[] = [];
  let y = 8;
  let row = 0;
  let mascotIdx = 0;
  const xOf = (r: number) => 50 + 26 * Math.sin((r * Math.PI) / 4);

  // Mascote grande ao lado do caminho (Duolingo), do lado oposto ao nó da linha
  const maybeMascot = (x: number, rowY: number, rowH: number) => {
    if (row % 5 !== 2) return;
    nodes.push({
      kind: "mascot",
      emoji: MASCOTS[mascotIdx++ % MASCOTS.length],
      y: rowY + rowH / 2,
      x: x < 50 ? Math.min(x + 44, 82) : Math.max(x - 44, 18),
    });
  };

  for (const p of phases) {
    nodes.push({ kind: "phase-banner", phase: p, y });
    y += IBANNER_ROW;
    for (let w = p.from; w <= p.to; w++) {
      const weekStartD = w * 7;
      const weekEndD = w * 7 + 6;
      if (weekEndD < journeyStartD) {
        const x = xOf(row);
        nodes.push({ kind: "album-week", week: w, y: y + IALBUM_ROW / 2, x, row });
        maybeMascot(x, y, IALBUM_ROW);
        y += IALBUM_ROW;
        row++;
      } else {
        nodes.push({ kind: "week-header", week: w, y });
        y += IWEEK_HEADER;
        for (let D = Math.max(weekStartD, journeyStartD); D <= weekEndD; D++) {
          const x = xOf(row);
          nodes.push({ kind: "day", D, week: w, y: y + IDAY_ROW / 2, x, row });
          maybeMascot(x, y, IDAY_ROW);
          y += IDAY_ROW;
          row++;
        }
      }
    }
  }
  return { nodes, height: y + 40 };
}

/* ── Anel de progresso segmentado (Duolingo): 3 segmentos = 3 tarefas do dia ── */

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function TaskRing({ done, color }: { done: number; color: string }) {
  // 3 segmentos de 104° com folgas de 16°, começando no topo
  const segs = [0, 1, 2].map((i) => {
    const start = i * 120 + 8;
    return arcPath(50, 50, 46, start, start + 104);
  });
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute -inset-[9px] h-[calc(100%+18px)] w-[calc(100%+18px)]"
      aria-hidden
    >
      {segs.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={i < done ? color : "oklch(0.91 0.01 40)"}
          strokeWidth="7"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/* ── Pezinhos de bebê no trecho já percorrido ──
   Entre duas moedas consecutivas COMPLETADAS, uma trilha de pegadas
   minúsculas alternando pé esquerdo/direito, rotacionadas na direção
   da caminhada — como se o bebê tivesse passado ali. */

type Footstep = {
  x: number; // left em %
  y: number; // top em px
  angle: number; // direção da caminhada em graus
  left: boolean; // pé esquerdo (espelhado)
  delay: number; // ms — os passos "acontecem" em sequência
  color: string;
};

function BabyFootprint({ color }: { color: string }) {
  // Pezinho como a referência: planta em gota + dedão interno + 4 dedinhos
  return (
    <svg viewBox="0 0 20 28" className="h-[13px] w-auto" aria-hidden>
      <ellipse cx="10.5" cy="18" rx="6.5" ry="8.6" fill={color} />
      <ellipse cx="9" cy="15" rx="4" ry="5" fill="rgba(255,255,255,0.28)" />
      <circle cx="16" cy="7.6" r="3" fill={color} />
      <circle cx="10.6" cy="5.4" r="2.2" fill={color} />
      <circle cx="6.2" cy="6" r="1.9" fill={color} />
      <circle cx="2.6" cy="7.8" r="1.6" fill={color} />
    </svg>
  );
}

/** Gera as pegadas entre pares consecutivos de nós já percorridos. */
function buildFootsteps(nodes: JourneyNode[], doneDays: number[], pathWidthPx: number): Footstep[] {
  const walkable = nodes.filter(
    (n): n is Extract<JourneyNode, { kind: "day" | "album-week" }> =>
      n.kind === "day" || n.kind === "album-week",
  );
  const walked = (n: (typeof walkable)[number]) =>
    n.kind === "album-week" || doneDays.includes(n.D);

  const steps: Footstep[] = [];
  for (let i = 0; i < walkable.length - 1; i++) {
    const a = walkable[i];
    const b = walkable[i + 1];
    // Só linhas adjacentes (sem cruzar pill de semana ou banner de fase)
    if (b.y - a.y > 118) continue;
    if (!walked(a) || !walked(b)) continue;

    const dxPx = ((b.x - a.x) / 100) * pathWidthPx;
    const dyPx = b.y - a.y;
    const len = Math.hypot(dxPx, dyPx);
    if (len < 60) continue;
    const angle = (Math.atan2(dyPx, dxPx) * 180) / Math.PI + 90;
    // perpendicular unitária (para afastar pé esquerdo/direito da linha)
    const px = -dyPx / len;
    const py = dxPx / len;
    const week = a.kind === "day" ? a.week : a.kind === "album-week" ? a.week : 20;
    const color = `color-mix(in oklab, ${trimMeta(week).main} 52%, white)`;

    // 4 passos entre as bordas das moedas (raio ~34px de folga)
    const t0 = Math.min(0.42, 40 / len);
    const t1 = 1 - t0;
    const count = 4;
    for (let s = 0; s < count; s++) {
      const t = t0 + ((t1 - t0) * s) / (count - 1);
      const side = s % 2 === 0 ? 1 : -1;
      steps.push({
        x: a.x + (b.x - a.x) * t + ((px * side * 7) / pathWidthPx) * 100,
        y: a.y + dyPx * t + py * side * 7,
        angle,
        left: side === 1,
        delay: s * 140,
        color,
      });
    }
  }
  return steps;
}

/* ══════════════════════════════ Componente ══════════════════════════════ */

export function GestacaoPath({ profile, gest }: GestacaoPathProps) {
  const hasGest = !!gest;
  // Dia gestacional de hoje (0-based desde a DUM), até a semana 42 (D=300)
  const rawD = hasGest ? gest.totalDays : 0;
  const todayD = hasGest ? Math.max(7, Math.min(300, rawD)) : 0;
  const currentWeek = hasGest ? Math.max(1, Math.min(42, Math.floor(todayD / 7))) : 0;
  const isPostDate = hasGest && rawD > 286; // passou da semana 40
  const isBeyond42 = hasGest && rawD > 300; // passou da semana 42

  const [sheet, setSheet] = useState<
    { kind: "day"; D: number } | { kind: "album"; week: number } | null
  >(null);
  const [revealing, setRevealing] = useState(false);

  const [journeyStart, setJourneyStart] = useState<JourneyStart | null>(null);
  const [stickers, setStickers] = useState<number[]>([]);
  const [doneDays, setDoneDays] = useState<number[]>([]);
  const [checkin, setCheckin] = useState<Checkin>({ last: "", streak: 0 });
  const [dayTasks, setDayTasks] = useState<Record<string, boolean>>({});
  // Estado dedicado do dia de HOJE: alimenta o anel segmentado sem vazar o
  // estado de outros dias abertos no sheet (dayTasks muda a cada openDay)
  const [todayTasks, setTodayTasks] = useState<Record<string, boolean>>({});
  const [showWelcome, setShowWelcome] = useState(false);

  // Lazy init: evita flash da tela errada no primeiro render (rota é ssr:false)
  const [birth, setBirth] = useState<Birth | null>(() => lsGet<Birth | null>(LS.birth, null));
  const [celebrated, setCelebrated] = useState(() => lsGet<boolean>(LS.celebrated, false));
  const [birthDateInput, setBirthDateInput] = useState(localDateStr());
  const [showBirthForm, setShowBirthForm] = useState(false);
  const [albumOpen, setAlbumOpen] = useState(false);

  /* ── Fases visíveis: bônus pós-data só aparece para quem precisa ── */
  const phases = useMemo<Phase[]>(
    () => (isPostDate ? [...PHASES, BONUS_PHASE] : PHASES),
    [isPostDate],
  );

  /* ── Carregamento + começo inteligente ── */
  useEffect(() => {
    if (!hasGest) return;
    setStickers(lsGet<number[]>(LS.stickers, []));
    setDoneDays(lsGet<number[]>(LS.doneDays, []));
    setCheckin(lsGet<Checkin>(LS.checkin, { last: "", streak: 0 }));
    setBirth(lsGet<Birth | null>(LS.birth, null));
    setCelebrated(lsGet<boolean>(LS.celebrated, false));

    let js = lsGet<JourneyStart | null>(LS.journeyStart, null);
    if (!js) {
      js = { date: localDateStr(), gestDay: todayD };
      lsSet(LS.journeyStart, js);
      if (todayD > 14 && !lsGet(LS.welcomed, false)) {
        setShowWelcome(true);
        lsSet(LS.welcomed, true);
      }
    }
    setJourneyStart(js);
    // Hidrata o anel de hoje do localStorage (senão só preenche ao abrir o sheet)
    setTodayTasks(lsGet<Record<string, boolean>>(LS.dayTasks(todayD), {}));
  }, [hasGest, todayD]);

  const journeyStartD = journeyStart?.gestDay ?? todayD;

  const streak = useMemo(() => {
    if (!hasGest || doneDays.length === 0) return 0;
    const set = new Set(doneDays);
    let s = 0;
    let d = set.has(todayD) ? todayD : todayD - 1;
    while (set.has(d)) {
      s++;
      d--;
    }
    return s;
  }, [doneDays, todayD, hasGest]);

  // Caminho contínuo: todas as fases numa página só, como o Duolingo
  const { nodes, height } = useMemo(
    () => buildFullJourney(phases, journeyStartD),
    [phases, journeyStartD],
  );

  // Largura real do caminho (px) — necessária para ângulo/afastamento das pegadas,
  // já que os nós posicionam left em % e top em px
  const pathRef = useRef<HTMLDivElement>(null);
  const [pathW, setPathW] = useState(390);
  useEffect(() => {
    const measure = () => setPathW(pathRef.current?.clientWidth || 390);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const footsteps = useMemo(() => buildFootsteps(nodes, doneDays, pathW), [nodes, doneDays, pathW]);

  // Centraliza o nó de HOJE na tela ao abrir (scroll da própria página)
  useEffect(() => {
    if (!hasGest || birth) return;
    const t = setTimeout(() => {
      document
        .getElementById("dc-today-node")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 450);
    return () => clearTimeout(t);
  }, [hasGest, birth, todayD]);

  const checkedToday = checkin.last === localDateStr();

  function doCheckin(mood: string) {
    if (checkedToday) return;
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    const s = checkin.last === yesterday ? checkin.streak + 1 : 1;
    const next = { last: localDateStr(), streak: s, mood };
    setCheckin(next);
    lsSet(LS.checkin, next);
    // Após o nascimento, o humor pertence ao dia PÓS-PARTO — não gravar na gestação
    if (!birth) markDayTask(todayD, "humor", true);
  }

  function dayTaskState(D: number): Record<string, boolean> {
    return lsGet<Record<string, boolean>>(LS.dayTasks(D), {});
  }

  function markDayTask(D: number, id: string, value: boolean) {
    const state = { ...dayTaskState(D), [id]: value };
    lsSet(LS.dayTasks(D), state);
    if (sheet?.kind === "day" && sheet.D === D) setDayTasks(state);
    if (D === todayD) setTodayTasks(state);
    const allDone = state.humor && state.desafio && state.leitura;
    if (allDone && !doneDays.includes(D)) {
      const next = [...doneDays, D];
      setDoneDays(next);
      lsSet(LS.doneDays, next);
      setRevealing(true);
      setTimeout(() => setRevealing(false), 1800);
      collectSticker(Math.floor(D / 7), false);
      toast.success(`🎉 Dia ${D - journeyStartD + 1} da jornada completo!`);
    }
  }

  function collectSticker(week: number, announce = true) {
    if (stickers.includes(week)) return;
    const next = [...stickers, week];
    setStickers(next);
    lsSet(LS.stickers, next);
    const baby = babyForWeek(week);
    if (announce) {
      setRevealing(true);
      setTimeout(() => setRevealing(false), 1800);
    }
    toast.success(`${FRUIT_EMOJI[week] ?? "🍼"} Figurinha coletada: ${baby.fruit}!`);
  }

  function openDay(D: number) {
    setDayTasks(dayTaskState(D));
    setSheet({ kind: "day", D });
    if (D === todayD) {
      setTimeout(() => markDayTask(D, "leitura", true), 600);
    }
  }

  function openAlbum(week: number) {
    setSheet({ kind: "album", week });
    if (week <= currentWeek) collectSticker(week);
  }

  // Piso de 300 dias: cobre qualquer parto real mesmo para quem só abre o app
  // meses depois do nascimento (a única saída da jornada não pode ficar travada).
  const birthMinDate = localDateStr(new Date(Date.now() - 300 * 86400000));

  function declareBirth() {
    const today = localDateStr();
    if (!birthDateInput) {
      toast.error("Informe a data do nascimento.");
      return;
    }
    if (birthDateInput > today) {
      toast.error("A data do nascimento não pode ser no futuro.");
      return;
    }
    if (birthDateInput < birthMinDate) {
      toast.error("Data muito antiga — confira o dia do nascimento.");
      return;
    }
    const b = { date: birthDateInput };
    setBirth(b);
    lsSet(LS.birth, b);
    setCelebrated(false);
    lsSet(LS.celebrated, false);
    setShowBirthForm(false);
  }

  async function share(week: number) {
    const baby = babyForWeek(week);
    const name = profile?.baby_name || "Meu bebê";
    const text = `🤰 Semana ${week}: ${name} está do tamanho de ${baby.fruit.toLowerCase()}! ${FRUIT_EMOJI[week] ?? ""}\n📏 ${baby.size} · ⚖️ ${baby.weight}\n\nAcompanhamento pré-natal com Dr. Clóvis Bacha 🩺`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Texto copiado! Cole no WhatsApp 💬");
      }
    } catch {
      /* cancelado */
    }
  }

  if (!hasGest) {
    return (
      <div className="glass-card glass-pink rounded-3xl p-10 text-center">
        <p className="text-5xl mb-4">🗺️</p>
        <p className="text-xl font-bold text-pink-700">Sua jornada começa aqui</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure a data da última menstruação em <strong>Perfil</strong> para ver o caminho das
          40 semanas.
        </p>
      </div>
    );
  }

  const babyLabel = profile?.baby_name || "seu bebê";

  const styleBlock = (
    <style>{`
      @keyframes dcConfettiFall {
        0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(75vh) rotate(540deg); opacity: 0; }
      }
      .dc-confetti { animation: dcConfettiFall 1.6s ease-in both; }
      @keyframes dcChestPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.12);} }
      .dc-chest { animation: dcChestPulse 1.1s ease-in-out infinite; }
      @keyframes dcHaloPulse { 0%,100%{opacity:0.35;} 50%{opacity:1;} }
      .dc-halo { animation: dcHaloPulse 1.8s ease-in-out infinite; }
      @keyframes dcStep {
        from { opacity: 0; transform: scale(0.4); }
        to { opacity: 1; transform: scale(1); }
      }
      .dc-step { animation: dcStep 420ms var(--ease-spring) backwards; }
      @keyframes dcStickerPop {
        0% { transform: scale(0) rotate(-12deg); }
        70% { transform: scale(1.25) rotate(4deg); }
        100% { transform: scale(1) rotate(0); }
      }
      .dc-sticker-pop { animation: dcStickerPop 700ms cubic-bezier(0.34,1.56,0.64,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .dc-confetti, .dc-chest, .dc-sticker-pop, .dc-halo, .dc-step { animation: none; }
      }
    `}</style>
  );

  /* ══════════ PONTO 2 · Celebração do nascimento (uma vez) ══════════ */
  if (birth && !celebrated) {
    const totalDone = doneDays.length;
    return (
      <div className="relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl bg-white/80 p-8 text-center backdrop-blur-sm">
        {styleBlock}
        <ConfettiBurst big />
        <p className="text-6xl">🎉</p>
        <div>
          <p className="text-2xl font-extrabold">{babyLabel} chegou!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Parabéns, mamãe. Vocês completaram a maior jornada que existe.
          </p>
        </div>
        <div
          className="duo3d flex h-24 w-24 items-center justify-center rounded-full text-5xl"
          style={{ background: "#fbbf24", "--lip": "#b45309" } as React.CSSProperties}
        >
          🏆
        </div>
        <div className="rounded-2xl bg-amber-50 px-5 py-3">
          <p className="text-sm font-extrabold text-amber-700">Jornada da Gestação completa</p>
          <p className="mt-0.5 text-xs text-amber-600">
            {totalDone} {totalDone === 1 ? "desafio completo" : "desafios completos"} ·{" "}
            {stickers.length} figurinhas colecionadas
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Seu álbum da gestação fica guardado para sempre 💝
        </p>
        <button
          onClick={() => {
            setCelebrated(true);
            lsSet(LS.celebrated, true);
          }}
          className="press rounded-full bg-sky-500 px-6 py-3 text-sm font-extrabold text-white shadow-md"
        >
          Começar o 4º trimestre 🍼
        </button>
      </div>
    );
  }

  /* ══════════ PONTO 2 · Jornada do 4º trimestre ══════════ */
  if (birth && celebrated) {
    return (
      <PosPartoJourney
        babyLabel={babyLabel}
        birth={birth}
        checkedToday={checkedToday}
        doCheckin={doCheckin}
        gestStickers={stickers}
        albumOpen={albumOpen}
        setAlbumOpen={setAlbumOpen}
        openGestAlbum={(w) => setSheet({ kind: "album", week: w })}
        sheet={sheet}
        setSheet={setSheet}
        revealing={revealing}
        setRevealing={setRevealing}
        styleBlock={styleBlock}
        shareGest={share}
      />
    );
  }

  /* ══════════ PONTO 3 · Semana 43+: o app se cala e manda para o médico ══════════ */
  if (isBeyond42) {
    return (
      <div className="flex flex-col gap-4">
        {styleBlock}
        <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Acompanhamento necessário
          </p>
          <p className="mt-2 text-lg font-bold text-amber-900">Sua gestação passou de 42 semanas</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            Entre em contato com o consultório do Dr. Clóvis <strong>hoje</strong> para avaliação do
            bem-estar do bebê e decisão sobre o parto. Se notar diminuição dos movimentos, perda de
            líquido ou sangramento, vá direto à maternidade.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/agendamento"
              className="press rounded-full bg-amber-600 px-5 py-2.5 text-sm font-bold text-white"
            >
              Falar com o consultório
            </a>
            <a
              href="tel:192"
              className="press rounded-full border-2 border-amber-600 px-5 py-2.5 text-sm font-bold text-amber-700"
            >
              Emergência: 192
            </a>
          </div>
        </div>

        {/* A única ação de jornada disponível: declarar o nascimento */}
        <div className="rounded-3xl bg-white/80 p-5 backdrop-blur-sm">
          <p className="text-sm font-bold">{babyLabel} já nasceu? 🎉</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Informe a data para celebrar e começar a jornada do 4º trimestre.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="date"
              value={birthDateInput}
              max={localDateStr()}
              onChange={(e) => setBirthDateInput(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
            />
            <button
              onClick={declareBirth}
              className="press rounded-full bg-pink-500 px-4 py-2 text-sm font-bold text-white"
            >
              Nasceu! 🎉
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ══════════ Jornada da gestação (com PONTO 1 embutido) ══════════ */
  const meta = trimMeta(currentWeek);
  const journeyDayNum = todayD - journeyStartD + 1;

  return (
    <div className="flex flex-col gap-4">
      {styleBlock}

      {showWelcome && (
        <div className="glass-card glass-pink rounded-3xl p-5">
          <p className="text-2xl">👋💜</p>
          <p className="mt-1 font-bold">Você chegou na semana {currentWeek} — e está tudo certo!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua jornada de desafios diários começa <strong>hoje</strong>. As {currentWeek - 1}{" "}
            semanas que você já viveu viraram seu <strong>álbum de memórias</strong>: toque nelas no
            caminho para colecionar as figurinhas do que {babyLabel} já conquistou.
          </p>
          <button
            onClick={() => setShowWelcome(false)}
            className="press mt-3 rounded-full bg-pink-500 px-4 py-1.5 text-sm font-bold text-white"
          >
            Começar a jornada 🚀
          </button>
        </div>
      )}

      {/* PONTO 1 · Banner pós-data: acolhedor + CTA médico forte */}
      {isPostDate && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-2xl">⏳💜</p>
          <p className="mt-1 font-bold text-amber-900">
            {babyLabel} escolheu ficar mais um pouquinho
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800">
            Isso é normal — acontece em 1 a cada 10 gestações. A partir de agora o acompanhamento
            fica mais próximo: consultas <strong>2x por semana</strong> com cardiotocografia, e a
            conversa sobre indução acontece com o Dr. Clóvis.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/agendamento"
              className="press rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white"
            >
              Agendar consulta
            </a>
          </div>
        </div>
      )}

      {/* PONTO 2 · Botão "nasceu" — disponível do termo (37s) em diante */}
      {currentWeek >= 37 && (
        <div className="rounded-2xl bg-white/80 p-4 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
          {!showBirthForm ? (
            <button
              onClick={() => setShowBirthForm(true)}
              className="press w-full rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 py-3 text-sm font-extrabold text-white"
            >
              🎉 {babyLabel} nasceu!
            </button>
          ) : (
            <div>
              <p className="text-sm font-bold">Que dia {babyLabel} chegou?</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="date"
                  value={birthDateInput}
                  max={localDateStr()}
                  onChange={(e) => setBirthDateInput(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
                />
                <button
                  onClick={declareBirth}
                  className="press rounded-full bg-pink-500 px-4 py-2 text-sm font-bold text-white"
                >
                  Confirmar 🎉
                </button>
                <button
                  onClick={() => setShowBirthForm(false)}
                  className="press rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats — faixa sólida fixa no topo (Duolingo): conteúdo passa por baixo limpo */}
      <div className="sticky top-0 z-30 -mx-5 flex items-center justify-around border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur-md md:mx-0 md:rounded-2xl md:border">
        <div className="flex items-center gap-1.5" title="Dias seguidos completando o desafio">
          <span className={`text-xl ${streak > 0 ? "" : "grayscale opacity-50"}`}>🔥</span>
          <span className="text-lg font-extrabold text-amber-500">{streak}</span>
          <span className="text-xs font-medium text-muted-foreground">
            {streak === 1 ? "dia" : "dias"}
          </span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5" title="Dia da sua jornada">
          <span className="text-xl">📅</span>
          <span className="text-lg font-extrabold text-sky-500">{journeyDayNum}º</span>
          <span className="text-xs font-medium text-muted-foreground">dia</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5" title="Figurinhas coletadas">
          <span className="text-xl">🏆</span>
          <span className="text-lg font-extrabold text-violet-500">{stickers.length}</span>
        </div>
      </div>

      {!checkedToday && (
        <div className="rounded-2xl bg-white/80 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)] backdrop-blur-sm">
          <p className="text-sm font-bold">Como você está hoje?</p>
          <p className="text-xs text-muted-foreground">1ª tarefa do desafio de hoje 🔥</p>
          <div className="mt-2.5 flex justify-between gap-1">
            {MOODS.map((m) => (
              <button
                key={m.label}
                onClick={() => doCheckin(m.label)}
                className="press flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-slate-50 py-2 hover:bg-pink-50"
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] font-medium text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Caminho contínuo em tela cheia (Duolingo-style) ──
          Sem caixa nem scroll interno: a página inteira É o caminho. */}
      <div ref={pathRef} className="relative -mx-5 md:mx-0" style={{ height: `${height}px` }}>
        {/* Pegadas do bebê no trecho já percorrido (atrás das moedas) */}
        {footsteps.map((f, i) => (
          <div
            key={`f${i}`}
            className="pointer-events-none absolute select-none"
            style={{
              left: `${f.x}%`,
              top: `${f.y}px`,
              transform: `translate(-50%,-50%) rotate(${f.angle}deg)${f.left ? " scaleX(-1)" : ""}`,
              filter: "drop-shadow(0 1.5px 1.5px rgba(0,0,0,0.20))",
            }}
            aria-hidden
          >
            <span className="dc-step inline-block" style={{ animationDelay: `${f.delay}ms` }}>
              <BabyFootprint color={f.color} />
            </span>
          </div>
        ))}

        {nodes.map((node) => {
          if (node.kind === "phase-banner") {
            const p = node.phase;
            const tm = trimMeta(p.from);
            const locked = p.from * 7 > todayD;
            return (
              <div
                key={`b${p.n}`}
                className="absolute inset-x-4 md:inset-x-0"
                style={{ top: `${node.y}px` }}
              >
                <div
                  className={`flex items-center justify-between rounded-2xl ${locked ? "bg-slate-300" : tm.banner} px-5 py-4 text-white`}
                  style={{
                    boxShadow: `0 4px 0 ${locked ? "#94a3b8" : tm.lip}, 0 10px 24px -10px rgba(0,0,0,0.18)`,
                  }}
                >
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                      Fase {p.n} · Semanas {p.from}–{p.to}
                    </p>
                    <p className="mt-0.5 text-xl font-extrabold">{p.name}</p>
                  </div>
                  <div className={`text-4xl ${locked ? "opacity-50 grayscale" : ""}`}>
                    {locked ? "🔒" : p.emoji}
                  </div>
                </div>
              </div>
            );
          }

          if (node.kind === "mascot") {
            return (
              <div
                key={`m${node.y}`}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none"
                style={{ left: `${node.x}%`, top: `${node.y}px` }}
                aria-hidden
              >
                <div className="float-slow text-7xl drop-shadow-[0_8px_10px_rgba(0,0,0,0.12)]">
                  {node.emoji}
                </div>
                <div className="mx-auto mt-1.5 h-2.5 w-14 rounded-full bg-slate-900/10 blur-[3px]" />
              </div>
            );
          }

          if (node.kind === "week-header") {
            const tm = trimMeta(node.week);
            return (
              <div
                key={`h${node.week}`}
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: `${node.y + 8}px` }}
              >
                <span
                  className={`rounded-full bg-white/90 px-3.5 py-1 text-[11px] font-extrabold shadow-sm backdrop-blur-sm ${tm.softText}`}
                >
                  Semana {node.week} {FRUIT_EMOJI[node.week] ?? ""}
                  {MILESTONES[node.week] ? ` · ${MILESTONES[node.week].emoji}` : ""}
                </span>
              </div>
            );
          }

          if (node.kind === "album-week") {
            const collected = stickers.includes(node.week);
            const tm = trimMeta(node.week);
            // Desbloqueado é COLORIDO (Duolingo): cinza fica só para o futuro.
            // Não colecionada = moeda mais clara da mesma cor, convidando o toque.
            return (
              <button
                key={`a${node.week}`}
                onClick={() => openAlbum(node.week)}
                className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none"
                style={{ left: `${node.x}%`, top: `${node.y}px` }}
                aria-label={`Memória da semana ${node.week}`}
              >
                <div
                  className="duo3d flex h-16 w-16 items-center justify-center rounded-full"
                  style={
                    {
                      background: collected
                        ? `linear-gradient(180deg, color-mix(in oklab, ${tm.main} 82%, white) 0%, ${tm.main} 55%)`
                        : `color-mix(in oklab, ${tm.main} 38%, white)`,
                      "--lip": collected ? tm.lip : `color-mix(in oklab, ${tm.lip} 55%, white)`,
                      boxShadow: `0 6px 0 var(--lip)`,
                    } as React.CSSProperties
                  }
                >
                  <span className="text-2xl">{FRUIT_EMOJI[node.week] ?? "🍼"}</span>
                </div>
              </button>
            );
          }

          const { D, week } = node;
          const isToday = D === todayD;
          const done = doneDays.includes(D);
          const isPast = D < todayD;
          const isFuture = D > todayD;
          const tm = trimMeta(week);
          const palette = done || isToday ? tm : isPast ? MISSED : LOCKED;
          const dia = isToday ? 84 : 64;
          const dayOfWeek = (D % 7) + 1;
          const tasksDone = isToday
            ? [checkedToday || todayTasks.humor, todayTasks.desafio, todayTasks.leitura].filter(
                Boolean,
              ).length
            : 0;

          return (
            <div key={`d${D}`}>
              <button
                id={isToday ? "dc-today-node" : undefined}
                onClick={() => openDay(D)}
                disabled={isFuture}
                className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none disabled:cursor-not-allowed"
                style={{ left: `${node.x}%`, top: `${node.y}px` }}
                aria-label={`Dia ${dayOfWeek} da semana ${week}`}
              >
                {isToday && (
                  <div className="duo-bubble absolute -top-11 z-20 whitespace-nowrap">
                    <div className="relative rounded-xl bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-pink-500 shadow-[0_3px_10px_rgba(0,0,0,0.12)]">
                      {done ? "Desafio completo ✓" : "Desafio de hoje 🎁"}
                      <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white" />
                    </div>
                  </div>
                )}
                <div className="relative">
                  {/* Halo pulsante convida o toque (opacity-only, zero repaint) */}
                  {isToday && !done && (
                    <span
                      className="dc-halo pointer-events-none absolute inset-0 rounded-full"
                      style={{ boxShadow: `0 0 30px 6px ${tm.main}55` }}
                    />
                  )}
                  {/* Anel segmentado: 3 segmentos = as 3 tarefas de hoje */}
                  {isToday && <TaskRing done={done ? 3 : tasksDone} color={tm.main} />}
                  <div
                    className={`duo3d relative flex items-center justify-center overflow-hidden rounded-full ${
                      isToday && !done ? "dc-chest" : ""
                    }`}
                    style={
                      {
                        width: `${dia}px`,
                        height: `${dia}px`,
                        background: `linear-gradient(180deg, color-mix(in oklab, ${palette.main} 82%, white) 0%, ${palette.main} 55%)`,
                        "--lip": palette.lip,
                        boxShadow: `0 ${isToday ? 8 : 6}px 0 ${palette.lip}`,
                      } as React.CSSProperties
                    }
                  >
                    {isToday && !done ? (
                      <span className="text-3xl">🎁</span>
                    ) : done ? (
                      <span
                        className={`font-black text-white ${isToday ? "text-3xl" : "text-2xl"}`}
                      >
                        ✓
                      </span>
                    ) : (
                      <span
                        className={`text-base font-black tabular-nums ${
                          isFuture ? "text-slate-400" : "text-pink-300"
                        }`}
                      >
                        {dayOfWeek}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Folga para a barra de navegação inferior do app */}
      <div className="h-16" />

      {/* Sheet de DIA */}
      {sheet?.kind === "day" &&
        (() => {
          const D = sheet.D;
          const week = Math.max(1, Math.min(42, Math.floor(D / 7)));
          const baby = babyForWeek(week);
          const ch = challengeForDay(D);
          const isToday = D === todayD;
          const state = isToday ? dayTasks : dayTaskState(D);
          const done = doneDays.includes(D);
          const tm = trimMeta(week);
          return (
            <div
              className="fixed inset-0 z-50 flex items-end"
              style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(2px)" }}
              onClick={() => setSheet(null)}
            >
              <div
                className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-10 shadow-2xl"
                style={{ animation: "slideUp 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}
                onClick={(e) => e.stopPropagation()}
              >
                {revealing && <ConfettiBurst />}
                <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />

                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`duo3d flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl ${revealing ? "dc-sticker-pop" : ""}`}
                    style={{ background: tm.main, "--lip": tm.lip } as React.CSSProperties}
                  >
                    {done ? "⭐" : ch.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Semana {week} · dia {(D % 7) + 1}
                      {isToday && (
                        <span className="ml-2 rounded-full bg-pink-100 px-2 py-0.5 text-pink-600">
                          hoje
                        </span>
                      )}
                    </p>
                    <h3 className="mt-0.5 text-xl font-extrabold">
                      {done ? "Desafio completo!" : isToday ? "Desafio de hoje" : "Desafio do dia"}
                    </h3>
                  </div>
                  <button
                    onClick={() => share(week)}
                    className="press shrink-0 rounded-full bg-pink-50 px-3 py-2 text-sm font-bold text-pink-600"
                  >
                    💌
                  </button>
                </div>

                <div className="mb-4 rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    ✅ Complete as 3 para ganhar o dia
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {[
                      { id: "humor", label: "Check-in: como você está?", emoji: "🙂" },
                      { id: "desafio", label: ch.label, emoji: ch.emoji },
                      { id: "leitura", label: `Ler sobre ${babyLabel} hoje (abaixo)`, emoji: "📖" },
                    ].map((t) => {
                      const checked = t.id === "humor" && isToday ? checkedToday : !!state[t.id];
                      const canToggle = isToday && t.id === "desafio";
                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <button
                            onClick={() => canToggle && markDayTask(D, t.id, !state[t.id])}
                            disabled={!canToggle && t.id === "desafio"}
                            className={`press flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-black text-white transition-colors ${
                              checked
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-emerald-300 bg-white"
                            }`}
                            aria-label={checked ? "Feito" : "Marcar"}
                          >
                            {checked ? "✓" : ""}
                          </button>
                          <span
                            className={`flex-1 text-sm ${checked ? "text-emerald-600 line-through" : "text-emerald-900"}`}
                          >
                            {t.emoji} {t.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {!isToday && !done && (
                    <p className="mt-2 text-[11px] text-emerald-700/70">
                      Desafios valem no dia — mas a leitura e as figurinhas ficam para sempre 💜
                    </p>
                  )}
                </div>

                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-pink-50 p-4">
                  <span className="text-4xl">{FRUIT_EMOJI[week] ?? "🍼"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold">
                      {babyLabel} está do tamanho de {baby.fruit.toLowerCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      📏 {baby.size} · ⚖️ {baby.weight}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {baby.desc.replace("seu bebê", babyLabel)}
                    </p>
                  </div>
                </div>

                {/* PONTO 1 · Orientação pós-data mais séria nas semanas 41–42 */}
                <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    🩺 Orientação do Dr. Clóvis
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-sky-900">
                    {week >= 41 ? POSDATA_GUIDANCE : consultaForWeek(week)}
                  </p>
                  {week >= 41 && (
                    <a
                      href="/agendamento"
                      className="press mt-3 inline-block rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white"
                    >
                      Agendar consulta desta semana
                    </a>
                  )}
                </div>

                {isToday && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      🔒 Amanhã: novo desafio
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {challengeForDay(D + 1).emoji} Volte amanhã para manter a chama 🔥
                      {streak > 0 ? ` (${streak} ${streak === 1 ? "dia" : "dias"})` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* Sheet de ÁLBUM */}
      {sheet?.kind === "album" && (
        <AlbumSheet
          week={sheet.week}
          babyLabel={babyLabel}
          revealing={revealing}
          onClose={() => setSheet(null)}
          onShare={share}
        />
      )}
    </div>
  );
}

/* ══════════════════ Sheet de álbum (gestação) — compartilhado ══════════════════ */

function AlbumSheet({
  week,
  babyLabel,
  revealing,
  onClose,
  onShare,
}: {
  week: number;
  babyLabel: string;
  revealing: boolean;
  onClose: () => void;
  onShare: (week: number) => void;
}) {
  const baby = babyForWeek(week);
  const tm = trimMeta(week);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-10 shadow-2xl"
        style={{ animation: "slideUp 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {revealing && <ConfettiBurst />}
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />

        <div className="mb-4 flex items-center gap-3">
          <div
            className={`duo3d flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl ${revealing ? "dc-sticker-pop" : ""}`}
            style={{ background: tm.main, "--lip": tm.lip } as React.CSSProperties}
          >
            {FRUIT_EMOJI[week] ?? "🍼"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Memória · Semana {week}
            </p>
            <h3 className="mt-0.5 truncate text-2xl font-extrabold">{baby.fruit}</h3>
          </div>
          <button
            onClick={() => onShare(week)}
            className="press shrink-0 rounded-full bg-pink-50 px-3 py-2 text-sm font-bold text-pink-600"
          >
            Enviar 💌
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-pink-50 p-3">
            <p className="text-xs font-bold text-pink-600">📏 Tamanho</p>
            <p className="mt-0.5 text-lg font-extrabold">{baby.size}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-600">⚖️ Peso</p>
            <p className="mt-0.5 text-lg font-extrabold">{baby.weight}</p>
          </div>
        </div>

        <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
          Nessa semana, {baby.desc.charAt(0).toLowerCase() + baby.desc.slice(1)}
        </p>

        {MILESTONES[week] && (
          <div className="rounded-2xl bg-violet-50 p-3">
            <p className="text-sm font-bold text-violet-700">
              🎯 {babyLabel} já conquistou: {MILESTONES[week].label}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ PONTO 2 · Jornada do 4º trimestre ══════════════════ */

function PosPartoJourney({
  babyLabel,
  birth,
  checkedToday,
  doCheckin,
  gestStickers,
  albumOpen,
  setAlbumOpen,
  openGestAlbum,
  sheet,
  setSheet,
  revealing,
  setRevealing,
  styleBlock,
  shareGest,
}: {
  babyLabel: string;
  birth: Birth;
  checkedToday: boolean;
  doCheckin: (mood: string) => void;
  gestStickers: number[];
  albumOpen: boolean;
  setAlbumOpen: (v: boolean) => void;
  openGestAlbum: (week: number) => void;
  sheet: { kind: "day"; D: number } | { kind: "album"; week: number } | null;
  setSheet: (s: { kind: "day"; D: number } | { kind: "album"; week: number } | null) => void;
  revealing: boolean;
  setRevealing: (v: boolean) => void;
  styleBlock: React.ReactNode;
  shareGest: (week: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [posDone, setPosDone] = useState<number[]>([]);
  const [posStickers, setPosStickers] = useState<number[]>([]);
  const [dayTasks, setDayTasks] = useState<Record<string, boolean>>({});
  const [selectedPhase, setSelectedPhase] = useState(0);

  // Idade do bebê em dias (0-based) → pseudo-dia D = idade + 7 (semana 1 = D 7..13)
  const birthDate = new Date(birth.date + "T00:00:00");
  const rawAgeDays = Math.max(0, Math.floor((Date.now() - birthDate.getTime()) / 86400000));
  const babyAgeDays = Math.min(83, rawAgeDays);
  const graduated = rawAgeDays > 83; // 12 semanas completas — 4º trimestre encerrado
  const todayD = babyAgeDays + 7;
  const currentWeek = Math.max(1, Math.min(12, Math.floor(todayD / 7)));
  const phases = PHASES_POS;
  const currentPhase = phaseOfWeek(phases, currentWeek);

  useEffect(() => {
    setPosDone(lsGet<number[]>(LS.posDoneDays, []));
    setPosStickers(lsGet<number[]>(LS.posStickers, []));
    const idx = phases.findIndex((p) => p === currentPhase);
    setSelectedPhase(idx >= 0 ? idx : 0);
  }, [currentPhase, phases]);

  const streak = useMemo(() => {
    if (posDone.length === 0) return 0;
    const set = new Set(posDone);
    let s = 0;
    let d = set.has(todayD) ? todayD : todayD - 1;
    while (set.has(d)) {
      s++;
      d--;
    }
    return s;
  }, [posDone, todayD]);

  const phase = phases[selectedPhase] ?? phases[0];
  // Jornada pós-parto começa no nascimento: sem semanas-álbum aqui
  const { nodes, height } = useMemo(() => buildPhaseNodes(phase, 7), [phase]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const target = nodes.find((n) => n.kind === "day" && n.D === todayD);
    const y = target?.y ?? 0;
    const t = setTimeout(() => {
      el.scrollTo({ top: Math.max(0, y - el.clientHeight / 2), behavior: "smooth" });
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, todayD]);

  function dayTaskState(D: number): Record<string, boolean> {
    return lsGet<Record<string, boolean>>(LS.posDayTasks(D), {});
  }

  function markDayTask(D: number, id: string, value: boolean) {
    const state = { ...dayTaskState(D), [id]: value };
    lsSet(LS.posDayTasks(D), state);
    if (sheet?.kind === "day" && sheet.D === D) setDayTasks(state);
    // No dia da transição gestação→pós-parto, o check-in pode ter sido feito ainda
    // na gestação (checkedToday) — vale como humor de hoje aqui também.
    const humorOk = state.humor || (D === todayD && checkedToday);
    const allDone = humorOk && state.desafio && state.leitura;
    if (allDone && !posDone.includes(D)) {
      const next = [...posDone, D];
      setPosDone(next);
      lsSet(LS.posDoneDays, next);
      setRevealing(true);
      setTimeout(() => setRevealing(false), 1800);
      const week = Math.floor(D / 7);
      if (!posStickers.includes(week)) {
        const ns = [...posStickers, week];
        setPosStickers(ns);
        lsSet(LS.posStickers, ns);
        toast.success(`${POS_EMOJI[week] ?? "🍼"} Figurinha da semana ${week} de vida coletada!`);
      }
      toast.success(`🎉 Dia ${babyAgeDays + 1} com ${babyLabel} completo!`);
    }
  }

  function openDay(D: number) {
    setDayTasks(dayTaskState(D));
    setSheet({ kind: "day", D });
    if (D === todayD) setTimeout(() => markDayTask(D, "leitura", true), 600);
  }

  return (
    <div className="flex flex-col gap-4">
      {styleBlock}

      {/* Cabeçalho do 4º trimestre + álbum da gestação preservado */}
      <div className="flex items-center justify-between rounded-2xl bg-white/80 p-4 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">4º Trimestre</p>
          <p className="text-lg font-extrabold">
            {graduated
              ? `${babyLabel} · 12 semanas completas 🎓`
              : `${babyLabel} · ${babyAgeDays + 1}º dia de vida 🍼`}
          </p>
        </div>
        <button
          onClick={() => setAlbumOpen(!albumOpen)}
          className="press rounded-full bg-pink-50 px-3 py-2 text-xs font-bold text-pink-600"
        >
          {albumOpen ? "Fechar álbum" : "Álbum da gestação 💝"}
        </button>
      </div>

      {/* Álbum da gestação: recordação permanente */}
      {albumOpen && (
        <div className="rounded-3xl bg-white/80 p-4 backdrop-blur-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Álbum da gestação · {gestStickers.length} figurinhas
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 42 }, (_, i) => i + 1).map((w) => {
              const got = gestStickers.includes(w);
              return (
                <button
                  key={w}
                  onClick={() => openGestAlbum(w)}
                  className={`press flex h-11 w-11 items-center justify-center rounded-xl text-xl ${
                    got ? "bg-pink-50" : "bg-slate-50 opacity-40 grayscale"
                  }`}
                  aria-label={`Semana ${w}`}
                >
                  {FRUIT_EMOJI[w] ?? "🍼"}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-around rounded-2xl bg-white/70 px-3 py-2.5 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-1.5">
          <span className={`text-xl ${streak > 0 ? "" : "grayscale opacity-50"}`}>🔥</span>
          <span className="text-lg font-extrabold text-amber-500">{streak}</span>
          <span className="text-xs font-medium text-muted-foreground">
            {streak === 1 ? "dia" : "dias"}
          </span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xl">👶</span>
          <span className="text-lg font-extrabold text-sky-500">S{currentWeek}</span>
          <span className="text-xs font-medium text-muted-foreground">de vida</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xl">🏆</span>
          <span className="text-lg font-extrabold text-violet-500">
            {gestStickers.length + posStickers.length}
          </span>
        </div>
      </div>

      {/* Graduação: 12 semanas completas encerra o 4º trimestre com celebração */}
      {graduated && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-4xl">🎓</p>
          <p className="mt-1 font-extrabold text-emerald-800">Jornada do 4º trimestre completa!</p>
          <p className="mt-1 text-sm text-emerald-700">
            Parabéns! Você e {babyLabel} atravessaram as 12 primeiras semanas juntos. O caminho e os
            álbuns ficam guardados aqui para sempre 💝
          </p>
        </div>
      )}

      {/* Check-in (a chama continua a mesma da gestação — recorrência não quebra) */}
      {!checkedToday && !graduated && (
        <div className="rounded-2xl bg-white/80 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)] backdrop-blur-sm">
          <p className="text-sm font-bold">Como você está hoje, mamãe?</p>
          <p className="text-xs text-muted-foreground">
            Seu bem-estar importa tanto quanto o do bebê 💜
          </p>
          <div className="mt-2.5 flex justify-between gap-1">
            {MOODS.map((m) => (
              <button
                key={m.label}
                onClick={() => {
                  doCheckin(m.label);
                  markDayTask(todayD, "humor", true);
                }}
                className="press flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-slate-50 py-2 hover:bg-sky-50"
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] font-medium text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Seletor de fases pós-parto */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {phases.map((p, i) => {
          const locked = p.from * 7 > todayD;
          const isSelected = i === selectedPhase;
          return (
            <button
              key={p.n}
              onClick={() => setSelectedPhase(i)}
              disabled={locked}
              className={`press flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all disabled:cursor-not-allowed ${
                isSelected
                  ? `${posMeta(p.from).banner} text-white shadow-sm`
                  : locked
                    ? "bg-slate-100 text-slate-300"
                    : "bg-white/80 text-slate-500"
              }`}
            >
              {locked ? "🔒" : p.emoji} Fase {p.n}
            </button>
          );
        })}
      </div>

      <div
        className={`flex items-center justify-between rounded-2xl ${posMeta(phase.from).banner} px-5 py-4 text-white shadow-md`}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            Fase {phase.n} · Semanas {phase.from}–{phase.to} de vida
          </p>
          <p className="mt-0.5 text-xl font-extrabold">{phase.name}</p>
        </div>
        <div className="text-4xl">{phase.emoji}</div>
      </div>

      {/* Caminho pós-parto */}
      <div
        ref={containerRef}
        className="relative overflow-y-auto rounded-3xl bg-gradient-to-b from-white/60 to-white/30 backdrop-blur-sm"
        style={{ height: "56vh" }}
      >
        <div className="relative" style={{ height: `${height}px` }}>
          {nodes.map((node) => {
            if (node.kind === "week-header") {
              const pm = posMeta(node.week);
              return (
                <div
                  key={`h${node.week}`}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ top: `${node.y + 8}px` }}
                >
                  <span
                    className={`rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold shadow-sm ${pm.softText}`}
                  >
                    Semana {node.week} de vida {POS_EMOJI[node.week] ?? ""}
                  </span>
                </div>
              );
            }
            if (node.kind === "album-week") return null;

            const { D, week } = node;
            const isToday = D === todayD;
            const done = posDone.includes(D);
            const isPast = D < todayD;
            const isFuture = D > todayD;
            const pm = posMeta(week);
            const palette = done || isToday ? pm : isPast ? MISSED : LOCKED;
            const dia = isToday ? 72 : 52;

            return (
              <button
                key={`d${D}`}
                onClick={() => openDay(D)}
                disabled={isFuture}
                className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none disabled:cursor-not-allowed"
                style={{ left: `${node.x}%`, top: `${node.y}px` }}
                aria-label={`Dia ${(D % 7) + 1} da semana ${week} de vida`}
              >
                {isToday && (
                  <div className="duo-bubble absolute -top-10 z-20 whitespace-nowrap">
                    <div className="relative rounded-xl bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-sky-500 shadow-[0_3px_10px_rgba(0,0,0,0.12)]">
                      {graduated
                        ? "Jornada completa 🎓"
                        : done
                          ? "Dia completo ✓"
                          : "Desafio de hoje 🎁"}
                      <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white" />
                    </div>
                  </div>
                )}
                <div
                  className={`duo3d flex items-center justify-center rounded-full ${
                    isToday ? "ring-4 ring-white/70" : ""
                  } ${isToday && !done ? "dc-chest" : ""}`}
                  style={
                    {
                      width: `${dia}px`,
                      height: `${dia}px`,
                      background: palette.main,
                      "--lip": palette.lip,
                    } as React.CSSProperties
                  }
                >
                  {isToday && !done ? (
                    <span className="text-2xl">🎁</span>
                  ) : done ? (
                    <span className={`font-black text-white ${isToday ? "text-2xl" : "text-lg"}`}>
                      ✓
                    </span>
                  ) : (
                    <span
                      className={`font-black tabular-nums ${
                        isFuture ? "text-slate-400" : "text-sky-300"
                      } text-sm`}
                    >
                      {(D % 7) + 1}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sheet de dia pós-parto */}
      {sheet?.kind === "day" &&
        (() => {
          const D = sheet.D;
          const week = Math.max(1, Math.min(12, Math.floor(D / 7)));
          const ch = challengeForPosDay(D);
          const isToday = D === todayD;
          const state = isToday ? dayTasks : dayTaskState(D);
          const done = posDone.includes(D);
          const pm = posMeta(week);
          return (
            <div
              className="fixed inset-0 z-50 flex items-end"
              style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(2px)" }}
              onClick={() => setSheet(null)}
            >
              <div
                className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-10 shadow-2xl"
                style={{ animation: "slideUp 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}
                onClick={(e) => e.stopPropagation()}
              >
                {revealing && <ConfettiBurst />}
                <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />

                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`duo3d flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl ${revealing ? "dc-sticker-pop" : ""}`}
                    style={{ background: pm.main, "--lip": pm.lip } as React.CSSProperties}
                  >
                    {done ? "⭐" : ch.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Semana {week} de vida · dia {(D % 7) + 1}
                      {isToday && (
                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-sky-600">
                          hoje
                        </span>
                      )}
                    </p>
                    <h3 className="mt-0.5 text-xl font-extrabold">
                      {done ? "Dia completo!" : "Desafio de hoje"}
                    </h3>
                  </div>
                </div>

                <div className="mb-4 rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    ✅ Complete as 3 para ganhar o dia
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {[
                      { id: "humor", label: "Check-in: como você está?", emoji: "🙂" },
                      { id: "desafio", label: ch.label, emoji: ch.emoji },
                      { id: "leitura", label: "Ler a orientação da semana (abaixo)", emoji: "📖" },
                    ].map((t) => {
                      const checked =
                        t.id === "humor" && isToday ? checkedToday || !!state[t.id] : !!state[t.id];
                      const canToggle = isToday && !graduated && t.id === "desafio";
                      return (
                        <div key={t.id} className="flex items-center gap-2">
                          <button
                            onClick={() => canToggle && markDayTask(D, t.id, !state[t.id])}
                            disabled={!canToggle && t.id === "desafio"}
                            className={`press flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-black text-white transition-colors ${
                              checked
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-emerald-300 bg-white"
                            }`}
                            aria-label={checked ? "Feito" : "Marcar"}
                          >
                            {checked ? "✓" : ""}
                          </button>
                          <span
                            className={`flex-1 text-sm ${checked ? "text-emerald-600 line-through" : "text-emerald-900"}`}
                          >
                            {t.emoji} {t.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    🩺 Orientação do Dr. Clóvis
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-sky-900">
                    {POS_GUIDANCE[week] ?? POS_GUIDANCE[12]}
                  </p>
                </div>

                {isToday && !graduated && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      🔒 Amanhã: novo desafio
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {challengeForPosDay(D + 1).emoji} Volte amanhã para manter a chama 🔥
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* Sheet de álbum da gestação (recordação) */}
      {sheet?.kind === "album" && (
        <AlbumSheet
          week={sheet.week}
          babyLabel={babyLabel}
          revealing={revealing}
          onClose={() => setSheet(null)}
          onShare={shareGest}
        />
      )}
    </div>
  );
}
