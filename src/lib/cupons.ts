/**
 * Leitura dos resgates de cupom — a parte que decide se a campanha funcionou.
 *
 * Mora fora do componente porque é a única conta da tela que o dono usa para
 * tomar decisão (repetir a campanha, ou não), e conta assim se testa.
 */

/** Margem entre resgatar e "ter voltado": um dia inteiro. */
export const MARGEM_VOLTOU_MS = 24 * 3600 * 1000;

/**
 * A pessoa voltou ao app depois de resgatar o cupom?
 *
 * `ultimoAcesso` é o `last_sign_in_at` do Supabase. No login em que o cupom foi
 * aplicado os dois carimbos são praticamente o mesmo instante — por isso a
 * margem de 24h, que separa "voltou outro dia" de "resgatou e fechou o app".
 *
 * Cuidado ao ler o `false`: o carimbo só se move num login NOVO, e a sessão do
 * app se renova sozinha por semanas. `true` prova que voltou; `false` não prova
 * que não voltou. A tela diz isso em português para o dono não ler ao contrário.
 */
export function voltouDepoisDoResgate(
  resgatadoEm: string,
  ultimoAcesso: string | null | undefined,
): boolean {
  if (!ultimoAcesso) return false;
  const fim = new Date(ultimoAcesso).getTime();
  const ini = new Date(resgatadoEm).getTime();
  // Data inválida vira NaN, e toda comparação com NaN é falsa — o `false` sai
  // de graça, mas explicitar evita que alguém "conserte" isso com um `!`.
  if (Number.isNaN(fim) || Number.isNaN(ini)) return false;
  return fim - ini > MARGEM_VOLTOU_MS;
}
