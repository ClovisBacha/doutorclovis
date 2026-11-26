/**
 * O QUARTINHO DO BEBÊ — as regras, sem tela (testadas pelo bun).
 *
 * 23/11/2026, o dono, com dois mockups e as ideias que pediu ao ChatGPT:
 * "quando clica no bebê bolha abre um quartinho que ela consegue decorar com
 * os itens [...] vamos fazer ficar o mais próximo dessas imagens". A proposta
 * inteira está em `docs/proposta-quartinho-e-itens.md`.
 *
 * - O QUARTO é uma arte vazia de dia (`assets/quartinho/quarto-dia.webp`) e
 *   a mesma, pintada de noite (`quarto-noite.webp`: o luar, a lua na janela
 *   e as estrelinhas da parede acesas); a COZINHA também (`cozinha-dia.webp`,
 *   `cozinha-noite.webp`: o luar na pia e a luzinha da coifa). Cada ITEM
 *   é uma arte à parte, com um lugar FIXO no quarto: decorar é escolher o
 *   que fica, e o quarto sai sempre
 *   bonito — sem arrastar, girar nem zoom ("eu não deixaria a experiência
 *   cheia de botões", a sugestão que veio junto).
 * - A POSSE: os itens com `lojinha` SÃO itens da lojinha (nove no quarto, sete
 *   na cozinha): ela os tem se os comprou, e o preço é o da lojinha. Desde
 *   24/11/2026 ela compra ali mesmo, pela mesma regra da vitrine (a loja por
 *   fase). Os outros são presentes da Bolha: os de saída (livres desde o
 *   começo) e os que as missões liberam. Nada aqui inventa preço nem moeda.
 * - AS MISSÕES: uma por dia, na ordem; cumprida, a Bolha comemora e dá o
 *   presente dela (um item). Elas não pagam sementinhas: quem paga é o
 *   servidor do site, que não muda.
 * - OS CÔMODOS (25/11/2026, o dono: "quando a pessoa arrastar pro lado direito
 *   ele deve ir para a cozinha [...] a imagem está melhor no sentido de dar mais
 *   profundidade e estar centralizado"): o quarto e, à direita dele, a
 *   cozinha. As duas pinturas são da MESMA câmera, de frente (a parede do fundo
 *   no centro, as paredes do lado, o teto e o chão), e cada item mora num
 *   cômodo só. A posse e o guardado são um só (`postos`): o cômodo é do item.
 */

import { CANTINHO_BY_ID } from "@/lib/cantinho";
import { quandoAbre, type ItemPorFase } from "~/lib/jornada/loja-por-fase";
import { AR_DO_QUARTO, type IdDoAr } from "./migracao";

export type Comodo = "quarto" | "cozinha";

/** Os cômodos, na ordem em que se arrastam: o quarto primeiro, a cozinha à direita. */
export const COMODOS: readonly { id: Comodo; nome: string }[] = [
  { id: "quarto", nome: "Quarto" },
  { id: "cozinha", nome: "Cozinha" },
];

export type Categoria =
  | "moveis"
  | "decoracao"
  | "brinquedos"
  | "tapetes"
  | "plantas"
  | "utensilios"
  | "luzes";

export type IdDoItem =
  /* As LUZES desenhadas por código (26/11/2026). */
  | "varal"
  | "neon-lua"
  | "projetor"
  | "pisca-pisca"
  | "fita-led"
  | "pendentes"
  /* A cozinha (25/11/2026). */
  | "potes"
  | "planta-pendurada"
  | "relogio"
  | "hortela"
  | "suculenta"
  | "cactinho"
  | "trevo"
  | "tapete-xadrez"
  | "cafeteira"
  | "tulipas"
  | "margaridas"
  | "girassol"
  | "colheres"
  | "panela"
  | "bule"
  | "planta-grande"
  /* O quarto. */
  | "berco"
  | "poltrona"
  | "comoda"
  | "luminaria"
  | "prateleira"
  | "quadro-urso"
  | "quadro-lua"
  | "mobile"
  | "ursinho"
  | "coelhinho"
  | "cavalinho"
  | "argolas"
  | "cubos"
  | "cesto"
  | "tapete"
  | "planta";

export type IdDaMissao =
  | "ursinho"
  | "parede"
  | "leitura"
  | "tapete"
  | "mobile"
  | "bancada"
  | "verde";

/**
 * Onde o item fica, em FRAÇÕES da arte do cômodo dele (1536 × 2752): `x` é o
 * centro, `base` é a linha onde o pé dele encosta, `largura` é a largura dele
 * e `camada` é a ordem de desenho (a parede atrás, os brinquedos na frente).
 * `achatar` encolhe a altura (o tapete, visto mais de lado).
 *
 * ⚠️ A tela mostra a pintura COBRINDO a tela (corta as laterais num iPhone
 * comprido: 8,8% de cada lado num 16 Pro). Item novo fica entre `x` 0,1 e 0,9,
 * e com a `base` até 0,70: a linha dos botões soltos começa em 0,665 (medida
 * no simulador), e a bandeja logo abaixo.
 */
export type Lugar = { x: number; base: number; largura: number; camada: number; achatar?: number };

