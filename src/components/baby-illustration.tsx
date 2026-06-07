import { babyStage, WEEK_MIN, WEEK_MAX, type BabyStage } from "@/lib/gestacao";

const STAGE_LABEL: Record<BabyStage, string> = {
  embriao: "Embrião",
  inicial: "Feto inicial",
  feto: "Feto",
  tardio: "Feto (reta final)",
  termo: "Bebê a termo",
};

function growth(week: number) {
  const t = (week - WEEK_MIN) / (WEEK_MAX - WEEK_MIN);
  return Math.max(0, Math.min(1, t));
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
        aria-label={`Ilustração do bebê — ${STAGE_LABEL[stage]}, semana ${week}`}
        className="h-48 w-48 md:h-56 md:w-56"
      >
        <defs>
          {/* Fundo do saco amniótico — gradiente quente */}
          <radialGradient id="bg-sac" cx="45%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#fdf6f0" />
            <stop offset="100%" stopColor="#f5e4d6" />
          </radialGradient>
          {/* Pele do bebê — rosé suave */}
          <linearGradient id="skin" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor="#d4876a" />
            <stop offset="100%" stopColor="#b3614a" />
          </linearGradient>
          {/* Sombra no corpo */}
          <linearGradient id="shadow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.09" />
          </linearGradient>
          {/* Umbilical */}
          <filter id="blur-sm">
            <feGaussianBlur stdDeviation="0.7" />
          </filter>
        </defs>

        {/* Saco amniótico */}
        <circle cx="100" cy="100" r={sacR} fill="url(#bg-sac)" />
        <circle
          cx="100"
          cy="100"
          r={sacR}
          fill="none"
          stroke="#c4845a"
          strokeOpacity="0.22"
          strokeWidth="1.8"
        />
        {/* reflexo de luz */}
        <ellipse
          cx="82"
          cy="76"
          rx={sacR * 0.28}
          ry={sacR * 0.12}
          fill="white"
          fillOpacity="0.22"
          transform="rotate(-20 82 76)"
        />

        {stage === "embriao" ? (
          <EmbryoShape />
        ) : stage === "inicial" ? (
          <InitialFetus />
        ) : stage === "feto" ? (
          <MidFetus plump={1} />
        ) : stage === "tardio" ? (
          <MidFetus plump={1.06} />
        ) : (
          <TermBaby />
        )}
      </svg>

      <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-primary/80">
        {STAGE_LABEL[stage]}
      </p>
    </div>
  );
}

/* ─── EMBRIÃO (sem. 4-9): forma de vírgula com coração pulsante ─── */
function EmbryoShape() {
  return (
    <g>
      {/* Sombra suave */}
      <ellipse
        cx="106"
        cy="116"
        rx="22"
        ry="8"
        fill="#000"
        fillOpacity="0.07"
        filter="url(#blur-sm)"
      />
      {/* Corpo em vírgula — cabeça grande + cauda */}
      <path
        d="M106 66
           C 128 66, 140 84, 136 104
           C 132 122, 118 132, 104 130
           C 90 128, 82 116, 84 106
           C 86 98, 94 96, 100 100
           C 88 98, 80 88, 86 76
           C 90 68, 100 64, 106 66 Z"
        fill="url(#skin)"
      />
      {/* Sombra lateral */}
      <path
        d="M106 66
           C 128 66, 140 84, 136 104
           C 132 122, 118 132, 104 130
           C 90 128, 82 116, 84 106
           C 86 98, 94 96, 100 100
           C 88 98, 80 88, 86 76
           C 90 68, 100 64, 106 66 Z"
        fill="url(#shadow)"
      />
      {/* Esboço do olho (rudimentar) */}
      <circle cx="100" cy="82" r="3.5" fill="#7a3820" fillOpacity="0.55" />
      {/* Coração batendo */}
      <g>
        <circle cx="108" cy="108" r="5.5" fill="#c0442a" fillOpacity="0.85">
          <animate attributeName="r" values="4.5;7;4.5" dur="0.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;1;0.7" dur="0.9s" repeatCount="indefinite" />
        </circle>
        {/* halo do coração */}
        <circle cx="108" cy="108" r="7" fill="#c0442a" fillOpacity="0.2">
          <animate attributeName="r" values="6;10;6" dur="0.9s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="0.9s" repeatCount="indefinite" />
        </circle>
      </g>
    </g>
  );
}

