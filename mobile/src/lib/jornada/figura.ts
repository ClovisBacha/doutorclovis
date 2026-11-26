/**
 * A FIGURA QUE DEMONSTRA O MOVIMENTO — a tabela das animações, quadro a quadro.
 *
 * Nasceu das animações do site (`@keyframes dc-mv-*`), e desde 21/11/2026 é
 * do app: o desenho virou uma personagem com uma pose por exercício
 * (`figura-poses.ts`), e o movimento acompanha a pose — o agachamento desce
 * pela parede dobrando joelho e canela, o balanço leva o quadril para trás com
 * as mãos e os joelhos parados no chão, a borboleta deixa os joelhos caírem
 * com os pés juntos. Os quadros que o site já tinha e que ainda servem ficam
 * com os mesmos números.
 *
 * Cada pedaço gira, desliza, estica ou some em volta de uma origem (uma junta
 * do desenho, em `JUNTAS`), com `ease-in-out` entre cada par de quadros. O
 * componente amostra o ciclo e anima no motor nativo.
 *
 * Sem react-native aqui: é testado pelo bun.
 */

import { JUNTAS } from "./figura-poses";

/** Uma função de `transform` do CSS com os seus números: `["rotate", -7]`. */
export type Passo = readonly [
  "translate" | "translateX" | "translateY" | "rotate" | "scale" | "scaleX" | "scaleY" | "skewX",
  ...number[],
];

export type Quadro = {
  /** Em que ponto do ciclo, de 0 a 100 (o `%` do `@keyframes`). */
  em: number;
  transform?: readonly Passo[];
  opacidade?: number;
};

/** Um vaivém: parado em `de`, vai até `ate` no meio do ciclo e volta. */
function vaiVolta(
  funcao: Passo[0],
  ate: number | readonly number[],
  de?: number | readonly number[],
) {
  const lista = (v: number | readonly number[]) => (typeof v === "number" ? [v] : [...v]);
  const zero = de ?? (funcao.startsWith("scale") ? 1 : funcao === "translate" ? [0, 0] : 0);
  const a = [funcao, ...lista(zero)] as unknown as Passo;
  const b = [funcao, ...lista(ate)] as unknown as Passo;
  return [
    { em: 0, transform: [a] },
    { em: 50, transform: [b] },
    { em: 100, transform: [a] },
  ] as const;
}

/** Um círculo pequeno (o quadril na bola), em oito pontos. */
function circulo(rx: number, ry: number): Quadro[] {
  return Array.from({ length: 9 }, (_, k) => {
    const a = (k / 8) * 2 * Math.PI;
    const r = (v: number) => Math.round(v * 1000) / 1000;
    return {
      em: k * 12.5,
      transform: [["translate", r(rx * Math.cos(a)), r(ry * Math.sin(a))]] as const,
    };
  });
}