/**
 * A RÉGUA DA LUZ (23/11/2026, o dono: "cada um deve ter seu brilho
 * proporcional à realidade, e deixe isso claro para depois, quando formos
 * criar mais itens, eles já virem com essa configuração").
 *
 * A potência vai de 0 a 1, e a lâmpada do abajur é o 1. TODO item novo
 * escolhe um degrau daqui (ou `luz: null`, se não emite luz nenhuma): não
 * invente um número solto, para o quarto continuar coerente.
 *
 *   lampada         1     abajur, luminária de chão: ilumina o quarto e o chão
 *   luzNoturna      0,5   estrela-abajur, luz de tomada, lua de mesa
 *   luzinhas        0,35  varal de luzinhas, pisca-pisca, vela de LED
 *   brilhaNoEscuro  0,2   plástico que brilha no escuro (móbile, adesivos)
 *   tintaQueBrilha  0,1   detalhe pintado com tinta fosforescente
 *
 * O que NÃO emite luz fica em `null`, por mais claro que seja: almofada,
 * pelúcia, móvel branco, espelho (reflete, não acende).
 */
export const REGUA_DA_LUZ = {
  lampada: 1,
  luzNoturna: 0.5,
  luzinhas: 0.35,
  brilhaNoEscuro: 0.2,
  tintaQueBrilha: 0.1,
} as const;

/**
 * A FICHA DE LUZ de um item. A tela (`app/quartinho.tsx`, `LuzDoItem`) tira
 * tudo daqui: o tamanho e a força do clarão saem da `potencia`; à noite o
 * item escurece menos quanto mais luz ele tem.
 */
export type Luz = {
  /** Um degrau de `REGUA_DA_LUZ`. */
  potencia: number;
  /** A cor da luz (quente para lâmpada, esverdeada ou azulada para o que brilha no escuro). */
  tom: string;
  /** De onde a luz sai, em frações da arte do item: [0, 0] é o canto de cima à esquerda. */
  de: readonly [number, number];
  /** Lança uma poça de luz no chão. Só para quem ilumina de verdade (`luzNoturna` para cima). */
  chao?: boolean;
};

export type ItemDoQuarto = {
  id: IdDoItem;
  nome: string;
  /** O cômodo onde ele mora (a pintura de que o `lugar` é fração). */
  comodo: Comodo;
  categoria: Categoria;
  /** A proporção da arte (altura / largura), para o lugar saber a altura. */
  proporcao: number;
  lugar: Lugar;
  /** O item da lojinha que ele É: a posse e o preço são os dela. */
  lojinha?: string;
  /** A missão que dá este item de presente. */
  missao?: IdDaMissao;
  /** A luz que ele emite à noite, pela `REGUA_DA_LUZ`. OBRIGATÓRIO: `null` é "não emite". */
  luz: Luz | null;
  /**
   * DESENHADO POR CÓDIGO (as luzes de 26/11/2026, o dono: "vamos adicionar
   * outros tipos de luzes para cada ambiente", sem crédito): no cômodo ele é
   * desenhado ao vivo (`componentes/quartinho/luzes.tsx`) e acende e apaga
   * com um toque; a arte em `assets/quartinho/` é só a miniatura da bandeja
   * (`scripts/gerar-luzes.mjs`). O `lugar` dele é a caixa do desenho.
   */
  desenhado?: true;
};

/*
 * O QUARTO, de frente (25/11/2026): a parede do fundo vai de x 0,244 a 0,804 e
 * de y 0,27 a 0,54 (o rodapé); a janela fica na parede da esquerda. Os lugares
 * foram compostos numa prévia da tela com a bandeja por cima, e não de cabeça.
 */
const Q = "quarto" as const;
/*
 * A COZINHA, a mesma câmera: a parede do fundo de x 0,148 a 0,829; a bancada
 * em y 0,508 (o tampo); o peitoril da janela em 0,4725; o fogão de x 0,703 a
 * 0,80; a geladeira na direita, de pé no chão.
 */
const C = "cozinha" as const;

