/**
 * Os preços do Premium da paciente, e o cupom do médico — só a conta.
 *
 * ─── O QUE MUDOU EM AGO/2026 ────────────────────────────────────────────────
 *
 * Antes existiam DOIS descontos e nenhum deles vinha do médico:
 *
 *  · o plano anual (R$ 118,80) contra o mensal;
 *  · uma oferta de boas-vindas automática, 62% no primeiro ano, para quem
 *    nunca tinha assinado — e o médico, em paralelo, dava Premium DE GRAÇA
 *    para um punhado de pacientes por mês.
 *
 * Decisão do dono: o médico **não dá mais Premium de graça** — ele dá um cupom
 * de desconto. E a oferta de boas-vindas foi **aposentada**, porque com o anual
 * a R$ 109,90 ela entregava quase exatamente o mesmo que o cupom (R$ 89,90
 * contra R$ 87,92): manter as duas faria o cupom do médico não valer nada, e
 * empilhá-las levaria a assinatura a R$ 71,92 — 30% do que uma paciente de doze
 * meses no mensal vale.
 *
 * Com uma só, o cupom passa a dar algo que ninguém mais tem, e é isso que dá ao
 * médico um motivo concreto para distribuí-lo.
 *
 * ─── A ORDEM QUE EVITA MENTIRA ──────────────────────────────────────────────
 *
 * O PREÇO é a fonte da verdade; a porcentagem é DERIVADA dele. Se a
 * porcentagem fosse a constante e o preço a conta, mudar o preço para um valor
 * redondo faria a porcentagem anunciada deixar de bater com o que é cobrado — e
 * ninguém perceberia, porque as duas continuariam sendo números plausíveis.
 *
 * Este arquivo é só a conta. Sem rede, sem banco, sem React.
 */

/** Plano mensal, em centavos. */
export const MENSAL_CENTAVOS = 1_990;

/**
 * Plano anual, em centavos — cobrado DE UMA VEZ.
 *
 * Era R$ 118,80 (doze parcelas figuradas de R$ 9,90). Passou a R$ 109,90 por
 * decisão do dono, com o número redondo escolhido primeiro e a porcentagem
 * calculada depois — que é a ordem descrita acima.
 */
export const ANUAL_CENTAVOS = 10_990;

/**
 * A base de comparação: um ano pagando mês a mês.
 *
 * É um preço REAL — é o que ela paga se escolher o mensal e ficar doze meses.
 * Por isso pode ser riscado na tela, desde que a tela diga que é isso. Riscar
 * um número que ninguém cobra é o "preço de referência" que o Código de Defesa
 * do Consumidor proíbe.
 */
export const REFERENCIA_CENTAVOS = MENSAL_CENTAVOS * 12;

/** Desconto que o médico pode dar, em porcentagem inteira. */
export const CUPOM_MEDICO_PCT = 20;

/** Arredonda uma vez, no fim, e em centavos. */
export function comDesconto(centavos: number, pct: number): number {
  return Math.round((centavos * (100 - pct)) / 100);
}

/**
 * Desconto ANUNCIADO, em porcentagem inteira — arredondado PARA BAIXO.
 *
 * ─── POR QUE `floor`, E POR QUE ISSO IMPORTA AQUI ─────────────────────────
 *
 * O desconto real do anual é 53,98%. A tentação é anunciar 54%, que é o
 * arredondamento normal — e é exatamente o erro que esta função existe para
 * impedir:
 *
 *   · anunciando 54%, a promessa é R$ 238,80 × 0,46 = R$ 109,85. Ela paga
 *     R$ 109,90 — CINCO CENTAVOS A MAIS do que o anúncio prometeu.
 *   · anunciando 53%, a promessa é R$ 112,24. Ela paga R$ 109,90 — menos do
 *     que foi prometido.
 *
 * São cinco centavos, e é a diferença entre uma propaganda verdadeira e uma
 * enganosa. `floor` é o único arredondamento seguro num desconto.
 */
export function descontoPct(precoFinal: number, referencia = REFERENCIA_CENTAVOS): number {
  return Math.floor((1 - precoFinal / referencia) * 100);
}

/** Anual sem cupom, contra pagar mês a mês: 53%. */
export const DESCONTO_ANUAL_PCT = descontoPct(ANUAL_CENTAVOS);

/** Anual COM o cupom do médico, contra pagar mês a mês: 63%. */
export const DESCONTO_ANUAL_COM_CUPOM_PCT = descontoPct(
  comDesconto(ANUAL_CENTAVOS, CUPOM_MEDICO_PCT),
);

/**
 * O equivalente mensal do anual, em centavos.
 *
 * "Equivalente" é literal, e a palavra é obrigatória na tela: R$ 9,16 × 12 =
 * R$ 109,92, dois centavos ACIMA do que é cobrado. A tela diz "equivale a",
 * nunca "12×" — porque multiplicar de volta não fecha, e quem faz essa conta
 * merece encontrar o texto certo em vez de um erro.
 *
 * E, por decisão do dono, este número NUNCA aparece como preço: ele existe só
 * dentro da comparação, ao lado do que ela pagaria mês a mês e da porcentagem.
 * O que sai do cartão dela é `ANUAL_CENTAVOS`, de uma vez.
 */
export const ANUAL_MENSAL_EQUIV_CENTAVOS = Math.round(ANUAL_CENTAVOS / 12);

/** Quanto ela economiza escolhendo o anual, em centavos. */
export const ECONOMIA_ANUAL_CENTAVOS = REFERENCIA_CENTAVOS - ANUAL_CENTAVOS;

/**
 * O id do cupom do médico no Stripe.
 *
 * Carrega a porcentagem no nome de propósito: mudar `CUPOM_MEDICO_PCT` sem
 * mudar o id faria o Stripe reaproveitar o cupom ANTIGO, e a tela passaria a
 * prometer um desconto que a fatura não daria. Com a porcentagem no id, um
 * valor novo cria um cupom novo.
 */
export const CUPOM_MEDICO_ID = `medico-${CUPOM_MEDICO_PCT}pct`;

/**
 * Os quatro preços que a paciente pode ver, em centavos.
 *
 * Juntos num objeto só porque a tela precisa dos quatro ao mesmo tempo para
 * montar a comparação, e buscá-los em quatro lugares diferentes é como duas
 * telas passam a discordar sobre o mesmo preço.
 */
export const PRECOS_PREMIUM = {
  mensal: MENSAL_CENTAVOS,
  mensalComCupom: comDesconto(MENSAL_CENTAVOS, CUPOM_MEDICO_PCT),
  anual: ANUAL_CENTAVOS,
  anualComCupom: comDesconto(ANUAL_CENTAVOS, CUPOM_MEDICO_PCT),
} as const;

/** Centavos → "R$ 19,90". */
export function brl(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}