/** Os quadros de cada animação. Os nomes que vêm do site têm os números dele. */
export const QUADROS = {
  ombros: [
    { em: 0, transform: [["translate", 0, 0]] },
    { em: 25, transform: [["translate", 0, -4]] },
    { em: 50, transform: [["translate", -3, -1]] },
    { em: 75, transform: [["translate", 0, 3]] },
    { em: 100, transform: [["translate", 0, 0]] },
  ],
  pescoco: [
    { em: 0, transform: [["rotate", 0]] },
    { em: 25, transform: [["rotate", -19]] },
    { em: 50, transform: [["rotate", 0]] },
    { em: 75, transform: [["rotate", 19]] },
    { em: 100, transform: [["rotate", 0]] },
  ],
  joelhoE: [
    { em: 0, transform: [["rotate", 0]] },
    { em: 50, transform: [["rotate", -11]] },
    { em: 100, transform: [["rotate", 0]] },
  ],
  joelhoD: [
    { em: 0, transform: [["rotate", 0]] },
    { em: 50, transform: [["rotate", 11]] },
    { em: 100, transform: [["rotate", 0]] },
  ],
  /* As duas poses que se cruzam (gato-camelo, braços para o alto): a pose A
     fica a primeira metade do ciclo, a B a segunda, com uma passagem suave. */
  gato1: [
    { em: 0, opacidade: 1 },
    { em: 38, opacidade: 1 },
    { em: 50, opacidade: 0 },
    { em: 88, opacidade: 0 },
    { em: 100, opacidade: 1 },
  ],
  gato2: [
    { em: 0, opacidade: 0 },
    { em: 38, opacidade: 0 },
    { em: 50, opacidade: 1 },
    { em: 88, opacidade: 1 },
    { em: 100, opacidade: 0 },
  ],
  respira: [
    { em: 0, transform: [["scale", 1]] },
    { em: 50, transform: [["scale", 1.06]] },
    { em: 100, transform: [["scale", 1]] },
  ],
  fecha: [
    { em: 0, transform: [["scale", 1]] },
    { em: 50, transform: [["scale", 0.95]] },
    { em: 100, transform: [["scale", 1]] },
  ],
  /* ── Os do app (21/11/2026) ── */
  bascula: vaiVolta("rotate", -9),
  /* A torção vai para UM lado só, o da mão no encosto, segura e volta (os
     passos: "fique 15 segundos e troque de lado"; o desenho mostra um lado). */
  gira: [
    {
      em: 0,
      transform: [
        ["translateX", 0],
        ["scaleX", 1],
      ],
    },
    {
      em: 30,
      transform: [
        ["translateX", -2.4],
        ["scaleX", 0.9],
      ],
    },
    {
      em: 70,
      transform: [
        ["translateX", -2.4],
        ["scaleX", 0.9],
      ],
    },
    {
      em: 100,
      transform: [
        ["translateX", 0],
        ["scaleX", 1],
      ],
    },
  ],
  peAcenaPonta: vaiVolta("rotate", 14, -14),
  cabecaGato: [
    { em: 0, transform: [["rotate", 0]] },
    { em: 38, transform: [["rotate", 0]] },
    { em: 50, transform: [["rotate", 20]] },
    { em: 88, transform: [["rotate", 20]] },
    { em: 100, transform: [["rotate", 0]] },
  ],
  balancoCorpo: vaiVolta("translateX", -6),
  balancoBraco: vaiVolta("rotate", -8.6),
  balancoCoxa: vaiVolta("rotate", -13.7),
  apertaTravesseiro: vaiVolta("scaleY", 0.7),
  apertaPerna: vaiVolta("translateY", 2.6),
  agachaCanela: vaiVolta("rotate", 18),
  agachaCoxa: vaiVolta("rotate", -41.5),
  agachaCorpo: vaiVolta("translateY", 9.4),
  costelasCorpo: vaiVolta("rotate", 4),
  costelasBraco: vaiVolta("rotate", -5.4),
  inclina: vaiVolta("translateX", 2.4),
  circuloNaBola: circulo(2.6, 1.1),
  /* ── A terceira volta (21/11/2026, "dar mais movimento") ── */
  /* O piriforme: o peito vem para a frente a partir do quadril (de frente, o
     tronco desce um pouco e cresce, como quem se aproxima). */
  inclinaAFrente: [
    {
      em: 0,
      transform: [
        ["scaleX", 1],
        ["scaleY", 1],
      ],
    },
    {
      em: 50,
      transform: [
        ["scaleX", 1.04],
        ["scaleY", 0.9],
      ],
    },
    {
      em: 100,
      transform: [
        ["scaleX", 1],
        ["scaleY", 1],
      ],
    },
  ],
  /* A respiração do diafragma: as costelas abrem para os lados. */
  abreCostelas: vaiVolta("scaleX", 1.045),
  /* As fechadas rápidas: uma piscadinha por dentro a cada segundo. */
  piscadinha: [
    { em: 0, transform: [["scale", 1]] },
    { em: 18, transform: [["scale", 0.975]] },
    { em: 40, transform: [["scale", 1]] },
    { em: 100, transform: [["scale", 1]] },
  ],
  /* A respiração de fundo: a figura inteira sobe e desce de leve, ancorada no
     chão, em todas as poses. */
  respiroDeFundo: [
    {
      em: 0,
      transform: [
        ["scaleX", 1],
        ["scaleY", 1],
      ],
    },
    {
      em: 50,
      transform: [
        ["scaleX", 0.996],
        ["scaleY", 1.016],
      ],
    },
    {
      em: 100,
      transform: [
        ["scaleX", 1],
        ["scaleY", 1],
      ],
    },
  ],
} as const satisfies Record<string, readonly Quadro[]>;

export type NomeDosQuadros = keyof typeof QUADROS;

/** Os pedaços da figura que se mexem — cada um é uma camada do desenho. */
export type Parte =
  | "ombros"
  | "bracosBaixos"
  | "bracosAltos"
  | "bacia"
  | "tronco"
  | "cabeca"
  | "pe"
  | "coxaE"
  | "coxaD"
  | "canelaE"
  | "canelaD"
  | "corcunda"
  | "corpo"
  | "braco"
  | "bracoLonge"
  | "coxa"
  | "coxaLonge"
  | "canela"
  | "canelaLonge"
  | "barriga"
  | "pernaDeCima"
  | "joelhoNoPeito"
  | "travesseiro"
  | "maoAberta"
  | "punho"
  | "maoAbertaLonge"
  | "punhoLonge";

