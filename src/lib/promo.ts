/**
 * Oferta de boas-vindas — 61% no primeiro ano do Premium, por 2h59.
 *
 * ─── As regras que fazem esta oferta ser honesta ────────────────────────
 *
 * Contador regressivo em tela de preço é, na maioria dos apps, mentira: ele
 * zera e volta na próxima visita, ou reinicia quando a pessoa limpa os dados.
 * Isso tem nome no Código de Defesa do Consumidor e é o tipo de coisa que
 * derruba a reputação de uma clínica junto com a do app. O Clóvis foi
 * explícito: *"isso vai ser de verdade… depois que passar, passou"*. Então:
 *
 * 1. **O relógio nasce no SERVIDOR e mora no banco.** O cliente não escolhe
 *    quando começa nem quanto falta — ele pergunta. Limpar o app, trocar de
 *    celular ou reinstalar não devolve a promoção.
 * 2. **Expirou, acabou.** Não há segunda janela, não há "última chance".
 * 3. **O desconto é aplicado no SERVIDOR**, na hora de criar o checkout, e só
 *    se o servidor concordar que a janela está aberta. O cliente pedir não
 *    basta.
 * 4. **O primeiro ano, e a tela diz isso.** O cupom vale para a primeira
 *    cobrança; a renovação volta ao preço cheio. Esconder isso seria a mesma
 *    mentira, só adiada em doze meses.
 *
 * Este arquivo é só a conta — sem rede, sem banco, sem React. É o que permite
 * testar preço, que é a parte do app que a paciente confere com o extrato do
 * cartão.
 */

/** Quanto dura a janela: 2h59. */
export const JANELA_MS = (2 * 60 + 59) * 60 * 1000;

/** O desconto, em porcentagem inteira. */
export const DESCONTO_PCT = 61;

/** Id do cupom no Stripe — estável, para não criar um cupom por checkout. */
export const CUPOM_ID = `boasvindas${DESCONTO_PCT}`;

/** Preço cheio do plano anual, em CENTAVOS (R$ 9,90 × 12). */
export const ANUAL_CENTAVOS = 11_880;

/**
 * O que a paciente paga no primeiro ano com o desconto.
 *
 * Arredonda no fim, uma vez só, e em centavos — é assim que o Stripe calcula
 * (`percent_off` sobre o total da fatura). Fazer a conta em reais e arredondar
 * depois dá um centavo de diferença em alguns valores, e um centavo de
 * diferença entre a tela e a fatura é uma reclamação.
 */
export function comDesconto(centavos: number, pct = DESCONTO_PCT): number {
  return Math.round((centavos * (100 - pct)) / 100);
}

/** Quanto ela deixa de pagar. */
export function economia(centavos: number, pct = DESCONTO_PCT): number {
  return centavos - comDesconto(centavos, pct);
}

/** "R$ 46,33" */
export function brl(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Quanto falta, em milissegundos, a partir do instante em que a janela abriu.
 *
 * `agora` entra por parâmetro em vez de vir de `Date.now()` para esta conta
 * ser testável — e porque quem manda no relógio é o servidor, não o aparelho
 * dela (adiantar o relógio do celular não estende promoção nenhuma).
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
 * "2:59:00" — o formato do contador.
 *
 * Sempre com dois dígitos em minutos e segundos: sem isso o número muda de
 * LARGURA a cada segundo e o texto ao lado dança na tela.
 */
export function formataRestante(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
