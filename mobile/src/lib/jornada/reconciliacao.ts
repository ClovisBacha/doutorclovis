/**
 * A RECONCILIAÇÃO DA ABA — o que o aparelho e o servidor acertam ao abrir a
 * Jornada, em regras puras (testadas pelo bun; o hook só faz a rede).
 *
 * O aparelho marca primeiro e o servidor paga depois: rede caída no fim de
 * uma atividade deixa a marca sem o recibo. A aba acerta isso ao ganhar foco —
 * para HOJE e para ONTEM, porque o servidor aceita ±1 dia e quem faz a
 * gratidão às 23h40 sem sinal só volta ao app na manhã seguinte.
 */

import type { Atividade } from "~/servidor/economia";
import { D_MINIMO } from "~/lib/jornada/dia";
import { ATIVIDADES, feito, type FlagsDoDia } from "~/lib/jornada/momentos";

/** Os dias que a aba acerta: hoje e ontem (a janela do servidor). */
export function diasDaReconciliacao(D: number): number[] {
  return [D, D - 1].filter((d) => d >= D_MINIMO);
}

/** As atividades marcadas no aparelho que o servidor ainda não registrou. */
export function atividadesSemRecibo(
  flags: FlagsDoDia,
  noServidor: readonly Atividade[],
): Atividade[] {
  return ATIVIDADES.filter((a) => feito(flags, a) && !noServidor.includes(a));
}

/**
 * Se a resposta do bônus já é a palavra final do servidor. Ele paga o bônus
 * conferindo as quatro atividades no ledger: com as quatro lá, um zero quer
 * dizer "já pago" — e não vale perguntar de novo. Com alguma faltando (o
 * pagamento dela falhou agora), o zero é provisório e a próxima abertura
 * pergunta outra vez.
 */
export function bonusResolvido(
  noServidor: readonly Atividade[],
  pagasAgora: readonly Atividade[],
): boolean {
  return ATIVIDADES.every((a) => noServidor.includes(a) || pagasAgora.includes(a));
}
