import type React from "react";
/**
 * Os ícones do painel da jornada — desenhados aqui, não emprestados do sistema.
 *
 * Antes eram emoji, e emoji não são um ícone: são um caractere que cada
 * fabricante desenha do jeito dele. O mesmo app aparecia diferente no iPhone, no
 * Android da Samsung e no da Motorola, o que já bastaria para trocar. Mas havia
 * um problema pior e concreto: o emoji de calendário 📅 tem uma data DESENHADA
 * dentro do glifo — "17 de julho" no iOS, outro dia em cada plataforma. Ele
 * ficava ao lado do texto "1º dia", exibindo para toda paciente, todo dia, uma
 * data que não é a dela.
 *
 * Cada ícone tem dois tons do mesmo `currentColor`: a massa cheia e um realce
 * mais claro por cima. É o que dá a sensação de volume sem render 3D — a mesma
 * economia que os jogos usam há décadas, e infinitamente mais barata que WebGL.
 * A cor vem do contexto, então o mesmo desenho serve à chama âmbar e ao troféu
 * violeta sem duplicar arquivo.
 */

type Props = {
  className?: string;
  /**
   * Estilo em linha — existe para o alinhamento da fita.
   *
   * Os ícones ficam ao lado de números, e a base do DESENHO de cada um mora
   * numa altura diferente dentro do `viewBox`. Quem calcula o deslocamento é
   * `alinhar-na-linha.ts`, com a fração medida; aqui só se recebe o resultado.
   */
  style?: React.CSSProperties;
};

const base = (className?: string, style?: React.CSSProperties) => ({
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true as const,
  className: className ?? "h-6 w-6",
  style,
});

/**
 * Sequência de dias.
 *
 * A primeira versão tinha um realce grande demais e, no tamanho em que o ícone
 * de fato aparece — 22px —, a silhueta lia como GOTA D'ÁGUA, não como fogo.
 * Num painel de sequência isso diz a coisa errada. O desenho agora tem a base
 * larga e ondulada e a ponta que verga para um lado, que é o que o olho
 * reconhece como chama mesmo quando a figura tem meio centímetro.
 */
export function IconeChama({ className }: Props) {
  return (
    <svg {...base(className)}>
      <path d="M13.4 1.4c-.4 2.4-1.7 3.9-3.4 5.4C7.7 8.8 5.7 10.9 5.7 14.3c0 4.3 3 7.5 6.3 7.5s6.3-3.2 6.3-7.5c0-2.3-.8-4-1.9-5.5-.5 1-1.2 1.7-2 2 .9-3.5.3-6.6-1-9.4z" />
      <path
        d="M12.4 11.9c-.3 1.4-1 2.2-1.8 2.9-.9.8-1.5 1.7-1.5 3 0 1.9 1.3 3.2 2.9 3.2s2.9-1.3 2.9-3.2c0-2-1.3-3.7-2.5-5.9z"
        opacity=".5"
        fill="#fff"
      />
    </svg>
  );
}

/**
 * Dia da jornada.
 *
 * Sem nenhum número dentro — era exatamente o defeito do emoji. Quem informa o
 * dia é o texto ao lado, que vem do estado real. O ícone só diz "calendário".
 */
export function IconeCalendario({ className, style }: Props) {
  return (
    <svg {...base(className, style)}>
      <path d="M7 2.2c.6 0 1 .4 1 1v1.3h8V3.2c0-.6.4-1 1-1s1 .4 1 1v1.3h.8c1.4 0 2.5 1.1 2.5 2.5v12c0 1.4-1.1 2.5-2.5 2.5H4.2a2.5 2.5 0 0 1-2.5-2.5V7c0-1.4 1.1-2.5 2.5-2.5H5V3.2c0-.6.4-1 1-1z" />
      <path
        d="M3.7 9.5h16.6V19c0 .3-.2.5-.5.5H4.2a.5.5 0 0 1-.5-.5V9.5z"
        opacity=".38"
        fill="#fff"
      />
      <circle cx="8.4" cy="13.4" r="1.5" opacity=".9" fill="#fff" />
      <circle cx="15.6" cy="13.4" r="1.5" opacity=".55" fill="#fff" />
      <circle cx="8.4" cy="17" r="1.5" opacity=".55" fill="#fff" />
      <circle cx="15.6" cy="17" r="1.5" opacity=".3" fill="#fff" />
    </svg>
  );
}

