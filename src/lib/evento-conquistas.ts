/**
 * QUANTAS CONQUISTAS ESTÃO COM PRÊMIO ESPERANDO O TOQUE.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * O prêmio da conquista deixou de cair sozinho e passou a depender do toque
 * dela (`resgatarConquista`, pedido do dono: "como o Duolingo faz"). Só que no
 * Duolingo o que faz a pessoa IR até lá é o emblema — o numerozinho que diz
 * "tem coisa para você aqui".
 *
 * Sem ele, a mudança tem um custo silencioso: quem não abrir Recompensas →
 * Conquistas por conta própria fica com as Sementinhas paradas e sem saber que
 * existem. Antes elas caíam sozinhas; agora ficam esperando alguém que não foi
 * avisado. Trocar "recebe sem saber" por "não recebe e não sabe" é pior que o
 * ponto de partida.
 *
 * ─── POR QUE UM EVENTO, E NÃO UMA PROP ──────────────────────────────────────
 *
 * Quem SABE o número é `checkAndAwardAchievements`, chamada de vários pontos do
 * app (registrar pressão, abrir a aba, fechar o dia). Quem PRECISA do número é a
 * fita de sub-abas de Recompensas, noutro ramo da árvore. Uma prop atravessando
 * os dois seria uma cadeia de assinaturas novas — e uma delas seria esquecida no
 * próximo bloco, como já aconteceu com o recado das Sementinhas.
 *
 * É o mesmo desenho de `evento-sementinhas.ts`, e pelo mesmo motivo: arquivo
 * próprio, sem imports, para não puxar módulo nenhum para dentro do pacote de
 * quem só quer ouvir.
 *
 * ⚠️ `null` NÃO É ZERO. Quando o servidor não consegue ler o que já foi pago,
 * o app não sabe quantas estão por resgatar — e nesse caso não mostra emblema
 * nenhum, em vez de mostrar "0" (que afirmaria uma coisa falsa) ou o total (que
 * prometeria moeda que o servidor, com razão, não vai dar). É a mesma régua de
 * `semSaberPagas` na tela.
 */

export const EVENTO_CONQUISTAS_A_RESGATAR = "dc-conquistas-a-resgatar";

/** Anuncia quantas conquistas têm prêmio esperando. `null` = não sei. */
export function publicarConquistasAResgatar(quantas: number | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENTO_CONQUISTAS_A_RESGATAR, { detail: quantas }));
}

/** Ouve o número. Devolve a função de desinscrever, para o `useEffect`. */
export function ouvirConquistasAResgatar(aoMudar: (quantas: number | null) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const ouvinte = (e: Event) => {
    const v = (e as CustomEvent).detail;
    aoMudar(typeof v === "number" ? v : null);
  };
  window.addEventListener(EVENTO_CONQUISTAS_A_RESGATAR, ouvinte);
  return () => window.removeEventListener(EVENTO_CONQUISTAS_A_RESGATAR, ouvinte);
}
