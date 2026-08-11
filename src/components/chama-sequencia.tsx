import { deslocamentoDaLinha } from "@/lib/alinhar-na-linha";
import chamaSprite from "@/assets/chama-sequencia.webp";

/**
 * A CHAMA DA SEQUÊNCIA — o fogo que arde enquanto ela não perde um dia.
 *
 * ─── POR QUE FOLHA DE SPRITES, E NÃO O VÍDEO QUE VEIO ───────────────────────
 *
 * A arte chegou como `.webm` com canal alfa de verdade (medido: cantos com
 * alpha 0, 86% da área transparente). O arquivo está certo; o problema é onde
 * ele ia rodar. **WebM com alfa não tem transparência no motor do Safari**, e o
 * app é instalado na tela de início do iPhone — a chama apareceria dentro de um
 * retângulo preto, só nos iPhones, que é a categoria de defeito que nenhuma
 * máquina de desenvolvimento mostra.
 *
 * A folha de sprites não passa por codec de vídeo nenhum. É uma imagem com
 * alfa, animada por `steps()`:
 *
 *  · idêntica nos três motores;
 *  · sem política de autoplay (iOS bloqueia vídeo em contextos que a paciente
 *    não escolheu, e a chama é decoração, nunca um gesto dela);
 *  · sem um elemento `<video>` decodificando num canto da tela o tempo todo;
 *  · e já decodificada pelo navegador quando a animação começa.
 *
 * 36 quadros, 6×6, 128px por quadro, 84 KB. O original tinha 3,03 s — a mesma
 * duração aqui dá 12 quadros por segundo, que é onde fogo lê como fogo.
 *
 * ─── DUAS ANIMAÇÕES, E NÃO UMA ─────────────────────────────────────────────
 *
 * Uma folha 2D precisa de dois passos: X varre as seis colunas de uma linha, Y
 * desce uma linha quando X completa a volta. Por isso a de X dura um SEXTO da
 * de Y — as duas em `steps(6)`, e o ciclo fecha sozinho.
 *
 * O `to` vai a 120% e não a 100% de propósito: `steps(6)` amostra em i/6 do
 * percurso, então 120% entrega exatamente 0, 20, 40, 60, 80 e 100% — os seis
 * quadros. Parando em 100%, o último quadro nunca apareceria e o primeiro
 * apareceria duas vezes.
 */
/**
 * Onde a TINTA da chama termina dentro da célula — a base MAIS BAIXA entre os
 * 36 quadros (medida), e não a de um quadro qualquer: alinhar por um quadro
 * médio faria o fogo subir e descer em relação ao número enquanto anima.
 */
const BASE_DA_TINTA = 0.7813;

export function ChamaDaSequencia({
  acesa,
  tamanho = 26,
  /** Tamanho da fonte do número ao lado — é nela que a base se apoia. */
  fonteAoLado = 18,
  className = "",
}: {
  /** `sequenciaAcesa(streak)` — nunca `streak > 0` escrito à mão aqui. */
  acesa: boolean;
  /** Lado em px. A folha tem 128px por quadro, então há folga até dsf 4. */
  tamanho?: number;
  fonteAoLado?: number;
  className?: string;
}) {
  /* O contorno de apagado é um traço que encosta na borda do viewBox, então a
     tinta dele vai até 1 — outra fração, mesma régua. */
  const deslocar = (baseDaTinta: number) =>
    `translateY(${deslocamentoDaLinha({ altura: tamanho, baseDaTinta, fonte: fonteAoLado })}px)`;
  /* APAGADA NÃO CARREGA A FOLHA. Quem está em zero dias é justamente quem
     acabou de chegar (ou quem voltou depois de sumir), e cobrar 84 KB dela
     para desenhar um contorno cinza é o pior momento possível para cobrar.
     O desenho de "apagado" é um traço, não uma chama sem cor: fogo cinza lê
     como imagem que falhou ao carregar. */
  if (!acesa) {
    return (
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        aria-hidden
        className={`shrink-0 ${className}`}
        style={{ transform: deslocar(1) }}
      >
        <path
          d="M12 2.5c.6 3.2-1.2 4.4-2.6 5.8C8 9.7 7 11 7 13.4a5 5 0 0 0 10 0c0-2-.8-3.4-1.8-4.7-.5 1-1.2 1.6-2 1.9.6-2.6-.2-5.6-1.2-8.1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="text-slate-300 dark:text-slate-600"
        />
      </svg>
    );
  }

  return (
    <span
      aria-hidden
      className={`dc-chama shrink-0 ${className}`}
      style={{
        width: tamanho,
        height: tamanho,
        backgroundImage: `url(${chamaSprite})`,
        transform: deslocar(BASE_DA_TINTA),
      }}
    />
  );
}