export const ITENS: readonly ItemDoQuarto[] = [
  /* ── O quarto ── A parede do fundo. */
  {
    id: "prateleira",
    nome: "Prateleira",
    comodo: Q,
    categoria: "moveis",
    proporcao: 337 / 515,
    lugar: { x: 0.66, base: 0.36, largura: 0.19, camada: 1 },
    luz: null,
  },
  {
    id: "quadro-urso",
    nome: "Quadro do ursinho",
    comodo: Q,
    categoria: "decoracao",
    proporcao: 351 / 353,
    lugar: { x: 0.36, base: 0.375, largura: 0.085, camada: 1 },
    luz: null,
    lojinha: "objeto-quadrinho",
  },
  {
    id: "quadro-lua",
    nome: "Quadro da lua",
    comodo: Q,
    categoria: "decoracao",
    proporcao: 351 / 351,
    lugar: { x: 0.5, base: 0.375, largura: 0.085, camada: 1 },
    /* A lua do quadro é pintada com tinta que brilha: quase nada. */
    luz: { potencia: REGUA_DA_LUZ.tintaQueBrilha, tom: "#c3ccff", de: [0.48, 0.5] },
    missao: "ursinho",
  },
  /* O chão, do fundo para a frente. */
  {
    id: "tapete",
    nome: "Tapete de estrelas",
    comodo: Q,
    categoria: "tapetes",
    proporcao: 321 / 583,
    lugar: { x: 0.53, base: 0.695, largura: 0.58, camada: 2, achatar: 0.6 },
    luz: null,
    lojinha: "objeto-tapete",
  },
  {
    id: "berco",
    nome: "Berço",
    comodo: Q,
    categoria: "moveis",
    proporcao: 417 / 471,
    lugar: { x: 0.44, base: 0.575, largura: 0.3, camada: 3 },
    luz: null,
    lojinha: "objeto-berco",
  },
  {
    id: "comoda",
    nome: "Cômoda",
    comodo: Q,
    categoria: "moveis",
    proporcao: 435 / 397,
    lugar: { x: 0.71, base: 0.555, largura: 0.17, camada: 3 },
    luz: null,
  },
  {
    id: "mobile",
    nome: "Móbile",
    comodo: Q,
    categoria: "decoracao",
    proporcao: 393 / 460,
    lugar: { x: 0.45, base: 0.455, largura: 0.14, camada: 4 },
    /* A estrela e a lua do móbile são do plástico que brilha no escuro. */
    luz: { potencia: REGUA_DA_LUZ.brilhaNoEscuro, tom: "#ffe58f", de: [0.6, 0.62] },
    lojinha: "objeto-mobile",
  },
  {
    id: "coelhinho",
    nome: "Coelhinho",
    comodo: Q,
    categoria: "brinquedos",
    proporcao: 448 / 293,
    /* Sentado em cima da cômoda. */
    lugar: { x: 0.74, base: 0.461, largura: 0.055, camada: 4 },
    luz: null,
    lojinha: "bicho-coelho",
  },
  {
    id: "luminaria",
    nome: "Luminária",
    comodo: Q,
    categoria: "moveis",
    proporcao: 519 / 240,
    /* Entre o berço e a cômoda. */
    lugar: { x: 0.598, base: 0.58, largura: 0.07, camada: 4 },
    /* A lâmpada: o 1 da régua. Ilumina a parede, o chão e o que está perto. */
    luz: { potencia: REGUA_DA_LUZ.lampada, tom: "#ffb45e", de: [0.5, 0.14], chao: true },
    lojinha: "objeto-luminaria",
  },
  {
    id: "planta",
    nome: "Planta",
    comodo: Q,
    categoria: "plantas",
    proporcao: 430 / 392,
    lugar: { x: 0.15, base: 0.64, largura: 0.12, camada: 5 },
    luz: null,
    lojinha: "planta-vaso",
  },
  {
    id: "poltrona",
    nome: "Poltrona",
    comodo: Q,
    categoria: "moveis",
    proporcao: 481 / 456,
    lugar: { x: 0.3, base: 0.645, largura: 0.2, camada: 5 },
    luz: null,
    lojinha: "objeto-poltrona",
  },
  {
    id: "cesto",
    nome: "Cesto de brinquedos",
    comodo: Q,
    categoria: "brinquedos",
    proporcao: 490 / 410,
    lugar: { x: 0.84, base: 0.645, largura: 0.12, camada: 5 },
    luz: null,
    lojinha: "objeto-cestinho",
  },
  /* Os brinquedos, em cima do tapete. */
  {
    id: "ursinho",
    nome: "Ursinho",
    comodo: Q,
    categoria: "brinquedos",
    proporcao: 409 / 347,
    lugar: { x: 0.38, base: 0.67, largura: 0.085, camada: 6 },
    luz: null,
  },
  {
    id: "cavalinho",
    nome: "Cavalinho",
    comodo: Q,
    categoria: "brinquedos",
    proporcao: 436 / 484,
    lugar: { x: 0.52, base: 0.662, largura: 0.11, camada: 6 },
    luz: null,
    missao: "parede",
  },
  {
    id: "argolas",
    nome: "Argolas",
    comodo: Q,
    categoria: "brinquedos",
    proporcao: 444 / 346,
    lugar: { x: 0.63, base: 0.652, largura: 0.05, camada: 6 },
    luz: null,
    missao: "leitura",
  },
  {
    id: "cubos",
    nome: "Cubinhos",
    comodo: Q,
    categoria: "brinquedos",
    proporcao: 387 / 370,
    lugar: { x: 0.67, base: 0.668, largura: 0.07, camada: 6 },
    luz: null,
    missao: "tapete",
  },

  /* ── A cozinha ── A parede do fundo. */
  {
    id: "potes",
    nome: "Prateleira de potes",
    comodo: C,
    categoria: "decoracao",
    proporcao: 266 / 510,
    lugar: { x: 0.235, base: 0.39, largura: 0.17, camada: 1 },
    luz: null,
  },
  {
    id: "planta-pendurada",
    nome: "Planta pendurada",
    comodo: C,
    categoria: "plantas",
    proporcao: 564 / 438,
    lugar: { x: 0.235, base: 0.488, largura: 0.11, camada: 1 },
    luz: null,
  },
  {
    id: "relogio",
    nome: "Relógio",
    comodo: C,
    categoria: "decoracao",
    proporcao: 399 / 393,
    /* Entre a cortina e a coifa. */
    lugar: { x: 0.695, base: 0.398, largura: 0.065, camada: 1 },
    luz: null,
    missao: "bancada",
  },
  /* O peitoril da janela (a torneira fica no meio, livre). */
  {
    id: "hortela",
    nome: "Hortelã",
    comodo: C,
    categoria: "plantas",
    proporcao: 363 / 385,
    lugar: { x: 0.4, base: 0.4725, largura: 0.042, camada: 2 },
    luz: null,
    lojinha: "planta-hortela",
  },
  {
    id: "suculenta",
    nome: "Suculenta",
    comodo: C,
    categoria: "plantas",
    proporcao: 343 / 335,
    lugar: { x: 0.445, base: 0.4725, largura: 0.04, camada: 2 },
    luz: null,
    lojinha: "planta-suculenta",
  },
  {
    id: "cactinho",
    nome: "Cactinho",
    comodo: C,
    categoria: "plantas",
    proporcao: 429 / 267,
    lugar: { x: 0.555, base: 0.4725, largura: 0.034, camada: 2 },
    luz: null,
    lojinha: "planta-cacto",
  },
  {
    id: "trevo",
    nome: "Trevo",
    comodo: C,
    categoria: "plantas",
    proporcao: 468 / 366,
    lugar: { x: 0.6, base: 0.4725, largura: 0.04, camada: 2 },
    luz: null,
    lojinha: "planta-trevo",
  },
  /* O chão. */
  {
    id: "tapete-xadrez",
    nome: "Tapete xadrez",
    comodo: C,
    categoria: "tapetes",
    proporcao: 237 / 516,
    lugar: { x: 0.47, base: 0.685, largura: 0.5, camada: 2, achatar: 0.55 },
    luz: null,
    missao: "verde",
  },
  /* A bancada, da esquerda para a direita, e o fogão. */
  {
    id: "cafeteira",
    nome: "Cafeteira",
    comodo: C,
    categoria: "utensilios",
    proporcao: 428 / 348,
    lugar: { x: 0.17, base: 0.508, largura: 0.08, camada: 3 },
    luz: null,
  },
  {
    id: "tulipas",
    nome: "Tulipas",
    comodo: C,
    categoria: "plantas",
    proporcao: 523 / 372,
    lugar: { x: 0.27, base: 0.508, largura: 0.055, camada: 3 },
    luz: null,
    lojinha: "planta-tulipa",
  },
  {
    id: "margaridas",
    nome: "Vaso de margaridas",
    comodo: C,
    categoria: "decoracao",
    proporcao: 480 / 403,
    lugar: { x: 0.355, base: 0.508, largura: 0.07, camada: 3 },
    luz: null,
  },
  {
    id: "girassol",
    nome: "Girassol",
    comodo: C,
    categoria: "plantas",
    proporcao: 546 / 385,
    lugar: { x: 0.625, base: 0.508, largura: 0.06, camada: 3 },
    luz: null,
    lojinha: "planta-girassol",
  },
  {
    id: "colheres",
    nome: "Pote de colheres",
    comodo: C,
    categoria: "utensilios",
    proporcao: 466 / 327,
    lugar: { x: 0.68, base: 0.508, largura: 0.05, camada: 3 },
    luz: null,
  },
  {
    id: "panela",
    nome: "Panela",
    comodo: C,
    categoria: "utensilios",
    proporcao: 350 / 467,
    lugar: { x: 0.728, base: 0.513, largura: 0.055, camada: 3 },
    luz: null,
  },
  {
    id: "bule",
    nome: "Bule de chá",
    comodo: C,
    categoria: "utensilios",
    proporcao: 336 / 440,
    lugar: { x: 0.778, base: 0.513, largura: 0.05, camada: 3 },
    luz: null,
    lojinha: "objeto-chaleira",
  },
  {
    id: "planta-grande",
    nome: "Planta grande",
    comodo: C,
    categoria: "plantas",
    proporcao: 575 / 483,
    lugar: { x: 0.18, base: 0.665, largura: 0.15, camada: 5 },
    luz: null,
  },
  /* ── As LUZES, desenhadas por código (26/11/2026). Presentes da Bolha:
     a lojinha mora no servidor do site, que não muda, e não tem estes
     itens. Cada uma acende e apaga com um toque. */
  {
    id: "varal",
    nome: "Varal de luzinhas",
    comodo: Q,
    categoria: "luzes",
    proporcao: 1,
    /* No alto da parede do fundo, de canto a canto, atrás da prateleira. */
    lugar: { x: 0.525, base: 0.302, largura: 0.53, camada: 0 },
    luz: { potencia: REGUA_DA_LUZ.luzinhas, tom: "#ffd27a", de: [0.5, 0.5] },
    desenhado: true,
  },
  {
    id: "neon-lua",
    nome: "Neon de lua",
    comodo: Q,
    categoria: "luzes",
    proporcao: 1,
    /* Na parede da direita, em perspectiva, acima do cesto. */
    lugar: { x: 0.862, base: 0.395, largura: 0.07, camada: 1 },
    luz: { potencia: REGUA_DA_LUZ.luzNoturna, tom: "#ff9fd6", de: [0.5, 0.5] },
    desenhado: true,
  },
  {
    id: "projetor",
    nome: "Projetor de estrelas",
    comodo: Q,
    categoria: "luzes",
    proporcao: 1,
    /* Em cima da cômoda, ao lado do coelhinho (sem a cômoda, não entra). */
    lugar: { x: 0.665, base: 0.463, largura: 0.042, camada: 4 },
    luz: { potencia: REGUA_DA_LUZ.luzNoturna, tom: "#b9a8ff", de: [0.5, 0.3] },
    desenhado: true,
  },
  {
    id: "pisca-pisca",
    nome: "Pisca-pisca na janela",
    comodo: C,
    categoria: "luzes",
    proporcao: 1,
    /* Pendurado no varão da cortina, em dois arcos. */
    lugar: { x: 0.5, base: 0.362, largura: 0.34, camada: 2 },
    luz: { potencia: REGUA_DA_LUZ.luzinhas, tom: "#ffd166", de: [0.5, 0.5] },
    desenhado: true,
  },
  {
    id: "fita-led",
    nome: "Fita de LED na bancada",
    comodo: C,
    categoria: "luzes",
    proporcao: 1,
    /* Embaixo da borda do tampo, da ponta esquerda até o fogão. */
    lugar: { x: 0.408, base: 0.52, largura: 0.58, camada: 2 },
    luz: { potencia: REGUA_DA_LUZ.luzNoturna, tom: "#ffcf8a", de: [0.5, 0.5] },
    desenhado: true,
  },
  {
    id: "pendentes",
    nome: "Pendentes de vidro",
    comodo: C,
    categoria: "luzes",
    proporcao: 1,
    /* Dois globos pendurados do teto, na frente da janela. */
    lugar: { x: 0.5, base: 0.262, largura: 0.25, camada: 0 },
    luz: { potencia: REGUA_DA_LUZ.lampada, tom: "#ffc27a", de: [0.5, 0.9], chao: true },
    desenhado: true,
  },
];

