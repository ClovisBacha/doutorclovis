/**
 * OS QUATRO CÉUS DA HOME — amanhecer, dia, pôr do sol e anoitecer.
 *
 * ─── O QUE ISTO SUBSTITUI ───────────────────────────────────────────────────
 *
 * Dez artes em `.webp` (700 KB) repartidas em dez faixas de hora. Pedido do
 * dono (ago/2026): "a gente vai remover o que está atualmente, que são várias
 * versões ali, porém que no final não ficou bom o suficiente... vai ficar
 * muito mais simples".
 *
 * ─── POR QUE SVG E NÃO IMAGEM ───────────────────────────────────────────────
 *
 * As quatro cenas são malhas de gradiente com três elementos (astro, dunas,
 * estrelas). Em SVG isso custa ~2 KB por céu em vez de ~70 KB, escala sem
 * borrar em qualquer densidade de tela, e — o que imagem nenhuma faz — deixa
 * a estrela cintilar e o astro respirar sem um segundo arquivo.
 *
 * `preserveAspectRatio="xMidYMid slice"` é o `background-size: cover` do SVG:
 * a cena é desenhada para retrato (430×956, a proporção do iPhone) e sobra
 * cortada nas bordas em qualquer outra. O que é cortado é sempre céu liso —
 * o astro e as dunas ficam dentro da faixa segura vertical.
 *
 * ─── A REGRA QUE NÃO PODE SE PERDER ─────────────────────────────────────────
 *
 * `dark` acompanha a ARTE, não o relógio. É esse campo que decide se o texto
 * do hero é branco ou escuro, e se a barra de status do iOS vai clara ou
 * escura. O amanhecer é claro apesar de cedo; o anoitecer é escuro apesar de
 * ainda não ser noite fechada.
 */

import type { ReactElement } from "react";

/** As quatro cenas. A ordem é a do dia, e é ela que a Loja mostra. */
export type NomeDoCeu = "amanhecer" | "dia" | "por-do-sol" | "anoitecer";

export type Ceu = {
  nome: NomeDoCeu;
  /** Como a paciente chama — aparece na Loja e no rótulo de acessibilidade. */
  rotulo: string;
  /** Céu escuro pede texto claro. Segue a ARTE, nunca o relógio. */
  dark: boolean;
  /**
   * A cor CHAPADA do topo da cena.
   *
   * O iOS em modo standalone não pinta o conteúdo da página fora da área
   * segura — pinta o fundo do DOCUMENTO. Sem esta cor sobrava uma faixa creme
   * atrás do relógio do sistema. Tem que casar com o primeiro `stop` do
   * gradiente, ou a emenda aparece.
   */
  corDeTopo: string;
  /**
   * A cor CHAPADA do pé da cena — o último `stop` do gradiente.
   *
   * A cena é desenhada para UMA TELA, e o hero é mais alto que uma tela: ele
   * continua atrás da segunda dobra (progresso, saudação, médico). Esta cor é
   * o que continua dali para baixo. Sem ela o SVG teria de esticar para
   * cobrir o hero inteiro — e esticar em `slice` amplia a cena até a lua sair
   * pela borda direita, que foi exatamente o defeito medido.
   */
  corDeBaixo: string;
};

export const CEUS: Ceu[] = [
  {
    nome: "amanhecer",
    rotulo: "Amanhecer",
    dark: false,
    corDeTopo: "#9b98e0",
    corDeBaixo: "#ddd3ee",
  },
  { nome: "dia", rotulo: "Dia", dark: false, corDeTopo: "#2f96e8", corDeBaixo: "#6bcdc0" },
  {
    nome: "por-do-sol",
    rotulo: "Pôr do sol",
    dark: false,
    corDeTopo: "#6f66bc",
    corDeBaixo: "#9a88c6",
  },
  {
    nome: "anoitecer",
    rotulo: "Anoitecer",
    dark: true,
    corDeTopo: "#16215f",
    corDeBaixo: "#4436a8",
  },
];

const PORNOME = new Map(CEUS.map((c) => [c.nome, c]));

