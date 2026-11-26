/**
 * As recompensas que o app ESCREVE na tela e que moram em arquivos de servidor
 * do site (`*.functions.ts`, que o app não importa: trariam o banco junto).
 *
 * Número de recompensa copiado é número que diverge em silêncio — a tela
 * promete 100 e o servidor paga outra coisa. Por isso a catraca
 * `recompensas.test.ts` confere cada um contra o fonte do site.
 */

/** Indicar uma amiga que cria a conta (`REFERRAL_REWARD`, referral.functions.ts). */
export const RECOMPENSA_DA_INDICACAO = 100;

/** Depoimento aprovado pelo médico (`reviewTestimonial`, testimonials.functions.ts). */
export const RECOMPENSA_DO_DEPOIMENTO = 100;
