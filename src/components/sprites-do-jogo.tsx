import { useEffect, useRef } from "react";
import checkFeito from "@/assets/jogo/check-feito.webp";
import estrelaGanha from "@/assets/jogo/estrela-ganha.webp";
import cincoEstrelas from "@/assets/jogo/cinco-estrelas.webp";

/**
 * AS TRÊS ANIMAÇÕES DE CONQUISTA DO JOGO.
 *
 * Pedido do dono, com os três `.webm` na mão:
 *
 *  · **check** — a bolinha verde que completa quando ela termina uma das cinco
 *    atividades do dia. "Depois que a pessoa sai da tela da meditação tendo
 *    completado o exercício, vai aparecer essa animação completando."
 *  · **estrela** — uma das cinco estrelas do dia acendendo, a cada atividade.
 *  · **cinco** — as cinco enfileiradas, quando o dia inteiro fecha.
 *
 * ─── POR QUE FOLHA DE SPRITES, E NÃO O `.webm` ─────────────────────────────
 *
 * As três chegaram com alfa de verdade (medido: cantos em 0, 93,7% a 97,7% da
 * área transparente). O arquivo está certo; o problema é onde ele ia rodar:
 * **WebM com alfa não tem transparência no motor do Safari**, e o app é
 * instalado na tela de início do iPhone. As três apareceriam dentro de um
 * retângulo preto, só nos iPhones — a categoria de defeito que nenhuma máquina
 * de desenvolvimento mostra. É a mesma decisão da chama e do troféu.
 *
 * ─── AS TRÊS TOCAM UMA VEZ E PARAM ─────────────────────────────────────────
 *
 * `forwards` no CSS. Elas são conquista, não enfeite: acontecem no instante em
 * que ela fez alguma coisa. Em laço, o check ficaria explodindo confete ao lado
 * de uma tarefa concluída há dez minutos.
 *
 * E o último quadro das três é a POSE DE REPOUSO — check pousado, estrela
 * cheia, cinco enfileiradas. Por isso o componente pode continuar na tela
 * depois de terminar: ele vira o próprio estado final.
 */

type Tipo = "check" | "estrela" | "cinco";

const FOLHA: Record<Tipo, { src: string; ms: number }> = {
  /* 24 quadros amostrados no primeiro 1,25 s do vídeo de 3 s: o resto era a
     pose final repetida, e 20 quadros idênticos numa folha é peso sem imagem.
     Ver o parâmetro de janela em `scripts/sprite-de-video.mjs`. */
  check: { src: checkFeito, ms: 1250 },
  estrela: { src: estrelaGanha, ms: 2000 },
  cinco: { src: cincoEstrelas, ms: 2000 },
};

export function SpriteDoJogo({
  tipo,
  tamanho,
  className = "",
  style,
  onFim,
}: {
  tipo: Tipo;
  /** Lado em px. As folhas têm 150px por quadro — há folga até dsf 3. */
  tamanho: number;
  className?: string;
  /** Ajuste de posição. As folhas têm faíscas em volta do desenho, então quem
      as encaixa numa fileira precisa recuar a margem para a fileira não saltar
      de largura no instante da animação. */
  style?: React.CSSProperties;
  /**
   * Avisa quando a animação termina.
   *
   * ⚠️ É um `setTimeout` e não `onAnimationEnd`: são DUAS animações no mesmo
   * elemento (X e Y), então o evento dispara duas vezes, e a primeira (a de X,
   * que dura um quarto) chegaria com a animação ainda no meio. Quem escuta o
   * evento fecharia a comemoração no primeiro quarto dela.
   */
  onFim?: () => void;
}) {
  const { src, ms } = FOLHA[tipo];
  const fim = useRef(onFim);
  fim.current = onFim;

  useEffect(() => {
    if (!onFim) return;
    /* +80ms de folga: o quadro final tem de ficar visível antes de quem
       escuta trocar a tela por baixo dele. */
    const t = setTimeout(() => fim.current?.(), ms + 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  return (
    <span
      aria-hidden
      className={`dc-sprite shrink-0 ${className}`}
      style={
        {
          ...style,
          width: tamanho,
          height: tamanho,
          backgroundImage: `url(${src})`,
          /* A de X varre as seis colunas de uma linha e dura um QUARTO da de
             Y, que desce as quatro linhas. É o que faz a folha 2D andar. */
          "--sprite-dur": `${ms}ms`,
          "--sprite-x": `${ms / 4}ms`,
        } as React.CSSProperties
      }
    />
  );
}