/** A cena de um nome. Nome desconhecido cai no dia — nunca devolve `undefined`. */
export function ceuPorNome(nome: string): Ceu {
  return PORNOME.get(nome as NomeDoCeu) ?? PORNOME.get("dia")!;
}

/**
 * QUE CÉU MOSTRAR, pelo relógio.
 *
 * O plano B de quando não se sabe onde a paciente está — a versão ancorada no
 * nascer e no pôr do sol de verdade mora em `ceuPeloSol`, logo abaixo.
 *
 * As faixas são fechadas à esquerda e abertas à direita (`>= de`, `< ate`), e
 * o anoitecer é o que dá a volta na meia-noite: das 19h às 5h.
 */
export function ceuPelaHora(hora: number): Ceu {
  const h = Math.max(0, Math.min(23, Math.floor(hora)));
  if (h >= 5 && h < 9) return PORNOME.get("amanhecer")!;
  if (h >= 9 && h < 16) return PORNOME.get("dia")!;
  if (h >= 16 && h < 19) return PORNOME.get("por-do-sol")!;
  return PORNOME.get("anoitecer")!;
}

/**
 * O CÉU SEGUINDO O SOL DE VERDADE.
 *
 * O relógio sozinho mente. Às 19h de julho, no Brasil, o sol se pôs há mais de
 * uma hora e está escuro — mas a tabela de horas fixas mostraria o pôr do sol
 * alaranjado. Em dezembro, no mesmo 19h, ainda é dia claro. Uma das duas está
 * sempre errada, e a distância cresce quanto mais longe do equador.
 *
 * As janelas de amanhecer e pôr do sol são MINUTOS FIXOS em volta do evento
 * (a passagem do sol pelo horizonte dura mais ou menos o mesmo em qualquer
 * estação, fora dos polos). O que fica entre elas é dia; o resto é anoitecer.
 *
 * Sem nascer/pôr conhecidos, ou com um dia degenerado (sol da meia-noite,
 * noite polar, resposta estranha da API), volta para o relógio: ele erra
 * menos que uma conta em cima de dado ruim.
 */
export function ceuPeloSol(agora: Date, sunrise: Date | null, sunset: Date | null): Ceu {
  if (!sunrise || !sunset) return ceuPelaHora(agora.getHours());
  const SR = sunrise.getTime();
  const SS = sunset.getTime();
  const t = agora.getTime();
  const dia = SS - SR;
  if (!(dia > 0) || dia > 22 * 3_600_000) return ceuPelaHora(agora.getHours());

  const min = 60_000;
  /* Amanhecer: de 50 min antes do nascer a 70 min depois. O céu já está
     rosado antes de o disco aparecer, e continua dourado um tempo depois. */
  if (t >= SR - 50 * min && t < SR + 70 * min) return PORNOME.get("amanhecer")!;
  /* Pôr do sol: de 80 min antes até 30 min depois — a "golden hour" inteira
     mais o crepúsculo civil, que é quando o céu fica laranja de verdade. */
  if (t >= SS - 80 * min && t < SS + 30 * min) return PORNOME.get("por-do-sol")!;
  if (t >= SR && t < SS) return PORNOME.get("dia")!;
  return PORNOME.get("anoitecer")!;
}

/* ────────────────────────────────────────────────────────────────────────────
   AS CENAS
   ──────────────────────────────────────────────────────────────────────────── */

/* A cena é desenhada nesta caixa e recortada para caber em qualquer tela. */
const W = 430;
const H = 956;

/**
 * Estrelas em posições DETERMINÍSTICAS.
 *
 * `Math.random()` aqui daria mismatch de hidratação: o servidor sorteia um
 * céu e o cliente sorteia outro, e o React reclama (ou repinta) na primeira
 * pintura. A sequência abaixo é um gerador congruente escrito à mão — mesma
 * entrada, mesmo céu, servidor e navegador.
 */
