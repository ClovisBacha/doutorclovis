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
] as const;

function phaseOfWeek(week: number) {
  return PHASES.find((p) => week >= p.from && week <= p.to) ?? PHASES[PHASES.length - 1];
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
};

/** Figurinha (emoji da fruta) de cada semana — colecionável no álbum. */
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
};

/* ══════════════════════ DESAFIOS DIÁRIOS (por trimestre) ══════════════════════ */

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

/** Desafio determinístico do dia gestacional D (mesmo dia = mesmo desafio). */
function challengeForDay(D: number): Challenge {
  const week = Math.floor(D / 7);
  const pool = week <= 13 ? CHALLENGES_T1 : week <= 27 ? CHALLENGES_T2 : CHALLENGES_T3;
  return pool[D % pool.length];
}

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
  checkin: "dc-path-checkin",
  journeyStart: "dc-path-journey-start",
  doneDays: "dc-path-done-days",
  dayTasks: (d: number) => `dc-path-day-${d}`,
  welcomed: "dc-path-welcomed",
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

/* ══════════════════════ Cores por trimestre ══════════════════════ */

function trimMeta(week: number) {
  if (week <= 13)
    return {
      main: "#ec4899",
      lip: "#be185d",
      banner: "bg-pink-500",
      softText: "text-pink-400",
    };
  if (week <= 27)
    return {
      main: "#f59e0b",
      lip: "#b45309",
      banner: "bg-amber-500",
      softText: "text-amber-500",
    };
  return {
    main: "#8b5cf6",
    lip: "#6d28d9",
    banner: "bg-violet-500",
    softText: "text-violet-400",
  };
}

const LOCKED = { main: "#e2e8f0", lip: "#cbd5e1" };
const GOLD = { main: "#fbbf24", lip: "#b45309" };
const MISSED = { main: "#fce7f3", lip: "#f3cfe2" };

const CONFETTI_COLORS = ["#ec4899", "#f59e0b", "#8b5cf6", "#38bdf8", "#34d399", "#fbbf24"];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: 4 + ((i * 37) % 92),
        delay: (i % 9) * 55,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: (i * 47) % 360,
        size: 6 + (i % 3) * 3,
      })),
    [],
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
  phase: (typeof PHASES)[number],
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
      // Semana inteira antes da jornada → nó de álbum (memória colecionável)
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

/* ══════════════════════════════ Componente ══════════════════════════════ */

