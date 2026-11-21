/**
 * O DESENHO DA FIGURA QUE DEMONSTRA O MOVIMENTO (21/11/2026: "essa imagem do
 * exercício está muito ruim [...] deixar mais profissional", o dono).
 *
 * Antes era o boneco de palito do site: seis poses de traço fino, uma para
 * vários exercícios — a mesma figura "na parede" servia para alongar a
 * panturrilha, abrir as costelas e agachar, e nenhuma das três era a do
 * exercício. Agora é uma personagem: pele, cabelo preso, a roupa na cor da
 * atividade, a legging, o tênis, a barriga com volume, e o apoio de verdade
 * (a cadeira, o banquinho, a parede, o tapete, o travesseiro). Cada exercício
 * tem o SEU desenho, na posição que os passos descrevem.
 *
 * Como é montado: um "kit" de peças (cabeça de frente e de perfil, tronco de
 * frente e de perfil, membros afinando para a ponta, tênis) desenhado com as
 * mesmas proporções em todas as poses, e cada desenho é uma lista de CAMADAS.
 * A camada que se mexe tem uma `parte` — o componente a põe numa vista animada
 * no motor nativo (girar, deslocar, esticar, a opacidade), com a tabela de
 * `~/lib/jornada/figura`. Membros que giram têm a ponta redonda centrada na
 * junta: girar em volta dela não abre buraco.
 *
 * Sem react-native aqui: o componente traduz as formas para o react-native-svg,
 * e a prévia (e o teste) as escrevem como SVG puro.
 */

import type { Parte } from "./figura";

/* ── As cores: nomes, e não valores. O componente decide o valor (a roupa é a
      cor da atividade). ───────────────────────────────────────────────────── */

export type Tom =
  | "pele"
  | "peleSombra"
  | "cabelo"
  | "roupa"
  | "roupaLuz"
  | "roupaSombra"
  | "legging"
  | "leggingSombra"
  | "tenis"
  | "sola"
  | "tapete"
  | "tapeteBorda"
  | "apoio"
  | "apoioSombra"
  | "sombra"
  | "rosto"
  | "bochecha"
  /* "Para vocês dois": a mão de quem acompanha e o ponto onde ela vai. */
  | "parceiroPele"
  | "parceiroManga"
  | "alvo";

/**
 * Um ponto de um degradê: onde (0 a 1), o tom, a luz (positiva clareia,
 * negativa escurece, de 0 a 1) e a opacidade.
 */
export type Parada = readonly [em: number, tom: Tom, luz?: number, opacidade?: number];

/**
 * O degradê de uma forma (a terceira volta, 21/11/2026: "refinar ainda mais
 * para parecer realmente uma arte 3D"). Nas coordenadas da forma, ou, com
 * `naCaixa`, em frações da caixa dela (0 a 1).
 */
export type Gradiente =
  | { tipo: "linear"; de: P; ate: P; paradas: readonly Parada[]; naCaixa?: boolean }
  | { tipo: "radial"; centro: P; raio: number; paradas: readonly Parada[]; naCaixa?: boolean };

export type Forma =
  | {
      d: string;
      /** O tom da forma (com degradê, é o tom do meio: o que o teste de contraste mede). */
      cor?: Tom;
      /** O volume: a forma é pintada com a luz e a sombra deste degradê. */
      gradiente?: Gradiente;
      traco?: Tom;
      espessura?: number;
      opacidade?: number;
    }
  | { grupo: readonly Forma[]; transform: string };

/** Uma camada do desenho. Com `parte`, é um pedaço que pode se mexer. */
export type Camada = {
  parte?: Parte;
  formas?: readonly Forma[];
  /** Camadas por cima desta, que se mexem junto com ela. */
  dentro?: readonly Camada[];
};

export type Desenho = {
  /** A caixa do desenho: x, y, largura, altura. */
  caixa: readonly [number, number, number, number];
  camadas: readonly Camada[];
};

export type P = readonly [number, number];

/* ── Geometria ───────────────────────────────────────────────────────────── */

const n = (v: number) => String(Math.round(v * 100) / 100);
const pt = (p: P) => `${n(p[0])} ${n(p[1])}`;

export function circulo(cx: number, cy: number, r: number): string {
  return `M${n(cx - r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)}A${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)}Z`;
}

export function elipse(cx: number, cy: number, rx: number, ry: number): string {
  return `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z`;
}

