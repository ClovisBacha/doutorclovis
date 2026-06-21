import { useEffect, useRef, useState } from "react";
import { babyForWeek } from "@/lib/gestacao";

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

const NODE_ROW_HEIGHT = 80;
const NODE_COUNT = 40;
const CONTAINER_HEIGHT = NODE_COUNT * NODE_ROW_HEIGHT + 80;

function nodeXPct(week: number): number {
  return 50 + 28 * Math.sin(((week - 1) * Math.PI) / 4);
}

function nodeY(week: number): number {
  return 40 + (week - 1) * NODE_ROW_HEIGHT;
}

function trimColors(week: number) {
  if (week <= 13)
    return { bg: "bg-pink-500", ring: "ring-pink-300", pingBg: "bg-pink-400", hex: "#f472b6" };
  if (week <= 27)
    return { bg: "bg-amber-500", ring: "ring-amber-300", pingBg: "bg-amber-400", hex: "#f59e0b" };
  return { bg: "bg-violet-500", ring: "ring-violet-300", pingBg: "bg-violet-400", hex: "#8b5cf6" };
}

function buildSvgPath(maxWeek: number): string {
  const count = Math.min(Math.max(maxWeek, 1), NODE_COUNT);
  const pts = Array.from({ length: count }, (_, i) => ({
    x: nodeXPct(i + 1),
    y: nodeY(i + 1),
  }));
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1];
    const c = pts[i];
    const midY = (p.y + c.y) / 2;
    d += ` C ${p.x.toFixed(2)} ${midY} ${c.x.toFixed(2)} ${midY} ${c.x.toFixed(2)} ${c.y}`;
  }
  return d;
}