/** Os itens da lojinha que o quartinho vende (os ids do catálogo do site). */
export const ITENS_A_VENDA_NO_QUARTO: ReadonlySet<string> = new Set(
  ITENS.flatMap((i) => (i.lojinha ? [i.lojinha] : [])),
);

export const ITEM_POR_ID: Readonly<Record<IdDoItem, ItemDoQuarto>> = Object.fromEntries(
  ITENS.map((i) => [i.id, i]),
) as Record<IdDoItem, ItemDoQuarto>;

/** As abas da bandeja de cada cômodo (o ícone é um item dele). */
export const CATEGORIAS: Readonly<
  Record<Comodo, readonly { id: Categoria; nome: string; icone: IdDoItem }[]>
> = {
  quarto: [
    { id: "moveis", nome: "Móveis", icone: "poltrona" },
    { id: "decoracao", nome: "Decoração", icone: "quadro-urso" },
    { id: "brinquedos", nome: "Brinquedos", icone: "ursinho" },
    { id: "tapetes", nome: "Tapetes", icone: "tapete" },
    { id: "plantas", nome: "Plantas", icone: "planta" },
    { id: "luzes", nome: "Luzes", icone: "varal" },
  ],
  cozinha: [
    { id: "utensilios", nome: "Utensílios", icone: "cafeteira" },
    { id: "decoracao", nome: "Decoração", icone: "margaridas" },
    { id: "plantas", nome: "Plantas", icone: "hortela" },
    { id: "tapetes", nome: "Tapetes", icone: "tapete-xadrez" },
    { id: "luzes", nome: "Luzes", icone: "pisca-pisca" },
  ],
};

