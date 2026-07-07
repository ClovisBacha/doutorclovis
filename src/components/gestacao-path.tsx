import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { babyForWeek, consultaForWeek } from "@/lib/gestacao";

type Gest = { weeks: number; days: number; totalDays: number } | null;

interface GestacaoPathProps {
  profile: { baby_name: string | null } | null;
  gest: Gest;
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

/** Figurinha (emoji da fruta) de cada semana — o caminho vira um álbum. */
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

/** Tarefas médicas reais por semana (o que converte: agendar = meta do jogo). */
function weekTasks(week: number): { id: string; label: string; agendar?: boolean }[] {
  const t: { id: string; label: string; agendar?: boolean }[] = [];
  if (week >= 5 && week <= 10)
    t.push({ id: "consulta1", label: "Agendar a 1ª consulta pré-natal", agendar: true });
  if (week >= 5 && week <= 12) t.push({ id: "folico", label: "Tomar ácido fólico hoje" });
  if (week >= 11 && week <= 13)
    t.push({ id: "tn", label: "Agendar a translucência nucal (11–13s)", agendar: true });
  if (week >= 18 && week <= 22)
    t.push({ id: "morfo", label: "Agendar o ultrassom morfológico", agendar: true });
  if (week >= 24 && week <= 27) t.push({ id: "totg", label: "Fazer o teste de glicose (TOTG)" });
  if (week >= 27 && week <= 36) t.push({ id: "dtpa", label: "Verificar a vacina dTpa" });
  if (week >= 35 && week <= 37) t.push({ id: "gbs", label: "Coletar o exame de estreptococo B" });
  if (week >= 33 && week <= 38) t.push({ id: "mala", label: "Preparar a mala da maternidade" });
  if (week >= 36) t.push({ id: "semanal", label: "Agendar a consulta semanal", agendar: true });
  t.push({ id: "leitura", label: "Ler o desenvolvimento desta semana" });
  return t.slice(0, 4);
}

const MOODS = [
  { emoji: "😄", label: "Ótima" },
  { emoji: "🙂", label: "Bem" },
  { emoji: "😐", label: "Normal" },
  { emoji: "😔", label: "Cansada" },
  { emoji: "🤢", label: "Enjoada" },
];

/* ── Persistência local (v1 sem depender de migrations) ── */
const LS = {
  stickers: "dc-path-stickers",
  checkin: "dc-path-checkin",
  tasks: (w: number) => `dc-path-tasks-${w}`,
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
    /* quota/privado — segue sem persistir */
  }
}

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Checkin = { last: string; streak: number; mood?: string };

const NODE_ROW_HEIGHT = 108;
const NODE_COUNT = 40;
const CONTAINER_HEIGHT = NODE_COUNT * NODE_ROW_HEIGHT + 120;

function nodeXPct(week: number): number {
  return 50 + 27 * Math.sin(((week - 1) * Math.PI) / 4);
}
function nodeY(week: number): number {
  return 70 + (week - 1) * NODE_ROW_HEIGHT;
}

type TrimMeta = {
  name: string;
  main: string;
  lip: string;
  banner: string;
  soft: string;
  softText: string;
};

function trimMeta(week: number): TrimMeta {
  if (week <= 13)
    return {
      name: "1º Trimestre",
      main: "#ec4899",
      lip: "#be185d",
      banner: "bg-pink-500",
      soft: "bg-pink-100/80",
      softText: "text-pink-400",
    };
  if (week <= 27)
    return {
      name: "2º Trimestre",
      main: "#f59e0b",
      lip: "#b45309",
      banner: "bg-amber-500",
      soft: "bg-amber-100/80",
      softText: "text-amber-500",
    };
  return {
    name: "3º Trimestre",
    main: "#8b5cf6",
    lip: "#6d28d9",
    banner: "bg-violet-500",
    soft: "bg-violet-100/80",
    softText: "text-violet-400",
  };
}

const LOCKED = { main: "#e2e8f0", lip: "#cbd5e1" };
const GOLD = { main: "#fbbf24", lip: "#b45309" };

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