/* ─── FETO INICIAL (sem. 10-15): posição fetal, cabeça grande, membros pequenos ─── */
function InitialFetus() {
  return (
    <g>
      <ellipse
        cx="104"
        cy="120"
        rx="28"
        ry="9"
        fill="#000"
        fillOpacity="0.06"
        filter="url(#blur-sm)"
      />

      {/* Tronco curvado */}
      <path
        d="M100 80
           C 122 76, 136 92, 134 112
           C 132 130, 118 140, 102 138
           C 88 136, 80 124, 82 112
           C 84 102, 94 98, 98 90 Z"
        fill="url(#skin)"
      />
      <path
        d="M100 80
           C 122 76, 136 92, 134 112
           C 132 130, 118 140, 102 138
           C 88 136, 80 124, 82 112
           C 84 102, 94 98, 98 90 Z"
        fill="url(#shadow)"
      />
      {/* Perna dobrada */}
      <path
        d="M88 130 C 76 132, 68 120, 74 110 C 78 104, 86 106, 88 114 C 90 122, 90 128, 88 130 Z"
        fill="url(#skin)"
      />
      {/* Bracinho */}
      <path d="M88 96 C 76 94, 70 102, 76 110 C 79 115, 86 112, 88 104 Z" fill="url(#skin)" />

      {/* Cabeça grande — proporção 1:2 corpo */}
      <circle cx="86" cy="76" r="26" fill="url(#skin)" />
      <circle cx="86" cy="76" r="26" fill="url(#shadow)" />

      {/* Rosto: olhos fechados, narinha, boquinha */}
      <ellipse cx="76" cy="74" rx="4.5" ry="3" fill="#7a3820" fillOpacity="0.5" />
      <circle cx="80" cy="83" r="2" fill="#7a3820" fillOpacity="0.25" />
      <path
        d="M74 88 q 5 4 10 0"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.4"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Cordão umbilical */}
      <path
        d="M98 108 Q 110 118 114 126"
        fill="none"
        stroke="#c0845a"
        strokeOpacity="0.5"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </g>
  );
}