/** Retângulo de cantos redondos. */
export function caixaRedonda(x: number, y: number, w: number, h: number, r: number): string {
  const k = Math.min(r, w / 2, h / 2);
  return (
    `M${n(x + k)} ${n(y)}H${n(x + w - k)}A${n(k)} ${n(k)} 0 0 1 ${n(x + w)} ${n(y + k)}` +
    `V${n(y + h - k)}A${n(k)} ${n(k)} 0 0 1 ${n(x + w - k)} ${n(y + h)}H${n(x + k)}` +
    `A${n(k)} ${n(k)} 0 0 1 ${n(x)} ${n(y + h - k)}V${n(y + k)}A${n(k)} ${n(k)} 0 0 1 ${n(x + k)} ${n(y)}Z`
  );
}

/**
 * Um pedaço de membro: dois círculos (a junta de cada ponta) e as duas
 * tangentes entre eles — afina da raiz para a ponta, e a ponta redonda é o
 * que deixa o pedaço girar em volta da junta sem abrir buraco.
 */
export function capsula(a: P, ra: number, b: P, rb: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(ra - rb)) return circulo(a[0], a[1], Math.max(ra, rb));
  const phi = Math.atan2(dy, dx);
  const alfa = Math.acos((ra - rb) / d);
  const e = (c: P, r: number, ang: number): P => [
    c[0] + r * Math.cos(ang),
    c[1] + r * Math.sin(ang),
  ];
  const a1 = e(a, ra, phi + alfa);
  const b1 = e(b, rb, phi + alfa);
  const b2 = e(b, rb, phi - alfa);
  const a2 = e(a, ra, phi - alfa);
  const grandeB = 2 * alfa > Math.PI ? 1 : 0;
  const grandeA = 2 * Math.PI - 2 * alfa > Math.PI ? 1 : 0;
  return (
    `M${pt(a1)}L${pt(b1)}A${n(rb)} ${n(rb)} 0 ${grandeB} 0 ${pt(b2)}` +
    `L${pt(a2)}A${n(ra)} ${n(ra)} 0 ${grandeA} 0 ${pt(a1)}Z`
  );
}

/** Um ponto do tronco (em coordenadas do tronco) levado para o desenho. */
export type Lugar = { x: number; y: number; giro: number; espelho?: boolean };

export function noDesenho(l: Lugar, p: P): P {
  const px = l.espelho ? -p[0] : p[0];
  const r = (l.giro * Math.PI) / 180;
  return [l.x + px * Math.cos(r) - p[1] * Math.sin(r), l.y + px * Math.sin(r) + p[1] * Math.cos(r)];
}

const transformDe = (l: Lugar) =>
  `translate(${n(l.x)} ${n(l.y)}) rotate(${n(l.giro)})${l.espelho ? " scale(-1 1)" : ""}`;

const grupo = (l: Lugar, formas: readonly Forma[]): Forma => ({
  grupo: formas,
  transform: transformDe(l),
});

/* ── As medidas da personagem (as mesmas em todas as poses) ─────────────────── */

export const MEDIDA = {
  cabeca: 9.5,
  braco: 21,
  antebraco: 19,
  coxa: 25,
  canela: 24,
  /** De perfil, o centro da cabeça fica tanto acima da base do pescoço (era
      17: o pescoço comprido pesava). */
  cabecaDePerfil: 16,
} as const;

/**
 * A grossura de cada pedaço (o raio na raiz e na ponta). Afinada na segunda
 * volta (21/11/2026, "dar mais leveza"): os membros grossos davam peso de
 * boneco; finos e afinando para a ponta, ela fica leve sem virar palito.
 */
export const GROSSO = {
  braco: [3.6, 2.7],
  antebraco: [2.55, 2.0],
  mao: [2.2, 1.8],
  coxa: [6.0, 4.2],
  canela: [4.0, 2.6],
} as const;

/* ── A luz (a terceira volta: o volume) ───────────────────────────────────────

   Uma luz de estúdio só, do alto à esquerda, como nos objetos 3D do app (o
   tapete, a flor, o envelope): cada membro é um cilindro, claro do lado da luz
   e escuro do outro, com o reflexo do chão voltando na borda — é esse reflexo
   que separa "render" de "desenho com sombra". A cabeça, o coque, a bola e a
   almofada são esferas. */

/** De onde vem a luz (um vetor de tamanho 1, apontando PARA a luz). */
export const LUZ: P = [-0.5, -0.866];

