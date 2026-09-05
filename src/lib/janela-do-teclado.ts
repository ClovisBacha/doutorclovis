/**
 * A JANELA QUE SOBRA QUANDO O TECLADO SOBE.
 *
 * O `visualViewport` é a única coisa que sabe quanto de tela restou depois de
 * o teclado do celular abrir — `100vh`, `100dvh` e `vh` em geral continuam
 * medindo a tela INTEIRA. Uma caixa de chat dimensionada em `vh` encolhe
 * proporcionalmente junto com nada: ela fica do mesmo tamanho e some por baixo
 * do teclado, ou (quando o navegador reporta a janela menor) encolhe a 55% de
 * uma tela que já é metade.
 *
 * ⚠️ **NO IPHONE O TECLADO NÃO MEXE EM `innerHeight` — só no
 * `visualViewport`.** É por isso que `55vh` não encolhe: a caixa continua com
 * os mesmos 469px de uma tela de 852, e metade dela fica ATRÁS do teclado.
 * Medido com o `visualViewport` forjado em 500 (o teclado do iPhone come
 * ~350px): a caixa de 469 não cabe nos 500 visíveis junto com mais nada, o
 * navegador rola a página para trazer o campo à vista, e o que sobra da
 * conversa é uma faixa. Com a régua: caixa **469 → 380**, lista **305 → 216**,
 * e o conjunto cabe inteiro na janela visível.
 *
 * ⚠️ **A RÉGUA MORA AQUI PORQUE JÁ HAVIA DOIS CHATS.** O Chat IA resolveu isso
 * com o estado e os dois ouvintes escritos DENTRO do componente; a
 * Nutricionista Virtual, que a paciente abre na MESMA tela trocando de aba,
 * ficou com a caixa de `55vh`. Uma segunda cópia da medição divergiria da
 * primeira no próximo ajuste, e a divergência apareceria como um dos dois
 * chats voltando a se esconder.
 *
 * ⚠️ **E ISTO NÃO É O CASO DA TELA PEQUENA.** Medido a 393×500 (celular
 * deitado, ou uma janela pequena no computador), a lista cai para **111px** —
 * e ali `visualViewport` bate com a tela, então esta régua NÃO age de
 * propósito: numa tela que é pequena de verdade, repartir 55% dela é uma
 * decisão de desenho, não um defeito. Confundir os dois casos foi o primeiro
 * diagnóstico desta correção, e ele consertava um e media o outro.
 */
import { useEffect, useState } from "react";

export type JanelaVisivel = {
  h: number;
  top: number;
  /** A tela INTEIRA no mesmo instante — é contra ela que se sabe se o teclado
      subiu. ⚠️ Vem daqui, e nunca de `window.innerHeight` lido no render: o
      servidor não tem `window`, e ler capacidade do navegador dentro do JSX é
      a divergência de hidratação que já deixou este app sem abrir. */
  tela: number;
};

/** Altura mínima que a caixa do chat nunca desce, mesmo com o teclado aberto. */
export const PISO_DA_CAIXA = 260;

/**
 * A altura da caixa de conversa que fica no FLUXO da página (o caso da
 * Nutrição, que tem o cartão de nutrientes acima dela).
 *
 * ⚠️ Em repouso devolve `null` — a caixa fica com a altura em `vh` que o CSS
 * já dá, e o desenho de todo dia não muda uma linha. Só com o teclado aberto
 * ela passa a valer o que SOBRA, e não uma fração de uma tela que encolheu.
 *
 * @param janela  o `visualViewport` medido, ou `null` no computador
 * @param reserva quanto do que sobra fica para o que não é a conversa
 */
export function alturaNoFluxo(janela: JanelaVisivel | null, reserva = 120): number | null {
  if (!janela) return null;
  const tela = janela.tela;
  /* Sem teclado o `visualViewport` bate com a tela — e aí não há o que
     corrigir. A folga de 40px cobre a barra do navegador aparecendo e
     sumindo, que não é teclado. */
  if (janela.h >= tela - 40) return null;
  return Math.max(PISO_DA_CAIXA, Math.round(janela.h - reserva));
}

/** Mede o `visualViewport` no celular; devolve `null` no computador. */
export function useJanelaDoTeclado(): JanelaVisivel | null {
  const [janela, setJanela] = useState<JanelaVisivel | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const celular = () => window.matchMedia("(max-width: 767px)").matches;
    const medir = () => {
      if (!celular() || !vv) {
        setJanela(null);
        return;
      }
      setJanela({
        h: Math.round(vv.height),
        top: Math.round(vv.offsetTop),
        tela: window.innerHeight,
      });
    };
    medir();
    vv?.addEventListener("resize", medir);
    vv?.addEventListener("scroll", medir);
    window.addEventListener("resize", medir);
    return () => {
      vv?.removeEventListener("resize", medir);
      vv?.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, []);
  return janela;
}
