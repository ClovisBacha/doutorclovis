import babyEmbriao from "@/assets/baby-embriao.png";
import babyInicial from "@/assets/baby-inicial.png";
import babyFeto from "@/assets/baby-feto.png";
import babyTardio from "@/assets/baby-tardio.png";
import babyTermo from "@/assets/baby-termo.png";
import { babyStage, babyForWeek, WEEK_MIN, WEEK_MAX, type BabyStage } from "@/lib/gestacao";

export const STAGE_LABEL: Record<BabyStage, string> = {
  embriao: "Embrião",
  inicial: "Feto inicial",
  feto: "Feto",
  tardio: "Feto (reta final)",
  termo: "Bebê a termo",
};

export const STAGE_RANGES: Record<BabyStage, [number, number]> = {
  embriao: [4, 9],
  inicial: [10, 15],
  feto: [16, 27],
  tardio: [28, 36],
  termo: [37, 42],
};

const STAGE_BASE_SCALE: Record<BabyStage, number> = {
  embriao: 0.38,
  inicial: 0.5,
  feto: 0.46,
  tardio: 0.68,
  termo: 0.84,
};

const STAGE_IMG: Record<BabyStage, string> = {
  embriao: babyEmbriao,
  inicial: babyInicial,
  feto: babyFeto,
  tardio: babyTardio,
  termo: babyTermo,
};

// embriao and termo images have white backgrounds — multiply blends white out on light bg
const WHITE_BG_STAGES = new Set<BabyStage>(["embriao", "termo"]);

/**
 * Tons de pele do bebê (0 = arte original clara → 4 = pele retinta).
 * Aplicados por filtro SVG de gamma por canal sobre a arte PNG: escurece a
 * pele preservando o branco do fundo. `swatch` é a cor mostrada na paleta
 * de escolha (cadastro/perfil).
 */
export const BABY_TONES: { label: string; swatch: string; exp: [number, number, number] }[] = [
  { label: "Claro", swatch: "#f7d9c4", exp: [1, 1, 1] },
  { label: "Claro médio", swatch: "#eec39a", exp: [1.18, 1.3, 1.42] },
  { label: "Médio", swatch: "#d9a066", exp: [1.42, 1.62, 1.85] },
  { label: "Moreno", swatch: "#a9714b", exp: [1.8, 2.15, 2.5] },
  { label: "Retinto", swatch: "#7a4b32", exp: [2.3, 2.85, 3.4] },
];

/** Normaliza um valor livre (banco) para um índice válido da paleta. */
export function clampTone(tone: number | null | undefined): number {
  const t = Math.round(Number(tone ?? 0));
  return Number.isFinite(t) ? Math.min(BABY_TONES.length - 1, Math.max(0, t)) : 0;
}

function growth(week: number) {
  return Math.max(0, Math.min(1, (week - WEEK_MIN) / (WEEK_MAX - WEEK_MIN)));
}

