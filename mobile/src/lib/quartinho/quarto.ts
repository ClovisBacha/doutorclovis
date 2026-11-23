/**
 * O QUARTINHO DO BEBÊ — as regras, sem tela (testadas pelo bun).
 *
 * 23/11/2026, o dono, com dois mockups e as ideias que pediu ao ChatGPT:
 * "quando clica no bebê bolha abre um quartinho que ela consegue decorar com
 * os itens [...] vamos fazer ficar o mais próximo dessas imagens". A proposta
 * inteira está em `docs/proposta-quartinho-e-itens.md`.
 *
 * - O QUARTO é uma arte só, vazia (`assets/quartinho/quarto-dia.webp`); a
 *   noite é ela mesma sob um azul que multiplica, com o vidro da janela da
 *   noite por cima (`janela-noite.webp`, tirado dela por código). Cada ITEM
 *   é uma arte à parte, com um lugar FIXO no quarto: decorar é escolher o
 *   que fica, e o quarto sai sempre
 *   bonito — sem arrastar, girar nem zoom ("eu não deixaria a experiência
 *   cheia de botões", a sugestão que veio junto).
 * - A POSSE: nove itens SÃO itens da lojinha (`lojinha`): ela os tem se os
 *   comprou lá, e o preço é o da lojinha. Os outros sete são presentes da
 *   Bolha: quatro de saída e três que as missões liberam. Nada aqui inventa
 *   preço nem moeda.
 * - AS MISSÕES: uma por dia, na ordem; cumprida, a Bolha comemora e dá o
 *   presente dela (um item). Elas não pagam sementinhas: quem paga é o
 *   servidor do site, que não muda.
 */

export type Categoria = "moveis" | "decoracao" | "brinquedos" | "tapetes" | "plantas";

export type IdDoItem =
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

export type IdDaMissao = "ursinho" | "parede" | "leitura" | "tapete" | "mobile";

/**
 * Onde o item fica, em FRAÇÕES da arte do quarto (1536 × 2752): `x` é o
 * centro, `base` é a linha onde o pé dele encosta, `largura` é a largura dele
 * e `camada` é a ordem de desenho (a parede atrás, os brinquedos na frente).
 * `achatar` encolhe a altura (o tapete, visto mais de lado).
 */
export type Lugar = { x: number; base: number; largura: number; camada: number; achatar?: number };

export type ItemDoQuarto = {
  id: IdDoItem;
  nome: string;
  categoria: Categoria;
  /** A proporção da arte (altura / largura), para o lugar saber a altura. */
  proporcao: number;
  lugar: Lugar;
  /** O item da lojinha que ele É: a posse e o preço são os dela. */
  lojinha?: string;
  /** A missão que dá este item de presente. */
  missao?: IdDaMissao;
};

export const ITENS: readonly ItemDoQuarto[] = [
  /* A parede do fundo. */
  {
    id: "prateleira",
    nome: "Prateleira",
    categoria: "moveis",
    proporcao: 337 / 515,
    lugar: { x: 0.66, base: 0.267, largura: 0.3, camada: 1 },
  },
  {
    id: "quadro-urso",
    nome: "Quadro do ursinho",
    categoria: "decoracao",
    proporcao: 351 / 353,
    lugar: { x: 0.47, base: 0.352, largura: 0.14, camada: 1 },
    lojinha: "objeto-quadrinho",
  },
  {
    id: "quadro-lua",
    nome: "Quadro da lua",
    categoria: "decoracao",
    proporcao: 351 / 351,
    lugar: { x: 0.69, base: 0.352, largura: 0.14, camada: 1 },
    missao: "ursinho",
  },
  /* O chão, do fundo para a frente. */
  {
    id: "tapete",
    nome: "Tapete de estrelas",
    categoria: "tapetes",
    proporcao: 321 / 583,
    lugar: { x: 0.56, base: 0.742, largura: 0.78, camada: 2, achatar: 0.62 },
    lojinha: "objeto-tapete",
  },
  {
    id: "planta",
    nome: "Planta",
    categoria: "plantas",
    proporcao: 430 / 392,
    lugar: { x: 0.085, base: 0.52, largura: 0.16, camada: 3 },
    lojinha: "planta-vaso",
  },
  {
    id: "comoda",
    nome: "Cômoda",
    categoria: "moveis",
    proporcao: 435 / 397,
    lugar: { x: 0.85, base: 0.54, largura: 0.25, camada: 3 },
  },
  {
    id: "berco",
    nome: "Berço",
    categoria: "moveis",
    proporcao: 417 / 471,
    lugar: { x: 0.585, base: 0.565, largura: 0.42, camada: 3 },
    lojinha: "objeto-berco",
  },
  {
    id: "mobile",
    nome: "Móbile",
    categoria: "decoracao",
    proporcao: 393 / 460,
    lugar: { x: 0.505, base: 0.392, largura: 0.22, camada: 4 },
    lojinha: "objeto-mobile",
  },
  {
    id: "coelhinho",
    nome: "Coelhinho",
    categoria: "brinquedos",
    proporcao: 448 / 293,
    lugar: { x: 0.855, base: 0.392, largura: 0.11, camada: 4 },
    lojinha: "bicho-coelho",
  },
  {
    id: "luminaria",
    nome: "Luminária",
    categoria: "moveis",
    proporcao: 519 / 240,
    lugar: { x: 0.335, base: 0.578, largura: 0.12, camada: 4 },
    lojinha: "objeto-luminaria",
  },
  {
    id: "poltrona",
    nome: "Poltrona",
    categoria: "moveis",
    proporcao: 481 / 456,
    lugar: { x: 0.165, base: 0.645, largura: 0.32, camada: 5 },
    lojinha: "objeto-poltrona",
  },
  {
    id: "cesto",
    nome: "Cesto de brinquedos",
    categoria: "brinquedos",
    proporcao: 490 / 410,
    lugar: { x: 0.905, base: 0.665, largura: 0.19, camada: 5 },
    lojinha: "objeto-cestinho",
  },
  /* Os brinquedos, em cima do tapete. */
  {
    id: "ursinho",
    nome: "Ursinho",
    categoria: "brinquedos",
    proporcao: 409 / 347,
    lugar: { x: 0.3, base: 0.728, largura: 0.14, camada: 6 },
  },
  {
    id: "cavalinho",
    nome: "Cavalinho",
    categoria: "brinquedos",
    proporcao: 436 / 484,
    lugar: { x: 0.47, base: 0.712, largura: 0.2, camada: 6 },
    missao: "parede",
  },
  {
    id: "argolas",
    nome: "Argolas",
    categoria: "brinquedos",
    proporcao: 444 / 346,
    lugar: { x: 0.635, base: 0.684, largura: 0.085, camada: 6 },
    missao: "leitura",
  },
  {
    id: "cubos",
    nome: "Cubinhos",
    categoria: "brinquedos",
    proporcao: 387 / 370,
    lugar: { x: 0.765, base: 0.704, largura: 0.12, camada: 6 },
    missao: "tapete",
  },
];