/** As paradas de um volume: o brilho, o tom, a sombra própria e o reflexo. */
const CILINDRO = [
  [0, 0.14],
  [0.24, 0.3],
  [0.56, 0],
  [0.88, -0.2],
  [1, -0.12],
] as const;

const paradas = (tom: Tom, faixas: readonly (readonly [number, number])[], k = 1): Parada[] =>
  faixas.map(([em, luz]) => [em, tom, luz * k] as const);

/** Um pedaço de membro com volume: a cápsula pintada como um cilindro. */
export function cilindro(
  a: P,
  ra: number,
  b: P,
  rb: number,
  tom: Tom,
  k = 1,
  /** A meia-largura da faixa de luz. Dois pedaços que se encontram numa junta
      usam a largura DA JUNTA: com faixas diferentes, a emenda aparecia (o
      joelho virava uma joelheira). Sem ela, a média das pontas. */
  faixa = (ra + rb) / 2,
): Forma {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  /* A normal do eixo que olha para a luz. */
  let nx = -dy / d;
  let ny = dx / d;
  if (nx * LUZ[0] + ny * LUZ[1] < 0) {
    nx = -nx;
    ny = -ny;
  }
  const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const r = faixa;
  return {
    d: capsula(a, ra, b, rb),
    cor: tom,
    gradiente: {
      tipo: "linear",
      de: [m[0] + nx * r, m[1] + ny * r],
      ate: [m[0] - nx * r, m[1] - ny * r],
      paradas: paradas(tom, CILINDRO, k),
    },
  };
}

/** A luz numa esfera (ou numa forma redonda) de centro `c` e raio `r`. */
export function luzDeEsfera(c: P, r: number, tom: Tom, k = 1): Gradiente {
  return {
    tipo: "radial",
    centro: [c[0] + LUZ[0] * r * 0.42, c[1] + LUZ[1] * r * 0.42],
    raio: r * 1.45,
    paradas: paradas(
      tom,
      [
        [0, 0.32],
        [0.36, 0.07],
        [0.7, -0.05],
        [0.92, -0.2],
        [1, -0.14],
      ],
      k,
    ),
  };
}

/** Uma esfera com volume. */
export function esfera(cx: number, cy: number, r: number, tom: Tom, k = 1): Forma {
  return { d: circulo(cx, cy, r), cor: tom, gradiente: luzDeEsfera([cx, cy], r, tom, k) };
}

/** A luz de estúdio numa peça lisa (o assento, o tapete, a parede): de cima para baixo. */
export function luzDeCima(y0: number, y1: number, tom: Tom, k = 1): Gradiente {
  return {
    tipo: "linear",
    de: [0, y0],
    ate: [0, y1],
    paradas: paradas(
      tom,
      [
        [0, 0.45],
        [0.5, 0.05],
        [1, -0.1],
      ],
      k,
    ),
  };
}

/** O reflexo macio de uma luz de estúdio: uma mancha clara que some nas bordas. */
export function reflexo(cx: number, cy: number, rx: number, ry: number): Forma {
  return {
    d: elipse(cx, cy, rx, ry),
    cor: "roupaLuz",
    gradiente: {
      tipo: "radial",
      naCaixa: true,
      centro: [0.5, 0.5],
      raio: 0.5,
      paradas: [
        [0, "roupaLuz", 0.5, 0.75],
        [0.5, "roupaLuz", 0.2, 0.3],
        [1, "roupaLuz", 0, 0],
      ],
    },
  };
}

/** Um tampo (o assento, o banquinho): a luz de cima, a quina de baixo na sombra. */
export function tampo(x: number, y: number, w: number, h: number, r: number): Forma {
  return {
    d: caixaRedonda(x, y, w, h, r),
    cor: "apoio",
    gradiente: luzDeCima(y, y + h, "apoio", 0.9),
  };
}

/** A perna de um móvel: um cilindro no tom de sombra do apoio. */
export function pernaDeMovel(a: P, ra: number, b: P, rb: number): Forma {
  return cilindro(a, ra, b, rb, "apoioSombra", 0.7);
}

/**
 * A luz numa parede a partir da quina em `borda`, com a parede continuando
 * para o lado `para` (-1: para a esquerda): a quina pega a luz, o fundo fica
 * um tom abaixo — é o que faz a parede virar um plano, e não uma faixa.
 */