/**
 * Figurinhas coletadas.
 *
 * As alças ficavam separadas da taça na primeira versão — a 22px pareciam duas
 * manchas soltas ao lado. Agora nascem coladas ao corpo, que é o que dá para
 * ler a forma inteira num relance.
 */
export function IconeTrofeu({ className }: Props) {
  return (
    <svg {...base(className)}>
      <path d="M5.8 2.4h12.4c.6 0 1.1.5 1.1 1.1v4c0 3.7-2.6 6.7-5.9 7.1v2.6h2.2c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1H8.4c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1h2.2v-2.6C7.3 14.2 4.7 11.2 4.7 7.5v-4c0-.6.5-1.1 1.1-1.1z" />
      <path
        d="M8.6 4.8h6.8v2.7c0 2.2-1.5 3.9-3.4 3.9s-3.4-1.7-3.4-3.9V4.8z"
        opacity=".45"
        fill="#fff"
      />
      <path d="M4.7 4.6H3.1c-.7 0-1.2.5-1.2 1.2 0 2.5 1.2 4.4 3 5.4a9 9 0 0 1-.7-2.2 5.4 5.4 0 0 1-.9-2.6h1.4V4.6zM19.3 4.6h1.6c.7 0 1.2.5 1.2 1.2 0 2.5-1.2 4.4-3 5.4.3-.7.6-1.4.7-2.2.5-.8.8-1.7.9-2.6h-1.4V4.6z" />
      <rect x="6.4" y="19.4" width="11.2" height="2.2" rx="1.1" />
    </svg>
  );
}

/** Sementinhas — a moeda da jornada. */
export function IconeSemente({ className }: Props) {
  return (
    <svg {...base(className)}>
      <path d="M12 2.4c4 2.4 6.4 5.6 6.4 9.3 0 3.9-2.9 6.9-6.4 6.9s-6.4-3-6.4-6.9c0-3.7 2.4-6.9 6.4-9.3z" />
      <path
        d="M12 6.2c2.2 1.6 3.4 3.5 3.4 5.5 0 2.2-1.5 3.9-3.4 3.9V6.2z"
        opacity=".4"
        fill="#fff"
      />
      <rect x="11" y="17.4" width="2" height="4.4" rx="1" />
    </svg>
  );
}

/** Loja de figurinhas. */
export function IconeLoja({ className }: Props) {
  return (
    <svg {...base(className)}>
      <path d="M4.6 7.6h14.8c.7 0 1.2.6 1.1 1.3l-1.3 11a2.2 2.2 0 0 1-2.2 1.9H7c-1.1 0-2.1-.8-2.2-1.9l-1.3-11c-.1-.7.4-1.3 1.1-1.3z" />
      <path
        d="M6.2 10.4h11.6l-1 8.6c0 .2-.2.3-.4.3H7.6a.4.4 0 0 1-.4-.3l-1-8.6z"
        opacity=".38"
        fill="#fff"
      />
      <path d="M12 1.6c2.4 0 4.3 1.9 4.3 4.3v1.7h-2.2V5.9c0-1.2-.9-2.1-2.1-2.1s-2.1.9-2.1 2.1v1.7H7.7V5.9c0-2.4 1.9-4.3 4.3-4.3z" />
    </svg>
  );
}