export function BabyIllustration({
  week,
  showSac = true,
  showInfo = true,
  className,
  tone = 0,
}: {
  week: number;
  /** false = bebê "livre", sem o círculo do saco amniótico */
  showSac?: boolean;
  /** false = oculta a legenda de estágio/tamanho/peso abaixo do SVG */
  showInfo?: boolean;
  /** classes do <svg> — sobrescreve o tamanho padrão */
  className?: string;
  /** Tom de pele do bebê (índice em BABY_TONES; 0 = arte original). */
  tone?: number;
}) {
  const stage = babyStage(week);
  const toneIdx = clampTone(tone);
  const [er, eg, eb] = BABY_TONES[toneIdx].exp;
  const toneFilterId = `baby-tone-${toneIdx}`;
  const g = growth(week);
  const sacR = 72 + g * 16;
  const info = babyForWeek(week);

  const [sMin, sMax] = STAGE_RANGES[stage];
  const t = Math.max(0, Math.min(1, (week - sMin) / (sMax - sMin)));
  const baseScale = STAGE_BASE_SCALE[stage];
  const freeBoost = showSac ? 1 : 1.18;
  const bodyScale = Math.min(1.1, (baseScale + t * (1 - baseScale)) * freeBoost);
  const tx = 100 * (1 - bodyScale);
  const isWhiteBg = WHITE_BG_STAGES.has(stage);

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Ilustração — ${STAGE_LABEL[stage]}, semana ${week}`}
        className={className ?? "h-48 w-48 md:h-56 md:w-56"}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* ── Saco amniótico ─────────────────────────────────── */}
          <radialGradient id="sac" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fef8f2" />
            <stop offset="52%" stopColor="#fae6d0" />
            <stop offset="100%" stopColor="#efceb0" />
          </radialGradient>
          <radialGradient id="sac-glow" cx="39%" cy="34%" r="54%">
            <stop offset="0%" stopColor="#fffdf8" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#fffdf8" stopOpacity="0" />
          </radialGradient>
          <filter id="blur-m">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          {toneIdx > 0 && (
            <filter id={toneFilterId} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="gamma" amplitude="1" exponent={er} offset="0" />
                <feFuncG type="gamma" amplitude="1" exponent={eg} offset="0" />
                <feFuncB type="gamma" amplitude="1" exponent={eb} offset="0" />
              </feComponentTransfer>
            </filter>
          )}
          {showSac && (
            <clipPath id="sac-clip">
              <circle cx="100" cy="100" r={sacR} />
            </clipPath>
          )}
        </defs>

        {/* ── Saco amniótico (opcional) ─────────────────────────── */}
        {showSac && (
          <>
            <circle cx="100" cy="100" r={sacR} fill="url(#sac)" />
            <circle cx="100" cy="100" r={sacR} fill="url(#sac-glow)" />
            <circle
              cx="100"
              cy="100"
              r={sacR}
              fill="none"
              stroke="#d08860"
              strokeWidth="2.2"
              strokeOpacity="0.26"
            />
            {/* Reflexo principal */}
            <ellipse
              cx={100 - sacR * 0.29}
              cy={100 - sacR * 0.31}
              rx={sacR * 0.25}
              ry={sacR * 0.12}
              fill="white"
              fillOpacity="0.3"
              transform={`rotate(-24 ${100 - sacR * 0.29} ${100 - sacR * 0.31})`}
            />
            {/* Reflexo secundário */}
            <ellipse
              cx={100 - sacR * 0.19}
              cy={100 - sacR * 0.41}
              rx={sacR * 0.09}
              ry={sacR * 0.05}
              fill="white"
              fillOpacity="0.52"
              transform={`rotate(-19 ${100 - sacR * 0.19} ${100 - sacR * 0.41})`}
            />
          </>
        )}

        {/* ── Imagem do bebê — escala contínua semana a semana ─────── */}
        <g
          transform={`translate(${tx} ${tx}) scale(${bodyScale})`}
          clipPath={showSac ? "url(#sac-clip)" : undefined}
        >
          <image
            href={STAGE_IMG[stage]}
            x="0"
            y="0"
            width="200"
            height="200"
            preserveAspectRatio="xMidYMid meet"
            filter={toneIdx > 0 ? `url(#${toneFilterId})` : undefined}
            style={isWhiteBg ? { mixBlendMode: "multiply" } : undefined}
          />
        </g>
      </svg>

      {/* ── Informações da semana ─────────── */}
      {showInfo && (
        <div className="mt-2 w-full text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/80">
            {STAGE_LABEL[stage]}
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-xs font-semibold text-foreground">
            <span>{info.size}</span>
            {info.weight !== "—" && (
              <>
                <span className="text-border">·</span>
                <span>{info.weight}</span>
              </>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-primary/70">{info.fruit}</p>
          <p className="mx-auto mt-1 max-w-[220px] text-[11px] leading-snug text-muted-foreground">
            {info.desc}
          </p>
        </div>
      )}
    </div>
  );
}
