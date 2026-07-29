/**
 * A figura que DEMONSTRA o movimento.
 *
 * O buraco da aba Movimento era: "gato-camelo suave — de quatro apoios,
 * alterne arredondar e relaxar a coluna". Quem já fez pilates entende; quem
 * nunca fez fica olhando pro emoji de gato. O ideal seria um vídeo de alguém
 * grávida fazendo — e é justamente o que não dá pra produzir agora.
 *
 * Então: desenho de linha ANIMADO. Um traço só, no mesmo vocabulário dos
 * ícones do rodapé, repetindo o movimento em loop pelo tempo todo do
 * cronômetro. Não é um vídeo, mas responde a pergunta que o texto não responde
 * — "o que eu faço com o corpo" — e tem três vantagens sobre filmar: pesa
 * ~2 KB, funciona offline e não envelhece.
 *
 * Três poses de base cobrem os nove movimentos (em pé, sentada, quatro
 * apoios); o que muda é qual grupo se mexe. As animações vivem em `styles.css`
 * com prefixo `dc-mv-` e todas param em `prefers-reduced-motion`.
 */

export type PoseKey = "pe" | "sentada" | "borboleta" | "quatro";

/** Traço comum a tudo: fino, redondo nas pontas, herda a cor do container. */
const T = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Cabeça + pescoço. Vira um grupo à parte porque o alongamento gira só ela. */
function Cabeca({ anim }: { anim?: string }) {
  return (
    <g style={anim ? { animation: anim, transformOrigin: "60px 44px" } : undefined}>
      <circle cx={60} cy={24} r={12} {...T} />
      <path d="M60 36 L60 46" {...T} />
    </g>
  );
}

/** Tronco com a barriga — a barriga é o que faz a figura ser uma gestante. */
function TroncoFrente() {
  return (
    <>
      <path d="M60 46 L60 68" {...T} />
      <ellipse cx={60} cy={78} rx={20} ry={17} {...T} />
    </>
  );
}

export function FiguraMovimento({
  pose,
  anim,
  className = "",
}: {
  pose: PoseKey;
  /** Id do movimento — escolhe qual grupo se mexe. */
  anim: string;
  className?: string;
}) {
  // Quatro apoios é uma figura DEITADA: no mesmo quadro em pé ela sobraria em
  // cima e embaixo e encolheria pela metade. Cada orientação tem seu quadro, e
  // o tamanho vem daqui — quem chama só diz a cor.
  const deitada = pose === "quatro";
  return (
    <svg
      viewBox={deitada ? "12 20 130 90" : "0 0 120 150"}
      className={`${deitada ? "h-28 w-40" : "h-40 w-32"} ${className}`}
      role="img"
      aria-label="Demonstração do movimento"
    >
      {pose === "quatro" ? <Quatro anim={anim} /> : null}
      {pose === "pe" ? <EmPe anim={anim} /> : null}
      {pose === "sentada" ? <Sentada anim={anim} /> : null}
      {pose === "borboleta" ? <Borboleta anim={anim} /> : null}
    </svg>
  );
}

/* ── Em pé ─────────────────────────────────────────────────────────────── */
function EmPe({ anim }: { anim: string }) {
  const ombros = anim === "ombros" ? "dc-mv-ombros 3s ease-in-out infinite" : undefined;
  const alonga = anim === "bracos";
  const quadril = anim === "pelve" ? "dc-mv-pelve 4s ease-in-out infinite" : undefined;

  return (
    <>
      <Cabeca />
      <TroncoFrente />
      {/* Ombros + braços viajam juntos no rolar de ombros: é o conjunto que
          sobe e desce, não o braço solto. */}
      <g style={ombros ? { animation: ombros, transformOrigin: "60px 50px" } : undefined}>
        <path d="M44 50 L76 50" {...T} />
        {/* Braços pro alto trocam a POSE inteira, e não giram: girar um grupo
            com os dois braços levantaria um e abaixaria o outro. Duas poses
            cruzando opacidade — o mesmo truque do gato-camelo. */}
        <g style={alonga ? { animation: "dc-mv-gato1 4.5s ease-in-out infinite" } : undefined}>
          <path d="M44 50 L32 74 L30 94" {...T} />
          <path d="M76 50 L88 74 L90 94" {...T} />
        </g>
        {alonga && (
          <g style={{ animation: "dc-mv-gato2 4.5s ease-in-out infinite", opacity: 0 }}>
            <path d="M44 50 L48 28 L57 12" {...T} />
            <path d="M76 50 L72 28 L63 12" {...T} />
          </g>
        )}
      </g>
      <g style={quadril ? { animation: quadril, transformOrigin: "60px 96px" } : undefined}>
        <path d="M48 96 L72 96" {...T} />
        <path d="M52 96 L50 120 L50 140" {...T} />
        <path d="M68 96 L70 120 L70 140" {...T} />
      </g>
      <path d="M24 144 L96 144" {...T} strokeWidth={2.2} opacity={0.35} />
    </>
  );
}