export function luzDaParede(borda: number, para: 1 | -1): Gradiente {
  return {
    tipo: "linear",
    de: [borda + para * 46, 0],
    ate: [borda, 0],
    paradas: [
      [0, "apoio", -0.05],
      [0.82, "apoio", 0.1],
      [1, "apoio", 0.45],
    ],
  };
}

/**
 * Os degradês de uma lista de formas (com os grupos de dentro), cada um com um
 * `id` único no SVG que os desenha.
 */
export function degradesDe(
  formas: readonly Forma[],
  prefixo: string,
): { lista: { id: string; gradiente: Gradiente }[]; idDe: Map<Forma, string> } {
  const lista: { id: string; gradiente: Gradiente }[] = [];
  const idDe = new Map<Forma, string>();
  const andar = (fs: readonly Forma[]) => {
    for (const f of fs) {
      if ("grupo" in f) andar(f.grupo);
      else if (f.gradiente) {
        const id = `${prefixo}g${lista.length}`;
        lista.push({ id, gradiente: f.gradiente });
        idDe.set(f, id);
      }
    }
  };
  andar(formas);
  return { lista, idDe };
}

/* ── O kit ───────────────────────────────────────────────────────────────── */

/** Braço inteiro: ombro → cotovelo → punho, e a mão. `longe` é o do outro lado. */
export function braco(ombro: P, cotovelo: P, punho: P, mao: P, longe = false): Forma[] {
  const cor: Tom = longe ? "peleSombra" : "pele";
  /* A pele com menos contraste que o pano: forte, a emenda do cotovelo e do
     punho aparecia (cara de manequim). */
  return [
    cilindro(ombro, GROSSO.braco[0], cotovelo, GROSSO.braco[1], cor, 0.7, GROSSO.braco[1]),
    cilindro(
      cotovelo,
      GROSSO.antebraco[0],
      punho,
      GROSSO.antebraco[1],
      cor,
      0.7,
      GROSSO.antebraco[0],
    ),
    cilindro(punho, GROSSO.mao[0], mao, GROSSO.mao[1], cor, 0.7, GROSSO.mao[0]),
  ];
}

/** Perna de legging: quadril → joelho → tornozelo. */
export function perna(quadril: P, joelho: P, tornozelo: P, longe = false): Forma[] {
  return [coxa(quadril, joelho, longe), canela(joelho, tornozelo, longe)];
}

/** Só a coxa, ou só a canela: para quando uma gira e a outra não. */
export function coxa(quadril: P, joelho: P, longe = false): Forma {
  const [a, b] = GROSSO.coxa;
  return cilindro(quadril, a, joelho, b, longe ? "leggingSombra" : "legging", 1, b);
}
export function canela(joelho: P, tornozelo: P, longe = false): Forma {
  const [a, b] = GROSSO.canela;
  return cilindro(joelho, a, tornozelo, b, longe ? "leggingSombra" : "legging", 1, a);
}

/**
 * O tênis de lado, com o tornozelo em (0,0) e a sola 6 abaixo, apontando para
 * +x; `giro` em graus (o pé em ponta, deitado), `espelho` aponta para -x.
 */
export function tenisDePerfil(tornozelo: P, giro = 0, espelho = false, longe = false): Forma {
  return grupo({ x: tornozelo[0], y: tornozelo[1], giro, espelho }, [
    {
      d: "M-3.1 6.2L7.8 6.2C9.9 6.2 10.2 3.6 8.2 2.6C5.8 1.5 3.8 0.2 2.3 -1.8L-2.1 -2C-3.5 -0.4 -3.9 3.2 -3.1 6.2Z",
      cor: longe ? "sola" : "tenis",
      gradiente: luzDeCima(-2, 6.4, longe ? "sola" : "tenis", 0.7),
    },
    { d: "M-3.2 6.4L8.4 6.4", traco: "sola", espessura: 1.4 },
  ]);
}

/** O tênis de frente, apoiado no chão em `chao`. */
export function tenisDeFrente(x: number, chao: number, longe = false): Forma[] {
  return [
    {
      d: `M${n(x - 5.1)} ${n(chao)}C${n(x - 5.3)} ${n(chao - 4.6)} ${n(x - 2.9)} ${n(chao - 6.2)} ${n(x)} ${n(chao - 6.2)}C${n(x + 2.9)} ${n(chao - 6.2)} ${n(x + 5.3)} ${n(chao - 4.6)} ${n(x + 5.1)} ${n(chao)}Z`,
      cor: longe ? "sola" : "tenis",
      gradiente: luzDeEsfera([x, chao - 2.4], 5.4, longe ? "sola" : "tenis", 0.8),
    },
    {
      d: `M${n(x - 5.4)} ${n(chao - 0.4)}L${n(x + 5.4)} ${n(chao - 0.4)}`,
      traco: "sola",
      espessura: 1.5,
    },
  ];
}

