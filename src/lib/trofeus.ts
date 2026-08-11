/**
 * TROFÉUS — um por dia de cinco estrelas.
 *
 * ─── O QUE ERA, E POR QUE MUDOU ─────────────────────────────────────────────
 *
 * O troféu roxo do topo mostrava `stickers.length`: as figurinhas de ÁLBUM DA
 * SEMANA. O dono olhou e disse a coisa certa — "tenho três conquistas e ele
 * marca oito, não tem significado nenhum". E não tinha mesmo: figurinha de
 * semana e troféu são coisas diferentes, e o mesmo desenho contando as duas só
 * ensinava a ignorar o número.
 *
 * Agora o troféu conta o que o desenho promete: **dias em que ela fechou as
 * cinco estrelas**.
 *
 * ─── A FONTE É O LEDGER, E ISSO NÃO É DETALHE ───────────────────────────────
 *
 * Não é `doneDays.length`. `doneDays` mora no `localStorage` e sobe no blob do
 * `journey_state` — quem escreve é o navegador, e ele desbloquearia itens da
 * loja. A fonte é a linha `day_stars:<ciclo>:<dia>` que `grantDayStarsBonus`
 * grava **depois de o próprio ledger confirmar as cinco atividades**. Uma linha
 * por dia fechado, escrita só pelo servidor, e que já existia.
 *
 * Por isso o número não zera ao trocar de aparelho, e por isso ele pode
 * destrancar item pago sem virar porta dos fundos.
 */

/** O prefixo da chave que `grantDayStarsBonus` grava. Um troféu por linha. */
export const PREFIXO_TROFEU = "day_stars:";

/**
 * OS ITENS QUE SÓ ABREM COM TROFÉU.
 *
 * Escolhidos pelo dono, e a escada segue o preço deles: o mais barato pede
 * menos. Troféu não substitui a Sementinha — ela continua pagando o item. O
 * troféu diz QUANDO a prateleira aparece, e é isso que o transforma num motivo
 * para voltar amanhã em vez de um número enfeitando o topo da tela.
 *
 * Dez dias completos é cerca de duas semanas de uso real (ninguém fecha os
 * cinco todo santo dia), o que põe o primeiro desbloqueio perto do momento em
 * que a loja grátis acaba — que é exatamente onde a economia precisa de um
 * novo horizonte.
 */
export const TROFEUS_PARA: Readonly<Record<string, number>> = {
  /** Borboleta — 74 🌱, o mais barato dos três. */
  "bicho-borboleta": 10,
  /** Fim de tarde no deserto — 240 🌱. */
  "fundo-deserto": 20,
  /** Bolinhas Coração — 400 🌱, o mais caro. */
  "trilha-coracao": 30,
};

/** Quantos troféus o item exige. `0` = não exige nenhum. */
export function trofeusExigidos(itemId: string): number {
  return TROFEUS_PARA[itemId] ?? 0;
}

/**
 * Quantos FALTAM. Zero quer dizer liberado — inclusive para item sem exigência.
 *
 * Devolver o que falta, e não só um booleano, é o que deixa a loja dizer
 * "faltam 4 troféus" em vez de "bloqueado". A segunda frase não dá o que fazer
 * a seguir, e é ela que faz a paciente achar que o item é pago em dinheiro.
 */
export function faltamTrofeus(itemId: string, trofeus: number): number {
  return Math.max(0, trofeusExigidos(itemId) - Math.max(0, Math.floor(trofeus || 0)));
}

export function itemLiberado(itemId: string, trofeus: number): boolean {
  return faltamTrofeus(itemId, trofeus) === 0;
}

/**
 * Os três, em ordem de escada — para a loja e a tela de troféus listarem sem
 * reordenar por conta própria.
 */
export function escadaDeTrofeus(): { itemId: string; trofeus: number }[] {
  return Object.entries(TROFEUS_PARA)
    .map(([itemId, trofeus]) => ({ itemId, trofeus }))
    .sort((a, b) => a.trofeus - b.trofeus);
}

/**
 * O PRÓXIMO DESBLOQUEIO — o que a tela do troféu mostra como horizonte.
 *
 * `null` quando ela já passou dos três. Nesse dia o número vira só placar, e
 * está tudo bem: inventar uma quarta meta que não existe seria pior.
 */
export function proximoDesbloqueio(trofeus: number): { itemId: string; trofeus: number } | null {
  return escadaDeTrofeus().find((d) => d.trofeus > trofeus) ?? null;
}
