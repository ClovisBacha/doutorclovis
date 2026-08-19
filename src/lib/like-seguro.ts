/**
 * ESCAPAR O QUE VAI DENTRO DE UM `LIKE`/`ILIKE`.
 *
 * ⚠️ **`%` e `_` são CURINGAS, e o PostgREST não os escapa por você.** Um valor
 * do usuário colado num padrão `ilike` deixa de ser um valor e vira um padrão:
 * `_` casa qualquer caractere e `%` casa qualquer sequência.
 *
 * Este repo já pagou por isso uma vez e consertou num lugar só — o comentário
 * está em `appointments.functions.ts`: *"uma conta `maria_jose@` leria as
 * consultas de `maria.jose@`"*. O conserto ficou inline, e três chamadas novas
 * de afiliada nasceram sem ele:
 *
 *  · `criadoraDaSessao` e `meuPainelDeInfluenciadora` — o painel de faturamento,
 *    o código e a lista de até 200 indicadas de uma criadora abriam para quem
 *    tivesse um e-mail que CASASSE por curinga (underscore é caractere legal no
 *    local-part e o Hotmail o aceita);
 *  · `criadoraDaSessao` do desafio — a mesma coisa, com poder de escrita.
 *
 * Por isso virou função, e por isso ela tem teste: escape que mora inline é
 * escape que a quarta chamada esquece.
 *
 * ⚠️ **A barra invertida entra na lista**, e ela vem primeiro: é o caractere de
 * escape do próprio `LIKE`, e escapá-lo depois de `%`/`_` escaparia as barras
 * que acabaram de ser inseridas.
 */
export function paraLike(valor: string): string {
  return valor.replace(/([\\%_])/g, "\\$1");
}

/** O mesmo, embrulhado em `%…%` para busca por trecho. */
export function trechoParaLike(valor: string): string {
  return `%${paraLike(valor)}%`;
}