/* ─── FETO (sem. 16-36): posição fetal clássica ─── */
function MidFetus({ plump }: { plump: number }) {
  const p = plump;
  return (
    <g>
      <ellipse
        cx="106"
        cy="126"
        rx={28 * p}
        ry={9}
        fill="#000"
        fillOpacity="0.06"
        filter="url(#blur-sm)"
      />

      {/* Tronco */}
      <path
        d={`M98 74
           C ${122 * p} 70, ${138 * p} 90, 134 116
           C 130 136, 114 148, 96 146
           C 80 144, 72 130, 76 116
           C 80 104, 92 100, 96 88 Z`}
        fill="url(#skin)"
      />
      <path
        d={`M98 74
           C ${122 * p} 70, ${138 * p} 90, 134 116
           C 130 136, 114 148, 96 146
           C 80 144, 72 130, 76 116
           C 80 104, 92 100, 96 88 Z`}
        fill="url(#shadow)"
      />

      {/* Joelho/perna dobrada */}
      <path
        d="M82 136 C 68 140, 60 128, 66 116 C 70 108, 80 110, 82 120 C 84 128, 84 134, 82 136 Z"
        fill="url(#skin)"
      />
      {/* Pezinho */}
      <ellipse cx="64" cy="128" rx="9" ry="6" fill="url(#skin)" transform="rotate(-15 64 128)" />

      {/* Bracinho dobrado junto ao rosto */}
      <path d="M84 90 C 70 86, 62 96, 68 108 C 72 115, 82 112, 84 102 Z" fill="url(#skin)" />
      {/* Mãozinha */}
      <ellipse cx="66" cy="106" rx="7" ry="5" fill="url(#skin)" transform="rotate(30 66 106)" />

      {/* Cabeça */}
      <circle cx="80" cy="68" r={22 * p} fill="url(#skin)" />
      <circle cx="80" cy="68" r={22 * p} fill="url(#shadow)" />

      {/* Cabelo */}
      <path
        d={`M${60 * p} ${55 + (p - 1) * 10} Q ${80 * p} ${46 + (p - 1) * 8} ${100 * p} ${55 + (p - 1) * 10}`}
        fill="none"
        stroke="#7a3820"
        strokeOpacity={0.18 * p}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Rosto: olhos, nariz, boca */}
      <ellipse cx="70" cy="66" rx="4" ry="3.5" fill="#7a3820" fillOpacity="0.55" />
      <ellipse cx="73" cy="76" rx="2" ry="1.5" fill="#7a3820" fillOpacity="0.2" />
      <path
        d="M68 82 q 6 4 11 0"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.4"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Cordão umbilical */}
      <path
        d="M96 108 Q 112 118 118 130"
        fill="none"
        stroke="#c0845a"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

/* ─── BEBÊ A TERMO (sem. 37-42): rechonchudo, cabeça para baixo ─── */
function TermBaby() {
  return (
    <g>
      <ellipse
        cx="106"
        cy="128"
        rx="32"
        ry="10"
        fill="#000"
        fillOpacity="0.07"
        filter="url(#blur-sm)"
      />

      {/* Tronco rechonchudo */}
      <path
        d="M98 70
           C 128 66, 146 90, 140 118
           C 136 140, 118 152, 98 150
           C 78 148, 68 134, 72 118
           C 76 104, 90 98, 96 84 Z"
        fill="url(#skin)"
      />
      <path
        d="M98 70
           C 128 66, 146 90, 140 118
           C 136 140, 118 152, 98 150
           C 78 148, 68 134, 72 118
           C 76 104, 90 98, 96 84 Z"
        fill="url(#shadow)"
      />

      {/* Perna direita dobrada */}
      <path
        d="M80 138 C 64 144, 54 130, 62 118 C 66 110, 78 112, 80 122 C 82 132, 82 136, 80 138 Z"
        fill="url(#skin)"
      />
      {/* Pé direito */}
      <ellipse cx="56" cy="128" rx="11" ry="7" fill="url(#skin)" transform="rotate(-15 56 128)" />
      {/* dedinhos do pé */}
      {[0, 1, 2, 3, 4].map((i) => (
        <circle
          key={i}
          cx={50 + i * 4}
          cy={125 - i * 0.5}
          r="2"
          fill="url(#skin)"
          transform={`rotate(-15 ${50 + i * 4} ${125 - i * 0.5})`}
        />
      ))}

      {/* Perna esquerda (atrás) */}
      <path
        d="M110 140 C 126 148, 138 136, 132 122 C 128 114, 118 116, 116 126 C 114 134, 112 140, 110 140 Z"
        fill="#b56050"
        fillOpacity="0.7"
      />

      {/* Braço direito sobre a barriga */}
      <path d="M84 88 C 68 84, 60 96, 66 110 C 70 118, 82 116, 84 104 Z" fill="url(#skin)" />
      {/* Mão direita (quase fazendo "tchau") */}
      <ellipse cx="64" cy="108" rx="9" ry="6.5" fill="url(#skin)" transform="rotate(25 64 108)" />
      {/* dedinhos da mão */}
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          cx={58 + i * 5}
          cy={103 + i * 1.5}
          rx="2.5"
          ry="1.8"
          fill="url(#skin)"
          transform={`rotate(25 ${58 + i * 5} ${103 + i * 1.5})`}
        />
      ))}

      {/* Braço esquerdo (atrás) */}
      <path
        d="M112 84 C 128 80, 136 94, 128 106 C 124 112, 114 108, 114 98 Z"
        fill="#b56050"
        fillOpacity="0.65"
      />

      {/* Cabeça */}
      <circle cx="80" cy="65" r="24" fill="url(#skin)" />
      <circle cx="80" cy="65" r="24" fill="url(#shadow)" />

      {/* Cabelinho suave */}
      <path
        d="M58 54 Q 80 42 102 54"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.22"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M64 47 Q 80 40 96 47"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.15"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Olho fechadinho (dormindo) */}
      <path
        d="M68 64 q 5 -4 10 0"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Sobrancelha */}
      <path
        d="M66 60 q 5 -2 10 0"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.2"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Nariz */}
      <ellipse cx="75" cy="72" rx="2.5" ry="1.8" fill="#7a3820" fillOpacity="0.18" />
      {/* Boquinha com sorriso */}
      <path
        d="M68 80 q 6 5 12 0"
        fill="none"
        stroke="#7a3820"
        strokeOpacity="0.38"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Bochecha rechonchuda */}
      <ellipse cx="92" cy="72" rx="6" ry="4.5" fill="#e09070" fillOpacity="0.28" />

      {/* Cordão umbilical */}
      <path
        d="M96 110 Q 116 120 122 134"
        fill="none"
        stroke="#c0845a"
        strokeOpacity="0.4"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </g>
  );
}