export function GestacaoPath({ profile, gest }: GestacaoPathProps) {
  const hasGest = !!gest;
  const currentWeek = hasGest ? Math.max(1, Math.min(40, gest.weeks)) : 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const [stickers, setStickers] = useState<number[]>([]);
  const [checkin, setCheckin] = useState<Checkin>({ last: "", streak: 0 });
  const [taskState, setTaskState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setStickers(lsGet<number[]>(LS.stickers, []));
    setCheckin(lsGet<Checkin>(LS.checkin, { last: "", streak: 0 }));
  }, []);

  useEffect(() => {
    if (!containerRef.current || !hasGest || currentWeek === 0) return;
    const el = containerRef.current;
    const y = nodeY(currentWeek);
    const t = setTimeout(() => {
      el.scrollTo({ top: y - el.clientHeight / 2, behavior: "smooth" });
    }, 400);
    return () => clearTimeout(t);
  }, [currentWeek, hasGest]);

  const checkedToday = checkin.last === localDateStr();
  // streak zera se pulou mais de 1 dia
  const effectiveStreak = useMemo(() => {
    if (!checkin.last) return 0;
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    return checkin.last === localDateStr() || checkin.last === yesterday ? checkin.streak : 0;
  }, [checkin]);

  function doCheckin(mood: string) {
    if (checkedToday) return;
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    const streak = checkin.last === yesterday ? checkin.streak + 1 : 1;
    const next = { last: localDateStr(), streak, mood };
    setCheckin(next);
    lsSet(LS.checkin, next);
    toast.success(
      streak > 1 ? `🔥 Chama mantida! ${streak} dias seguidos` : "🔥 Check-in feito! Volte amanhã",
    );
  }

  function openSheet(week: number) {
    setSelectedWeek(week);
    setSheetOpen(true);
    setTaskState(lsGet<Record<string, boolean>>(LS.tasks(week), {}));
    // coleta a figurinha na primeira abertura de uma semana desbloqueada
    if (week <= currentWeek && !stickers.includes(week)) {
      const next = [...stickers, week];
      setStickers(next);
      lsSet(LS.stickers, next);
      setRevealing(true);
      setTimeout(() => setRevealing(false), 1800);
      const baby = babyForWeek(week);
      toast.success(`${FRUIT_EMOJI[week] ?? "🍼"} Figurinha coletada: ${baby.fruit}!`);
    }
  }

  function toggleTask(week: number, id: string) {
    const next = { ...taskState, [id]: !taskState[id] };
    setTaskState(next);
    lsSet(LS.tasks(week), next);
    const tasks = weekTasks(week);
    if (tasks.every((t) => next[t.id])) {
      toast.success("⭐ Semana completa! Nó dourado conquistado");
    }
  }

  function weekComplete(week: number): boolean {
    if (week > currentWeek) return false;
    const state = lsGet<Record<string, boolean>>(LS.tasks(week), {});
    const tasks = weekTasks(week);
    return tasks.length > 0 && tasks.every((t) => state[t.id]);
  }

  async function share(week: number) {
    const baby = babyForWeek(week);
    const name = profile?.baby_name || "Meu bebê";
    const text = `🤰 Semana ${week}: ${name} está do tamanho de ${baby.fruit.toLowerCase()}! ${FRUIT_EMOJI[week] ?? ""}\n📏 ${baby.size} · ⚖️ ${baby.weight}\n\nAcompanhamento pré-natal com Dr. Clóvis Bacha 🩺`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Texto copiado! Cole no WhatsApp 💬");
      }
    } catch {
      /* usuária cancelou o share */
    }
  }

  const selectedBaby = selectedWeek ? babyForWeek(selectedWeek) : null;
  const progressPct = hasGest ? Math.min(100, (currentWeek / 40) * 100) : 0;
  const meta = trimMeta(currentWeek || 1);
  const babyLabel = profile?.baby_name || "seu bebê";
  const daysToNextWeek = hasGest ? 7 - gest.days : 7;

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

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @keyframes dcConfettiFall {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(75vh) rotate(540deg); opacity: 0; }
        }
        .dc-confetti { animation: dcConfettiFall 1.6s ease-in both; }
        @keyframes dcChestPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }
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

      {/* Barra de stats: streak real · progresso · figurinhas */}
      <div className="flex items-center justify-around rounded-2xl bg-white/70 px-3 py-2.5 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-1.5" title="Dias seguidos de check-in">
          <span className={`text-xl ${effectiveStreak > 0 ? "" : "grayscale opacity-50"}`}>🔥</span>
          <span className="text-lg font-extrabold text-amber-500">{effectiveStreak}</span>
          <span className="text-xs font-medium text-muted-foreground">
            {effectiveStreak === 1 ? "dia" : "dias"}
          </span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xl">💎</span>
          <span className="text-lg font-extrabold text-sky-500">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5" title="Figurinhas coletadas">
          <span className="text-xl">🏆</span>
          <span className="text-lg font-extrabold text-violet-500">{stickers.length}</span>
          <span className="text-xs font-medium text-muted-foreground">figurinhas</span>
        </div>
      </div>

      {/* Check-in diário de 1 toque */}
      {!checkedToday && (
        <div className="rounded-2xl bg-white/80 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)] backdrop-blur-sm">
          <p className="text-sm font-bold">Como você está hoje?</p>
          <p className="text-xs text-muted-foreground">
            Um toque mantém sua chama acesa 🔥
            {effectiveStreak > 0 ? ` (${effectiveStreak} dias)` : ""}
          </p>
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

      {/* Banner de seção */}
      <div
        className={`flex items-center justify-between rounded-2xl ${meta.banner} px-5 py-4 text-white shadow-md`}
      >
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            {meta.name}
          </p>
          <p className="mt-0.5 text-xl font-extrabold">
            Semana {currentWeek}
            <span className="ml-1.5 text-sm font-semibold text-white/75">de 40</span>
          </p>
        </div>
        <div className="text-4xl">
          {stickers.includes(currentWeek)
            ? (FRUIT_EMOJI[currentWeek] ?? "🤰")
            : (MILESTONES[currentWeek]?.emoji ?? "🎁")}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Toque nas semanas para colecionar as figurinhas do bebê 🎁
      </p>

      {/* Caminho */}
      <div
        ref={containerRef}
        className="relative overflow-y-auto rounded-3xl bg-gradient-to-b from-white/60 to-white/30 backdrop-blur-sm"
        style={{ height: "64vh" }}
      >
        <div className="relative" style={{ height: `${CONTAINER_HEIGHT}px` }}>
          {Array.from({ length: NODE_COUNT }, (_, i) => {
            const week = i + 1;
            const xPct = nodeXPct(week);
            const y = nodeY(week);
            const isCurrent = week === currentWeek;
            const done = week < currentWeek;
            const unlocked = done || isCurrent;
            const milestone = MILESTONES[week];
            const collected = stickers.includes(week);
            const golden = unlocked && weekComplete(week);
            const tm = trimMeta(week);
            const palette = !unlocked ? LOCKED : golden ? GOLD : tm;

            const dia = isCurrent ? 78 : milestone ? 68 : 58;
            const isChest = isCurrent && !collected;

            return (
              <div key={week}>
                {/* Mascote ao lado do nó atual — sempre no lado interno da tela */}
                {isCurrent && (
                  <div
                    className="pointer-events-none absolute z-10"
                    style={{
                      top: `${y - 6}px`,
                      left: `${xPct < 50 ? xPct + 14 : xPct - 14}%`,
                      transform: xPct < 50 ? "none" : "translateX(-100%)",
                    }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 text-4xl shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
                      {collected ? (FRUIT_EMOJI[week] ?? "👶") : "👶"}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => openSheet(week)}
                  className="group absolute flex -translate-x-1/2 flex-col items-center focus:outline-none"
                  style={{ left: `${xPct}%`, top: `${y}px` }}
                  aria-label={`Semana ${week}`}
                >
                  {isCurrent && (
                    <div className="duo-bubble absolute -top-11 z-20 whitespace-nowrap">
                      <div className="relative rounded-xl bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-pink-500 shadow-[0_3px_10px_rgba(0,0,0,0.12)]">
                        {isChest ? "Toque para abrir 🎁" : "Você está aqui"}
                        <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white" />
                      </div>
                    </div>
                  )}

                  <div
                    className={`duo3d flex items-center justify-center rounded-full ${
                      isCurrent ? "ring-4 ring-white/70" : ""
                    } ${isChest ? "dc-chest" : ""}`}
                    style={
                      {
                        width: `${dia}px`,
                        height: `${dia}px`,
                        background: palette.main,
                        "--lip": palette.lip,
                      } as React.CSSProperties
                    }
                  >
                    {isChest ? (
                      <span className="text-3xl">🎁</span>
                    ) : milestone ? (
                      <span
                        className={`${isCurrent ? "text-3xl" : "text-2xl"} ${!unlocked ? "opacity-45 grayscale" : ""}`}
                      >
                        {milestone.emoji}
                      </span>
                    ) : collected ? (
                      <span className={isCurrent ? "text-3xl" : "text-2xl"}>
                        {FRUIT_EMOJI[week] ?? "🍼"}
                      </span>
                    ) : done ? (
                      <span className="text-2xl font-black text-white">✓</span>
                    ) : (
                      <span
                        className={`font-black tabular-nums ${
                          unlocked ? "text-white" : "text-slate-400"
                        } ${isCurrent ? "text-xl" : "text-lg"}`}
                      >
                        {week}
                      </span>
                    )}
                  </div>

                  <span
                    className={`mt-1.5 flex items-center gap-0.5 text-[10px] font-bold ${
                      unlocked ? tm.softText : "text-slate-300"
                    }`}
                  >
                    {week}s{golden && <span title="Tarefas da semana completas">⭐</span>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom sheet — a experiência do toque */}
      {sheetOpen && selectedWeek && selectedBaby && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(2px)" }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-10 shadow-2xl"
            style={{ animation: "slideUp 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}
            onClick={(e) => e.stopPropagation()}
          >
            {revealing && <ConfettiBurst />}
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />

            {/* 1+2 · Hero do bebê */}
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`duo3d flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-3xl ${revealing ? "dc-sticker-pop" : ""}`}
                style={
                  {
                    background: trimMeta(selectedWeek).main,
                    "--lip": trimMeta(selectedWeek).lip,
                  } as React.CSSProperties
                }
              >
                {selectedWeek <= currentWeek
                  ? (FRUIT_EMOJI[selectedWeek] ?? MILESTONES[selectedWeek]?.emoji ?? "👶")
                  : "🔒"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Semana {selectedWeek}
                  {selectedWeek === currentWeek && (
                    <span className="ml-2 rounded-full bg-pink-100 px-2 py-0.5 text-pink-600">
                      você está aqui
                    </span>
                  )}
                </p>
                <h3 className="mt-0.5 truncate text-2xl font-extrabold">
                  {selectedWeek <= currentWeek ? selectedBaby.fruit : "Ainda é surpresa..."}
                </h3>
              </div>
              {selectedWeek <= currentWeek && (
                <button
                  onClick={() => share(selectedWeek)}
                  className="press shrink-0 rounded-full bg-pink-50 px-3 py-2 text-sm font-bold text-pink-600"
                  aria-label="Compartilhar"
                >
                  Enviar 💌
                </button>
              )}
            </div>

            {selectedWeek <= currentWeek ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-pink-50 p-3">
                    <p className="text-xs font-bold text-pink-600">📏 Tamanho</p>
                    <p className="mt-0.5 text-lg font-extrabold">{selectedBaby.size}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-600">⚖️ Peso</p>
                    <p className="mt-0.5 text-lg font-extrabold">{selectedBaby.weight}</p>
                  </div>
                </div>

                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  {selectedBaby.desc.replace("seu bebê", babyLabel)}
                </p>

                {MILESTONES[selectedWeek] && (
                  <div className="mb-4 rounded-2xl bg-violet-50 p-3">
                    <p className="text-sm font-bold text-violet-700">
                      🎯 Marco: {MILESTONES[selectedWeek].label}
                    </p>
                  </div>
                )}

                {/* 3 · Orientação do Dr. Clóvis (autoridade) */}
                <div className="mb-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-600">
                    🩺 Orientação do Dr. Clóvis
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-sky-900">
                    {consultaForWeek(selectedWeek)}
                  </p>
                </div>

                {/* 4 · Tarefas da semana (conversão) */}
                <div className="mb-4 rounded-2xl bg-emerald-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      ✅ O que fazer nesta semana
                    </p>
                    {weekTasks(selectedWeek).every((t) => taskState[t.id]) && (
                      <span className="text-lg">⭐</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {weekTasks(selectedWeek).map((t) => (
                      <div key={t.id} className="flex items-center gap-2">
                        <button
                          onClick={() => toggleTask(selectedWeek, t.id)}
                          className={`press flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-black text-white transition-colors ${
                            taskState[t.id]
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-emerald-300 bg-white"
                          }`}
                          aria-label={taskState[t.id] ? "Desmarcar" : "Concluir"}
                        >
                          {taskState[t.id] ? "✓" : ""}
                        </button>
                        <span
                          className={`flex-1 text-sm ${taskState[t.id] ? "text-emerald-600 line-through" : "text-emerald-900"}`}
                        >
                          {t.label}
                        </span>
                        {t.agendar && !taskState[t.id] && (
                          <a
                            href="/agendamento"
                            className="press shrink-0 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white"
                          >
                            Agendar
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-emerald-700/70">
                    Complete tudo e o nó desta semana fica dourado ⭐
                  </p>
                </div>

                {/* 5 · Gancho: check-in + teaser da próxima semana */}
                {!checkedToday && selectedWeek === currentWeek && (
                  <div className="mb-4 rounded-2xl bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-800">
                      🔥 Mantenha sua chama: como você está hoje?
                    </p>
                    <div className="mt-2 flex gap-2">
                      {MOODS.map((m) => (
                        <button
                          key={m.label}
                          onClick={() => doCheckin(m.label)}
                          className="press rounded-xl bg-white px-3 py-1.5 text-xl shadow-sm"
                        >
                          {m.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedWeek === currentWeek && currentWeek < 40 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      🔒 Semana {currentWeek + 1} · desbloqueia em {daysToNextWeek}{" "}
                      {daysToNextWeek === 1 ? "dia" : "dias"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400 blur-[3px] select-none">
                      {babyForWeek(currentWeek + 1).desc}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      Volte para abrir o próximo baú e coletar a figurinha 🎁
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl bg-slate-50 p-6 text-center">
                <p className="text-4xl">🔒</p>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  Essa semana ainda não chegou
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Desbloqueia quando você chegar na semana {selectedWeek}. Cada semana é uma
                  surpresa nova sobre {babyLabel} 💝
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