export type Curva = "ease-in-out" | "linear";

export type Uso = {
  parte: Parte;
  quadros: NomeDosQuadros;
  /** Em segundos, como no `animation:` do site. */
  duracao: number;
  curva: Curva;
  /** O `transformOrigin` do site, nas coordenadas do desenho. Sem ele, (0, 0) —
   *  o padrão do CSS para elementos de SVG. */
  origem?: readonly [number, number];
};

const suave = (
  parte: Parte,
  quadros: NomeDosQuadros,
  duracao: number,
  origem?: readonly [number, number],
): Uso => ({
  parte,
  quadros,
  duracao,
  curva: "ease-in-out",
  ...(origem ? { origem } : {}),
});

const J = JUNTAS;

/**
 * A RESPIRAÇÃO DE FUNDO (a terceira volta: "dar mais movimento"). Por baixo do
 * movimento do exercício, a figura respira o tempo todo — sobe e desce de
 * leve, ancorada no chão, num ritmo próprio (mais lento que o dela). Nenhuma
 * pose fica parada como um adesivo, nem as que não têm o que mostrar (as
 * fechadas rápidas). Com "reduzir movimento", não respira.
 */
export const RESPIRO = {
  quadros: "respiroDeFundo",
  duracao: 4.6,
  curva: "ease-in-out",
} as const satisfies { quadros: NomeDosQuadros; duracao: number; curva: Curva };

/**
 * Qual pedaço cada movimento anima, com que quadros, em quanto tempo e em
 * volta de que junta. Por baixo de todos, a figura respira (`RESPIRO`).
 */
export const USOS: Record<string, readonly Uso[]> = {
  ombros: [suave("ombros", "ombros", 3, J.ombros)],
  bracos: [suave("bracosBaixos", "gato1", 4.5), suave("bracosAltos", "gato2", 4.5)],
  pelve: [suave("bacia", "bascula", 4, J.pelve)],
  torcao: [suave("tronco", "gira", 5, J.torcao)],
  pescoco: [suave("cabeca", "pescoco", 5, J.pescoco)],
  tornozelo: [suave("pe", "peAcenaPonta", 3, J.tornozelo)],
  "punho-dedos": [
    suave("maoAberta", "gato1", 3),
    suave("punho", "gato2", 3),
    suave("maoAbertaLonge", "gato1", 3),
    suave("punhoLonge", "gato2", 3),
  ],
  "circulos-bola": [{ parte: "corpo", quadros: "circuloNaBola", duracao: 6, curva: "linear" }],
  quadril: [
    suave("coxaE", "joelhoE", 4, J.borboleta.quadrilE),
    suave("canelaE", "joelhoE", 4, J.borboleta.tornozeloE),
    suave("coxaD", "joelhoD", 4, J.borboleta.quadrilD),
    suave("canelaD", "joelhoD", 4, J.borboleta.tornozeloD),
  ],
  gatocamelo: [suave("corcunda", "gato2", 5), suave("cabeca", "cabecaGato", 5, J.quatro.pescoco)],
  balanco: [
    suave("corpo", "balancoCorpo", 4),
    suave("braco", "balancoBraco", 4, J.quatro.punho),
    suave("bracoLonge", "balancoBraco", 4, J.quatro.punhoLonge),
    suave("coxa", "balancoCoxa", 4, J.quatro.joelho),
    suave("coxaLonge", "balancoCoxa", 4, J.quatro.joelhoLonge),
  ],
  "respiracao-diafragma": [suave("tronco", "abreCostelas", 5, J.costelasDeFrente)],
  "assoalho-soltar": [suave("barriga", "respira", 5, J.barrigaDeitada)],
  "respirar-para-baixo": [suave("barriga", "respira", 6, J.barrigaDeitada)],
  "pernas-elevadas": [suave("barriga", "respira", 6, J.barrigaDeitada)],
  "assoalho-lento": [suave("barriga", "fecha", 5, J.barrigaDeitada)],
  "ativar-transverso": [suave("barriga", "fecha", 5, J.barrigaDeitada)],
  /* A perna de cima esticada e, na outra metade, o joelho no peito com a mão
     segurando (era a perna inteira deslizando para dentro da barriga). */
  "joelho-ao-peito": [suave("pernaDeCima", "gato1", 5), suave("joelhoNoPeito", "gato2", 5)],
  "assoalho-rapido": [suave("tronco", "piscadinha", 1, J.torcao)],
  "travesseiro-entre-joelhos": [
    suave("travesseiro", "apertaTravesseiro", 4, J.travesseiro),
    suave("pernaDeCima", "apertaPerna", 4, J.quadrilDeitada),
  ],
  "agachamento-parede": [
    suave("canela", "agachaCanela", 5, J.agachamento.tornozelo),
    suave("canelaLonge", "agachaCanela", 5, J.agachamento.tornozeloLonge),
    suave("coxa", "agachaCoxa", 5, J.agachamento.joelho),
    suave("coxaLonge", "agachaCoxa", 5, J.agachamento.joelhoLonge),
    suave("corpo", "agachaCorpo", 5),
  ],
  "costelas-parede": [
    suave("corpo", "costelasCorpo", 5, J.costelas.quadril),
    suave("braco", "costelasBraco", 5, J.costelas.cotovelo),
    suave("bracoLonge", "costelasBraco", 5, J.costelas.cotoveloLonge),
  ],
  "panturrilha-parede": [suave("corpo", "inclina", 5)],
  piriforme: [suave("tronco", "inclinaAFrente", 5, J.torcao)],
};

