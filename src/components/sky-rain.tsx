/**
 * Chuva na home do bebê — duas camadas, três intensidades.
 *
 * ─────────────────────── COMO A INTENSIDADE É DECIDIDA ───────────────────
 *
 * Não invento limiares em milímetros. Amostrei 16 dias de previsão horária em
 * oito cidades chuvosas (Manaus, Singapura, Bombaim, Bogotá, Miami, Tóquio,
 * Londres, Lagos) — 1.097 horas com chuva — e o dado mostrou que o Open-Meteo
 * JÁ classifica a intensidade no código WMO, de forma consistente com os mm:
 *
 *     código 51 garoa fraca       0,03 – 0,4 mm/h   (722 h)
 *     código 53 garoa moderada    0,5  – 0,9        (247 h)
 *     código 55 garoa densa       1,0  – 1,2        ( 24 h)
 *     código 80 pancada fraca     1,3  – 2,4        ( 28 h)
 *     código 81 pancada moderada  2,5  – 2,9        (  3 h)
 *     código 82 pancada violenta  9,0               (  2 h)
 *     código 95 trovoada          0,2  – 17,2       ( 63 h)
 *
 * Isso casa com a escala da OMM (fraca ≤ 2,5 mm/h, moderada 2,5–10, forte
 * > 10). O código é a classificação de quem entende; um limiar meu seria uma
 * segunda opinião pior.
 *
 * A exceção é a TROVOADA: o código 95 vai de 0,2 a 17,2 mm/h, ou seja, sozinho
 * não distingue um trovão seco de um temporal. Só nela o milímetro decide.
 *
 * ─────────────────────────── AS DUAS CAMADAS ─────────────────────────────
 *
 * FUNDO   riscos finos caindo ao longe, atrás de tudo. Dão a chuva do
 *         cenário — é o que se vê pela janela.
 * VIDRAÇA gotas grudadas no vidro, que engordam e escorrem deixando rastro.
 *         O celular É a janela; foi essa a leitura pedida ("pingos como se
 *         tivessem vindo na tela").
 *
 * As duas ficam ENTRE a arte do céu e o conteúdo: a chuva molha o cenário,
 * nunca o texto.
 *
 * ──────────────────────────── DESEMPENHO ─────────────────────────────────
 *
 * Roda em celular, durante rolagem, sobre uma foto em tela cheia. Por isso:
 * só `transform` e `opacity` (a GPU faz de graça), contagem FIXA por nível,
 * nenhum `filter` animado, e nada de canvas. Chuva bonita que trava o scroll
 * é pior que chuva nenhuma.
 *
 * Posições e atrasos são constantes, nunca sorteados: `Math.random()` no
 * render faria servidor e cliente desenharem coisas diferentes e quebraria a
 * hidratação — a mesma regra do resto do ambiente do céu.
 */

export type ForcaChuva = "fraca" | "media" | "forte" | null;

/**
 * Traduz código WMO + milímetros na intensidade da animação.
 * `mm` é a precipitação da hora anterior (o campo `precipitation` da API).
 */
export function forcaDaChuva(code: number, mm?: number): ForcaChuva {
  // Neve tem física própria (cai devagar, não escorre) e não é chuva.
  if (code >= 71 && code <= 77) return null;
  if (code === 85 || code === 86) return null;

  // Trovoada: o único caso em que o código não basta.
  if (code >= 95) {
    const p = mm ?? 0;
    if (p >= 10) return "forte";
    if (p >= 2) return "media";
    return "fraca";
  }

  if (code === 65 || code === 82) return "forte"; // chuva forte, pancada violenta
  if (code === 55 || code === 63 || code === 81) return "media";
  if (code === 51 || code === 53 || code === 61 || code === 80) return "fraca";
  return null; // sem chuva
}

/** Quantos elementos cada nível põe na tela. */
const PERFIL = {
  fraca: { gotas: 10, riscos: 6, escorridas: 2 },
  media: { gotas: 18, riscos: 14, escorridas: 5 },
  forte: { gotas: 26, riscos: 26, escorridas: 9 },
} as const;

/**
 * Posição pseudo-aleatória e ESTÁVEL em [0,1) — o lugar do `Math.random()`,
 * que aqui quebraria a hidratação (servidor e cliente sorteariam valores
 * diferentes para o mesmo elemento).
 *
 * Hash inteiro de 32 bits, não aritmética modular simples. A primeira versão
 * era `(i * 9301 + semente * 49297) % 233280`, e o incremento por `i` era
 * sempre 9301/233280 = 0,0399: uma PROGRESSÃO ARITMÉTICA disfarçada. Com
 * poucos elementos isso alinhava tudo — as 5 escorridas nasciam em 35,6%,
 * 39,3%, 42,9%, 46,6% e 50,3%, todas amontoadas no meio da tela, penduradas
 * como fios de um móbile em vez de espalhadas pelo vidro.
 * Só operações inteiras, então o resultado é bit a bit idêntico em qualquer
 * motor JS — o que é justamente o requisito da hidratação.
 */
