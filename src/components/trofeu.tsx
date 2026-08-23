import { useEffect, useRef, useState } from "react";
import { tocarSomDeUI } from "@/lib/tocar-som-de-ui";
import { deslocamentoDaLinha } from "@/lib/alinhar-na-linha";
import trofeuSprite from "@/assets/trofeu.webp";

/**
 * O TROFÉU DAS CINCO ESTRELAS.
 *
 * ─── A ARTE E O QUE ELA OBRIGOU ─────────────────────────────────────────────
 *
 * Chegou como `.webm` de 5,00 s, 150×120, com alfa de verdade (medido: 87–100%
 * transparente). Virou folha de sprites pelo mesmo motivo da chama — WebM com
 * alfa não tem transparência no motor do Safari, e o app é instalado no iPhone.
 * 60 quadros, grade 10×6, 12 fps, 178 KB.
 *
 * Mas o troféu tem uma diferença que muda o desenho: **o quadro 0 está 100%
 * vazio**. É uma animação que CONSTRÓI o troféu do nada, não um laço. Medi a
 * caixa do desenho crescendo quadro a quadro (`61,68→91,117` em 1,25 s;
 * `20,29→127,117` em 4,9 s).
 *
 * Por isso o ícone do topo NÃO roda a animação em laço, como faz a chama: um
 * laço faria o troféu SUMIR e renascer a cada cinco segundos num ícone de
 * 22px, que lê como falha de carregamento, não como enfeite. O ícone fica no
 * ÚLTIMO quadro — o troféu pronto — e a animação inteira acontece onde ela tem
 * sentido: no instante em que ela conquista mais um.
 */

/** Grade da folha. Mudou a folha, mudam estes dois — e o CSS lê os mesmos. */
const COLUNAS = 10;
const LINHAS = 6;
/** Proporção do quadro (150×120). Forçar quadrado achataria o troféu. */
const PROPORCAO = 120 / 150;
/**
 * Onde a TINTA do último quadro termina dentro da célula — medido na folha
 * (caixa 20,29 → 127,117 de 150×120), não estimado.
 *
 * É o que faz o troféu pousar na linha dos números em vez de ficar pendurado
 * 7,5px abaixo deles, que foi o que o dono viu na fita.
 */
const BASE_DA_TINTA = 0.9833;

/**
 * O ÍCONE — troféu pronto, parado.
 *
 * Usa a mesma folha da animação em vez de um segundo arquivo: é o último
 * quadro dela, então nunca há como o ícone e a comemoração mostrarem troféus
 * diferentes. E o navegador já tem a folha em cache quando a comemoração
 * dispara.
 */
export function TrofeuIcone({
  /* ─── 34, E NÃO 24 ────────────────────────────────────────────────────
     O desenho NÃO preenche o quadro: no último quadro da folha ele ocupa
     108×89 de 150×120 (medido) — 72% da largura. Com a caixa em 24px o troféu
     saía com ~17px visíveis, ao lado de uma chama de 26 e de um calendário de
     22, e o dono viu na hora: "está pequeno em relação aos outros".

     34 × 0,72 ≈ 24px de troféu visível, que é o tamanho dos vizinhos. A conta
     é essa, e não gosto: comparar caixas de arte com margens diferentes é
     comparar coisas que não se veem. */
  tamanho = 34,
  /** Tamanho da fonte do número ao lado — é nela que a base se apoia. */
  fonteAoLado = 18,
  className = "",
}: {
  tamanho?: number;
  fonteAoLado?: number;
  className?: string;
}) {
  const altura = Math.round(tamanho * PROPORCAO);
  return (
    <span
      aria-hidden
      className={`dc-trofeu-fim shrink-0 ${className}`}
      style={{
        width: tamanho,
        height: altura,
        backgroundImage: `url(${trofeuSprite})`,
        /* `translateY` e não `margin`: o deslocamento é visual e não pode
           empurrar os vizinhos na fita. */
        transform: `translateY(${deslocamentoDaLinha({
          altura,
          baseDaTinta: BASE_DA_TINTA,
          fonte: fonteAoLado,
        })}px)`,
      }}
    />
  );
}

/**
 * A COMEMORAÇÃO — a animação inteira, uma vez, em tela cheia.
 *
 * ─── TOCAR PULA, E POR QUE ISSO IMPORTA ─────────────────────────────────────
 *
 * Pedido do dono, e ele está certo: cinco segundos é muito para a segunda vez.
 * Uma comemoração que não se pode pular deixa de ser presente e vira pedágio —
 * e quem fecha o dia todo dia é justamente quem mais pagaria esse pedágio.
 *
 * A área de toque é a TELA INTEIRA, não o troféu: mirar num desenho de 60px que
 * está crescendo e se movendo é pedir para ela errar o alvo.
 */
