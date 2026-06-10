/**
 * BabyIllustration — ilustrações SVG artísticas do desenvolvimento fetal.
 *
 * Cada estágio usa:
 *  - Gradientes radiais por parte do corpo (luz top-left → sombra bottom-right)
 *  - Camada especular sobreposta (brilho de pele úmida)
 *  - Subsurface scattering nas bordas (calor vermelho em pele fina)
 *  - Saco amniótico com glow interno e reflexo especular
 */
import { babyStage, WEEK_MIN, WEEK_MAX, type BabyStage } from "@/lib/gestacao";

const STAGE_LABEL: Record<BabyStage, string> = {
  embriao: "Embrião",
  inicial: "Feto inicial",
  feto: "Feto",
  tardio: "Feto (reta final)",
  termo: "Bebê a termo",
};

function growth(week: number) {
  return Math.max(0, Math.min(1, (week - WEEK_MIN) / (WEEK_MAX - WEEK_MIN)));
}

export function BabyIllustration({ week }: { week: number }) {
  const stage = babyStage(week);
  const g = growth(week);
  const sacR = 72 + g * 16;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Ilustração — ${STAGE_LABEL[stage]}, semana ${week}`}
        className="h-48 w-48 md:h-56 md:w-56"
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

          {/* ── Pele — gradiente radial "esfera iluminada" ─────── */}
          {/* Cabeça */}
          <radialGradient id="sk-h" cx="34%" cy="26%" r="78%">
            <stop offset="0%" stopColor="#f6cdb0" />
            <stop offset="20%" stopColor="#eaac88" />
            <stop offset="52%" stopColor="#d28464" />
            <stop offset="80%" stopColor="#ba6e54" />
            <stop offset="100%" stopColor="#9e5244" />
          </radialGradient>
          {/* Tronco */}
          <radialGradient id="sk-b" cx="36%" cy="28%" r="76%">
            <stop offset="0%" stopColor="#f2c2a0" />
            <stop offset="26%" stopColor="#e2a27e" />
            <stop offset="58%" stopColor="#c87e5c" />
            <stop offset="100%" stopColor="#a8644c" />
          </radialGradient>
          {/* Membros */}
          <radialGradient id="sk-l" cx="40%" cy="32%" r="74%">
            <stop offset="0%" stopColor="#edbc9c" />
            <stop offset="42%" stopColor="#d29272" />
            <stop offset="100%" stopColor="#ae7258" />
          </radialGradient>

          {/* Brilho especular — "pele molhada" (aplica sobre qualquer forma) */}
          <radialGradient id="spec" cx="28%" cy="18%" r="62%">
            <stop offset="0%" stopColor="white" stopOpacity="0.44" />
            <stop offset="48%" stopColor="white" stopOpacity="0.06" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>

          {/* Subsurface scattering — vermelho quente nas bordas finas */}
          <radialGradient id="sss" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="#d04838" stopOpacity="0" />
            <stop offset="100%" stopColor="#d04838" stopOpacity="0.13" />
          </radialGradient>

          {/* Filtros */}
          <filter id="blur-s">
            <feGaussianBlur stdDeviation="1.0" />
          </filter>
          <filter id="blur-m">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>

        {/* ── Saco amniótico ────────────────────────────────────── */}
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

        {/* ── Estágio ──────────────────────────────────────────── */}
        {stage === "embriao" && <Embryo />}
        {stage === "inicial" && <FetoInicial />}
        {stage === "feto" && <FetoMedio plump={1} />}
        {stage === "tardio" && <FetoMedio plump={1.07} />}
        {stage === "termo" && <BebeTermo />}
      </svg>

      <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-primary/80">
        {STAGE_LABEL[stage]}
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ESTÁGIO 1 — EMBRIÃO (sem. 4–9)
   Forma de C com limb buds, coração pulsante e vesícula ocular
   ══════════════════════════════════════════════════════════════════ */
function Embryo() {
  return (
    <g>
      {/* Sombra projetada */}
      <ellipse
        cx="100"
        cy="132"
        rx="24"
        ry="8"
        fill="#000"
        fillOpacity="0.06"
        filter="url(#blur-m)"
      />

      {/* CORPO — C-shape: cabeça grande + cauda afunilada */}
      <path
        d="M96 92
           C 112 88, 128 98, 126 114
           C 124 128, 116 138, 106 138
           C 96 138, 88 132, 86 122
           C 84 112, 86 102, 92 98 Z"
        fill="url(#sk-b)"
      />
      <path
        d="M96 92
           C 112 88, 128 98, 126 114
           C 124 128, 116 138, 106 138
           C 96 138, 88 132, 86 122
           C 84 112, 86 102, 92 98 Z"
        fill="url(#spec)"
      />
      <path
        d="M96 92
           C 112 88, 128 98, 126 114
           C 124 128, 116 138, 106 138
           C 96 138, 88 132, 86 122
           C 84 112, 86 102, 92 98 Z"
        fill="url(#sss)"
      />

      {/* Tubo neural — traço ao longo da espinha */}
      <path
        d="M96 93 C 110 100, 118 112, 116 128"
        fill="none"
        stroke="#9a5042"
        strokeOpacity="0.2"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* LIMB BUDS — brotos de membros superiores */}
      <ellipse cx="84" cy="100" rx="9" ry="5.5" fill="url(#sk-l)" transform="rotate(-22 84 100)" />
      <ellipse cx="84" cy="100" rx="9" ry="5.5" fill="url(#spec)" transform="rotate(-22 84 100)" />

      {/* LIMB BUDS — brotos de membros inferiores */}
      <ellipse cx="88" cy="128" rx="10" ry="5.5" fill="url(#sk-l)" transform="rotate(18 88 128)" />
      <ellipse cx="88" cy="128" rx="10" ry="5.5" fill="url(#spec)" transform="rotate(18 88 128)" />

      {/* CABEÇA — grande, domina a composição */}
      <circle cx="94" cy="82" r="19" fill="url(#sk-h)" />
      <circle cx="94" cy="82" r="19" fill="url(#spec)" />
      <circle cx="94" cy="82" r="19" fill="url(#sss)" />

      {/* Vesícula ótica (olho rudimentar) */}
      <ellipse cx="89" cy="79" rx="5" ry="3.5" fill="#6a2e18" fillOpacity="0.5" />
      {/* Brilhinho no olho */}
      <ellipse cx="90.5" cy="77.5" rx="1.6" ry="1.2" fill="white" fillOpacity="0.65" />

      {/* Nariz rudimentar */}
      <ellipse cx="87" cy="86" rx="1.8" ry="1.3" fill="#6a2e18" fillOpacity="0.22" />

      {/* ── CORAÇÃO PULSANDO ── */}
      {/* Halo externo */}
      <circle cx="102" cy="110" r="9" fill="#d83828" fillOpacity="0.18">
        <animate attributeName="r" values="7;12;7" dur="0.84s" repeatCount="indefinite" />
        <animate
          attributeName="fill-opacity"
          values="0.22;0;0.22"
          dur="0.84s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Halo médio */}
      <circle cx="102" cy="110" r="7" fill="#d83828" fillOpacity="0.3">
        <animate attributeName="r" values="5;9;5" dur="0.84s" repeatCount="indefinite" />
        <animate
          attributeName="fill-opacity"
          values="0.3;0.05;0.3"
          dur="0.84s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Núcleo */}
      <circle cx="102" cy="110" r="5" fill="#d03024" fillOpacity="0.85">
        <animate attributeName="r" values="4;6.5;4.5;5.5;4" dur="0.84s" repeatCount="indefinite" />
        <animate
          attributeName="fill-opacity"
          values="0.75;1;0.85;1;0.75"
          dur="0.84s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ESTÁGIO 2 — FETO INICIAL (sem. 10–15)
   Posição fetal clássica, cabeça grande, feições formando
   ══════════════════════════════════════════════════════════════════ */
function FetoInicial() {
  return (
    <g>
      {/* Sombra */}
      <ellipse
        cx="104"
        cy="152"
        rx="28"
        ry="9"
        fill="#000"
        fillOpacity="0.07"
        filter="url(#blur-m)"
      />

      {/* PERNA/QUADRIL TRASEIRO (camada de trás) */}
      <path
        d="M96 132 C 90 148, 80 152, 70 144 C 62 138, 66 124, 76 120 C 84 116, 92 122, 96 132 Z"
        fill="#c07858"
        fillOpacity="0.72"
      />
      <ellipse
        cx="66"
        cy="144"
        rx="10"
        ry="6.5"
        fill="#c07858"
        fillOpacity="0.62"
        transform="rotate(-22 66 144)"
      />

      {/* BRAÇO TRASEIRO */}
      <path
        d="M112 90 C 128 84, 136 100, 128 114 C 124 122, 114 118, 114 104 Z"
        fill="#c07858"
        fillOpacity="0.6"
      />

      {/* TRONCO */}
      <path
        d="M96 96
           C 120 88, 136 106, 132 128
           C 128 146, 114 156, 96 154
           C 80 152, 72 140, 76 126
           C 80 114, 92 108, 96 96 Z"
        fill="url(#sk-b)"
      />
      <path
        d="M96 96
           C 120 88, 136 106, 132 128
           C 128 146, 114 156, 96 154
           C 80 152, 72 140, 76 126
           C 80 114, 92 108, 96 96 Z"
        fill="url(#spec)"
      />
      <path
        d="M96 96
           C 120 88, 136 106, 132 128
           C 128 146, 114 156, 96 154
           C 80 152, 72 140, 76 126
           C 80 114, 92 108, 96 96 Z"
        fill="url(#sss)"
      />

      {/* BRAÇO DIANTEIRO */}
      <path d="M84 104 C 70 98, 62 110, 68 124 C 72 132, 84 130, 86 118 Z" fill="url(#sk-l)" />
      <path d="M84 104 C 70 98, 62 110, 68 124 C 72 132, 84 130, 86 118 Z" fill="url(#spec)" />
      {/* Mão — esboço de dedos */}
      <ellipse cx="66" cy="124" rx="9" ry="6.5" fill="url(#sk-l)" transform="rotate(20 66 124)" />
      <ellipse cx="66" cy="124" rx="9" ry="6.5" fill="url(#spec)" transform="rotate(20 66 124)" />
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          cx={60 + i * 5}
          cy={119 + i * 1.5}
          rx="2.4"
          ry="1.8"
          fill="url(#sk-l)"
          transform={`rotate(20 ${60 + i * 5} ${119 + i * 1.5})`}
        />
      ))}

      {/* PERNA DIANTEIRA */}
      <path d="M78 138 C 66 146, 56 134, 62 120 C 66 112, 78 114, 78 126 Z" fill="url(#sk-l)" />
      <path d="M78 138 C 66 146, 56 134, 62 120 C 66 112, 78 114, 78 126 Z" fill="url(#spec)" />
      {/* Pezinho */}
      <ellipse cx="56" cy="136" rx="11" ry="7" fill="url(#sk-l)" transform="rotate(-20 56 136)" />
      <ellipse cx="56" cy="136" rx="11" ry="7" fill="url(#spec)" transform="rotate(-20 56 136)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={50 + i * 4}
          cy={132 - i * 0.5}
          r={2}
          fill="url(#sk-l)"
          transform={`rotate(-20 ${50 + i * 4} ${132 - i * 0.5})`}
        />
      ))}

      {/* CABEÇA — grande, ~40% do comprimento */}
      <circle cx="86" cy="76" r="27" fill="url(#sk-h)" />
      <circle cx="86" cy="76" r="27" fill="url(#spec)" />
      <circle cx="86" cy="76" r="27" fill="url(#sss)" />

      {/* Orelha */}
      <ellipse cx="114" cy="76" rx="5.5" ry="8" fill="url(#sk-h)" />
      <ellipse cx="114" cy="76" rx="5.5" ry="8" fill="url(#spec)" />

      {/* ROSTO */}
      {/* Olho fechado */}
      <path
        d="M73 73 q 6 -3.5 12 0"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.58"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* Sobrancelha */}
      <path
        d="M72 68 q 6 -2.5 12 0"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.2"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Nariz */}
      <path
        d="M77 80 C 78 85, 82 86, 83 84"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.3"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Boca */}
      <path
        d="M74 91 q 6 4 12 0"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.36"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* Bochecha */}
      <ellipse cx="101" cy="82" rx="5.5" ry="4" fill="#e08868" fillOpacity="0.22" />

      {/* Cordão umbilical */}
      <path
        d="M96 120 Q 112 130 116 144"
        fill="none"
        stroke="#c08860"
        strokeOpacity="0.48"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ESTÁGIO 3 + 4 — FETO MÉDIO / TARDIO (sem. 16–36)
   Posição fetal clássica com dedinhos, cabelo e proporções reais
   plump=1.0 (16-30) / plump=1.07 (31-36)
   ══════════════════════════════════════════════════════════════════ */
function FetoMedio({ plump: p }: { plump: number }) {
  return (
    <g transform={`scale(${p}) translate(${(100 * (1 - p)) / p} ${(100 * (1 - p)) / p})`}>
      {/* Sombra */}
      <ellipse
        cx="106"
        cy="150"
        rx="30"
        ry="9"
        fill="#000"
        fillOpacity="0.07"
        filter="url(#blur-m)"
      />

      {/* PERNA TRASEIRA */}
      <path
        d="M108 140 C 126 148, 140 134, 134 118 C 130 108, 118 110, 116 122 C 114 132, 112 140, 108 140 Z"
        fill="#be7860"
        fillOpacity="0.68"
      />
      <ellipse
        cx="138"
        cy="132"
        rx="12"
        ry="8"
        fill="#be7860"
        fillOpacity="0.6"
        transform="rotate(20 138 132)"
      />

      {/* BRAÇO TRASEIRO */}
      <path
        d="M112 84 C 130 78, 140 94, 130 108 C 126 116, 114 110, 116 100 Z"
        fill="#be7860"
        fillOpacity="0.62"
      />

      {/* TRONCO */}
      <path
        d="M96 76
           C 122 68, 142 88, 138 118
           C 134 140, 116 152, 96 150
           C 76 148, 66 134, 70 118
           C 74 104, 90 96, 94 84 Z"
        fill="url(#sk-b)"
      />
      <path
        d="M96 76
           C 122 68, 142 88, 138 118
           C 134 140, 116 152, 96 150
           C 76 148, 66 134, 70 118
           C 74 104, 90 96, 94 84 Z"
        fill="url(#spec)"
      />
      <path
        d="M96 76
           C 122 68, 142 88, 138 118
           C 134 140, 116 152, 96 150
           C 76 148, 66 134, 70 118
           C 74 104, 90 96, 94 84 Z"
        fill="url(#sss)"
      />

      {/* BRAÇO DIANTEIRO */}
      <path d="M84 90 C 68 84, 60 98, 66 114 C 70 122, 84 120, 84 106 Z" fill="url(#sk-l)" />
      <path d="M84 90 C 68 84, 60 98, 66 114 C 70 122, 84 120, 84 106 Z" fill="url(#spec)" />
      {/* Mão dianteira */}
      <ellipse cx="62" cy="112" rx="10" ry="7" fill="url(#sk-l)" transform="rotate(28 62 112)" />
      <ellipse cx="62" cy="112" rx="10" ry="7" fill="url(#spec)" transform="rotate(28 62 112)" />
      {[0, 1, 2, 3].map((i) => (
        <ellipse
          key={i}
          cx={55 + i * 5.5}
          cy={107 + i * 1.5}
          rx="2.8"
          ry="2"
          fill="url(#sk-l)"
          transform={`rotate(28 ${55 + i * 5.5} ${107 + i * 1.5})`}
        />
      ))}

      {/* PERNA DIANTEIRA */}
      <path d="M80 138 C 64 146, 54 130, 62 116 C 66 108, 80 110, 80 124 Z" fill="url(#sk-l)" />
      <path d="M80 138 C 64 146, 54 130, 62 116 C 66 108, 80 110, 80 124 Z" fill="url(#spec)" />
      {/* Pé dianteiro */}
      <ellipse cx="54" cy="130" rx="13" ry="8" fill="url(#sk-l)" transform="rotate(-18 54 130)" />
      <ellipse cx="54" cy="130" rx="13" ry="8" fill="url(#spec)" transform="rotate(-18 54 130)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={48 + i * 4.5}
          cy={126 - i * 0.6}
          r={2.3}
          fill="url(#sk-l)"
          transform={`rotate(-18 ${48 + i * 4.5} ${126 - i * 0.6})`}
        />
      ))}

      {/* CABEÇA */}
      <circle cx="78" cy="68" r="24" fill="url(#sk-h)" />
      <circle cx="78" cy="68" r="24" fill="url(#spec)" />
      <circle cx="78" cy="68" r="24" fill="url(#sss)" />

      {/* Orelha */}
      <ellipse cx="103" cy="68" rx="5.5" ry="8.5" fill="url(#sk-h)" />
      <ellipse cx="103" cy="68" rx="5.5" ry="8.5" fill="url(#spec)" />

      {/* Cabelinho suave */}
      <path
        d="M56 52 Q 78 40 100 52"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.2"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M62 46 Q 78 38 94 46"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.13"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* ROSTO */}
      {/* Olho fechado */}
      <path
        d="M67 66 q 5.5 -3.5 10 0"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.62"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* Sobrancelha */}
      <path
        d="M66 62 q 5 -2.5 10 0"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.22"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Nariz */}
      <path
        d="M70 74 C 71 79, 75 80, 76 78"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.28"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* Boca */}
      <path
        d="M68 84 q 5.5 4 11 0"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.36"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Bochecha */}
      <ellipse cx="90" cy="74" rx="6" ry="4.5" fill="#e08868" fillOpacity="0.24" />

      {/* Cordão umbilical */}
      <path
        d="M96 112 Q 114 122 118 138"
        fill="none"
        stroke="#c08860"
        strokeOpacity="0.44"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ESTÁGIO 5 — BEBÊ A TERMO (sem. 37–42)
   Rechonchudo, dormindo, cabelo, bocejos e bochechas de anjo
   ══════════════════════════════════════════════════════════════════ */
function BebeTermo() {
  return (
    <g>
      {/* Sombra */}
      <ellipse
        cx="108"
        cy="158"
        rx="36"
        ry="11"
        fill="#000"
        fillOpacity="0.08"
        filter="url(#blur-m)"
      />

      {/* PERNA TRASEIRA */}
      <path
        d="M110 142 C 128 150, 144 136, 138 118 C 134 108, 120 110, 118 124 C 116 134, 114 142, 110 142 Z"
        fill="#be7860"
        fillOpacity="0.65"
      />
      <ellipse
        cx="142"
        cy="134"
        rx="13"
        ry="9"
        fill="#be7860"
        fillOpacity="0.58"
        transform="rotate(22 142 134)"
      />

      {/* BRAÇO TRASEIRO */}
      <path
        d="M112 80 C 134 72, 146 92, 136 110 C 130 120, 118 114, 118 100 Z"
        fill="#be7860"
        fillOpacity="0.6"
      />

      {/* TRONCO — rechonchudo */}
      <path
        d="M94 68
           C 132 60, 152 86, 146 122
           C 142 148, 122 164, 96 162
           C 72 160, 60 144, 64 122
           C 68 104, 86 96, 92 80 Z"
        fill="url(#sk-b)"
      />
      <path
        d="M94 68
           C 132 60, 152 86, 146 122
           C 142 148, 122 164, 96 162
           C 72 160, 60 144, 64 122
           C 68 104, 86 96, 92 80 Z"
        fill="url(#spec)"
      />
      <path
        d="M94 68
           C 132 60, 152 86, 146 122
           C 142 148, 122 164, 96 162
           C 72 160, 60 144, 64 122
           C 68 104, 86 96, 92 80 Z"
        fill="url(#sss)"
      />

      {/* Vinco de gordura no pescoço */}
      <path
        d="M84 82 Q 96 90 114 86"
        fill="none"
        stroke="#b06850"
        strokeOpacity="0.22"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* PERNA DIANTEIRA */}
      <path d="M76 140 C 58 150, 48 134, 56 118 C 60 108, 76 110, 76 126 Z" fill="url(#sk-l)" />
      <path d="M76 140 C 58 150, 48 134, 56 118 C 60 108, 76 110, 76 126 Z" fill="url(#spec)" />
      {/* Pé dianteiro */}
      <ellipse
        cx="48"
        cy="134"
        rx="14.5"
        ry="9.5"
        fill="url(#sk-l)"
        transform="rotate(-20 48 134)"
      />
      <ellipse
        cx="48"
        cy="134"
        rx="14.5"
        ry="9.5"
        fill="url(#spec)"
        transform="rotate(-20 48 134)"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={41 + i * 5}
          cy={130 - i * 0.6}
          r={2.6}
          fill="url(#sk-l)"
          transform={`rotate(-20 ${41 + i * 5} ${130 - i * 0.6})`}
        />
      ))}

      {/* BRAÇO DIANTEIRO */}
      <path d="M82 88 C 64 80, 54 96, 60 114 C 64 124, 80 122, 82 108 Z" fill="url(#sk-l)" />
      <path d="M82 88 C 64 80, 54 96, 60 114 C 64 124, 80 122, 82 108 Z" fill="url(#spec)" />
      {/* Mão dianteira */}
      <ellipse
        cx="58"
        cy="114"
        rx="11.5"
        ry="8.5"
        fill="url(#sk-l)"
        transform="rotate(26 58 114)"
      />
      <ellipse
        cx="58"
        cy="114"
        rx="11.5"
        ry="8.5"
        fill="url(#spec)"
        transform="rotate(26 58 114)"
      />
      {[0, 1, 2, 3].map((i) => (
        <ellipse
          key={i}
          cx={51 + i * 6}
          cy={109 + i * 1.5}
          rx="3.2"
          ry="2.2"
          fill="url(#sk-l)"
          transform={`rotate(26 ${51 + i * 6} ${109 + i * 1.5})`}
        />
      ))}

      {/* CABEÇA — rechonchuda, grande */}
      <circle cx="78" cy="62" r="26" fill="url(#sk-h)" />
      <circle cx="78" cy="62" r="26" fill="url(#spec)" />
      <circle cx="78" cy="62" r="26" fill="url(#sss)" />

      {/* Orelha */}
      <ellipse cx="105" cy="62" rx="6.5" ry="10" fill="url(#sk-h)" />
      <ellipse cx="105" cy="62" rx="6.5" ry="10" fill="url(#spec)" />

      {/* CABELO — mechas delicadas */}
      <path
        d="M54 48 Q 78 34 102 48"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.26"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M60 41 Q 78 33 96 41"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.17"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M68 37 Q 78 32 88 37"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.12"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* ROSTO — dormindo tranquilamente */}
      {/* Olho fechado com cílios */}
      <path
        d="M65 60 q 7 -4.5 13 0"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.62"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {[65, 68.5, 72, 75.5].map((x, i) => (
        <path
          key={i}
          d={`M ${x} 60 L ${x - 1.5 + i * 0.3} ${56.5}`}
          stroke="#6a2e18"
          strokeOpacity="0.28"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      ))}
      {/* Sobrancelha */}
      <path
        d="M63 56 q 7 -3 14 0"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.24"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Nariz rechonchudo */}
      <path
        d="M72 69 C 73 75, 76 77, 77 76"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.26"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <ellipse cx="73.5" cy="75" rx="2.4" ry="1.7" fill="#6a2e18" fillOpacity="0.13" />
      <ellipse cx="78" cy="75" rx="2.4" ry="1.7" fill="#6a2e18" fillOpacity="0.13" />

      {/* Boquinha — sorriso de bebê dormindo */}
      <path
        d="M67 83 q 7 6 15 0"
        fill="none"
        stroke="#6a2e18"
        strokeOpacity="0.38"
        strokeWidth="2.1"
        strokeLinecap="round"
      />

      {/* Bochechas rechonchudas */}
      <ellipse cx="98" cy="70" rx="8" ry="6" fill="#e88868" fillOpacity="0.26" />
      <ellipse cx="63" cy="70" rx="5.5" ry="4" fill="#e88868" fillOpacity="0.18" />

      {/* Cordão umbilical */}
      <path
        d="M96 118 Q 118 128 124 146"
        fill="none"
        stroke="#c08860"
        strokeOpacity="0.42"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
    </g>
  );
}