/* ── Sentada na beira da cadeira ────────────────────────────────────────── */
function Sentada({ anim }: { anim: string }) {
  const tronco = anim === "torcao" ? "dc-mv-torcao 5s ease-in-out infinite" : undefined;
  const cabeca = anim === "pescoco" ? "dc-mv-pescoco 5s ease-in-out infinite" : undefined;
  const pe = anim === "tornozelo" ? "dc-mv-tornozelo 3s linear infinite" : undefined;

  return (
    <>
      {/* Cadeira: sem ela a figura parece flutuando de joelhos dobrados. */}
      <path d="M40 100 L88 100 L88 140" {...T} strokeWidth={2.4} opacity={0.35} />
      <g style={tronco ? { animation: tronco, transformOrigin: "60px 98px" } : undefined}>
        <Cabeca anim={cabeca} />
        <TroncoFrente />
        <path d="M44 50 L76 50" {...T} />
        <path d="M44 50 L34 74 L40 96" {...T} />
        <path d="M76 50 L86 74 L80 96" {...T} />
      </g>
      <path d="M48 98 L72 98" {...T} />
      <path d="M52 98 L48 122" {...T} />
      <path d="M68 98 L72 122" {...T} />
      <path d="M48 122 L48 140" {...T} />
      <g style={pe ? { animation: pe, transformOrigin: "72px 122px" } : undefined}>
        <path d="M72 122 L72 138 L80 140" {...T} />
      </g>
      <path d="M24 144 L96 144" {...T} strokeWidth={2.2} opacity={0.35} />
    </>
  );
}

/* ── Borboleta: sentada no chão, solas dos pés juntas ───────────────────── */
function Borboleta({ anim }: { anim: string }) {
  const abre = anim === "quadril";
  return (
    <>
      <Cabeca />
      <TroncoFrente />
      <path d="M44 50 L76 50" {...T} />
      <path d="M44 50 L34 76 L42 96" {...T} />
      <path d="M76 50 L86 76 L78 96" {...T} />
      <path d="M48 100 L72 100" {...T} />
      {/* Cada perna gira em torno do próprio quadril, em espelho — é o que
          torna o "deixe os joelhos caírem" visível sem texto. */}
      <g
        style={
          abre
            ? { animation: "dc-mv-joelhoE 4s ease-in-out infinite", transformOrigin: "50px 100px" }
            : undefined
        }
      >
        <path d="M50 100 L30 118 L52 130" {...T} />
      </g>
      <g
        style={
          abre
            ? { animation: "dc-mv-joelhoD 4s ease-in-out infinite", transformOrigin: "70px 100px" }
            : undefined
        }
      >
        <path d="M70 100 L90 118 L68 130" {...T} />
      </g>
      <path d="M24 144 L96 144" {...T} strokeWidth={2.2} opacity={0.35} />
    </>
  );
}

/* ── Quatro apoios ──────────────────────────────────────────────────────── */
function Quatro({ anim }: { anim: string }) {
  const gato = anim === "gatocamelo";
  const balanco = anim === "balanco" ? "dc-mv-balanco 4s ease-in-out infinite" : undefined;

  // Braços e pernas ficam fora da troca de pose: o que muda no gato-camelo é
  // só a coluna. Mãos e joelhos continuam plantados no chão — e é isso que o
  // desenho precisa deixar claro, senão parece que ela balança o corpo todo.
  const membros = (
    <>
      <path d="M46 46 L42 74 L46 100" {...T} />
      <path d="M110 46 L116 74 L112 100" {...T} />
    </>
  );

  return (
    <g style={balanco ? { animation: balanco } : undefined}>
      {/* Gato-camelo é a única troca de FORMA da coluna: duas colunas
          desenhadas, uma arredondada e outra relaxada, alternando opacidade.
          Interpolar um <path> entre dois "d" não é confiável em todos os
          navegadores; cruzar opacidade é, e o olho lê como a mesma coluna. */}
      <g style={gato ? { animation: "dc-mv-gato1 5s ease-in-out infinite" } : undefined}>
        {/* Coluna neutra, cabeça na linha do tronco. */}
        <circle cx={30} cy={46} r={13} {...T} />
        <path d="M43 43 L50 42" {...T} />
        <path d="M50 42 C70 34 92 36 110 44" {...T} />
        <path d="M62 46 C68 76 96 76 104 50" {...T} />
      </g>
      {gato && (
        <g style={{ animation: "dc-mv-gato2 5s ease-in-out infinite", opacity: 0 }}>
          {/* Coluna arredondada: queixo desce, dorso sobe. */}
          <circle cx={32} cy={60} r={13} {...T} />
          <path d="M45 55 L52 51" {...T} />
          <path d="M52 51 C70 24 94 26 110 44" {...T} />
          <path d="M62 54 C70 82 96 80 104 52" {...T} />
        </g>
      )}
      {membros}
      <path d="M20 104 L134 104" {...T} strokeWidth={2.4} opacity={0.35} />
    </g>
  );
}