/** O rosto calmo da personagem: olhos fechados, bochecha, um sorriso pequeno. */
function rostoDeFrente(x: number, y: number): Forma[] {
  return [
    {
      d: `M${n(x - 5.3)} ${n(y + 1)}Q${n(x - 3.7)} ${n(y + 2.5)} ${n(x - 2.1)} ${n(y + 1)}`,
      traco: "rosto",
      espessura: 0.95,
    },
    {
      d: `M${n(x + 2.1)} ${n(y + 1)}Q${n(x + 3.7)} ${n(y + 2.5)} ${n(x + 5.3)} ${n(y + 1)}`,
      traco: "rosto",
      espessura: 0.95,
    },
    { d: circulo(x - 5.4, y + 4.1, 1.6), cor: "bochecha", opacidade: 0.38 },
    { d: circulo(x + 5.4, y + 4.1, 1.6), cor: "bochecha", opacidade: 0.38 },
    {
      d: `M${n(x - 1.3)} ${n(y + 5.4)}Q${n(x)} ${n(y + 6.4)} ${n(x + 1.3)} ${n(y + 5.4)}`,
      traco: "rosto",
      espessura: 0.85,
    },
  ];
}

/** A cabeça de frente, com o coque no alto. */
export function cabecaDeFrente(x: number, y: number): Forma[] {
  const r = MEDIDA.cabeca;
  return [
    esfera(x, y - r - 2.1, 3.8, "cabelo"),
    esfera(x - r + 0.2, y + 1.2, 2.1, "pele"),
    esfera(x + r - 0.2, y + 1.2, 2.1, "pele"),
    esfera(x, y, r, "pele", 0.8),
    {
      /* O cabelo puxado para o coque, com a risca de lado. */
      d:
        `M${n(x - r - 0.3)} ${n(y + 1.6)}C${n(x - r - 1)} ${n(y - 8)} ${n(x - 5)} ${n(y - r - 0.8)} ${n(x)} ${n(y - r - 0.8)}` +
        `C${n(x + 5.4)} ${n(y - r - 0.8)} ${n(x + r + 1)} ${n(y - 8)} ${n(x + r + 0.3)} ${n(y + 1.6)}` +
        `C${n(x + 8.6)} ${n(y - 3.6)} ${n(x + 5.6)} ${n(y - 5.6)} ${n(x + 1.4)} ${n(y - 5.8)}` +
        `C${n(x - 3.4)} ${n(y - 6)} ${n(x - 8)} ${n(y - 3.8)} ${n(x - r - 0.3)} ${n(y + 1.6)}Z`,
      cor: "cabelo",
      gradiente: luzDeEsfera([x, y - 2], r + 1.2, "cabelo", 1.2),
    },
    {
      d: `M${n(x - 3.4)} ${n(y - r + 0.4)}Q${n(x + 0.6)} ${n(y - 7.6)} ${n(x + 4.6)} ${n(y - 6.4)}`,
      traco: "pele",
      espessura: 0.8,
      opacidade: 0.3,
    },
    ...rostoDeFrente(x, y),
  ];
}

/**
 * A cabeça de perfil, olhando para +x (com `l.espelho`, para -x), centrada em
 * (0,0) do lugar: o coque atrás, a orelha, o nariz, o olho fechado.
 */
export function cabecaDePerfil(l: Lugar): Forma {
  const r = MEDIDA.cabeca;
  return grupo(l, [
    esfera(-7.3, -7.9, 3.8, "cabelo"),
    esfera(0, 0, r, "pele", 0.8),
    esfera(r - 0.6, 1.6, 1.9, "pele"),
    {
      d: `M6.8 -6.6C2.6 -11.6 -8 -11.2 -9.8 -1.6C-10.4 2.6 -9.2 6 -6.8 8.2C-5.8 4.4 -4.6 1.6 -3.8 -1.2C-1.6 -4.4 2.6 -5.6 6.8 -6.6Z`,
      cor: "cabelo",
      gradiente: luzDeEsfera([0, -1], r + 1, "cabelo", 1.2),
    },
    esfera(-2.2, 1.6, 2.2, "pele"),
    { d: circulo(-2.2, 1.6, 1.0), cor: "peleSombra", opacidade: 0.6 },
    { d: "M3.5 0.7Q5 2 6.5 0.7", traco: "rosto", espessura: 0.95 },
    { d: circulo(4.4, 4.2, 1.55), cor: "bochecha", opacidade: 0.38 },
    { d: "M6.6 5.7Q7.4 6.2 8.1 5.6", traco: "rosto", espessura: 0.85 },
  ]);
}

