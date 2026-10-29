/**
 * A FIGURA QUE DEMONSTRA O MOVIMENTO — as animações do site, quadro a quadro.
 *
 * No site (`src/components/figura-movimento.tsx`), cada movimento anima um
 * pedaço da figura com um `@keyframes dc-mv-*` do `styles.css`, com
 * `ease-in-out` entre cada par de quadros. Aqui a mesma tabela vira números: o
 * componente pergunta "onde está este pedaço no instante t?" e desenha com o
 * `transform` do SVG — as mesmas funções, na mesma ordem, em volta da mesma
 * origem.
 *
 * Sem react-native aqui: é testado pelo bun, e o teste lê o `styles.css` e o
 * componente do site para garantir que nenhum número foi copiado errado.
 */

/** Uma função de `transform` do CSS com os seus números: `["rotate", -7]`. */
export type Passo = readonly [
  "translate" | "translateX" | "translateY" | "rotate" | "scale" | "scaleX" | "skewX",
  ...number[],
];

export type Quadro = {
  /** Em que ponto do ciclo, de 0 a 100 (o `%` do `@keyframes`). */
  em: number;
  transform?: readonly Passo[];
  opacidade?: number;
};

/** Os `@keyframes dc-mv-*` do `styles.css` do site, com os mesmos números. */
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
  pelve: [
    {
      em: 0,
      transform: [
        ["rotate", 0],
        ["translateY", 0],
      ],
    },
    {
      em: 30,
      transform: [
        ["rotate", -7],
        ["translateY", -2],
      ],
    },
    {
      em: 70,
      transform: [
        ["rotate", 7],
        ["translateY", 2],
      ],
    },
    {
      em: 100,
      transform: [
        ["rotate", 0],
        ["translateY", 0],
      ],
    },
  ],
  torcao: [
    {
      em: 0,
      transform: [
        ["rotate", 0],
        ["scaleX", 1],
      ],
    },
    {
      em: 25,
      transform: [
        ["rotate", -11],
        ["scaleX", 0.86],
      ],
    },
    {
      em: 50,
      transform: [
        ["rotate", 0],
        ["scaleX", 1],
      ],
    },
    {
      em: 75,
      transform: [
        ["rotate", 11],
        ["scaleX", 0.86],
      ],
    },
    {
      em: 100,
      transform: [
        ["rotate", 0],
        ["scaleX", 1],
      ],
    },
  ],
  /* No site só existe o `to`: o começo é a figura parada, `rotate(0)`. */
  tornozelo: [
    { em: 0, transform: [["rotate", 0]] },
    { em: 100, transform: [["rotate", 360]] },
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
  balanco: [
    { em: 0, transform: [["translateX", -7]] },
    { em: 50, transform: [["translateX", 7]] },
    { em: 100, transform: [["translateX", -7]] },
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
  joelhopeito: [
    { em: 0, transform: [["rotate", 0]] },
    { em: 50, transform: [["rotate", -22]] },
    { em: 100, transform: [["rotate", 0]] },
  ],
  eleva: [
    { em: 0, transform: [["rotate", 0]] },
    { em: 50, transform: [["rotate", -9]] },
    { em: 100, transform: [["rotate", 0]] },
  ],
  aperta: [
    { em: 0, transform: [["scaleX", 1]] },
    { em: 50, transform: [["scaleX", 0.78]] },
    { em: 100, transform: [["scaleX", 1]] },
  ],
  agacha: [
    { em: 0, transform: [["translateY", 0]] },
    { em: 50, transform: [["translateY", 14]] },
    { em: 100, transform: [["translateY", 0]] },
  ],
  costelas: [
    {
      em: 0,
      transform: [
        ["translateY", 0],
        ["rotate", 0],
      ],
    },
    {
      em: 50,
      transform: [
        ["translateY", 6],
        ["rotate", -3],
      ],
    },
    {
      em: 100,
      transform: [
        ["translateY", 0],
        ["rotate", 0],
      ],
    },
  ],
  panturrilha: [
    { em: 0, transform: [["skewX", 0]] },
    { em: 50, transform: [["skewX", -5]] },
    { em: 100, transform: [["skewX", 0]] },
  ],
} as const satisfies Record<string, readonly Quadro[]>;

export type NomeDosQuadros = keyof typeof QUADROS;

/** Os pedaços da figura que se mexem — cada um é um `<g>` no desenho. */
export type Parte =
  | "ombros"
  | "bracosBaixos"
  | "bracosAltos"
  | "quadril"
  | "tronco"
  | "cabeca"
  | "pe"
  | "pernaE"
  | "pernaD"
  | "colunaNeutra"
  | "colunaRedonda"
  | "tudo"
  | "barriga"
  | "pernaDeCima"
  | "travesseiro"
  | "corpo"
  | "pernas";

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

/**
 * Qual pedaço cada movimento anima — a lógica de `figura-movimento.tsx`.
 * Movimento fora daqui (o assoalho rápido, o piriforme, os punhos, os círculos
 * na bola, respirar para baixo) mostra a pose parada, como no site: os passos
 * estão escritos na tela.
 */
export const USOS: Record<string, readonly Uso[]> = {
  ombros: [suave("ombros", "ombros", 3, [60, 50])],
  bracos: [suave("bracosBaixos", "gato1", 4.5), suave("bracosAltos", "gato2", 4.5)],
  pelve: [suave("quadril", "pelve", 4, [60, 96])],
  torcao: [suave("tronco", "torcao", 5, [60, 98])],
  pescoco: [suave("cabeca", "pescoco", 5, [60, 44])],
  tornozelo: [
    { parte: "pe", quadros: "tornozelo", duracao: 3, curva: "linear", origem: [72, 122] },
  ],
  quadril: [suave("pernaE", "joelhoE", 4, [50, 100]), suave("pernaD", "joelhoD", 4, [70, 100])],
  gatocamelo: [suave("colunaNeutra", "gato1", 5), suave("colunaRedonda", "gato2", 5)],
  balanco: [suave("tudo", "balanco", 4)],
  "respiracao-diafragma": [suave("barriga", "respira", 5, [76, 56])],
  "assoalho-soltar": [suave("barriga", "respira", 5, [76, 56])],
  "assoalho-lento": [suave("barriga", "fecha", 5, [76, 56])],
  "ativar-transverso": [suave("barriga", "fecha", 5, [76, 56])],
  "joelho-ao-peito": [suave("pernaDeCima", "joelhopeito", 5, [100, 54])],
  "pernas-elevadas": [suave("pernaDeCima", "eleva", 6, [100, 54])],
  "travesseiro-entre-joelhos": [suave("travesseiro", "aperta", 4, [117, 70])],
  "agachamento-parede": [suave("corpo", "agacha", 5)],
  "costelas-parede": [suave("corpo", "costelas", 5)],
  "panturrilha-parede": [suave("pernas", "panturrilha", 5, [60, 96])],
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