function espalha(i: number, semente: number): number {
  let h = (Math.imul(i, 374761393) + Math.imul(semente, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type SkyRainProps = {
  forca: ForcaChuva;
  /** Modo Cuidado silencia tudo, como no resto do ambiente. */
  careMode?: boolean;
};

export function SkyRain({ forca, careMode }: SkyRainProps) {
  if (!forca || careMode) return null;
  const p = PERFIL[forca];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* ── O véu de chuva ─────────────────────────────────────────
          A arte do céu é escolhida só pela HORA — não existe versão
          chuvosa de cada momento do dia. Sem isto, a paciente via gotas
          caindo num céu azul de sol sem nuvem, e a cena inteira mentia:
          o defeito não era a chuva, era o céu por baixo dela.
          Um véu cinza-azulado resolve sem pedir dez artes novas, e é ele
          que dá a diferença REAL entre os três níveis — contar partículas
          separa 10 de 26 gotas, mas é a luz que faz um temporal parecer
          temporal. Fica ABAIXO do bebê, que continua como está: escurecer
          o protagonista seria fisicamente correto e visualmente errado. */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background:
            "linear-gradient(180deg, rgba(78,96,124,0.55) 0%, rgba(96,112,138,0.34) 45%, rgba(120,134,156,0.16) 100%)",
          opacity: forca === "forte" ? 0.62 : forca === "media" ? 0.36 : 0.16,
        }}
      />

      {/* ── FUNDO: os riscos caindo ao longe ───────────────────────
          Levemente inclinados, porque chuva sem vento nenhum lê como
          listra de interface. Os mais longos caem mais rápido: é assim que
          a profundidade aparece sem precisar de escala. */}
      {Array.from({ length: p.riscos }, (_, i) => {
        const x = espalha(i, 7) * 100;
        const dur = 0.9 + espalha(i, 13) * 0.7;
        const alt = 12 + espalha(i, 29) * 16;
        return (
          <span
            key={`r${i}`}
            className="dc-rain-linha absolute top-0 w-px rounded-full"
            style={{
              left: `${x.toFixed(2)}%`,
              height: `${alt.toFixed(0)}px`,
              animationDuration: `${dur.toFixed(2)}s`,
              animationDelay: `-${(espalha(i, 41) * dur).toFixed(2)}s`,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(228,240,255,0.55) 60%, rgba(255,255,255,0))",
            }}
          />
        );
      })}

      {/* ── VIDRAÇA: as gotas paradas no vidro ─────────────────────
          Elas não caem: ficam. O que anima é a opacidade e um leve inchar,
          como gota que junta água. O brilho embaixo e a sombra em cima são
          o que dá a leitura de volume — sem eles é um círculo, não uma gota. */}
      {Array.from({ length: p.gotas }, (_, i) => {
        const x = espalha(i, 53) * 96 + 2;
        const y = espalha(i, 67) * 92 + 2;
        const d = 3 + espalha(i, 83) * 5;
        return (
          <span
            key={`g${i}`}
            className="dc-rain-gota absolute rounded-full"
            style={{
              left: `${x.toFixed(2)}%`,
              top: `${y.toFixed(2)}%`,
              width: `${d.toFixed(1)}px`,
              height: `${(d * 1.15).toFixed(1)}px`,
              animationDelay: `-${(espalha(i, 97) * 7).toFixed(2)}s`,
              background:
                "radial-gradient(ellipse at 32% 28%, rgba(255,255,255,0.85) 0%, rgba(214,232,252,0.34) 45%, rgba(190,215,245,0.12) 100%)",
              boxShadow:
                "inset 0 -1px 1.5px rgba(255,255,255,0.75), inset 0 1px 1px rgba(80,110,150,0.25), 0 1px 2px rgba(60,90,130,0.18)",
            }}
          />
        );
      })}

      {/* ── VIDRAÇA: as que escorrem ───────────────────────────────
          A gota que desce puxa um rastro atrás. É o gesto que faz alguém
          reconhecer "está chovendo" mesmo sem ver o céu — e o motivo de a
          chuva na vidraça funcionar melhor que a chuva ao longe num
          celular, onde a tela É o vidro. */}
      {Array.from({ length: p.escorridas }, (_, i) => {
        const x = espalha(i, 101) * 92 + 4;
        const dur = 6 + espalha(i, 103) * 7;
        const d = 4 + espalha(i, 107) * 3;
        return (
          <span
            key={`e${i}`}
            className="dc-rain-escorre absolute"
            style={{
              left: `${x.toFixed(2)}%`,
              top: `${(4 + espalha(i, 109) * 26).toFixed(2)}%`,
              width: `${d.toFixed(1)}px`,
              height: `${(d * 1.2).toFixed(1)}px`,
              animationDuration: `${dur.toFixed(2)}s`,
              animationDelay: `-${(espalha(i, 113) * dur).toFixed(2)}s`,
            }}
          >
            {/* o rastro sobe a partir da gota, encolhendo */}
            <span
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                bottom: "50%",
                width: "1.5px",
                height: `${(d * 5).toFixed(0)}px`,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(226,240,255,0.4) 100%)",
              }}
            />
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(ellipse at 32% 28%, rgba(255,255,255,0.9) 0%, rgba(214,232,252,0.4) 45%, rgba(190,215,245,0.15) 100%)",
                boxShadow: "inset 0 -1px 1.5px rgba(255,255,255,0.8)",
              }}
            />
          </span>
        );
      })}
    </div>
  );
}