/**
 * O tronco de frente, com a barriga: ombros em y (largura 28), a barra da
 * blusa em y+47,6. Sem pescoço nem braços (eles vêm por cima).
 *
 * Na segunda volta (21/11/2026) ele afinou: os ombros eram tão largos quanto
 * a barriga e o tronco virava um barril. Agora os ombros caem, o lado afina
 * sob o braço e só a barriga abre — é ela que diz "gestante", e não a largura.
 */
export function troncoDeFrente(x: number, y: number): Forma[] {
  const X = (v: number) => n(x + v);
  const Y = (v: number) => n(y + v);
  /* Metade direita do contorno; a esquerda é o espelho. */
  const lado = (s: 1 | -1) => (v: number) => n(x + s * v);
  const d = (s: 1 | -1) => {
    const L = lado(s);
    return (
      `C${L(11.8)} ${Y(-1.4)} ${L(13.6)} ${Y(0.4)} ${L(13.9)} ${Y(4)}` +
      `C${L(14.1)} ${Y(8.2)} ${L(12.8)} ${Y(12.4)} ${L(13)} ${Y(16.4)}` +
      `C${L(16)} ${Y(21.2)} ${L(17.8)} ${Y(27.4)} ${L(17.6)} ${Y(33.6)}` +
      `C${L(17.4)} ${Y(40.4)} ${L(15.6)} ${Y(45.6)} ${L(12.6)} ${Y(47.6)}`
    );
  };
  const voltaEsquerda =
    `C${X(-15.6)} ${Y(45.6)} ${X(-17.4)} ${Y(40.4)} ${X(-17.6)} ${Y(33.6)}` +
    `C${X(-17.8)} ${Y(27.4)} ${X(-16)} ${Y(21.2)} ${X(-13)} ${Y(16.4)}` +
    `C${X(-12.8)} ${Y(12.4)} ${X(-14.1)} ${Y(8.2)} ${X(-13.9)} ${Y(4)}` +
    `C${X(-13.6)} ${Y(0.4)} ${X(-11.8)} ${Y(-1.4)} ${X(-8.8)} ${Y(-2)}Z`;
  return [
    {
      d: `M${X(-8.8)} ${Y(-2)}C${X(-6.2)} ${Y(2.8)} ${X(6.2)} ${Y(2.8)} ${X(8.8)} ${Y(-2)}${d(1)}L${X(-12.6)} ${Y(47.6)}${voltaEsquerda}`,
      cor: "roupa",
      gradiente: luzDeEsfera([x, y + 30], 22, "roupa", 0.9),
    },
    /* A barriga: um brilho no alto à esquerda e a sombra embaixo à direita,
       os dois de leve (forte, o brilho virava uma bola de plástico). */
    reflexo(x - 7.4, y + 24.6, 5.4, 4),
    {
      d: `M${X(16.4)} ${Y(31)}C${X(17)} ${Y(40)} ${X(12.8)} ${Y(46)} ${X(4.6)} ${Y(46.8)}C${X(10.4)} ${Y(43.6)} ${X(14.2)} ${Y(38.4)} ${X(16.4)} ${Y(31)}Z`,
      cor: "roupaSombra",
      opacidade: 0.16,
    },
    {
      d: `M${X(-9.8)} ${Y(15.4)}C${X(-5.4)} ${Y(17.8)} ${X(5.4)} ${Y(17.8)} ${X(9.8)} ${Y(15.4)}`,
      traco: "roupaSombra",
      espessura: 0.9,
      opacidade: 0.3,
    },
  ];
}

