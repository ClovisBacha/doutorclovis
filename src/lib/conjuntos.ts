/**
 * OS CONJUNTOS DO CANTINHO — itens que se completam.
 *
 * ─── O PEDIDO ───────────────────────────────────────────────────────────────
 *
 * Palavras do dono: "veja se os itens se sincronizam de uma maneira
 * interessante, se eles se complementam — por exemplo um item de emoji de
 * golfinho e outro de um lago, dá pra juntar".
 *
 * Ele viu o que estava lá: 🐬 `agua-golfinho`, 🐚 `agua-concha`, 🐠
 * `agua-peixinho` e 🌊 `fundo-mar` já existiam, cada um sozinho na sua
 * prateleira, sem nada no app dizendo que são a mesma praia. A loja tinha
 * TEMA sem ter CONJUNTO.
 *
 * ─── O QUE ISTO NÃO É ───────────────────────────────────────────────────────
 *
 * ⚠️ Não é a Coroa da Coleção (`cantinho.ts`). Aquela pede um item pago de
 * CADA categoria — é largura, "você passeou pelo cantinho inteiro". O conjunto
 * é profundidade: quatro coisas que contam a mesma história. As duas convivem
 * porque respondem a perguntas diferentes, e um item pode servir às duas.
 *
 * ─── ⚠️ O RISCO CLÍNICO, E COMO O DESENHO O EVITA ───────────────────────────
 *
 * Conjunto é a mecânica que mais empurra compra em jogo comercial: "faltam 2
 * para completar" é desenhado para incomodar. Numa gestante de alto risco —
 * que às vezes está sem dinheiro, sem disposição, ou internada — isso vira
 * cobrança com cara de enfeite. Três travas:
 *
 *  1. **O conjunto não se anuncia.** Ele aparece na prateleira dele, não como
 *     aviso na tela inicial, nem como emblema no menu, nem em push.
 *  2. **Não existe prazo.** Nada de "só até domingo". O conjunto espera.
 *  3. **Falta nunca é contada em vermelho nem no plural do dever.** A tela diz
 *     "3 de 4", que é estado, e não "falta 1!", que é dívida.
 *
 * ─── ⚠️ CONJUNTO PUBLICADO NÃO MUDA DE ITENS ────────────────────────────────
 *
 * A mesma lição que a Coroa aprendeu (ver `CANTINHO_COMPLETION_MIN`): o app não
 * pode tirar de volta o que já deu. Se um conjunto ganhasse um quinto item, ele
 * DES-completaria para quem já o tinha fechado — e ela veria um "3 de 5" onde
 * ontem havia um selo. Item novo entra em conjunto NOVO. Há teste.
 */

import { CANTINHO_BY_ID } from "./cantinho";

export type Conjunto = {
  id: string;
  nome: string;
  /**
   * Um emoji que representa a CENA inteira — e que não é o de NENHUM item do
   * catálogo.
   *
   * ⚠️ A primeira versão usava o emoji do item mais representativo (🌊 para o
   * mar, 🕯️ para as luzes) e o teste pegou: a prateleira mostrava o mesmo
   * desenho duas vezes, e o selo do conjunto lia como mais uma cópia daquele
   * item. O conjunto é a cena, não o item principal dela.
   */
  emoji: string;
  /** A frase que a paciente lê. Descreve a CENA, não a mecânica. */
  descricao: string;
  /** Ids de `CANTINHO_ITEMS`. Fixo depois de publicado — ver o cabeçalho. */
  itens: string[];
};

/**
 * Quanto vale fechar um conjunto, por tamanho.
 *
 * Proporcional ao número de itens, e modesto de propósito: o prêmio é o
 * RECONHECIMENTO (o selo e o nome do conjunto na prateleira). Se a Sementinha
 * fosse o motivo, o conjunto viraria planilha — e quem monta uma cena bonita
 * no cantinho não está fazendo planilha.
 */
export const BONUS_POR_ITEM = 15;

export function bonusDoConjunto(c: Conjunto): number {
  return c.itens.length * BONUS_POR_ITEM;
}

