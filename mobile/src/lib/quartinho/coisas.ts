/**
 * AS COISAS QUE SE TOCAM NO QUARTINHO — as regras, sem tela (testadas pelo bun).
 *
 * 25/11/2026, o dono: "onde tem luzes [...] quando a gente clicar em cima
 * deles, eles têm que acender [...] quando clica na geladeira, abre a
 * geladeira. Quando clica no forno, abre o forno. Quando clica na cortina,
 * fecha e abre a cortina. Então, todos esses detalhes que fazem o jogo ficar
 * mais interativo [...] sem gastar nenhum crédito".
 *
 * Por isso nada aqui é arte nova: cada coisa é um pedaço da PRÓPRIA pintura do
 * cômodo, medido nela (frações da arte, 1536 × 2752, como os lugares dos
 * itens), e a tela o anima por código (`componentes/quartinho/coisas.tsx`):
 * - a LUZ do teto acende (o ponto brilha, o cone desce e a poça cai no chão);
 * - a PORTA (a geladeira, o forno) gira na dobradiça e mostra o miolo, que é
 *   desenhado por código;
 * - a CORTINA é o tecido pintado, esticado sobre a janela.
 *
 * O estado é do aparelho (`dc-quartinho-coisas:<uid>`, apagado no sair): é
 * brincadeira, não posse — não vale sementinha nem vai para o servidor.
 */

import type { Comodo } from "./quarto";

export type TipoDaCoisa = "luz" | "porta" | "cortina";

/** Um retângulo na arte, em frações: [x0, y0, x1, y1]. */
export type Caixa = readonly [number, number, number, number];

export type Coisa = {
  id: string;
  comodo: Comodo;
  tipo: TipoDaCoisa;
  /** Para o leitor de tela e a fala da Bolha. */
  nome: string;
  /** Onde o dedo acerta (em frações da arte). */
  toque: Caixa;
} & (
  | {
      tipo: "luz";
      /** O ponto de luz no teto e onde a luz cai no chão. */
      ponto: readonly [number, number];
      chao: readonly [number, number];
    }
  | {
      tipo: "porta";
      /** As folhas da porta (a geladeira tem duas) e por onde cada uma gira. */
      folhas: readonly { caixa: Caixa; dobradica: "direita" | "baixo" }[];
      miolo: "geladeira" | "forno";
    }
  | {
      tipo: "cortina";
      /**
       * Os dois panos fechados, cada um um quadrilátero (o do quarto está na
       * parede do lado, em perspectiva): [x, y] do alto-fora, alto-dentro,
       * baixo-dentro, baixo-fora. O pano cresce a partir do lado de fora.
       */
      panos: readonly (readonly (readonly [number, number])[])[];
      /** O pedaço da pintura que é tecido liso, para esticar (o pano é ele). */
      tecido: Caixa;
      /**
       * A luz da janela PINTADA no chão (o sol de dia, o luar de noite): com a
       * cortina fechada ela some, coberta por um remendo do próprio chão,
       * tirado ao lado (`de`: o deslocamento até um chão sem luz, ao longo
       * das tábuas) e esfumado na borda.
       */
      remendos: { dia: readonly Remendo[]; noite: readonly Remendo[] };
    }
);

export type Remendo = {
  /** A mancha de luz, um quadrilátero em frações da arte. */
  mancha: readonly (readonly [number, number])[];
  /**
   * Onde está o chão igual sem luz: [dx, dy] em frações. Ou, quando o chão em
   * volta da mancha não se repete em lugar nenhum (o luar do quarto deixa um
   * brilho azulado em volta dela), `tinta`: a cor medida ali, esfumada.
   */
  de?: readonly [number, number];
  tinta?: string;
  /**
   * Até onde a borda esfuma (o remendo ampliado em volta do meio). O luar do
   * quarto tem um brilho azulado em volta: lá o remendo esfuma mais longe.
   */
  borda?: number;
};

/**
 * As coisas de cada cômodo, medidas na pintura de dia (a de noite é a mesma
 * câmera). ⚠️ Tudo dentro da faixa que a tela mostra (x de 0,085 a 0,915: a
 * pintura cobre a tela e corta as beiradas num iPhone comprido).
 */