function estrelas(qtd: number, semente: number, alturaMax: number) {
  const out: { x: number; y: number; r: number; o: number; d: number }[] = [];
  let s = semente;
  const proximo = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  for (let i = 0; i < qtd; i++) {
    const a = proximo();
    const b = proximo();
    const c = proximo();
    out.push({
      x: a * W,
      y: b * alturaMax,
      r: 0.7 + c * 1.15,
      o: 0.42 + c * 0.55,
      d: (i % 9) * 0.45,
    });
  }
  return out;
}

/** A lua em quarto crescente: um disco cheio com outro mordendo a borda. */
function LuaCrescente({
  cx,
  cy,
  r,
  id,
  cor = "#fdf4fb",
  brilho = 0.34,
}: {
  cx: number;
  cy: number;
  r: number;
  id: string;
  cor?: string;
  brilho?: number;
}) {
  return (
    <g>
      {/* O halo primeiro, atrás: pintado depois cobriria a lua de leitoso. */}
      <circle cx={cx} cy={cy} r={r * 2.9} fill={`url(#halo-${id})`} opacity={brilho} />
      <mask id={`lua-${id}`}>
        <circle cx={cx} cy={cy} r={r} fill="#fff" />
        {/* A mordida vem de cima à esquerda — é a fase que a referência traz.
            Deslocada em 0,52r: menos que isso vira meia-lua, mais vira fio. */}
        <circle cx={cx - r * 0.52} cy={cy - r * 0.3} r={r * 0.94} fill="#000" />
      </mask>
      <circle cx={cx} cy={cy} r={r} fill={cor} mask={`url(#lua-${id})`} />
    </g>
  );
}

/** O sol: disco quente com halo largo. `halo` controla o alcance do brilho. */
function Sol({
  cx,
  cy,
  r,
  id,
  nucleo,
  borda,
  halo = 3.4,
  opacidade = 0.5,
}: {
  cx: number;
  cy: number;
  r: number;
  id: string;
  nucleo: string;
  borda: string;
  halo?: number;
  opacidade?: number;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * halo} fill={`url(#halo-${id})`} opacity={opacidade} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#disco-${id})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={borda} strokeOpacity={0.35} />
      <circle cx={cx} cy={cy} r={r * 0.55} fill={nucleo} opacity={0.9} />
    </g>
  );
}

/* ── 1. AMANHECER ──────────────────────────────────────────────────────────
   Lavanda em cima, pêssego no horizonte, dunas de neve lilás. A lua ainda
   está no céu — é o que diz que o dia acabou de começar. */
