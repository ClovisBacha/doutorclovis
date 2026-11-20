import { CANTINHO_BY_ID } from "@/lib/cantinho";
import { bonusDoConjunto, CONJUNTO_POR_ID } from "@/lib/conjuntos";
import { trofeusExigidos } from "@/lib/trofeus";

/**
 * A LOJA POR FASE — a economia "mista" que o dono escolheu (out/2026).
 *
 * O problema: a lojinha grátis do site foi feita para acabar em ~15 dias e
 * empurrar o Premium (`src/lib/economia-sementinhas.ts`). No app o Premium não
 * existe (regra da Apple) — então ela comprava tudo em ~10 dias e passava o
 * resto da gestação juntando sementinhas sem ter onde gastar.
 *
 * A saída: parte dos itens Premium (as artes 3D já existem) passa a ser
 * vendida por sementinhas, abrindo POR FASE da gestação — cada trimestre traz
 * conjuntos inteiros (o bônus de conjunto vira meta) e um item grande. A reta
 * final e o pós-parto abrem o último lote: depois do parto o servidor não paga
 * mais as atividades, e é aí que ela gasta o que juntou. O resto (os
 * especiais, as bolinhas mais caras e os dois itens de troféu) fica guardado
 * para o Premium que vier com a compra pela Apple.
 *
 * A REGRA MORA NO BANCO: `mobile/supabase/APLICAR_LOJA_POR_FASE.sql`, gerado deste
 * arquivo por `mobile/scripts/gerar-loja-por-fase.ts` (a catraca em
 * `loja-por-fase.test.ts` reprova se os dois divergirem). O app lê a tabela;
 * mudar uma fase no banco muda a loja sem build novo.
 * Sem react-native aqui: é testado pelo bun.
 */

export type FaseDaLoja = {
  n: number;
  nome: string;
  /** A semana de gestação em que a fase abre (o pós-parto abre todas). */
  semana: number;
  /** Conjuntos inteiros: todo item Premium deles abre nesta fase (ou antes). */
  conjuntos: readonly string[];
  /** Itens soltos da fase. */
  avulsos: readonly string[];
};

export const FASES_DA_LOJA: readonly FaseDaLoja[] = [
  {
    n: 1,
    nome: "Primeiro trimestre",
    semana: 0,
    conjuntos: ["floral", "cha", "luzes", "bichinhos"],
    avulsos: ["planta-vaso", "ceu-passarinhos", "planta-cacto"],
  },
  {
    n: 2,
    nome: "Segundo trimestre",
    semana: 14,
    conjuntos: ["sem-pressa", "costura", "chao-de-floresta", "recife"],
    avulsos: ["trilha-origami", "fundo-bosque", "ceu-pipa", "agua-fonte", "clima-petalas"],
  },
  {
    n: 3,
    nome: "Terceiro trimestre",
    semana: 28,
    conjuntos: ["lago", "madrugada", "depois-da-chuva"],
    avulsos: ["fundo-quartinho", "objeto-berco", "objeto-mobile", "clima-bolhas", "ceu-balao-ar"],
  },
  {
    n: 4,
    nome: "Reta final e pós-parto",
    semana: 37,
    conjuntos: ["quintal", "mar", "noite"],
    avulsos: ["trilha-perolas", "objeto-poltrona", "clima-peninhas"],
  },
];

/** A semana da régua depois do parto: tudo aberto. */
export const SEMANA_DEPOIS_DO_PARTO = 99;

/**
 * Cada item Premium das fases → a semana em que abre: a MENOR entre as fases
 * que o trazem (a lua está na Madrugada, do 3º trimestre, e na Noite
 * estrelada, da reta final — abre no 3º, senão a Madrugada não fecharia).
 * Só os Premium: os outros itens dos conjuntos já estão na vitrine comum.
 */
export function semanasDosItens(): Map<string, number> {
  const fora = new Map<string, number>();
  const por = (id: string, semana: number) => {
    const item = CANTINHO_BY_ID[id];
    if (!item?.premium) return;
    const antes = fora.get(id);
    if (antes == null || semana < antes) fora.set(id, semana);
  };
  for (const f of FASES_DA_LOJA) {
    for (const c of f.conjuntos)
      for (const id of CONJUNTO_POR_ID[c]?.itens ?? []) por(id, f.semana);
    for (const id of f.avulsos) por(id, f.semana);
  }
  return fora;
}

export type LinhaDaLoja = { item_id: string; preco: number; semana_minima: number };

/** As linhas de `cantinho_por_fase`: o preço é o do catálogo, a semana é a da fase. */
export function linhasDaTabela(): LinhaDaLoja[] {
  return [...semanasDosItens()]
    .map(([item_id, semana_minima]) => ({
      item_id,
      preco: CANTINHO_BY_ID[item_id]!.price,
      semana_minima,
    }))
    .sort(
      (a, b) =>
        a.semana_minima - b.semana_minima ||
        a.preco - b.preco ||
        a.item_id.localeCompare(b.item_id),
    );
}

export type ConjuntoDaLoja = { conjunto_id: string; nome: string; itens: string[]; bonus: number };

/**
 * Os conjuntos para o bônus pago pelo banco: os itens que ela precisa TER (os
 * de preço zero já são dela desde o início, como no servidor do site) e o
 * bônus da mesma régua (`bonusDoConjunto`), com a mesma chave `conjunto:<id>`.
 */
export function conjuntosDaTabela(): ConjuntoDaLoja[] {
  const ids = new Set(FASES_DA_LOJA.flatMap((f) => f.conjuntos));
  return [...ids].sort().map((id) => {
    const c = CONJUNTO_POR_ID[id]!;
    return {
      conjunto_id: id,
      nome: c.nome,
      itens: c.itens.filter((i) => (CANTINHO_BY_ID[i]?.price ?? 0) > 0),
      bonus: bonusDoConjunto(c),
    };
  });
}

/** A semana da régua da loja: a da gestação, o pós-parto (tudo) ou zero sem data. */
export function semanaDaLoja(o: { semanaDaGestacao: number | null; nasceu: boolean }): number {
  if (o.nasceu) return SEMANA_DEPOIS_DO_PARTO;
  return Math.max(0, o.semanaDaGestacao ?? 0);
}

export type ItemPorFase = { preco: number; semana: number };

/**
 * O que a vitrine mostra de um item da loja por fase: à venda (a fase dela já
 * chegou), a próxima fase com cadeado (o que vem por aí — um motivo para
 * voltar), ou escondido (fases mais à frente não entulham a vitrine).
 */
export function situacaoNaVitrine(
  item: ItemPorFase,
  semanaDela: number,
  semanasDasFases: readonly number[],
): "a-venda" | "em-breve" | "escondido" {
  if (item.semana <= semanaDela) return "a-venda";
  const proxima = semanasDasFases.filter((s) => s > semanaDela).sort((a, b) => a - b)[0];
  return item.semana === proxima ? "em-breve" : "escondido";
}

/** O texto curto do cadeado, pela semana: o trimestre que ela conhece. */
export function quandoAbre(semana: number): string {
  if (semana >= 37) return "Na reta final";
  if (semana >= 28) return "No 3º trimestre";
  if (semana >= 14) return "No 2º trimestre";
  return `Na semana ${semana}`;
}

/** Os itens que exigem troféu ficam fora das fases: a contagem mora só no servidor do site. */
export function exigeTrofeu(id: string): boolean {
  return trofeusExigidos(id) > 0;
}
