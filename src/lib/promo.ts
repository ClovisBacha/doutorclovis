/**
 * Oferta de boas-vindas — 61% no primeiro ano do Premium, por 2h59.
 *
 * ─── Sobre o que os 61% incidem ─────────────────────────────────────────
 *
 * Sobre o que ela pagaria ASSINANDO MÊS A MÊS durante um ano: R$ 19,90 × 12 =
 * R$ 238,80. Com o desconto, o primeiro ano sai por R$ 93,13.
 *
 * Isso obriga a tela a fazer uma coisa, e ela faz: **dizer o que é o preço
 * riscado**. O plano anual normal custa R$ 118,80 — riscar R$ 238,80 sem
 * legenda faria parecer que o anual foi inflado para a promoção, que é
 * exatamente o "preço de referência" que o Código de Defesa do Consumidor
 * proíbe. Riscado com a legenda "pagando mês a mês" é comparação verdadeira;
 * riscado sozinho é propaganda enganosa. A letra miúda também diz que a
 * renovação volta para R$ 118,80.
 *
 * ─── Sobre o relógio ────────────────────────────────────────────────────
 *
 * Contador em tela de preço é, na maioria dos apps, mentira: zera e volta na
 * próxima visita, ou reinicia quando a pessoa limpa os dados. O Clóvis foi
 * explícito: *"isso vai ser de verdade… depois que passar, passou"*. Então:
 *
 * 1. O relógio nasce no SERVIDOR e mora no banco. Limpar o app, trocar de
 *    celular ou reinstalar não devolve a promoção.
 * 2. Expirou, acabou. Não há segunda janela.
 * 3. O desconto é aplicado no SERVIDOR, e só se o servidor concordar que a
 *    janela está aberta. O cliente pedir não basta.
 *
 * ─── Sobre o desconto no Stripe ─────────────────────────────────────────
 *
 * O que o Stripe cobra é o Price do plano anual (R$ 118,80). Para a fatura
 * fechar em R$ 93,13, o cupom desconta um VALOR FIXO (R$ 25,67), não uma
 * porcentagem: 21,61% sobre 11.880 centavos daria 2.567,268, e quem arredonda
 * isso é o Stripe, não este arquivo. Um centavo de diferença entre a tela e a
 * fatura é uma reclamação — e com valor fixo não existe arredondamento.
 *
 * Este arquivo é só a conta. Sem rede, sem banco, sem React.
 */

/** Quanto dura a janela: 2h59. */
export const JANELA_MS = (2 * 60 + 59) * 60 * 1000;

/** O desconto anunciado, em porcentagem inteira. */
export const DESCONTO_PCT = 61;

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

/** Cupom no Stripe — id estável, para não criar um cupom por checkout. */
export const CUPOM_ID = `boasvindas${DESCONTO_PCT}`;

/** Arredonda uma vez, no fim, e em centavos. */
export function comDesconto(centavos: number, pct = DESCONTO_PCT): number {
  return Math.round((centavos * (100 - pct)) / 100);
}

/** O que ela paga no primeiro ano. */
export const PROMO_CENTAVOS = comDesconto(REFERENCIA_CENTAVOS);

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

/** "R$ 93,13" */
export function brl(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Quanto falta, em milissegundos, a partir do instante em que a janela abriu.
 *
 * `agora` entra por parâmetro para esta conta ser testável — e porque quem
 * manda no relógio é o servidor, não o aparelho dela.
 */
export function restanteMs(abertaEm: number, agora: number, janela = JANELA_MS): number {
  if (!Number.isFinite(abertaEm) || !Number.isFinite(agora)) return 0;
  return Math.max(0, abertaEm + janela - agora);
}

/** A janela ainda está aberta? */
export function estaAberta(abertaEm: number, agora: number, janela = JANELA_MS): boolean {
  return restanteMs(abertaEm, agora, janela) > 0;
}

/**
 * "2:59:00" — sempre com dois dígitos em minutos e segundos, senão o número
 * muda de LARGURA a cada segundo e o texto ao lado dança na tela.
 */
export function formataRestante(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