export const COISAS: readonly Coisa[] = [
  /* ── O quarto ── */
  {
    id: "luz-esquerda",
    comodo: "quarto",
    tipo: "luz",
    nome: "a luz do teto da esquerda",
    ponto: [0.305, 0.226],
    chao: [0.33, 0.6],
    toque: [0.25, 0.195, 0.36, 0.26],
  },
  {
    id: "luz-direita",
    comodo: "quarto",
    tipo: "luz",
    nome: "a luz do teto da direita",
    ponto: [0.695, 0.226],
    chao: [0.67, 0.6],
    toque: [0.64, 0.195, 0.75, 0.26],
  },
  {
    id: "cortina",
    comodo: "quarto",
    tipo: "cortina",
    nome: "a cortina",
    /* A janela está na parede da esquerda: o varão desce para a direita, e a
       barra do pano sobe (as duas linhas vão para o fundo do quarto). */
    panos: [
      [
        [0.088, 0.262],
        [0.158, 0.282],
        [0.158, 0.486],
        [0.088, 0.491],
      ],
      [
        [0.236, 0.307],
        [0.152, 0.283],
        [0.152, 0.486],
        [0.236, 0.481],
      ],
    ],
    /* Acima da faixa que amarra (ela está em 0,40): esticada, virava uma listra. */
    tecido: [0.2, 0.312, 0.236, 0.39],
    /* As tábuas correm de lado: o chão igual está à direita, na mesma altura. */
    remendos: {
      dia: [
        {
          mancha: [
            [0.27, 0.596],
            [0.556, 0.61],
            [0.52, 0.693],
            [0.143, 0.64],
          ],
          de: [0.36, 0],
        },
        {
          mancha: [
            [0.37, 0.755],
            [0.53, 0.755],
            [0.57, 0.8],
            [0.4, 0.8],
          ],
          de: [0.33, 0],
        },
      ],
      noite: [
        {
          mancha: [
            [0.278, 0.603],
            [0.559, 0.615],
            [0.52, 0.7],
            [0.14, 0.645],
          ],
          /* Medida em volta da mancha, na pintura da noite: (92, 88, 106). */
          tinta: "#5c586a",
          borda: 1.5,
        },
      ],
    },
    toque: [0.088, 0.25, 0.25, 0.5],
  },
  /* ── A cozinha ── */
  {
    id: "luz-esquerda",
    comodo: "cozinha",
    tipo: "luz",
    nome: "a luz do teto da esquerda",
    ponto: [0.283, 0.278],
    chao: [0.3, 0.66],
    toque: [0.23, 0.25, 0.34, 0.31],
  },
  {
    id: "luz-direita",
    comodo: "cozinha",
    tipo: "luz",
    nome: "a luz do teto da direita",
    ponto: [0.681, 0.278],
    chao: [0.66, 0.66],
    toque: [0.63, 0.25, 0.74, 0.31],
  },
  {
    id: "cortina",
    comodo: "cozinha",
    tipo: "cortina",
    nome: "a cortina",
    panos: [
      [
        [0.334, 0.337],
        [0.503, 0.337],
        [0.503, 0.496],
        [0.334, 0.496],
      ],
      [
        [0.669, 0.337],
        [0.497, 0.337],
        [0.497, 0.496],
        [0.669, 0.496],
      ],
    ],
    tecido: [0.338, 0.338, 0.392, 0.405],
    /* Do lado está a geladeira: o chão igual está logo abaixo da mancha. */
    remendos: {
      dia: [
        {
          mancha: [
            [0.25, 0.617],
            [0.6, 0.617],
            [0.62, 0.656],
            [0.215, 0.656],
          ],
          de: [0, 0.08],
        },
      ],
      noite: [
        {
          mancha: [
            [0.27, 0.625],
            [0.725, 0.625],
            [0.81, 0.712],
            [0.18, 0.712],
          ],
          de: [0, 0.115],
        },
      ],
    },
    toque: [0.33, 0.33, 0.675, 0.5],
  },
  {
    id: "geladeira",
    comodo: "cozinha",
    tipo: "porta",
    nome: "a geladeira",
    folhas: [
      { caixa: [0.802, 0.393, 0.921, 0.501], dobradica: "direita" },
      { caixa: [0.802, 0.504, 0.921, 0.648], dobradica: "direita" },
    ],
    miolo: "geladeira",
    toque: [0.8, 0.39, 0.915, 0.65],
  },
  {
    id: "forno",
    comodo: "cozinha",
    tipo: "porta",
    nome: "o forno",
    folhas: [{ caixa: [0.703, 0.537, 0.788, 0.607], dobradica: "baixo" }],
    miolo: "forno",
    toque: [0.7, 0.52, 0.792, 0.612],
  },
];

/** A chave de uma coisa no estado: o cômodo e o id (as luzes se repetem). */
export const chaveDaCoisa = (c: Pick<Coisa, "comodo" | "id">) => `${c.comodo}:${c.id}`;

export const coisasDoComodo = (comodo: Comodo) => COISAS.filter((c) => c.comodo === comodo);

/**
 * O estado: o que está LIGADO (a luz acesa, a porta aberta, a cortina
 * FECHADA). O que não está aqui está no repouso: luz apagada, porta fechada,
 * cortina aberta — o cômodo como foi pintado.
 */
export type EstadoDasCoisas = readonly string[];

const CHAVES = new Set(COISAS.map(chaveDaCoisa));

/** Lê o que veio do aparelho, jogando fora o que não existe (ou não é texto). */
export function lerEstadoDasCoisas(bruto: unknown): EstadoDasCoisas {
  if (!Array.isArray(bruto)) return [];
  return [...new Set(bruto.filter((k): k is string => typeof k === "string" && CHAVES.has(k)))];
}

export const ligada = (estado: EstadoDasCoisas, chave: string) => estado.includes(chave);

export function alternarCoisa(estado: EstadoDasCoisas, chave: string): EstadoDasCoisas {
  if (!CHAVES.has(chave)) return estado;
  return ligada(estado, chave) ? estado.filter((k) => k !== chave) : [...estado, chave];
}

/** Quantas luzes do teto estão acesas no cômodo (a noite clareia com elas). */
export function luzesAcesas(estado: EstadoDasCoisas, comodo: Comodo): number {
  return coisasDoComodo(comodo).filter((c) => c.tipo === "luz" && ligada(estado, chaveDaCoisa(c)))
    .length;
}

/**
 * A fala da Bolha ao tocar (o que ela vê acontecer; nada de conduta). Curta:
 * a fala fica no alto da tela, numa linha.
 */
export function falaDaCoisa(c: Coisa, agora: boolean): string {
  if (c.tipo === "luz") return agora ? "Luz acesa!" : "Luz apagada.";
  if (c.tipo === "cortina") return agora ? "Cortina fechada." : "Cortina aberta!";
  if (c.miolo === "geladeira") return agora ? "Olha quanta coisa gostosa!" : "Geladeira fechada.";
  return agora ? "Hmm, cheirinho de biscoito!" : "Forno fechado.";
}
