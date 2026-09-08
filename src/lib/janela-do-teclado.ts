/**
 * A JANELA QUE SOBRA QUANDO O TECLADO SOBE.
 *
 * O `visualViewport` é a única coisa que sabe quanto de tela restou depois de
 * o teclado do celular abrir — `100vh`, `100dvh` e `vh` em geral continuam
 * medindo a tela INTEIRA. Um painel de chat dimensionado em `vh` não encolhe
 * junto com nada: ele fica do mesmo tamanho e some por baixo do teclado.
 *
 * ⚠️ **NO IPHONE O TECLADO NÃO MEXE EM `innerHeight` — só no
 * `visualViewport`.** Medido com o `visualViewport` forjado em 500 (o teclado
 * do iPhone come ~350px de uma tela de 852): uma caixa de 55vh continuava com
 * 469px, não cabia nos 500 visíveis junto com mais nada, o navegador rolava a
 * página para trazer o campo à vista, e o que sobrava da conversa era uma
 * faixa.
 *
 * ⚠️ **A RÉGUA MORA AQUI PORQUE HÁ DOIS CHATS.** O Chat IA e a Nutricionista
 * Virtual são abertos na MESMA tela, trocando de aba. Uma segunda cópia da
 * medição divergiria da primeira no próximo ajuste, e a divergência
 * apareceria como um dos dois chats voltando a se esconder atrás do teclado.
 *
 * Os dois são hoje PAINÉIS em tela cheia no celular (`fixed`, com a altura e o
 * topo vindos daqui), e a lista rola por dentro. A régua "caixa no fluxo" que
 * existia para a Nutrição — quando ela era uma caixa de 55vh dentro da página
 * — saiu junto com a caixa: um chat dentro de uma página rolável eram dois
 * rolos disputando o dedo, e a resposta cortada no meio da palavra na borda.
 *
 * ⚠️ **E ISTO NÃO É O CASO DA TELA PEQUENA.** A 393×500 (celular deitado, ou
 * uma janela pequena no computador) o `visualViewport` bate com a tela, e o
 * painel simplesmente mede a tela inteira. Confundir os dois casos foi o
 * primeiro diagnóstico da correção original, e ele consertava um e media o
 * outro.
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