/** Os itens de um cômodo, na ordem do catálogo. */
export const itensDoComodo = (c: Comodo): readonly ItemDoQuarto[] =>
  ITENS.filter((i) => i.comodo === c);

/**
 * As missões, uma por dia e na ordem (a ideia que o dono trouxe: "escolha o
 * primeiro ursinho, decore a parede do berço, escolha o tapete, monte o
 * cantinho de leitura"). `precisa`: cada grupo é "um destes".
 */
export type Missao = {
  id: IdDaMissao;
  texto: string;
  precisa: readonly (readonly IdDoItem[])[];
};

export const MISSOES: readonly Missao[] = [
  { id: "ursinho", texto: "Escolha o primeiro ursinho", precisa: [["ursinho"]] },
  { id: "parede", texto: "Decore a parede do berço", precisa: [["quadro-urso", "quadro-lua"]] },
  { id: "leitura", texto: "Monte o cantinho de leitura", precisa: [["poltrona"], ["luminaria"]] },
  { id: "tapete", texto: "Escolha o tapete", precisa: [["tapete"]] },
  { id: "mobile", texto: "Pendure o móbile no berço", precisa: [["berco"], ["mobile"]] },
  /* As da cozinha vêm depois das do quarto (25/11/2026). */
  { id: "bancada", texto: "Arrume a bancada da cozinha", precisa: [["margaridas"], ["colheres"]] },
  {
    id: "verde",
    texto: "Ponha uma planta na cozinha",
    precisa: [["planta-grande", "planta-pendurada"]],
  },
];