export function TrofeuConquistado({
  numero,
  aoFechar,
  careMode = false,
}: {
  /** Qual troféu é este — "seu 12º dia de 5 estrelas". */
  numero: number;
  aoFechar: () => void;
  careMode?: boolean;
}) {
  const [saindo, setSaindo] = useState(false);

  /**
   * ⚠️ ESTA ERA A ÚNICA ANIMAÇÃO DE CINCO SEGUNDOS E MEIO DO APP, E ERA MUDA.
   *
   * O chime do dia fechado toca cerca de um segundo ANTES do troféu aparecer e
   * já acabou quando ele entra: a paciente via o clímax do jogo inteiro em
   * silêncio absoluto.
   *
   * O som do troféu é PRÓPRIO e mais lento que o da conquista — quatro degraus
   * ao longo de 1,7 s, contra 0,65 do chime. Um arpejo rápido acabaria antes do
   * desenho e deixaria os últimos quatro segundos mudos, que é o mesmo defeito
   * em versão menor.
   *
   * ⚠️ E ele nasce no MONTE, junto com o primeiro quadro — não num
   * `setTimeout`. O quadro 0 da folha de sprite é vazio e o troféu se constrói;
   * a nota que começa junto com ele é a nota que o acompanha.
   */
  useEffect(() => {
    tocarSomDeUI("trofeu", { careMode });
  }, [careMode]);
  /* `useRef` e não estado: dois toques rápidos (ou o fim da animação chegando
     junto com um toque) chamariam `aoFechar` duas vezes, e o contador do
     Caminho avançaria dois troféus com uma conquista só. */
  const fechado = useRef(false);

  function fechar() {
    if (fechado.current) return;
    fechado.current = true;
    setSaindo(true);
    /* Espera o esmaecer antes de desmontar: cortar seco no toque parece
       travamento, e o toque é justamente o caminho de quem tem pressa. */
    setTimeout(aoFechar, 260);
  }

  useEffect(() => {
    /* 5,0 s da animação + meio segundo lendo o troféu pronto. Sem essa folga a
       tela some no quadro em que a última estrela acende, que é o quadro que a
       comemoração inteira existe para mostrar. */
    const t = setTimeout(fechar, 5500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Troféu ${numero} conquistado`}
      onClick={fechar}
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center"
      style={{
        background: "rgba(30,16,40,0.52)",
        backdropFilter: "blur(3px)",
        opacity: saindo ? 0 : 1,
        transition: "opacity 260ms ease-out",
      }}
    >
      {/* ─── 200px, E NÃO 250 ───────────────────────────────────────────
          A origem tem 150px de largura. Num iPhone (dsf 3), desenhar 250 CSS
          pede 750 pixels reais de uma arte de 150 — cinco vezes. É a mesma
          conta que deixou a bolha borrada em julho (2,76×), e a lição de lá
          vale aqui: `pixels reais = largura CSS × densidade`.

          200 baixa para 4× e ainda é a peça dominante da tela. O resto da
          nitidez não está aqui: está na EXPORTAÇÃO. Uma animação de 512px de
          largura ficaria cravada em qualquer densidade — e o conversor
          (`scripts/sprite-de-video.mjs`) já aceita a origem maior sem mudar
          uma linha.

          Ampliar o vídeo com um upscaler não serve: eles devolvem H.264, que
          não tem canal alfa — trocaríamos nitidez pela transparência, que é
          justamente o que faz esta arte funcionar em cima da trilha. */}
      <span
        aria-hidden
        className="dc-trofeu-anim"
        style={{
          width: 200,
          height: Math.round(200 * PROPORCAO),
          backgroundImage: `url(${trofeuSprite})`,
        }}
      />
      <p className="mt-4 font-serif text-2xl text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
        Cinco estrelas!
      </p>
      <p className="mt-1 text-sm text-white/85">
        {numero === 1 ? "Seu primeiro troféu 🏆" : `${numero} troféus 🏆`}
      </p>
      <p className="mt-6 text-xs text-white/55">toque para continuar</p>
    </div>
  );
}

/** Só para o teste: a grade que o CSS precisa espelhar. */
export const GRADE_DO_TROFEU = { COLUNAS, LINHAS, PROPORCAO };