function Amanhecer() {
  const st = estrelas(14, 7717, H * 0.4);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="am-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9b98e0" />
          <stop offset="0.16" stopColor="#a7a1e4" />
          <stop offset="0.32" stopColor="#b9a7e0" />
          <stop offset="0.46" stopColor="#cfb0d9" />
          <stop offset="0.58" stopColor="#e5c0cc" />
          <stop offset="0.68" stopColor="#f3ceb5" />
          <stop offset="0.77" stopColor="#fadcb4" />
          <stop offset="0.84" stopColor="#fde9c8" />
          <stop offset="0.9" stopColor="#f0dcd8" />
          <stop offset="1" stopColor="#ddd3ee" />
        </linearGradient>
        {/* O clarão do sol que ainda não nasceu, no centro do horizonte. */}
        <radialGradient id="am-glow" cx="0.42" cy="0.86" r="0.55">
          <stop offset="0" stopColor="#fff0cf" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#fbdcb8" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f2cfc4" stopOpacity="0" />
        </radialGradient>
        {/* Quatro `stop` e não dois: a queda linear de um gradiente de duas
            paradas deixa uma BORDA DE DISCO visível em volta do astro — o
            halo lê como círculo desenhado em vez de luz. Os valores abaixo
            aproximam uma queda quadrática, que é como luz se espalha. */}
        <radialGradient id="halo-am">
          <stop offset="0" stopColor="#fff8f2" stopOpacity="0.7" />
          <stop offset="0.3" stopColor="#fff8f2" stopOpacity="0.34" />
          <stop offset="0.6" stopColor="#fff8f2" stopOpacity="0.11" />
          <stop offset="1" stopColor="#fff8f2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="am-duna-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfc4ea" />
          <stop offset="1" stopColor="#ded5f0" />
        </linearGradient>
        <linearGradient id="am-duna-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9cdec" />
          <stop offset="1" stopColor="#e7dff4" />
        </linearGradient>
        <linearGradient id="am-duna-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8def3" />
          <stop offset="1" stopColor="#ded6f0" />
        </linearGradient>
        <filter id="am-mole" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#am-ceu)" />
      <rect width={W} height={H} fill="url(#am-glow)" />

      {st.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r * 0.72}
          fill="#fff"
          /* `fill-opacity` e não `opacity`: a classe `.dc-estrela` anima
             `opacity`, e as duas se MULTIPLICAM. Escritas na mesma
             propriedade, o CSS venceria o atributo e todas as estrelas
             cintilariam com o mesmo brilho — some a variação que faz o céu
             parecer céu. */
          fillOpacity={s.o * 0.5}
          className="dc-estrela"
          style={{ animationDelay: `${s.d}s` }}
        />
      ))}

      <LuaCrescente cx={352} cy={196} r={22} id="am" cor="#fefaff" brilho={0.42} />

      {/* Dunas: três cristas com a névoa do amanhecer entre elas. A de trás é
          mais azulada e mais borrada — é a distância que faz isso. */}
      <g filter="url(#am-mole)">
        <path
          d={`M-20 ${H * 0.578} C 40 ${H * 0.523}, 118 ${H * 0.514}, 176 ${H * 0.567}
              S 300 ${H * 0.604}, 356 ${H * 0.548} S 430 ${H * 0.53}, ${W + 20} ${H * 0.552}
              L ${W + 20} ${H} L -20 ${H} Z`}
          fill="url(#am-duna-a)"
          opacity="0.92"
        />
      </g>
      <path
        d={`M-20 ${H * 0.63} C 62 ${H * 0.596}, 152 ${H * 0.65}, 232 ${H * 0.639}
            S 372 ${H * 0.607}, ${W + 20} ${H * 0.633} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="url(#am-duna-b)"
        opacity="0.95"
      />
      <path
        d={`M-20 ${H * 0.702} C 90 ${H * 0.676}, 190 ${H * 0.72}, 300 ${H * 0.703}
            S ${W + 20} ${H * 0.688}, ${W + 20} ${H * 0.7} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="url(#am-duna-c)"
      />
      {/* A crista acesa: a luz do horizonte lambe a borda de cima da duna. */}
      <path
        d={`M-20 ${H * 0.702} C 90 ${H * 0.676}, 190 ${H * 0.72}, 300 ${H * 0.703}
            S ${W + 20} ${H * 0.688}, ${W + 20} ${H * 0.7}`}
        fill="none"
        stroke="#fff3e4"
        strokeOpacity="0.5"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/* ── 2. DIA ────────────────────────────────────────────────────────────────
   Azul forte no alto que abre em creme e verde-água embaixo. Sol alto à
   direita, com halo largo e nenhuma nuvem: é o céu limpo do meio do dia. */
function Dia() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="di-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f96e8" />
          <stop offset="0.18" stopColor="#4ea7ea" />
          <stop offset="0.36" stopColor="#79c2ea" />
          <stop offset="0.54" stopColor="#a5d9e9" />
          <stop offset="0.68" stopColor="#cfe9e0" />
          <stop offset="0.78" stopColor="#eaf4d9" />
          <stop offset="0.86" stopColor="#cfead6" />
          <stop offset="0.94" stopColor="#8ed8c8" />
          <stop offset="1" stopColor="#6bcdc0" />
        </linearGradient>
        {/* Ver a nota do amanhecer: a queda precisa de paradas intermediárias
            para o halo não virar um disco de borda dura. */}
        <radialGradient id="halo-di">
          <stop offset="0" stopColor="#fffdf0" stopOpacity="0.9" />
          <stop offset="0.22" stopColor="#fff8dd" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#fff4cc" stopOpacity="0.22" />
          <stop offset="0.72" stopColor="#fff2c0" stopOpacity="0.07" />
          <stop offset="1" stopColor="#fff2c0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="disco-di">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#fff8d8" />
          <stop offset="1" stopColor="#ffeda6" />
        </radialGradient>
        <linearGradient id="di-onda-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f8dd" stopOpacity="0.95" />
          <stop offset="1" stopColor="#dcefdc" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="di-onda-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d8eede" stopOpacity="0.95" />
          <stop offset="1" stopColor="#9fdccb" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="di-onda-c" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#96dcc9" />
          <stop offset="1" stopColor="#63cabd" />
        </linearGradient>
        <filter id="di-mole" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#di-ceu)" />

      <Sol cx={340} cy={190} r={32} id="di" nucleo="#ffffff" borda="#fff3bd" halo={3.6} />

      {/* Ondas suaves — o mesmo desenho das dunas, mas em creme e verde-água:
          aqui elas leem como colina distante sob luz forte. */}
      <g filter="url(#di-mole)">
        <path
          d={`M-20 ${H * 0.742} C 70 ${H * 0.706}, 168 ${H * 0.756}, 262 ${H * 0.738}
              S ${W + 20} ${H * 0.705}, ${W + 20} ${H * 0.73} L ${W + 20} ${H} L -20 ${H} Z`}
          fill="url(#di-onda-a)"
        />
      </g>
      <path
        d={`M-20 ${H * 0.806} C 96 ${H * 0.784}, 190 ${H * 0.828}, 300 ${H * 0.806}
            S ${W + 20} ${H * 0.778}, ${W + 20} ${H * 0.8} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="url(#di-onda-b)"
      />
      <path
        d={`M-20 ${H * 0.876} C 110 ${H * 0.852}, 214 ${H * 0.9}, 330 ${H * 0.874}
            S ${W + 20} ${H * 0.856}, ${W + 20} ${H * 0.87} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="url(#di-onda-c)"
      />
      <path
        d={`M-20 ${H * 0.806} C 96 ${H * 0.784}, 190 ${H * 0.828}, 300 ${H * 0.806}
            S ${W + 20} ${H * 0.778}, ${W + 20} ${H * 0.8}`}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/* ── 3. PÔR DO SOL ─────────────────────────────────────────────────────────
   Violeta no alto, coral no meio, ouro no horizonte. O sol encosta na crista
   da direita — é ele que acende as bordas das dunas. */
function PorDoSol() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="ps-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f66bc" />
          <stop offset="0.12" stopColor="#8069b6" />
          <stop offset="0.24" stopColor="#a870a2" />
          <stop offset="0.34" stopColor="#d47b7a" />
          <stop offset="0.44" stopColor="#ea8a62" />
          <stop offset="0.54" stopColor="#f59a52" />
          <stop offset="0.63" stopColor="#fbb44c" />
          <stop offset="0.7" stopColor="#fdc94e" />
          <stop offset="0.78" stopColor="#f7a86c" />
          <stop offset="0.87" stopColor="#cf8a95" />
          <stop offset="0.95" stopColor="#a288c4" />
          <stop offset="1" stopColor="#9a88c6" />
        </linearGradient>
        <radialGradient id="halo-ps">
          <stop offset="0" stopColor="#fff6c4" stopOpacity="0.88" />
          <stop offset="0.22" stopColor="#ffe698" stopOpacity="0.48" />
          <stop offset="0.46" stopColor="#ffd873" stopOpacity="0.22" />
          <stop offset="0.74" stopColor="#ffc25e" stopOpacity="0.07" />
          <stop offset="1" stopColor="#ffc25e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="disco-ps">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.65" stopColor="#ffef9e" />
          <stop offset="1" stopColor="#ffd964" />
        </radialGradient>
        <linearGradient id="ps-duna-a" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#f0a069" stopOpacity="0.92" />
          <stop offset="1" stopColor="#e08a72" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id="ps-duna-b" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#ef9a6f" />
          <stop offset="0.55" stopColor="#e28a80" />
          <stop offset="1" stopColor="#d4849a" />
        </linearGradient>
        <linearGradient id="ps-duna-c" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#c98a9e" />
          <stop offset="1" stopColor="#a98ac0" />
        </linearGradient>
        <linearGradient id="ps-duna-d" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a889c4" />
          <stop offset="1" stopColor="#9787c8" />
        </linearGradient>
        <filter id="ps-mole" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#ps-ceu)" />

      {/* O sol encostado na crista: metade dele já sumiu atrás da duna, e é o
          que faz o horizonte acender de dentro para fora. */}
      <Sol
        cx={346}
        cy={527}
        r={30}
        id="ps"
        nucleo="#fffce8"
        borda="#ffe89a"
        halo={4.2}
        opacidade={0.62}
      />

      <g filter="url(#ps-mole)">
        <path
          d={`M-20 ${H * 0.585} C 52 ${H * 0.538}, 130 ${H * 0.566}, 208 ${H * 0.6}
              S 330 ${H * 0.618}, ${W + 20} ${H * 0.566} L ${W + 20} ${H} L -20 ${H} Z`}
          fill="url(#ps-duna-a)"
        />
      </g>
      <path
        d={`M-20 ${H * 0.652} C 78 ${H * 0.61}, 168 ${H * 0.666}, 258 ${H * 0.658}
            S 386 ${H * 0.624}, ${W + 20} ${H * 0.654} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="url(#ps-duna-b)"
        opacity="0.96"
      />
      <path
        d={`M-20 ${H * 0.724} C 96 ${H * 0.69}, 200 ${H * 0.746}, 312 ${H * 0.722}
            S ${W + 20} ${H * 0.702}, ${W + 20} ${H * 0.718} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="url(#ps-duna-c)"
        opacity="0.94"
      />
      <path
        d={`M-20 ${H * 0.806} C 110 ${H * 0.784}, 220 ${H * 0.834}, 336 ${H * 0.804}
            S ${W + 20} ${H * 0.79}, ${W + 20} ${H * 0.802} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="url(#ps-duna-d)"
      />
      {/* As duas cristas acesas pelo sol rasante. */}
      <path
        d={`M-20 ${H * 0.652} C 78 ${H * 0.61}, 168 ${H * 0.666}, 258 ${H * 0.658}
            S 386 ${H * 0.624}, ${W + 20} ${H * 0.654}`}
        fill="none"
        stroke="#ffe2ad"
        strokeOpacity="0.55"
        strokeWidth="1.6"
      />
      <path
        d={`M-20 ${H * 0.724} C 96 ${H * 0.69}, 200 ${H * 0.746}, 312 ${H * 0.722}
            S ${W + 20} ${H * 0.702}, ${W + 20} ${H * 0.718}`}
        fill="none"
        stroke="#ffd9b0"
        strokeOpacity="0.4"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/* ── 4. ANOITECER ──────────────────────────────────────────────────────────
   Azul-marinho profundo, estrelas, lua crescente e as ondas de luz. É a cena
   da referência do rebranding — a que o resto da tela foi desenhado para. */
function Anoitecer() {
  const st = estrelas(56, 20260810, H * 0.62);
  /* As luzinhas da base: hastes finas com um bulbo aceso, como flores de luz.
     Posições fixas — o mesmo motivo das estrelas. */
  const flores = [
    { x: 40, y: 0.895, h: 26, r: 3.4 },
    { x: 58, y: 0.878, h: 34, r: 2.8 },
    { x: 132, y: 0.905, h: 22, r: 2.6 },
    { x: 300, y: 0.9, h: 28, r: 3 },
    { x: 356, y: 0.884, h: 32, r: 3.6 },
    { x: 378, y: 0.902, h: 24, r: 2.8 },
    { x: 396, y: 0.892, h: 30, r: 3.2 },
  ];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="an-ceu" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16215f" />
          <stop offset="0.14" stopColor="#1d2a72" />
          <stop offset="0.3" stopColor="#2b3090" />
          <stop offset="0.44" stopColor="#3f38a8" />
          <stop offset="0.54" stopColor="#5544b6" />
          <stop offset="0.61" stopColor="#7c5cc4" />
          <stop offset="0.66" stopColor="#b487d6" />
          <stop offset="0.7" stopColor="#c9a0dd" />
          <stop offset="0.76" stopColor="#7a68d0" />
          <stop offset="0.86" stopColor="#5a4cc0" />
          <stop offset="1" stopColor="#4436a8" />
        </linearGradient>
        {/* O clarão baixo: o resto do dia que ainda não foi embora. */}
        <radialGradient id="an-glow" cx="0.45" cy="0.69" r="0.52">
          <stop offset="0" stopColor="#e0b8f0" stopOpacity="0.62" />
          <stop offset="0.5" stopColor="#9a7ad8" stopOpacity="0.24" />
          <stop offset="1" stopColor="#6a52c0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="halo-an">
          <stop offset="0" stopColor="#f6e4ff" stopOpacity="0.6" />
          <stop offset="0.26" stopColor="#eed6ff" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#e4c8f6" stopOpacity="0.11" />
          <stop offset="1" stopColor="#e0c0f0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="an-onda-a" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#4f6fd8" />
          <stop offset="0.45" stopColor="#7a6ade" />
          <stop offset="1" stopColor="#4a63d4" />
        </linearGradient>
        <linearGradient id="an-onda-b" x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#6a5cd0" />
          <stop offset="0.5" stopColor="#9a72dc" />
          <stop offset="1" stopColor="#5f52c8" />
        </linearGradient>
        <linearGradient id="an-onda-c" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#5b4ac0" />
          <stop offset="0.5" stopColor="#8158cc" />
          <stop offset="1" stopColor="#4e3fb4" />
        </linearGradient>
        <linearGradient id="an-fio" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cfe0ff" stopOpacity="0.15" />
          <stop offset="0.35" stopColor="#f0e6ff" stopOpacity="0.9" />
          <stop offset="0.75" stopColor="#e6d4ff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#cfc0ff" stopOpacity="0.1" />
        </linearGradient>
        <filter id="an-mole" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="an-brilho" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#an-ceu)" />
      <rect width={W} height={H} fill="url(#an-glow)" />

      {st.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#fff"
          /* Ver a nota do amanhecer: `fill-opacity` multiplica com o
             `opacity` animado, `opacity` seria sobrescrito por ele. */
          fillOpacity={s.o}
          className="dc-estrela"
          style={{ animationDelay: `${s.d}s` }}
        />
      ))}

      <LuaCrescente cx={356} cy={188} r={27} id="an" cor="#f7e7fb" brilho={0.5} />

      {/* AS ONDAS DE LUZ. Cada uma é uma faixa preenchida com um fio aceso na
          crista — é o fio que faz a onda parecer luz em vez de morro. */}
      <g filter="url(#an-mole)">
        <path
          d={`M-20 ${H * 0.585} C 70 ${H * 0.542}, 150 ${H * 0.6}, 240 ${H * 0.594}
              S 372 ${H * 0.542}, ${W + 20} ${H * 0.566} L ${W + 20} ${H} L -20 ${H} Z`}
          fill="url(#an-onda-a)"
          opacity="0.86"
        />
      </g>
      <path
        d={`M-20 ${H * 0.585} C 70 ${H * 0.542}, 150 ${H * 0.6}, 240 ${H * 0.594}
            S 372 ${H * 0.542}, ${W + 20} ${H * 0.566}`}
        fill="none"
        stroke="url(#an-fio)"
        strokeWidth="2"
        filter="url(#an-brilho)"
      />
      <path
        d={`M-20 ${H * 0.585} C 70 ${H * 0.542}, 150 ${H * 0.6}, 240 ${H * 0.594}
            S 372 ${H * 0.542}, ${W + 20} ${H * 0.566}`}
        fill="none"
        stroke="url(#an-fio)"
        strokeWidth="1.1"
      />

      <path
        d={`M-20 ${H * 0.664} C 84 ${H * 0.62}, 176 ${H * 0.686}, 272 ${H * 0.668}
            S ${W + 20} ${H * 0.616}, ${W + 20} ${H * 0.646} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="url(#an-onda-b)"
        opacity="0.92"
      />
      <path
        d={`M-20 ${H * 0.664} C 84 ${H * 0.62}, 176 ${H * 0.686}, 272 ${H * 0.668}
            S ${W + 20} ${H * 0.616}, ${W + 20} ${H * 0.646}`}
        fill="none"
        stroke="url(#an-fio)"
        strokeWidth="2.2"
        filter="url(#an-brilho)"
      />
      <path
        d={`M-20 ${H * 0.664} C 84 ${H * 0.62}, 176 ${H * 0.686}, 272 ${H * 0.668}
            S ${W + 20} ${H * 0.616}, ${W + 20} ${H * 0.646}`}
        fill="none"
        stroke="url(#an-fio)"
        strokeWidth="1.2"
      />

      <path
        d={`M-20 ${H * 0.752} C 100 ${H * 0.714}, 206 ${H * 0.776}, 318 ${H * 0.75}
            S ${W + 20} ${H * 0.712}, ${W + 20} ${H * 0.738} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="url(#an-onda-c)"
      />
      <path
        d={`M-20 ${H * 0.752} C 100 ${H * 0.714}, 206 ${H * 0.776}, 318 ${H * 0.75}
            S ${W + 20} ${H * 0.712}, ${W + 20} ${H * 0.738}`}
        fill="none"
        stroke="url(#an-fio)"
        strokeWidth="1.8"
        filter="url(#an-brilho)"
      />
      <path
        d={`M-20 ${H * 0.752} C 100 ${H * 0.714}, 206 ${H * 0.776}, 318 ${H * 0.75}
            S ${W + 20} ${H * 0.712}, ${W + 20} ${H * 0.738}`}
        fill="none"
        stroke="url(#an-fio)"
        strokeWidth="1"
        strokeOpacity="0.8"
      />

      {/* Colina da frente, apagada: é ela que dá o chão da cena. */}
      <path
        d={`M-20 ${H * 0.86} C 90 ${H * 0.836}, 200 ${H * 0.882}, 320 ${H * 0.858}
            S ${W + 20} ${H * 0.844}, ${W + 20} ${H * 0.856} L ${W + 20} ${H} L -20 ${H} Z`}
        fill="#4232a2"
        opacity="0.75"
      />

      {flores.map((f, i) => (
        <g key={i} opacity="0.9">
          <line
            x1={f.x}
            y1={H * f.y + f.h}
            x2={f.x}
            y2={H * f.y}
            stroke="#c9a6ee"
            strokeOpacity="0.5"
            strokeWidth="1"
          />
          <circle cx={f.x} cy={H * f.y} r={f.r * 2.6} fill="#e8c0ff" opacity="0.18" />
          <circle cx={f.x} cy={H * f.y} r={f.r} fill="#f0d8ff" />
        </g>
      ))}
    </svg>
  );
}

const CENAS: Record<NomeDoCeu, () => ReactElement> = {
  amanhecer: Amanhecer,
  dia: Dia,
  "por-do-sol": PorDoSol,
  anoitecer: Anoitecer,
};

/**
 * O céu do momento, pronto para ser o fundo absoluto de um container
 * `relative overflow-hidden`.
 *
 * ─── POR QUE A ALTURA É A DA PRIMEIRA DOBRA, E NÃO `inset-0` ────────────────
 *
 * A cena tem a proporção de UMA TELA (430×956). O hero é mais alto que uma
 * tela — ele segue atrás da segunda dobra. Com `inset-0` o `slice` ampliava a
 * cena até cobrir os 1104px do hero: escala de 1,155, e a lua saía pela borda
 * direita cortada ao meio. Medido, não suposto.
 *
 * Presa à altura da primeira dobra, a cena fica na proporção para que foi
 * desenhada e o `corDeBaixo` do container continua dali para baixo.
 */
export function CeuDoDia({ nome, className = "" }: { nome: NomeDoCeu; className?: string }) {
  const Cena = CENAS[nome] ?? Dia;
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 h-[calc(100svh+0.5rem+var(--safe-top))] ${className}`}
      aria-hidden
    >
      <Cena />
    </div>
  );
}