/** Dia ainda fechado. */
export function IconeCadeado({ className }: Props) {
  return (
    <svg {...base(className)}>
      <path d="M12 1.8c2.9 0 5.2 2.3 5.2 5.2v2.6h-2.4V7c0-1.5-1.3-2.8-2.8-2.8S9.2 5.5 9.2 7v2.6H6.8V7c0-2.9 2.3-5.2 5.2-5.2z" />
      <rect x="4.4" y="9.6" width="15.2" height="12.6" rx="2.6" />
      <path
        d="M6.6 12.2h10.8c.3 0 .5.2.5.5v6.9c0 .3-.2.5-.5.5H6.6a.5.5 0 0 1-.5-.5v-6.9c0-.3.2-.5.5-.5z"
        opacity=".3"
        fill="#fff"
      />
      <circle cx="12" cy="15.2" r="1.7" opacity=".85" fill="#fff" />
      <rect x="11.2" y="15.9" width="1.6" height="3.2" rx=".8" opacity=".85" fill="#fff" />
    </svg>
  );
}

/** Recompensa do dia. */
export function IconePresente({ className }: Props) {
  return (
    <svg {...base(className)}>
      <path d="M2.8 8.4h18.4c.5 0 .9.4.9.9v2.8c0 .5-.4.9-.9.9H2.8a.9.9 0 0 1-.9-.9V9.3c0-.5.4-.9.9-.9z" />
      <path d="M4.4 13.6h15.2v6.6c0 1-.8 1.8-1.8 1.8H6.2c-1 0-1.8-.8-1.8-1.8v-6.6z" />
      <rect x="10.4" y="8.4" width="3.2" height="13.6" opacity=".45" fill="#fff" />
      <path d="M8.1 1.9c1.7 0 3 1.6 3.6 4.1-2.6.5-4.4.2-5.3-.7a2 2 0 0 1 1.7-3.4zM15.9 1.9a2 2 0 0 1 1.7 3.4c-.9.9-2.7 1.2-5.3.7.6-2.5 1.9-4.1 3.6-4.1z" />
    </svg>
  );
}

/**
 * AMIGAS — o que substituiu o calendário na fita.
 *
 * Duas silhuetas e um `+`, como o ícone que o dono mandou. Desenhado aqui e
 * não emprestado do sistema pelo mesmo motivo dos outros: emoji de pessoas tem
 * tom de pele, e um app de gestação não escolhe o tom de pele da paciente por
 * ela.
 *
 * A tinta encosta em baixo (o ombro da silhueta grande vai até a borda do
 * `viewBox`), então a fração de alinhamento dele é 1 — ver `alinhar-na-linha`.
 */
export function IconeAmigas({ className, style }: Props) {
  return (
    <svg {...base(className, style)}>
      {/* a de trás, menor e mais clara */}
      <circle cx="16.1" cy="7.4" r="3.1" opacity=".55" />
      <path
        d="M16.1 11.6c2.7 0 5 1.7 5.6 4.1.2.7-.4 1.4-1.1 1.4h-3.2c0-2.2-1.2-4.1-3-5.2.6-.2 1.1-.3 1.7-.3z"
        opacity=".55"
      />
      {/* a da frente */}
      <circle cx="9.4" cy="6.9" r="3.9" />
      <path d="M9.4 12c3.4 0 6.3 2.2 7.1 5.2.3 1-.5 1.9-1.5 1.9H3.8c-1 0-1.8-.9-1.5-1.9.8-3 3.7-5.2 7.1-5.2z" />
      {/* o mais, num disco próprio para não sumir no ombro */}
      <circle cx="18.2" cy="18" r="4.1" />
      <path
        d="M18.2 15.6c.4 0 .7.3.7.7v1h1c.4 0 .7.3.7.7s-.3.7-.7.7h-1v1c0 .4-.3.7-.7.7s-.7-.3-.7-.7v-1h-1c-.4 0-.7-.3-.7-.7s.3-.7.7-.7h1v-1c0-.4.3-.7.7-.7z"
        fill="#fff"
      />
    </svg>
  );
}