export function GestacaoPath({ profile, gest }: GestacaoPathProps) {
  const hasGest = !!gest;
  const currentWeek = hasGest ? Math.max(1, Math.min(40, gest.weeks)) : 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !hasGest || currentWeek === 0) return;
    const y = nodeY(currentWeek);
    const el = containerRef.current;
    setTimeout(() => {
      el.scrollTop = y - el.clientHeight / 2;
    }, 350);
  }, [currentWeek, hasGest]);

  function openSheet(week: number) {
    setSelectedWeek(week);
    setSheetOpen(true);
  }

  const selectedBaby = selectedWeek ? babyForWeek(selectedWeek) : null;
  const progressPct = hasGest ? Math.min(100, (currentWeek / 40) * 100) : 0;
  const trimLabel = !hasGest
    ? "—"
    : currentWeek <= 13
      ? "1º Trimestre"
      : currentWeek <= 27
        ? "2º Trimestre"
        : "3º Trimestre";

  const heroEmoji = hasGest ? (MILESTONES[currentWeek]?.emoji ?? "🌸") : "🌸";

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
      {/* Header card */}
      <div className="glass-card glass-pink rounded-3xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-pink-600">Sua Jornada</p>
            <p className="mt-1 text-3xl font-bold">
              Semana {currentWeek}
              <span className="ml-2 text-lg font-normal text-muted-foreground">de 40</span>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{trimLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-5xl leading-none">{heroEmoji}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {progressPct.toFixed(0)}% concluído
            </p>
          </div>
        </div>

        {/* Gradient progress bar */}
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/40">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #f472b6 0%, #f59e0b 50%, #8b5cf6 100%)",
            }}
          />
        </div>

        {/* Trimester pills */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {[
            {
              label: "T1 · 1–13s",
              active: currentWeek <= 13,
              on: "bg-pink-500 text-white shadow-sm",
              off: "bg-pink-100/80 text-pink-400",
            },
            {
              label: "T2 · 14–27s",
              active: currentWeek >= 14 && currentWeek <= 27,
              on: "bg-amber-500 text-white shadow-sm",
              off: "bg-amber-100/80 text-amber-400",
            },
            {
              label: "T3 · 28–40s",
              active: currentWeek >= 28,
              on: "bg-violet-500 text-white shadow-sm",
              off: "bg-violet-100/80 text-violet-400",
            },
          ].map((t) => (
            <span
              key={t.label}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                t.active ? t.on : t.off
              }`}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Toque em qualquer semana para ver o desenvolvimento do bebê
      </p>

      {/* Scrollable S-curve path */}
      <div
        ref={containerRef}
        className="relative overflow-y-auto rounded-3xl bg-white/20 backdrop-blur-sm"
        style={{ height: "70vh" }}
      >
        <div className="relative" style={{ height: `${CONTAINER_HEIGHT}px` }}>
          {/* SVG connecting lines */}
          <svg
            viewBox={`0 0 100 ${CONTAINER_HEIGHT}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 w-full"
            style={{ height: `${CONTAINER_HEIGHT}px` }}
          >
            <defs>
              <linearGradient id="gestPathGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="45%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>

            {/* Gray full path */}
            <path
              d={buildSvgPath(40)}
              fill="none"
              stroke="rgba(203,213,225,0.5)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Colored progress path */}
            {currentWeek > 0 && (
              <path
                d={buildSvgPath(currentWeek)}
                fill="none"
                stroke="url(#gestPathGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {/* Week nodes */}
          {Array.from({ length: NODE_COUNT }, (_, i) => {
            const week = i + 1;
            const xPct = nodeXPct(week);
            const y = nodeY(week);
            const isCurrent = week === currentWeek;
            const isPast = week < currentWeek;
            const milestone = MILESTONES[week];
            const tc = trimColors(week);

            const size = isCurrent ? "w-16 h-16" : milestone ? "w-12 h-12" : "w-9 h-9";
            const filled = isCurrent || isPast;

            return (
              <button
                key={week}
                onClick={() => openSheet(week)}
                className={`press absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none`}
                style={{ left: `${xPct}%`, top: `${y}px` }}
                aria-label={`Semana ${week}`}
              >
                {/* Ping ring for current week */}
                {isCurrent && (
                  <span
                    className={`absolute inset-0 rounded-full ${tc.pingBg} animate-ping opacity-25`}
                  />
                )}

                <div
                  className={[
                    "relative flex items-center justify-center rounded-full transition-all duration-200",
                    size,
                    filled ? `${tc.bg} text-white shadow-md` : "bg-slate-100 text-slate-400",
                    isCurrent ? `ring-4 ring-offset-2 ${tc.ring}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {milestone ? (
                    <span className={isCurrent ? "text-2xl" : milestone ? "text-xl" : "text-sm"}>
                      {milestone.emoji}
                    </span>
                  ) : (
                    <span className={`tabular-nums font-bold ${isCurrent ? "text-sm" : "text-xs"}`}>
                      {week}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom sheet overlay */}
      {sheetOpen && selectedWeek && selectedBaby && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: "rgba(0,0,0,0.18)", backdropFilter: "blur(2px)" }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full glass-card glass-pink rounded-t-3xl p-6 pb-10"
            style={{ animation: "slideUp 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-pink-200" />

            {/* Title row */}
            <div className="mb-4 flex items-center gap-3">
              {MILESTONES[selectedWeek] && (
                <span className="text-4xl">{MILESTONES[selectedWeek].emoji}</span>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Semana {selectedWeek}
                  {selectedWeek === currentWeek && (
                    <span className="ml-2 rounded-full bg-pink-100 px-2 py-0.5 text-pink-600">
                      você está aqui
                    </span>
                  )}
                </p>
                <h3 className="mt-0.5 text-2xl font-bold">{selectedBaby.fruit}</h3>
              </div>
            </div>

            {/* Stats grid */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="glass-card glass-pink rounded-2xl p-3">
                <p className="text-xs font-medium text-pink-600">📏 Tamanho</p>
                <p className="mt-0.5 text-lg font-bold">{selectedBaby.size}</p>
              </div>
              <div className="glass-card glass-amber rounded-2xl p-3">
                <p className="text-xs font-medium text-amber-600">⚖️ Peso</p>
                <p className="mt-0.5 text-lg font-bold">{selectedBaby.weight}</p>
              </div>
            </div>

            {/* Description */}
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              {selectedBaby.desc}
            </p>

            {/* Milestone banner */}
            {MILESTONES[selectedWeek] && (
              <div className="glass-card glass-violet rounded-2xl p-3">
                <p className="text-sm font-semibold text-violet-700">
                  🎯 Marco: {MILESTONES[selectedWeek].label}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