/* ── A curva `ease-in-out` do CSS: cubic-bezier(0.42, 0, 0.58, 1) ─────────── */

function bezier(p1: number, p2: number, s: number): number {
  const u = 1 - s;
  return 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s;
}

/** Quanto do caminho já andou, em `u` (0 a 1) do tempo do trecho. */
export function easeInOut(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  /* x(s) é crescente: a bissecção acha o `s` do tempo pedido sem surpresa. */
  let lo = 0;
  let hi = 1;
  let s = u;
  for (let i = 0; i < 24; i++) {
    s = (lo + hi) / 2;
    if (bezier(0.42, 0.58, s) < u) lo = s;
    else hi = s;
  }
  return bezier(0, 1, s);
}

const misturar = (a: number, b: number, k: number) => a + (b - a) * k;

/** O estado de uma animação no instante `t` (segundos), já interpolado. */
export function quadroNoTempo(
  nome: NomeDosQuadros,
  duracao: number,
  curva: Curva,
  t: number,
): { transform?: Passo[]; opacidade?: number } {
  const quadros: readonly Quadro[] = QUADROS[nome];
  const ciclo = ((t % duracao) + duracao) % duracao;
  const p = (ciclo / duracao) * 100;
  let i = 0;
  while (i < quadros.length - 2 && p >= quadros[i + 1]!.em) i++;
  const a = quadros[i]!;
  const b = quadros[i + 1]!;
  const u = b.em === a.em ? 1 : (p - a.em) / (b.em - a.em);
  const k = curva === "linear" ? Math.min(1, Math.max(0, u)) : easeInOut(u);
  const fora: { transform?: Passo[]; opacidade?: number } = {};
  if (a.transform && b.transform) {
    fora.transform = a.transform.map(([f, ...va], j) => {
      const vb = b.transform![j]!.slice(1) as number[];
      return [f, ...va.map((v, n) => misturar(v, vb[n]!, k))] as Passo;
    });
  }
  if (a.opacidade != null && b.opacidade != null)
    fora.opacidade = misturar(a.opacidade, b.opacidade, k);
  return fora;
}

const n = (v: number) => String(Math.round(v * 1000) / 1000);

/**
 * O `transform` do CSS escrito como atributo do SVG, em volta da origem. As
 * funções ficam na mesma ordem — no CSS e no SVG a da direita age primeiro.
 */
export function paraSvg(passos: readonly Passo[], origem?: readonly [number, number]): string {
  const meio = passos
    .map(([f, a = 0, b = 0]) => {
      if (f === "translate") return `translate(${n(a)} ${n(b)})`;
      if (f === "translateX") return `translate(${n(a)} 0)`;
      if (f === "translateY") return `translate(0 ${n(a)})`;
      if (f === "rotate") return `rotate(${n(a)})`;
      if (f === "scale") return `scale(${n(a)})`;
      if (f === "scaleX") return `scale(${n(a)} 1)`;
      if (f === "scaleY") return `scale(1 ${n(a)})`;
      return `skewX(${n(a)})`;
    })
    .join(" ");
  if (!origem) return meio;
  const [x, y] = origem;
  return `translate(${n(x)} ${n(y)}) ${meio} translate(${n(-x)} ${n(-y)})`;
}

/** O que o `<g>` de uma parte recebe no instante `t`: nada, se esta parte não se mexe. */
export function parteNoTempo(
  movimento: string,
  parte: Parte,
  t: number,
): { transform?: string; opacity?: number } {
  const uso = USOS[movimento]?.find((u) => u.parte === parte);
  if (!uso) return {};
  const q = quadroNoTempo(uso.quadros, uso.duracao, uso.curva, t);
  return {
    ...(q.transform ? { transform: paraSvg(q.transform, uso.origem) } : {}),
    ...(q.opacidade != null ? { opacity: q.opacidade } : {}),
  };
}