/** Os presentes de saída: o quarto já abre com eles à mão. */
export const PRESENTES_DE_SAIDA: readonly IdDoItem[] = ["comoda", "prateleira", "ursinho"];

export const CHAVE_DO_QUARTINHO = "dc-path-quartinho";

/**
 * Uma MEMÓRIA do quarto: como ele estava no fim de cada dia em que ela mexeu
 * nele (desde 24/11/2026 o quarto se guarda sozinho; antes, no "Salvar meu
 * quarto"). É o começo da retrospectiva do nascimento (a ideia 5: "como o
 * quarto foi montado, desde o primeiro objeto até a decoração completa"). Uma
 * por dia, a última do dia vale.
 */
export type Memoria = { dia: string; postos: IdDoItem[] };
export const MAXIMO_DE_MEMORIAS = 60;

export type Quartinho = {
  v: 1;
  /** O que está no quarto. */
  postos: IdDoItem[];
  /** Missão cumprida → o dia (aaaa-mm-dd) em que ela cumpriu. */
  missoes: Partial<Record<IdDaMissao, string>>;
  memorias: Memoria[];
  /** O AR do quarto (as pétalas, as bolhinhas caindo): um de cada vez, ou nenhum. */
  ar?: IdDoAr | null;
};

/** O quarto da primeira vez: a cômoda e a prateleira, para não abrir vazio. */
export const QUARTO_INICIAL: Quartinho = {
  v: 1,
  postos: ["comoda", "prateleira"],
  missoes: {},
  memorias: [],
};

const ehItem = (x: unknown): x is IdDoItem => typeof x === "string" && x in ITEM_POR_ID;

/** Lê o que está guardado; o que não for do formato vira o quarto inicial. */
const ehDia = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function lerQuartinho(v: unknown): Quartinho {
  if (!v || typeof v !== "object")
    return { ...QUARTO_INICIAL, postos: [...QUARTO_INICIAL.postos], memorias: [] };
  const o = v as { postos?: unknown; missoes?: unknown; memorias?: unknown; ar?: unknown };
  const postos = Array.isArray(o.postos) ? [...new Set(o.postos.filter(ehItem))] : [];
  const missoes: Quartinho["missoes"] = {};
  if (o.missoes && typeof o.missoes === "object")
    for (const m of MISSOES) {
      const d = (o.missoes as Record<string, unknown>)[m.id];
      if (ehDia(d)) missoes[m.id] = d;
    }
  const memorias: Memoria[] = [];
  if (Array.isArray(o.memorias))
    for (const m of o.memorias) {
      const x = m as { dia?: unknown; postos?: unknown };
      if (ehDia(x?.dia) && Array.isArray(x.postos))
        memorias.push({ dia: x.dia, postos: [...new Set(x.postos.filter(ehItem))] });
    }
  const ar = typeof o.ar === "string" && o.ar in AR_DO_QUARTO ? (o.ar as IdDoAr) : null;
  return {
    v: 1,
    postos,
    missoes,
    memorias: memorias.slice(-MAXIMO_DE_MEMORIAS),
    ...(ar ? { ar } : {}),
  };
}

/** Guarda o quarto de hoje nas memórias (uma por dia: a de hoje é trocada). */
export function guardarMemoria(q: Quartinho, hoje: string): Quartinho {
  const outras = q.memorias.filter((m) => m.dia !== hoje);
  const memorias = [...outras, { dia: hoje, postos: [...q.postos] }].slice(-MAXIMO_DE_MEMORIAS);
  return { ...q, memorias };
}

export type Situacao =
  | { tipo: "livre" }
  /** À venda AGORA: o preço que vale (o do banco, se é da loja por fase). */
  | { tipo: "comprar"; preco: number; lojinha: string; daFase: boolean }
  /** Ainda não abriu na lojinha: a fase dela não chegou (ou o banco não diz). */
  | { tipo: "em-breve"; lojinha: string; quando: string }
  | { tipo: "missao"; missao: Missao };

/**
 * A LOJINHA COMO ELA É PARA ELA: a posse (os ids que o servidor devolve), a
 * loja por fase lida do banco (`~/lib/jornada/loja-por-fase`) e a semana dela
 * na régua da loja (`semanaDaLoja`). `porFase: null` = o banco ainda sem a
 * tabela, ou a leitura falhou.
 */
export type VitrineDoQuarto = {
  posse: ReadonlySet<string> | null;
  porFase: ReadonlyMap<string, ItemPorFase> | null;
  semana: number;
};

/**
 * Como o item da lojinha se vende no quarto: pela MESMA regra da vitrine
 * (`situacaoNaLoja`, em `~/lib/jornada/enfeites`). O que não é Premium está à
 * venda pelo preço do catálogo; o Premium só pela loja por fase, quando a fase
 * dela chega, e pelo preço do banco. Sem a tabela, o Premium não se vende (o
 * servidor do site recusa todo Premium).
 *
 * ⚠️ 24/11/2026: a primeira versão mostrava o preço do catálogo em todo item e
 * mandava ela à lojinha, onde o berço (3º trimestre) nem aparecia.
 */
