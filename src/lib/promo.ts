/**
 * Oferta de boas-vindas — 62% no primeiro ano do Premium, para quem nunca assinou.
 *
 * ─── Sobre o que os 61% incidem ─────────────────────────────────────────
 *
 * Sobre o que ela pagaria ASSINANDO MÊS A MÊS durante um ano: R$ 19,90 × 12 =
 * R$ 238,80. Com o desconto, o primeiro ano sai por R$ 89,90 — o equivalente a
 * R$ 7,49 por mês.
 *
 * Isso obriga a tela a fazer uma coisa, e ela faz: **dizer o que é o preço
 * riscado**. O plano anual normal custa R$ 118,80 — riscar R$ 238,80 sem
 * legenda faria parecer que o anual foi inflado para a promoção, que é
 * exatamente o "preço de referência" que o Código de Defesa do Consumidor
 * proíbe. Riscado com a legenda "pagando mês a mês" é comparação verdadeira;
 * riscado sozinho é propaganda enganosa. A letra miúda também diz que a
 * renovação volta para R$ 118,80.
 *
 * ─── Quem tem direito ───────────────────────────────────────────────────
 *
 * Quem nunca assinou o Premium, e só. Sem contador, sem janela de horas.
 *
 * Havia um relógio de 2h59 aqui, com o instante gravado no banco. Ele saiu
 * por decisão do Clóvis, e a decisão é coerente com o rumo: a paciente vai
 * assinar DENTRO do app, e o molde que a loja oferece para "desconto de
 * primeira assinatura" é a oferta introdutória — que vale para quem nunca
 * assinou e **não tem janela por pessoa**. Manter um contador aqui criaria
 * uma promessa que a loja não consegue cumprir depois.
 *
 * O que não mudou: **quem decide é o servidor**. A elegibilidade é conferida
 * de novo na hora de criar o checkout, então uma requisição forjada não
 * compra com desconto. Ver `promo.functions.ts`.
 *
 * ─── Sobre o desconto no Stripe ─────────────────────────────────────────
 *
 * O que o Stripe cobra é o Price do plano anual (R$ 118,80). Para a fatura
 * fechar em R$ 89,90, o cupom desconta um VALOR FIXO (R$ 28,90), não uma
 * porcentagem — porcentagem obrigaria o Stripe a arredondar, e um centavo de
 * diferença entre a tela e a fatura é uma reclamação.
 *
 * Nota de rumo: quando a paciente passar a assinar só DENTRO do app (iOS e
 * Android), quem cobra é a loja, não o Stripe, e este trecho vira histórico —
 * lá o preço vem de uma faixa da Apple/Google e o desconto é uma oferta
 * introdutória ou promocional. Ver `docs/plano-iap.md`.
 *
 * Este arquivo é só a conta. Sem rede, sem banco, sem React.
 */

/**
 * O PREÇO é a fonte da verdade; a porcentagem é derivada dele.
 *
 * Ao contrário do que parece, esta é a ordem que evita mentira. Se a
 * porcentagem fosse a constante e o preço a conta, mudar o preço para um valor
 * "redondo" (R$ 89,90) faria a porcentagem anunciada deixar de bater com o que
 * é cobrado — e ninguém perceberia, porque as duas continuariam sendo números
 * plausíveis na tela.
 */
export const PROMO_CENTAVOS = 8_990;

/** Preço do plano mensal, em centavos. */
export const MENSAL_CENTAVOS = 1_990;

/**
 * A base do desconto: um ano pagando mês a mês.
 *
 * É um preço REAL — é o que ela paga se escolher o plano mensal e ficar doze
 * meses. Por isso pode ser riscado, desde que a tela diga que é isso.
 */
export const REFERENCIA_CENTAVOS = MENSAL_CENTAVOS * 12;

/**
 * O preço de LISTA do plano anual, em centavos.
 *
 * É o que o Stripe cobra fora da promoção, e é para onde a renovação volta
 * depois do primeiro ano. Não é a base do desconto — é a terceira informação
 * que a tela precisa dar para não esconder nada.
 */
export const ANUAL_LISTA_CENTAVOS = 11_880;

/** Arredonda uma vez, no fim, e em centavos. */
export function comDesconto(centavos: number, pct: number): number {
  return Math.round((centavos * (100 - pct)) / 100);
}

/**
 * O desconto ANUNCIADO, em porcentagem inteira — arredondado PARA BAIXO.
 *
 * O desconto real é 62,35%. Anunciar 62% significa que ela paga R$ 89,90 onde
 * o anúncio prometia R$ 90,74: recebe um pouco mais do que foi prometido.
 * Arredondar para cima faria o contrário — anunciar 63% e cobrar mais do que
 * 63% implicam — e aí a propaganda estaria enganando, ainda que por oitenta
 * centavos. `floor` é o único arredondamento seguro num desconto.
 */
export const DESCONTO_PCT = Math.floor((1 - PROMO_CENTAVOS / REFERENCIA_CENTAVOS) * 100);

/**
 * O equivalente mensal do primeiro ano, em centavos.
 *
 * "Equivalente" é literal: R$ 7,49 × 12 = R$ 89,88, dois centavos abaixo dos
 * R$ 89,90 cobrados. A tela diz "equivale a", nunca "×12" — porque multiplicar
 * de volta não fecha, e quem faz essa conta merece encontrar o texto certo.
 */
export const PROMO_MENSAL_CENTAVOS = Math.round(PROMO_CENTAVOS / 12);

/**
 * Cupom no Stripe — id estável, para não criar um cupom por checkout.
 *
 * O preço entra no id de propósito. Um cupom no Stripe é IMUTÁVEL: mudar o
 * valor não altera o que já existe lá. Com o id amarrado ao preço, mexer no
 * preço cria um cupom novo em vez de continuar aplicando o antigo em silêncio
 * — que é o defeito que só aparece na fatura de alguém.
 */
export const CUPOM_ID = `boasvindas-${PROMO_CENTAVOS}`;

/** Quanto ela deixa de pagar, comparado a assinar mês a mês por um ano. */
export const ECONOMIA_CENTAVOS = REFERENCIA_CENTAVOS - PROMO_CENTAVOS;

/**
 * Quanto o cupom do Stripe tem de abater do preço de lista, em centavos.
 *
 * Positivo por construção — se algum dia o preço promocional passar do de
 * lista, isto vira 0 e o checkout segue sem desconto em vez de cobrar mais
 * caro do que o normal.
 */
export const ABATIMENTO_CENTAVOS = Math.max(0, ANUAL_LISTA_CENTAVOS - PROMO_CENTAVOS);

/** "R$ 89,90" */
export function brl(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}