export function GestacaoPath({ profile, gest }: GestacaoPathProps) {
  const hasGest = !!gest;
  // Dia gestacional de hoje (0-based desde a DUM); semana exibida = floor(D/7)
  const todayD = hasGest ? Math.max(7, Math.min(286, gest.totalDays)) : 0;
  const currentWeek = hasGest ? Math.max(1, Math.min(40, Math.floor(todayD / 7))) : 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const [sheet, setSheet] = useState<
    { kind: "day"; D: number } | { kind: "album"; week: number } | null
  >(null);
  const [revealing, setRevealing] = useState(false);

  const [journeyStart, setJourneyStart] = useState<JourneyStart | null>(null);
  const [stickers, setStickers] = useState<number[]>([]);
  const [doneDays, setDoneDays] = useState<number[]>([]);
  const [checkin, setCheckin] = useState<Checkin>({ last: "", streak: 0 });
  const [dayTasks, setDayTasks] = useState<Record<string, boolean>>({});
  const [showWelcome, setShowWelcome] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<number>(0);

  /* ── Começo inteligente: registra onde a jornada começou ── */
  useEffect(() => {
    if (!hasGest) return;
    setStickers(lsGet<number[]>(LS.stickers, []));
    setDoneDays(lsGet<number[]>(LS.doneDays, []));
    setCheckin(lsGet<Checkin>(LS.checkin, { last: "", streak: 0 }));

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
    setSelectedPhase(PHASES.findIndex((p) => p === phaseOfWeek(currentWeek)));
  }, [hasGest, todayD, currentWeek]);

  const journeyStartD = journeyStart?.gestDay ?? todayD;

  /* ── Streak real: dias consecutivos completados até hoje/ontem ── */
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

  const phase = PHASES[selectedPhase] ?? PHASES[0];
  const currentPhase = phaseOfWeek(currentWeek);

  const { nodes, height } = useMemo(
    () => buildPhaseNodes(phase, journeyStartD),
    [phase, journeyStartD],
  );

  /* ── Progresso da fase atual (só dias da jornada contam) ── */
  const phaseProgress = useMemo(() => {
    const from = Math.max(phase.from * 7, journeyStartD);
    const to = Math.min(phase.to * 7 + 6, todayD);
    if (to < from) return { done: 0, total: 0 };
    const total = to - from + 1;
    const done = doneDays.filter((d) => d >= from && d <= to).length;
    return { done, total };
  }, [phase, journeyStartD, todayD, doneDays]);

  /* ── Auto-scroll para o dia de hoje ── */
  useEffect(() => {
    if (!containerRef.current || !hasGest) return;
    const el = containerRef.current;
    const target = nodes.find((n) => n.kind === "day" && n.D === todayD);
    const y = target?.y ?? 0;
    const t = setTimeout(() => {
      el.scrollTo({ top: Math.max(0, y - el.clientHeight / 2), behavior: "smooth" });
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, todayD, hasGest]);

  const checkedToday = checkin.last === localDateStr();

  function doCheckin(mood: string) {
    if (checkedToday) return;
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    const s = checkin.last === yesterday ? checkin.streak + 1 : 1;
    const next = { last: localDateStr(), streak: s, mood };
    setCheckin(next);
    lsSet(LS.checkin, next);
    markDayTask(todayD, "humor", true);
  }

  /* ── Tarefas do dia: humor + desafio + leitura. Completou as 3 → dia feito ── */
  function dayTaskState(D: number): Record<string, boolean> {
    return lsGet<Record<string, boolean>>(LS.dayTasks(D), {});
  }

  function markDayTask(D: number, id: string, value: boolean) {
    const state = { ...dayTaskState(D), [id]: value };
    lsSet(LS.dayTasks(D), state);
    if (sheet?.kind === "day" && sheet.D === D) setDayTasks(state);
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
    // Abrir o dia de hoje já cumpre a tarefa de leitura
    if (D === todayD) {
      setTimeout(() => markDayTask(D, "leitura", true), 600);
    }
  }

  function openAlbum(week: number) {
    setSheet({ kind: "album", week });
    if (week <= currentWeek) collectSticker(week);
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

  const meta = trimMeta(currentWeek);
  const journeyDayNum = todayD - journeyStartD + 1;
  const babyLabel = profile?.baby_name || "seu bebê";

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @keyframes dcConfettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(75vh) rotate(540deg); opacity: 0; }
        }
        .dc-confetti { animation: dcConfettiFall 1.6s ease-in both; }
        @keyframes dcChestPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.12);} }
        .dc-chest { animation: dcChestPulse 1.1s ease-in-out infinite; }
        @keyframes dcStickerPop {
          0% { transform: scale(0) rotate(-12deg); }
          70% { transform: scale(1.25) rotate(4deg); }
          100% { transform: scale(1) rotate(0); }
        }
        .dc-sticker-pop { animation: dcStickerPop 700ms cubic-bezier(0.34,1.56,0.64,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .dc-confetti, .dc-chest, .dc-sticker-pop { animation: none; }
        }
      `}</style>

      {/* Boas-vindas do começo inteligente (só uma vez, para quem chega no meio) */}
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

      {/* Stats: streak diário real · dia da jornada · figurinhas */}
      <div className="flex items-center justify-around rounded-2xl bg-white/70 px-3 py-2.5 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
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

      {/* Check-in rápido (1ª tarefa do dia) */}
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

      {/* Seletor de fases */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {PHASES.map((p, i) => {
          const isCurrent = p === currentPhase;
          const locked = p.from * 7 > todayD;
          const isSelected = i === selectedPhase;
          return (
            <button
              key={p.n}
              onClick={() => setSelectedPhase(i)}
              className={`press flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                isSelected
                  ? `${trimMeta(p.from).banner} text-white shadow-sm`
                  : locked
                    ? "bg-slate-100 text-slate-300"
                    : "bg-white/80 text-slate-500"
              }`}
            >
              {locked ? "🔒" : p.emoji} Fase {p.n}
              {isCurrent && !isSelected && <span className="ml-1">•</span>}
            </button>
          );
        })}
      </div>

      {/* Banner da fase selecionada */}
      <div
        className={`flex items-center justify-between rounded-2xl ${trimMeta(phase.from).banner} px-5 py-4 text-white shadow-md`}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            Fase {phase.n} · Semanas {phase.from}–{phase.to}
          </p>
          <p className="mt-0.5 text-xl font-extrabold">{phase.name}</p>
          {phaseProgress.total > 0 && (
            <p className="mt-0.5 text-xs font-semibold text-white/75">
              {phaseProgress.done} de {phaseProgress.total} desafios completos
            </p>
          )}
        </div>
        <div className="text-4xl">{phase.emoji}</div>
      </div>

      {/* Caminho da fase: dias como nós; semanas pré-jornada como álbum */}
      <div
        ref={containerRef}
        className="relative overflow-y-auto rounded-3xl bg-gradient-to-b from-white/60 to-white/30 backdrop-blur-sm"
        style={{ height: "60vh" }}
      >
        <div className="relative" style={{ height: `${height}px` }}>
          {nodes.map((node) => {
            if (node.kind === "week-header") {
              const tm = trimMeta(node.week);
              return (
                <div
                  key={`h${node.week}`}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ top: `${node.y + 8}px` }}
                >
                  <span
                    className={`rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold shadow-sm ${tm.softText}`}
                  >
                    Semana {node.week} {FRUIT_EMOJI[node.week] ?? ""}
                    {MILESTONES[node.week] ? ` · ${MILESTONES[node.week].emoji}` : ""}
                  </span>
                </div>
              );
            }

            if (node.kind === "album-week") {
              const collected = stickers.includes(node.week);
              return (
                <button
                  key={`a${node.week}`}
                  onClick={() => openAlbum(node.week)}
                  className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none"
                  style={{ left: `${node.x}%`, top: `${node.y}px` }}
                  aria-label={`Álbum semana ${node.week}`}
                >
                  <div
                    className="duo3d flex h-16 w-16 items-center justify-center rounded-full"
                    style={
                      {
                        background: collected ? "#fdf2f8" : "#f1f5f9",
                        "--lip": collected ? "#fbcfe8" : "#e2e8f0",
                      } as React.CSSProperties
                    }
                  >
                    <span className={`text-2xl ${collected ? "" : "opacity-40 grayscale"}`}>
                      {FRUIT_EMOJI[node.week] ?? "🍼"}
                    </span>
                  </div>
                  <span className="mt-1 text-[10px] font-bold text-slate-400">
                    S{node.week} · memória {collected ? "💜" : "📖"}
                  </span>
                </button>
              );
            }

            /* Nó de dia */
            const { D, week } = node;
            const isToday = D === todayD;
            const done = doneDays.includes(D);
            const isPast = D < todayD;
            const isFuture = D > todayD;
            const tm = trimMeta(week);
            const palette = done ? tm : isToday ? tm : isPast ? MISSED : LOCKED;
            const dia = isToday ? 72 : 52;
            const dayOfWeek = (D % 7) + 1;

            return (
              <div key={`d${D}`}>
                <button
                  onClick={() => openDay(D)}
                  disabled={isFuture}
                  className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none disabled:cursor-not-allowed"
                  style={{ left: `${node.x}%`, top: `${node.y}px` }}
                  aria-label={`Dia ${dayOfWeek} da semana ${week}`}
                >
                  {isToday && (
                    <div className="duo-bubble absolute -top-10 z-20 whitespace-nowrap">
                      <div className="relative rounded-xl bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-pink-500 shadow-[0_3px_10px_rgba(0,0,0,0.12)]">
                        {done ? "Desafio completo ✓" : "Desafio de hoje 🎁"}
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
                          isFuture ? "text-slate-400" : "text-pink-300"
                        } text-sm`}
                      >
                        {dayOfWeek}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════ Sheet de DIA (desafio diário) ══════════ */}
      {sheet?.kind === "day" &&
        (() => {
          const D = sheet.D;
          const week = Math.max(1, Math.min(40, Math.floor(D / 7)));
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

                {/* As 3 tarefas do dia */}
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

                {/* Bebê hoje */}
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

                {/* Orientação médica da semana */}
                <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    🩺 Orientação do Dr. Clóvis
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-sky-900">
                    {consultaForWeek(week)}
                  </p>
                </div>

                {/* Gancho de amanhã */}
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

      {/* ══════════ Sheet de ÁLBUM (semanas antes da jornada) ══════════ */}
      {sheet?.kind === "album" &&
        (() => {
          const week = sheet.week;
          const baby = babyForWeek(week);
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
                    {FRUIT_EMOJI[week] ?? "🍼"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Memória · Semana {week}
                    </p>
                    <h3 className="mt-0.5 truncate text-2xl font-extrabold">{baby.fruit}</h3>
                  </div>
                  <button
                    onClick={() => share(week)}
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
        })()}
    </div>
  );
}