export function vendaNoQuarto(
  lojinha: string,
  porFase: ReadonlyMap<string, ItemPorFase> | null,
  semana: number,
): Extract<Situacao, { tipo: "comprar" | "em-breve" }> {
  const i = CANTINHO_BY_ID[lojinha];
  if (!i || i.aposentado) return { tipo: "em-breve", lojinha, quando: "Em breve" };
  if (!i.premium) return { tipo: "comprar", preco: i.price, lojinha, daFase: false };
  const f = porFase?.get(lojinha);
  if (!f) return { tipo: "em-breve", lojinha, quando: "Em breve" };
  if (f.semana <= semana) return { tipo: "comprar", preco: f.preco, lojinha, daFase: true };
  return { tipo: "em-breve", lojinha, quando: quandoAbre(f.semana) };
}

/**
 * Se ela pode pôr o item: os presentes de saída sempre; o da missão depois de
 * cumpri-la; o da lojinha se ela o tem. O que ela não tem se compra ali mesmo,
 * no quarto, quando já está à venda (`vendaNoQuarto`).
 */
export function situacaoDoItem(
  item: ItemDoQuarto,
  q: Quartinho,
  vitrine: VitrineDoQuarto,
): Situacao {
  if (item.lojinha) {
    if (vitrine.posse?.has(item.lojinha)) return { tipo: "livre" };
    return vendaNoQuarto(item.lojinha, vitrine.porFase, vitrine.semana);
  }
  if (item.missao && !q.missoes[item.missao]) {
    return { tipo: "missao", missao: MISSOES.find((m) => m.id === item.missao)! };
  }
  return { tipo: "livre" };
}

/**
 * Se o item da lojinha se vende no app ALGUM dia (agora ou numa fase que vem).
 * O Premium que não está na loja por fase nunca se vende: mostrá-lo como "Em
 * breve" seria prometer o que não vem.
 */
export function vendeAlgumDia(
  lojinha: string,
  porFase: ReadonlyMap<string, ItemPorFase> | null,
): boolean {
  const i = CANTINHO_BY_ID[lojinha];
  if (!i || i.aposentado) return false;
  return !i.premium || !!porFase?.has(lojinha);
}

/** O ar do quarto se vende como o item: o da lojinha, pela mesma regra da vitrine. */
export function situacaoDoAr(a: IdDoAr, vitrine: VitrineDoQuarto): Situacao {
  const lojinha = AR_DO_QUARTO[a].lojinha;
  if (vitrine.posse?.has(lojinha)) return { tipo: "livre" };
  return vendaNoQuarto(lojinha, vitrine.porFase, vitrine.semana);
}

/** Liga um ar (desligando o outro), ou desliga o que está ligado. */
export function alternarAr(q: Quartinho, a: IdDoAr): Quartinho {
  return { ...q, ar: q.ar === a ? null : a };
}

/** O que a Bolha diz do item que ainda não abriu (cabe nas duas linhas do balão). */
export function falaDoEmBreve(quando: string): string {
  return quando === "Em breve"
    ? "Esse chega em breve na lojinha."
    : `Abre ${quando.charAt(0).toLowerCase()}${quando.slice(1)}. Junte sementinhas!`;
}

/**
 * A conta da compra, antes de ela confirmar: quanto fica, ou quanto falta.
 * Saldo desconhecido (`null`) não tranca: quem decide é o servidor.
 */
export function contaDaCompra(
  preco: number,
  saldo: number | null,
): { pode: true; fica: number | null } | { pode: false; faltam: number } {
  if (saldo == null) return { pode: true, fica: null };
  return saldo >= preco
    ? { pode: true, fica: saldo - preco }
    : { pode: false, faltam: preco - saldo };
}

/** Põe ou tira um item (tirar é sempre possível; pôr só o que está livre). */
/**
 * O que só fica em cima de outro item: o móbile no berço, o projetor de
 * estrelas na cômoda. Sem o apoio, ele não entra; tirado o apoio, sai junto.
 */
export const PRECISA_DE: Readonly<Partial<Record<IdDoItem, IdDoItem>>> = {
  mobile: "berco",
  projetor: "comoda",
};

export function alternar(q: Quartinho, id: IdDoItem): Quartinho {
  const tem = q.postos.includes(id);
  let postos = tem ? q.postos.filter((p) => p !== id) : [...q.postos, id];
  /* Sem o apoio, o que fica em cima dele não tem onde ficar: sai junto. */
  if (tem) postos = postos.filter((p) => PRECISA_DE[p] !== id);
  if (!tem && faltaOApoio(q, id)) return q;
  return { ...q, postos };
}

/** O apoio que falta para o item entrar (o berço do móbile, a cômoda do projetor). */
export function faltaOApoio(q: Quartinho, id: IdDoItem): IdDoItem | null {
  const apoio = PRECISA_DE[id];
  return apoio && !q.postos.includes(apoio) ? apoio : null;
}

export const faltaOBerco = (q: Quartinho, id: IdDoItem) => faltaOApoio(q, id) === "berco";

/** Quantos grupos da missão já estão no quarto, de quantos. */
export function progressoDaMissao(m: Missao, q: Quartinho): { feitos: number; total: number } {
  const feitos = m.precisa.filter((grupo) => grupo.some((i) => q.postos.includes(i))).length;
  return { feitos, total: m.precisa.length };
}