export const ITEM_POR_ID: Readonly<Record<IdDoItem, ItemDoQuarto>> = Object.fromEntries(
  ITENS.map((i) => [i.id, i]),
) as Record<IdDoItem, ItemDoQuarto>;

export const CATEGORIAS: readonly { id: Categoria; nome: string; icone: IdDoItem }[] = [
  { id: "moveis", nome: "Móveis", icone: "poltrona" },
  { id: "decoracao", nome: "Decoração", icone: "quadro-urso" },
  { id: "brinquedos", nome: "Brinquedos", icone: "ursinho" },
  { id: "tapetes", nome: "Tapetes", icone: "tapete" },
  { id: "plantas", nome: "Plantas", icone: "planta" },
];

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
];

/** Os presentes de saída: o quarto já abre com eles à mão. */
export const PRESENTES_DE_SAIDA: readonly IdDoItem[] = ["comoda", "prateleira", "ursinho"];

export const CHAVE_DO_QUARTINHO = "dc-path-quartinho";

/**
 * Uma MEMÓRIA do quarto: como ele estava no dia em que ela tocou em "Salvar
 * meu quarto". É o começo da retrospectiva do nascimento (a ideia 5: "como o
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
  const o = v as { postos?: unknown; missoes?: unknown; memorias?: unknown };
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
  return { v: 1, postos, missoes, memorias: memorias.slice(-MAXIMO_DE_MEMORIAS) };
}

/** Guarda o quarto de hoje nas memórias (uma por dia: a de hoje é trocada). */
export function guardarMemoria(q: Quartinho, hoje: string): Quartinho {
  const outras = q.memorias.filter((m) => m.dia !== hoje);
  const memorias = [...outras, { dia: hoje, postos: [...q.postos] }].slice(-MAXIMO_DE_MEMORIAS);
  return { ...q, memorias };
}

export type Situacao =
  | { tipo: "livre" }
  | { tipo: "comprar"; preco: number; lojinha: string }
  | { tipo: "missao"; missao: Missao };

/**
 * Se ela pode pôr o item: os presentes de saída sempre; o da missão depois de
 * cumpri-la; o da lojinha se ela o tem (`posse`, os ids da lojinha que o
 * servidor devolve). `precoDaLojinha` vem do catálogo do site.
 */
export function situacaoDoItem(
  item: ItemDoQuarto,
  q: Quartinho,
  posse: ReadonlySet<string> | null,
  precoDaLojinha: (id: string) => number | undefined,
): Situacao {
  if (item.lojinha) {
    if (posse?.has(item.lojinha)) return { tipo: "livre" };
    return { tipo: "comprar", preco: precoDaLojinha(item.lojinha) ?? 0, lojinha: item.lojinha };
  }
  if (item.missao && !q.missoes[item.missao]) {
    return { tipo: "missao", missao: MISSOES.find((m) => m.id === item.missao)! };
  }
  return { tipo: "livre" };
}

/** Põe ou tira um item (tirar é sempre possível; pôr só o que está livre). */
export function alternar(q: Quartinho, id: IdDoItem): Quartinho {
  const tem = q.postos.includes(id);
  let postos = tem ? q.postos.filter((p) => p !== id) : [...q.postos, id];
  /* Sem berço, o móbile não tem onde ficar: sai junto. */
  if (tem && id === "berco") postos = postos.filter((p) => p !== "mobile");
  if (!tem && id === "mobile" && !postos.includes("berco")) return q;
  return { ...q, postos };
}

export const faltaOBerco = (q: Quartinho, id: IdDoItem) =>
  id === "mobile" && !q.postos.includes("berco");

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

/** Os itens na ordem de desenho: a parede atrás, os brinquedos na frente. */
export function emOrdemDeDesenho(postos: readonly IdDoItem[]): ItemDoQuarto[] {
  return postos
    .map((id) => ITEM_POR_ID[id])
    .sort((a, b) => a.lugar.camada - b.lugar.camada || a.lugar.base - b.lugar.base);
}

/** É noite no quarto (as mesmas horas do céu da noite do app). */
export const ehNoiteNoQuarto = (hora: number) => hora >= 19 || hora < 5;
