/**
 * Manter a tela acesa durante uma atividade guiada.
 *
 * Três telas do app dependem disso e nenhuma pedia:
 *
 * · **Meditação** — dez minutos, e a tela diz "com a voz você pode fechar os
 *   olhos". O celular bloqueia em uns trinta segundos, o `setTimeout` do ciclo
 *   é suspenso e o áudio para. A paciente fecha os olhos como pedimos e a
 *   sessão morre sozinha.
 * · **Respiração** — setenta segundos de olhos fechados, mesmo problema em
 *   escala menor.
 * · **Contador de chutes** — até duas horas. É o caso mais duro: ela fica
 *   esperando o bebê se mexer, sem tocar no aparelho.
 *
 * A Screen Wake Lock API existe no Chrome/Android e no Safari 16.4+. Onde não
 * existe, isto é no-op silencioso — nunca lança, nunca quebra a tela.
 *
 * Detalhe que só aparece em uso real: o sistema SOLTA o bloqueio sozinho
 * quando a aba vai para segundo plano. Voltar não o restaura — por isso o
 * `visibilitychange` repede. Sem isso, a paciente que atende uma mensagem no
 * meio da meditação volta e perde a tela em trinta segundos.
 */

type Sentinel = { released: boolean; release: () => Promise<void> };

/**
 * Pede a tela acesa e devolve a função que a solta.
 *
 * Chame a função devolvida no fim da atividade — sempre, inclusive na saída
 * por erro. Segurar o bloqueio depois que a atividade acabou come bateria e é
 * o tipo de coisa que ninguém percebe até a paciente reclamar do aparelho.
 */
export function manterTelaAcesa(): () => void {
  if (typeof navigator === "undefined") return () => {};
  const wl = (
    navigator as unknown as {
      wakeLock?: { request: (t: "screen") => Promise<Sentinel> };
    }
  ).wakeLock;
  if (!wl?.request) return () => {};

  let sentinela: Sentinel | null = null;
  let solto = false;

  const pedir = async () => {
    /* `!sentinela.released` é a metade que faltava, e sem ela este arquivo
       inteiro não fazia nada além do primeiro pedido.

       Quando o sistema solta o bloqueio sozinho — aba para segundo plano, a
       paciente atende uma mensagem — a sentinela CONTINUA preenchida, só com
       `released: true`. A guarda original (`if (solto || sentinela) return`)
       via um objeto ali e saía na primeira linha, então o `visibilitychange`
       chamava `pedir()` e não pedia nada. Quatro telas achavam que tinham a
       tela acesa e tinham só o primeiro pedido; a respiração escapava por
       acidente, porque o efeito dela depende de `phase` e refaz o pedido a
       cada fase. */
    if (solto || (sentinela && !sentinela.released)) return;
    try {
      sentinela = await wl.request("screen");
    } catch {
      /* Negado (aba em segundo plano, bateria fraca): segue sem. */
    }
  };

  const aoVoltar = () => {
    if (document.visibilityState === "visible") void pedir();
  };

  void pedir();
  document.addEventListener("visibilitychange", aoVoltar);

  return () => {
    solto = true;
    document.removeEventListener("visibilitychange", aoVoltar);
    const s = sentinela;
    sentinela = null;
    if (s && !s.released) void s.release().catch(() => {});
  };
}