/** A cintura da legging de frente (vai por baixo da barra da blusa). */
export function cinturaDeFrente(x: number, y: number): Forma {
  return {
    d:
      `M${n(x - 12.8)} ${n(y)}C${n(x - 7)} ${n(y + 2.4)} ${n(x + 7)} ${n(y + 2.4)} ${n(x + 12.8)} ${n(y)}` +
      `C${n(x + 13.6)} ${n(y + 5)} ${n(x + 13.2)} ${n(y + 9)} ${n(x + 11.6)} ${n(y + 12)}` +
      `C${n(x + 7.6)} ${n(y + 15.2)} ${n(x - 7.6)} ${n(y + 15.2)} ${n(x - 11.6)} ${n(y + 12)}` +
      `C${n(x - 13.2)} ${n(y + 9)} ${n(x - 13.6)} ${n(y + 5)} ${n(x - 12.8)} ${n(y)}Z`,
    cor: "legging",
    /* Um cilindro deitado, com a mesma luz das coxas logo abaixo. */
    gradiente: {
      tipo: "linear",
      de: [x - 13, y],
      ate: [x + 13, y],
      paradas: paradas("legging", CILINDRO),
    },
  };
}

/** O pescoço de frente, de `y0` (queixo) a `y1` (sob a gola). */
export function pescocoDeFrente(x: number, y0: number, y1: number): Forma[] {
  return [
    cilindro([x, y0], 3.0, [x, y1], 3.3, "pele"),
    { d: elipse(x, y0 + 1.4, 2.8, 1.3), cor: "peleSombra", opacidade: 0.5 },
  ];
}

/*
 * O TRONCO DE PERFIL, olhando para +x, em coordenadas do tronco: (0,0) é a
 * base do pescoço, o tronco desce em +y. Ombro em (0.5, 7), quadril em (1, 49).
 * A barriga é uma peça à parte (`barrigaDePerfil`) — é ela que respira.
 */
export const TRONCO = {
  ombro: [0.5, 7] as P,
  quadril: [1, 49] as P,
  barriga: [11.5, 33] as P,
} as const;

/** A legging do tronco de perfil: o quadril, o bumbum, o baixo da barriga. */
function quadrilDePerfil(): Forma {
  return {
    d: "M-7 38C-9.6 42 -10.6 47 -9 51.4C-7.2 55.6 -2 56.4 3.4 55.4L6.2 55C11 51.6 14.4 47 15.8 41.6Z",
    cor: "legging",
    gradiente: luzDeEsfera([1, 47], 12, "legging", 0.8),
  };
}

/** A blusa no tronco de perfil (sem a barriga, que vem por cima). */
function blusaDePerfil(): Forma[] {
  return [
    {
      d:
        "M-3.2 -1.4C-5.8 1 -7.6 5.6 -7.6 11C-7.6 18 -6.2 25.6 -5.6 31C-5.4 35.4 -6.6 39.6 -7.4 43" +
        "Q3.4 45.6 13.4 44.2C12.4 34 10.4 26 8.4 20.6C10.2 17.4 10.2 12.2 7.8 8.2C6.4 4.8 5 1.6 3.4 -1.2Z",
      cor: "roupa",
      gradiente: luzDeEsfera([1, 20], 24, "roupa", 0.85),
    },
    { d: "M-5.2 9.6C-4.6 15 -4 21 -3.8 26", traco: "roupaSombra", espessura: 0.9, opacidade: 0.28 },
  ];
}

/** A barriga de perfil, centrada em `TRONCO.barriga`: é a peça que respira. */
export function barrigaDePerfil(): Forma[] {
  const [x, y] = TRONCO.barriga;
  return [
    {
      d: `M${n(x - 6)} ${n(y - 13.4)}C${n(x + 3)} ${n(y - 13.6)} ${n(x + 9.6)} ${n(y - 6)} ${n(x + 9.8)} ${n(y + 1.6)}C${n(x + 10)} ${n(y + 8.6)} ${n(x + 5.6)} ${n(y + 12)} ${n(x + 0.6)} ${n(y + 12.6)}L${n(x - 7)} ${n(y + 12.4)}Z`,
      cor: "roupa",
      gradiente: luzDeEsfera([x, y], 12.6, "roupa", 0.9),
    },
    /* O reflexo do estúdio no alto da barriga. */
    reflexo(x + 1.6, y - 6.4, 4.4, 3.4),
    {
      d: `M${n(x + 9.4)} ${n(y + 2)}C${n(x + 9.4)} ${n(y + 8.4)} ${n(x + 5.4)} ${n(y + 11.6)} ${n(x)} ${n(y + 12)}C${n(x + 4.6)} ${n(y + 9)} ${n(x + 7.6)} ${n(y + 6)} ${n(x + 9.4)} ${n(y + 2)}Z`,
      cor: "roupaSombra",
      opacidade: 0.3,
    },
  ];
}

