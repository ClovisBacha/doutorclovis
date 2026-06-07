import { babyStage, WEEK_MIN, WEEK_MAX, type BabyStage } from "@/lib/gestacao";

/**
 * Ilustração vetorial estilizada do bebê em posição fetal, desenhada em SVG
 * com as cores do site. A figura evolui por estágio (embrião → feto → bebê a
 * termo) e cresce suavemente conforme a semana avança. Sem imagens externas:
 * tudo é renderizado em código, leve e nítido em qualquer tela.
 */

const STAGE_LABEL: Record<BabyStage, string> = {
  embriao: "Embrião",
  inicial: "Feto inicial",
  feto: "Feto",
  tardio: "Feto (reta final)",
  termo: "Bebê a termo",
};

// Fração de crescimento (0 a 1) ao longo de toda a gestação — controla o
// tamanho da figura dentro do "saco amniótico".
function growth(week: number) {
  const t = (week - WEEK_MIN) / (WEEK_MAX - WEEK_MIN);
  return Math.max(0, Math.min(1, t));
}

export function BabyIllustration({ week }: { week: number }) {
  const stage = babyStage(week);
  const g = growth(week);

  // A figura escala de ~0.5 (4 semanas) a ~1.0 (42 semanas).
  const scale = 0.5 + g * 0.5;
  // Embriões/fetos iniciais têm a cabeça proporcionalmente enorme.
  const headRatio =
    stage === "embriao" ? 1.35 : stage === "inicial" ? 1.2 : stage === "feto" ? 1.05 : 1;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Ilustração do bebê em posição fetal — ${STAGE_LABEL[stage]}, semana ${week}`}
        className="h-48 w-48 md:h-56 md:w-56"
      >
        <defs>
          <radialGradient id="sac" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="oklch(0.97 0.02 30)" />
            <stop offset="100%" stopColor="oklch(0.92 0.04 22)" />
          </radialGradient>
          <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.09 22)" />
            <stop offset="100%" stopColor="oklch(0.62 0.11 18)" />
          </linearGradient>
        </defs>

        {/* Saco amniótico — cresce um pouco com a gestação */}
        <circle cx="100" cy="100" r={70 + g * 18} fill="url(#sac)" />
        <circle
          cx="100"
          cy="100"
          r={70 + g * 18}
          fill="none"
          stroke="oklch(0.5 0.11 18)"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />

        <g transform={`translate(100 102) scale(${scale}) translate(-100 -100)`} fill="url(#body)">
          {stage === "embriao" ? <Embryo /> : <Fetus headRatio={headRatio} stage={stage} />}
        </g>
      </svg>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-primary/80">
        {STAGE_LABEL[stage]}
      </p>
    </div>
  );
}

/** Embrião: forma encurvada em "vírgula", com um ponto = coração batendo. */
function Embryo() {
  return (
    <g>
      <path
        d="M118 70
           C 140 78, 142 108, 122 122
           C 112 129, 98 128, 92 118
           C 87 110, 90 100, 98 98
           C 88 96, 84 86, 90 78
           C 96 70, 110 66, 118 70 Z"
      />
      {/* esboço do olho */}
      <circle cx="112" cy="86" r="4" fill="oklch(0.35 0.07 18)" fillOpacity="0.65" />
      {/* coração batendo */}
      <circle cx="104" cy="108" r="5" fill="oklch(0.55 0.18 18)">
        <animate attributeName="r" values="4;6;4" dur="1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

/** Feto/bebê em posição fetal: cabeça redonda + corpo encurvado + membros. */
function Fetus({ headRatio, stage }: { headRatio: number; stage: BabyStage }) {
  const headR = 26 * headRatio;
  // Bebê a termo é mais "rechonchudo".
  const plump = stage === "termo" ? 1.08 : stage === "tardio" ? 1.03 : 1;

  return (
    <g>
      {/* Corpo encurvado (tronco + bumbum) */}
      <path
        d={`M96 78
           C ${118 * plump} 76, ${134 * plump} 96, 130 118
           C 127 136, 110 146, 92 142
           C 80 139, 74 128, 78 118
           C 81 110, 88 106, 92 100
           C 94 94, 92 86, 96 78 Z`}
      />
      {/* Perna dobrada (joelho recolhido) */}
      <path
        d="M86 132 C 74 134, 66 126, 70 116 C 73 110, 80 110, 84 116 C 88 122, 90 128, 86 132 Z"
        fillOpacity="0.92"
      />
      {/* Bracinho junto ao rosto */}
      <path d="M82 92 C 72 90, 66 96, 70 104 C 73 109, 79 108, 82 102 Z" fillOpacity="0.9" />
      {/* Cabeça */}
      <circle cx="82" cy="70" r={headR} />
      {/* Carinha (rosto voltado para baixo-esquerda) */}
      <circle cx={82 - headR * 0.45} cy="70" r="3.4" fill="oklch(0.32 0.07 18)" fillOpacity="0.7" />
      <path
        d={`M${82 - headR * 0.62} 78 q 5 5 11 1`}
        fill="none"
        stroke="oklch(0.32 0.07 18)"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}
