/**
 * A LISTA DE PRESENTES — tipos e régua de apresentação.
 *
 * ─── A DECISÃO DE ARQUITETURA QUE VEM ANTES DE TUDO ────────────────────────
 *
 * As cinco coisas aprovadas pelo dono não são cinco recursos. São **um objeto e
 * quatro propriedades dele**:
 *
 *   · fraldas por tamanho = um TIPO de item (`tipo: "fralda"`, com `tamanho`)
 *   · cotas               = um TIPO de item (`tipo: "cota"`, com `centavosTotal`)
 *   · áudio               = um campo da RESERVA, não do item
 *   · agradecimento       = uma LEITURA das reservas
 *   · agendamento         = um campo da RESERVA (`revelarEm`)
 *
 * Construídas como cinco recursos, viram cinco tabelas, cinco telas e cinco
 * portas na Comunidade — e a paciente teria de entender cinco coisas para usar
 * uma. Construídas como um objeto, são três tabelas e uma página pública por
 * token, no molde exato de `/album/$token`.
 */

import type { TamanhoFralda } from "@/lib/fraldas";

export type TipoDeItem = "item" | "fralda" | "cota";

export type ItemDaLista = {
  id: string;
  tipo: TipoDeItem;
  titulo: string;
  nota: string | null;
  ordem: number;
  /** Só em `tipo: "fralda"`. */
  tamanho: TamanhoFralda | null;
  /** Meta em UNIDADES do tipo: item→peças, fralda→PACOTES, cota→cotas. */
  meta: number;
  /** Acima disto o servidor recusa. `null` = sem teto. */
  teto: number | null;
  /** Só em `tipo: "cota"`. */
  centavosTotal: number | null;
  /** SOMA das reservas vivas. Nunca uma coluna — ver o cabeçalho do SQL. */
  reservado: number;
};

/** O que a página PÚBLICA vê de uma reserva. */
export type ReservaPublica = {
  id: string;
  itemId: string;
  quantidade: number;
  /**
   * ⚠️ `null` na página pública, preenchido só para a DONA.
   *
   * A amiga precisa saber que o item está reservado — não POR QUEM. Quem deu é
   * surpresa, e revelar cria comparação entre as convidadas ("a Fulana deu o
   * carrinho e eu dei fralda"), que é exatamente o constrangimento que a lista
   * não pode produzir.
   */
  quemNome: string | null;
  recado: string | null;
  temAudio: boolean;
  revelarEm: string | null;
  agradecidaEm: string | null;
  criadaEm: string;
};

/** Um item está fechado quando alcançou a meta (ou o teto) e não aceita mais. */
export function ehItemFechado(i: Pick<ItemDaLista, "meta" | "teto" | "reservado">): boolean {
  const limite = i.teto ?? i.meta;
  return i.reservado >= limite;
}

/**
 * A ordem da página pública.
 *
 * ⚠️ **O que está FECHADO vai para o fim — e NUNCA some.** A amiga precisa ver
 * o que já foi dado para não repetir, mas não deve tropeçar nisso antes de ver
 * o que ainda cabe.
 *
 * É o INVERSO da regra de `conjuntos.ts`, onde o completo vem primeiro — e a
 * diferença não é gosto: lá o conjunto completo é RECONHECIMENTO (a paciente
 * montou uma cena bonita e merece vê-la), aqui a lista é uma FILA DE TRABALHO
 * (a amiga veio escolher o que dar). As duas regras são opostas pela mesma
 * razão: o que a tela existe para fazer sobe.
 */
export function ordemDaListaPublica(itens: ItemDaLista[]): ItemDaLista[] {
  return [...itens].sort((a, b) => {
    const fa = ehItemFechado(a) ? 1 : 0;
    const fb = ehItemFechado(b) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    return a.ordem - b.ordem;
  });
}

/** Quanto da lista já foi prometido — para a barra do topo. */
export function progressoDaLista(itens: ItemDaLista[]): {
  itens: number;
  fechados: number;
  fracao: number;
} {
  const total = itens.length;
  const fechados = itens.filter(ehItemFechado).length;
  return { itens: total, fechados, fracao: total > 0 ? fechados / total : 0 };
}

/** Limite do nome de quem dá. Cabe "Maria Fernanda de Oliveira" com folga. */
export const LIMITE_DO_NOME = 60;

/**
 * O nome de quem deu, vindo de um terceiro SEM CONTA.
 *
 * ⚠️ É texto livre de alguém que não fez login, e ele vai para uma tela que a
 * paciente lê e para um texto de agradecimento que ela envia. Corta `<`, `>` e
 * caracteres de controle, e nunca é renderizado como HTML.
 *
 * ⚠️ Vazio depois da limpeza vira "Alguém", nunca string vazia — sem isso o
 * agradecimento sairia "Obrigada, !" e a lista mostraria uma linha sem dono.
 */
export function sanitizarNomeDeQuemDeu(bruto: string | null | undefined): string {
  const limpo = (bruto ?? "")
    /* ⚠️ Escrito em `\u`, e a faixa é de CONTROLE — não uma faixa literal.
       A primeira versão saiu com o intervalo do espaço até o `<`, que engoliria
       dígitos, vírgula, hífen e apóstrofo: "Ana D'Ávila 2" viraria "AnaDÁvila".
       Um sanitizador que estraga o nome é pior que nenhum — o estrago aparece
       na tela dela e ninguém sabe de onde veio. */
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITE_DO_NOME);
  return limpo || "Alguém";
}

/**
 * O convite que a paciente manda.
 *
 * ⚠️ Nenhuma palavra de pressa, e há teste. Um convite que diz "faltam 8 itens,
 * corre!" transforma a rede dela numa lista de devedores — e a rede de uma
 * gestante de alto risco é justamente a coisa que este app existe para
 * fortalecer, não para cobrar.
 */
export function textoDoConvite(opts: { bebeNome?: string | null; url: string }): string {
  const quem = opts.bebeNome ? ` do ${opts.bebeNome}` : "";
  return `Oi! Montei a lista de presentes${quem} aqui: ${opts.url}\n\nSe quiser dar alguma coisa, é só escolher — e dá para deixar um recado em áudio pra gente ouvir junto. 💛`;
}