/**
 * As costas arredondadas do gato-camelo, no lugar do tronco: a blusa que abaula
 * entre a nuca e o quadril, com a MESMA luz da blusa (21/11/2026). Era um balão
 * solto por cima das costas, com brilho próprio, alto como uma mochila.
 */
export function costasCurvas(l: Lugar): Forma {
  return grupo(l, [
    {
      d:
        "M-3.2 -1.4C-6.4 1 -10 5.2 -11.8 11.2C-13.4 17 -13.2 24.6 -11.8 30.6" +
        "C-10.8 35.4 -9.4 39.6 -7.4 43L2 43.6L2 -1.6Z",
      cor: "roupa",
      gradiente: luzDeEsfera([1, 20], 24, "roupa", 0.85),
    },
  ]);
}

/** O tronco de perfil inteiro, no lugar `l` (sem a barriga). */
export function troncoDePerfil(l: Lugar, comQuadril = true): Forma {
  return grupo(l, comQuadril ? [quadrilDePerfil(), ...blusaDePerfil()] : blusaDePerfil());
}

/** Só o quadril de perfil (a bacia que bascula), no lugar `l`. */
export function quadrilNoLugar(l: Lugar): Forma {
  return grupo(l, [quadrilDePerfil()]);
}

/** A barriga de perfil no lugar `l`. */
export function barrigaNoLugar(l: Lugar): Forma {
  return grupo(l, barrigaDePerfil());
}

/** O pescoço de perfil: da base (0,0 do tronco) até a cabeça. */
export function pescocoDePerfil(base: P, cabeca: P): Forma {
  return cilindro(base, 3.2, cabeca, 2.9, "pele");
}

/** A sombra no chão. */
export function sombraNoChao(cx: number, chao: number, rx: number): Forma {
  return {
    d: elipse(cx, chao + 0.6, rx * 1.2, 3.4),
    cor: "sombra",
    gradiente: {
      tipo: "radial",
      naCaixa: true,
      centro: [0.5, 0.5],
      raio: 0.5,
      paradas: [
        [0, "sombra", 0, 0.2],
        [0.55, "sombra", 0, 0.08],
        [1, "sombra", 0, 0],
      ],
    },
  };
}

/** O tapete visto de lado: uma faixa com a borda mais escura. */
export function tapete(x0: number, x1: number, topo: number): Forma[] {
  return [
    {
      d: caixaRedonda(x0, topo, x1 - x0, 4.4, 2.2),
      cor: "tapete",
      gradiente: luzDeCima(topo, topo + 4.4, "tapete"),
    },
    { d: caixaRedonda(x0, topo + 2.8, x1 - x0, 1.6, 0.8), cor: "tapeteBorda" },
  ];
}

/** Um travesseiro, uma almofada. */
export function almofada(cx: number, cy: number, rx: number, ry: number): Forma[] {
  return [
    {
      d: caixaRedonda(cx - rx, cy - ry, rx * 2, ry * 2, ry * 0.95),
      cor: "apoio",
      gradiente: {
        tipo: "radial",
        naCaixa: true,
        centro: [0.34, 0.26],
        raio: 0.85,
        paradas: [
          [0, "apoio", 0.7],
          [0.55, "apoio", 0],
          [1, "apoio", -0.1],
        ],
      },
    },
    {
      d: `M${n(cx - rx + ry * 0.7)} ${n(cy + ry * 0.45)}L${n(cx + rx - ry * 0.7)} ${n(cy + ry * 0.45)}`,
      traco: "apoioSombra",
      espessura: 1,
      opacidade: 0.6,
    },
  ];
}

/**
 * A escala do desenho no disco do Mexer. Com folga em volta (a segunda volta,
 * "dar mais leveza": a figura encostava no anel do tempo, e o ar em volta
 * também é leveza). A parede e o tapete, que passam da caixa, continuam indo
 * até a borda redonda.
 */
export function escalaNoDisco(caixa: Desenho["caixa"], disco: number): number {
  const [, , w, h] = caixa;
  return Math.min((disco * 0.89) / w, (disco * 0.88) / h, (disco * 1.01) / Math.hypot(w, h));
}