export type MissaoDoDia =
  | { estado: "aberta"; missao: Missao; feitos: number; total: number }
  | { estado: "cumprida-hoje"; missao: Missao }
  | { estado: "todas" };

/**
 * A missão de hoje: a primeira que falta. Uma por dia — cumprida a de hoje,
 * a próxima espera amanhã.
 */
export function missaoDoDia(q: Quartinho, hoje: string): MissaoDoDia {
  const deHoje = MISSOES.find((m) => q.missoes[m.id] === hoje);
  if (deHoje) return { estado: "cumprida-hoje", missao: deHoje };
  const proxima = MISSOES.find((m) => !q.missoes[m.id]);
  if (!proxima) return { estado: "todas" };
  return { estado: "aberta", missao: proxima, ...progressoDaMissao(proxima, q) };
}

/**
 * Depois de uma mudança: se a missão aberta ficou completa, ela é cumprida
 * hoje. Devolve o quarto novo e a missão cumprida (para a festa), ou nada.
 */
export function cumprirSePronta(
  q: Quartinho,
  hoje: string,
): { quarto: Quartinho; cumprida: Missao | null } {
  const d = missaoDoDia(q, hoje);
  if (d.estado !== "aberta" || d.feitos < d.total) return { quarto: q, cumprida: null };
  return { quarto: { ...q, missoes: { ...q.missoes, [d.missao.id]: hoje } }, cumprida: d.missao };
}

/** O presente que uma missão libera (o item que tem `missao` igual a ela). */
export const presenteDaMissao = (m: Missao): ItemDoQuarto | undefined =>
  ITENS.find((i) => i.missao === m.id);

/**
 * Onde o item se apoia: decide a SOMBRA dele (a profundidade do quarto). No
 * chão, a sombra de contato embaixo; na parede, a sombra projetada atrás; o
 * tapete é o próprio chão, e o que fica sobre um móvel não projeta no chão.
 */
export type Apoio = "chao" | "parede" | "tapete" | "movel";
export const APOIO: Readonly<Record<IdDoItem, Apoio>> = {
  berco: "chao",
  poltrona: "chao",
  comoda: "chao",
  luminaria: "chao",
  planta: "chao",
  cesto: "chao",
  ursinho: "chao",
  cavalinho: "chao",
  argolas: "chao",
  cubos: "chao",
  prateleira: "parede",
  "quadro-urso": "parede",
  "quadro-lua": "parede",
  tapete: "tapete",
  mobile: "movel",
  coelhinho: "movel",
  /* A cozinha: o que fica na bancada, no peitoril e no fogão está "no móvel". */
  "planta-grande": "chao",
  potes: "parede",
  "planta-pendurada": "parede",
  relogio: "parede",
  "tapete-xadrez": "tapete",
  hortela: "movel",
  suculenta: "movel",
  cactinho: "movel",
  trevo: "movel",
  cafeteira: "movel",
  tulipas: "movel",
  margaridas: "movel",
  girassol: "movel",
  colheres: "movel",
  panela: "movel",
  bule: "movel",
  /* As luzes: o varal, o neon e o pisca-pisca na parede; o projetor na
     cômoda, a fita embaixo do tampo; os pendentes no teto (sem sombra). */
  varal: "parede",
  "neon-lua": "parede",
  projetor: "movel",
  "pisca-pisca": "parede",
  "fita-led": "movel",
  pendentes: "movel",
};

/**
 * "Decorar aleatoriamente" (o botão do dado, dos mockups): sorteia entre o
 * que ela PODE pôr (`livres`), sempre com pelo menos três itens, e o móbile
 * só entra com o berço. `sorteio` devolve um número em [0, 1). Só mexe no
 * cômodo que está na tela: o outro fica como ela deixou.
 */
export function decorarAoAcaso(
  q: Quartinho,
  livres: readonly IdDoItem[],
  sorteio: () => number,
  comodo: Comodo = "quarto",
): Quartinho {
  const daqui = livres.filter((id) => ITEM_POR_ID[id].comodo === comodo);
  let escolhidos = daqui.filter(() => sorteio() < 0.7);
  if (escolhidos.length < Math.min(3, daqui.length)) escolhidos = [...daqui];
  escolhidos = escolhidos.filter((p) => {
    const apoio = PRECISA_DE[p];
    return !apoio || escolhidos.includes(apoio);
  });
  const doOutro = q.postos.filter((id) => ITEM_POR_ID[id].comodo !== comodo);
  return { ...q, postos: [...doOutro, ...escolhidos] };
}

/** Os itens na ordem de desenho: a parede atrás, os brinquedos na frente. */
export function emOrdemDeDesenho(postos: readonly IdDoItem[]): ItemDoQuarto[] {
  return postos
    .map((id) => ITEM_POR_ID[id])
    .sort((a, b) => a.lugar.camada - b.lugar.camada || a.lugar.base - b.lugar.base);
}

/** É noite no quarto (as mesmas horas do céu da noite do app). */
export const ehNoiteNoQuarto = (hora: number) => hora >= 19 || hora < 5;