export const CONJUNTOS: Conjunto[] = [
  {
    id: "mar",
    nome: "Fundo do mar",
    emoji: "🏖️",
    descricao: "O golfinho, o peixinho e a concha, com o mar atrás.",
    /* O conjunto que o dono descreveu com o dedo. Os quatro já existiam. */
    itens: ["fundo-mar", "agua-golfinho", "agua-peixinho", "agua-concha"],
  },
  {
    id: "noite",
    nome: "Noite estrelada",
    emoji: "🌜",
    descricao: "A lua, as estrelinhas e um cometa passando.",
    itens: ["ceu-lua", "ceu-estrelinhas", "ceu-cometa", "fundo-estrelas"],
  },
  {
    id: "floral",
    nome: "Canteiro florido",
    emoji: "💐",
    descricao: "Girassol, tulipa e cerejeira — e a abelha que veio junto.",
    itens: ["planta-girassol", "planta-tulipa", "planta-cerejeira", "bicho-abelha"],
  },
  {
    id: "luzes",
    nome: "Luzes acesas",
    emoji: "🌟",
    descricao: "Tudo que acende devagar quando escurece.",
    itens: ["luz-vela", "luz-lampiao", "luz-pisca", "objeto-luminaria"],
  },
  {
    id: "cha",
    nome: "Hora do chá",
    emoji: "☕",
    descricao: "Chá quente, um livro e um lugar macio pra sentar.",
    itens: ["objeto-chaleira", "objeto-livrinho", "objeto-almofada", "objeto-tapete"],
  },
  {
    id: "depois-da-chuva",
    nome: "Depois da chuva",
    emoji: "⛅",
    /* Três itens, e é o único trio: a cena tem três atos e não comporta um
       quarto sem virar outra coisa. Tamanho é conteúdo, não meta. */
    descricao: "Chove, o sol volta, e aí aparece o arco-íris.",
    itens: ["especial-chuva", "ceu-sol", "ceu-arcoiris"],
  },
  {
    id: "bichinhos",
    nome: "Bichinhos de jardim",
    emoji: "🪲",
    descricao: "Os pequenos que aparecem entre as plantas.",
    itens: ["bicho-joaninha", "bicho-borboleta", "bicho-tartaruga"],
  },
  {
    id: "quintal",
    nome: "Amigos do quintal",
    emoji: "🏡",
    descricao: "Os que passeiam pelo caminho quando ninguém está olhando.",
    itens: ["bicho-coelho", "bicho-gato", "bicho-raposa", "bicho-passaro"],
  },
];

export const CONJUNTO_POR_ID: Record<string, Conjunto> = Object.fromEntries(
  CONJUNTOS.map((c) => [c.id, c]),
);

export type ProgressoDoConjunto = {
  conjunto: Conjunto;
  tem: number;
  total: number;
  completo: boolean;
  /** Ids que ela ainda não tem — para a prateleira do conjunto, nunca para aviso. */
  faltando: string[];
};

export function progressoDoConjunto(c: Conjunto, ownedIds: Iterable<string>): ProgressoDoConjunto {
  const owned = ownedIds instanceof Set ? ownedIds : new Set(ownedIds);
  const faltando = c.itens.filter((id) => !owned.has(id));
  return {
    conjunto: c,
    tem: c.itens.length - faltando.length,
    total: c.itens.length,
    completo: faltando.length === 0,
    faltando,
  };
}

/**
 * Todos os conjuntos, ordenados: os completos primeiro, depois os mais
 * próximos de fechar.
 *
 * ⚠️ Os completos vêm primeiro de propósito. A ordem oposta — "quase lá" no
 * topo — é a que todo jogo comercial usa, e é exatamente a que transforma a
 * prateleira num lembrete do que falta. Aqui o topo mostra o que ela JÁ fez.
 */
export function conjuntosOrdenados(ownedIds: Iterable<string>): ProgressoDoConjunto[] {
  const owned = ownedIds instanceof Set ? ownedIds : new Set(ownedIds);
  return CONJUNTOS.map((c) => progressoDoConjunto(c, owned)).sort((a, b) => {
    if (a.completo !== b.completo) return a.completo ? -1 : 1;
    return b.tem / b.total - a.tem / a.total;
  });
}

/** Os ids dos conjuntos que ela fechou. É o que o servidor paga. */
export function conjuntosCompletos(ownedIds: Iterable<string>): string[] {
  const owned = ownedIds instanceof Set ? ownedIds : new Set(ownedIds);
  return CONJUNTOS.filter((c) => c.itens.every((id) => owned.has(id))).map((c) => c.id);
}

/** A chave de dedupe do bônus — uma por conjunto, paga uma vez na vida. */
export function chaveDoBonus(conjuntoId: string): string {
  return `conjunto:${conjuntoId}`;
}

/**
 * A que conjuntos um item pertence — usado no tile da loja, para o item dizer
 * de que cena ele faz parte antes de ela comprar.
 */
export function conjuntosDoItem(itemId: string): Conjunto[] {
  return CONJUNTOS.filter((c) => c.itens.includes(itemId));
}

/** Todo id citado por algum conjunto existe no catálogo? (usado no teste) */
export function idsInvalidos(): string[] {
  return CONJUNTOS.flatMap((c) => c.itens).filter((id) => !CANTINHO_BY_ID[id]);
}
