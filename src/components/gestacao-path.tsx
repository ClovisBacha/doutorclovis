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

const MILESTONE_WEEKS = Object.keys(MILESTONES).map(Number);

const NODE_ROW_HEIGHT = 108;
const NODE_COUNT = 40;
const CONTAINER_HEIGHT = NODE_COUNT * NODE_ROW_HEIGHT + 120;

/** Posição horizontal (0–100%) em zigue-zague suave. */
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

export function GestacaoPath({ profile, gest }: GestacaoPathProps) {
  const hasGest = !!gest;
  const currentWeek = hasGest ? Math.max(1, Math.min(40, gest.weeks)) : 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !hasGest || currentWeek === 0) return;
    const el = containerRef.current;
    const y = nodeY(currentWeek);
    const t = setTimeout(() => {
      el.scrollTo({ top: y - el.clientHeight / 2, behavior: "smooth" });
    }, 400);
    return () => clearTimeout(t);
  }, [currentWeek, hasGest]);

  function openSheet(week: number) {
    setSelectedWeek(week);
    setSheetOpen(true);
  }

  const selectedBaby = selectedWeek ? babyForWeek(selectedWeek) : null;
  const progressPct = hasGest ? Math.min(100, (currentWeek / 40) * 100) : 0;
  const meta = trimMeta(currentWeek || 1);
  const milestonesReached = MILESTONE_WEEKS.filter((w) => w <= currentWeek).length;
  const babyLabel = profile?.baby_name || "seu bebê";

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
      {/* Barra de stats estilo Duolingo */}
      <div className="flex items-center justify-around rounded-2xl bg-white/70 px-3 py-2.5 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-1.5">
          <span className="text-xl">🔥</span>
          <span className="text-lg font-extrabold text-amber-500">{currentWeek}</span>
          <span className="text-xs font-medium text-muted-foreground">sem</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xl">💎</span>
          <span className="text-lg font-extrabold text-sky-500">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span className="text-xl">🏆</span>
          <span className="text-lg font-extrabold text-violet-500">{milestonesReached}</span>
          <span className="text-xs font-medium text-muted-foreground">marcos</span>
        </div>
      </div>

      {/* Banner de seção colorido */}
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
        <div className="text-4xl">{MILESTONES[currentWeek]?.emoji ?? "🤰"}</div>
      </div>

      {/* Caminho — nós 3D flutuantes */}
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
            const filled = done || isCurrent;
            const milestone = MILESTONES[week];
            const tm = trimMeta(week);
            const main = filled ? tm.main : LOCKED.main;
            const lip = filled ? tm.lip : LOCKED.lip;

            const dia = isCurrent ? 78 : milestone ? 68 : 58;

            return (
              <div key={week}>
                {/* Mascote/fruta ao lado do nó atual */}
                {isCurrent && (
                  <div
                    className="pointer-events-none absolute z-10 flex flex-col items-center"
                    style={{
                      top: `${y - 6}px`,
                      left: xPct < 50 ? `${xPct + 26}%` : undefined,
                      right: xPct >= 50 ? `${72 - xPct}%` : undefined,
                    }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 text-4xl shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
                      {milestone?.emoji ?? "👶"}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => openSheet(week)}
                  className="group absolute flex -translate-x-1/2 flex-col items-center focus:outline-none"
                  style={{ left: `${xPct}%`, top: `${y}px` }}
                  aria-label={`Semana ${week}`}
                >
                  {/* Balão "VOCÊ ESTÁ AQUI" */}
                  {isCurrent && (
                    <div className="duo-bubble absolute -top-11 z-20 whitespace-nowrap">
                      <div className="relative rounded-xl bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-pink-500 shadow-[0_3px_10px_rgba(0,0,0,0.12)]">
                        Você está aqui
                        <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white" />
                      </div>
                    </div>
                  )}

                  <div
                    className={`duo3d flex items-center justify-center rounded-full ${
                      isCurrent ? "ring-4 ring-white/70" : ""
                    }`}
                    style={
                      {
                        width: `${dia}px`,
                        height: `${dia}px`,
                        background: main,
                        "--lip": lip,
                      } as React.CSSProperties
                    }
                  >
                    {milestone ? (
                      <span className={isCurrent ? "text-3xl" : "text-2xl"}>{milestone.emoji}</span>
                    ) : done ? (
                      <span className="text-2xl font-black text-white">✓</span>
                    ) : (
                      <span
                        className={`font-black tabular-nums ${
                          filled ? "text-white" : "text-slate-400"
                        } ${isCurrent ? "text-xl" : "text-lg"}`}
                      >
                        {week}
                      </span>
                    )}
                  </div>

                  {/* Rótulo da semana */}
                  <span
                    className={`mt-1.5 text-[10px] font-bold ${
                      filled ? tm.softText : "text-slate-300"
                    }`}
                  >
                    {week}s
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom sheet */}
      {sheetOpen && selectedWeek && selectedBaby && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(2px)" }}
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-6 pb-10 shadow-2xl"
            style={{ animation: "slideUp 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />

            <div className="mb-4 flex items-center gap-3">
              <div
                className="duo3d flex h-16 w-16 items-center justify-center rounded-full text-3xl"
                style={
                  {
                    background: trimMeta(selectedWeek).main,
                    "--lip": trimMeta(selectedWeek).lip,
                  } as React.CSSProperties
                }
              >
                {MILESTONES[selectedWeek]?.emoji ?? "👶"}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Semana {selectedWeek}
                  {selectedWeek === currentWeek && (
                    <span className="ml-2 rounded-full bg-pink-100 px-2 py-0.5 text-pink-600">
                      você está aqui
                    </span>
                  )}
                </p>
                <h3 className="mt-0.5 text-2xl font-extrabold">{selectedBaby.fruit}</h3>
              </div>
            </div>

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

            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              {selectedBaby.desc.replace("seu bebê", babyLabel)}
            </p>

            {MILESTONES[selectedWeek] && (
              <div className="rounded-2xl bg-violet-50 p-3">
                <p className="text-sm font-bold text-violet-700">
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
