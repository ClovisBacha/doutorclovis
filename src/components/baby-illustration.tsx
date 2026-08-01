import babyEmbriao from "@/assets/baby-embriao.png";
import babyInicial from "@/assets/baby-inicial.png";
import babyFeto from "@/assets/baby-feto.png";
import babyTardio from "@/assets/baby-tardio.png";
import babyTermo from "@/assets/baby-termo.png";
import { babyStage, babyForWeek, WEEK_MIN, WEEK_MAX, type BabyStage } from "@/lib/gestacao";

export const STAGE_LABEL: Record<BabyStage, string> = {
  embriao: "Embrião",
  inicial: "Feto inicial",
  feto: "Feto",
  tardio: "Feto (reta final)",
  termo: "Bebê a termo",
};

export const STAGE_RANGES: Record<BabyStage, [number, number]> = {
  embriao: [4, 9],
  inicial: [10, 15],
  feto: [16, 27],
  tardio: [28, 36],
  termo: [37, 42],
};

const STAGE_IMG: Record<BabyStage, string> = {
  embriao: babyEmbriao,
  inicial: babyInicial,
  feto: babyFeto,
  tardio: babyTardio,
  termo: babyTermo,
};

/**
 * A ARTE POR SEMANA — 39 arquivos, um para cada semana de 4 a 42.
 *
 * Antes eram cinco desenhos para 39 semanas: a mesma imagem ficava parada por
 * até doze semanas seguidas (16 a 27). Numa tela que ela abre todo dia, "nada
 * mudou" doze semanas seguidas é o oposto do que o produto promete.
 *
 * `import.meta.glob` com `eager` + `?url` devolve um MAPA de caminho para URL
 * com hash de conteúdo. As 39 entram no manifesto do build, mas o navegador só
 * baixa a que o `<image href>` apontar — a paciente carrega ~24 KB da semana
 * dela, não 39 arquivos. Pôr as imagens em `public/` daria o mesmo download e
 * perderia o hash (e com ele o cache eterno).
 */
const ARTE_POR_SEMANA: Record<number, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("@/assets/bebes/semana-*.webp", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([caminho, url]) => [Number(caminho.match(/semana-(\d+)\.webp$/)?.[1]), url]),
);

/**
 * A arte da semana, com as cinco antigas como rede.
 *
 * A série de 39 é gerada em lotes, então em qualquer momento pode faltar
 * semana. Faltando, cai no desenho do estágio — que é o comportamento de hoje.
 * Nunca fica sem imagem: uma home sem bebê é pior que um bebê repetido.
 */
function arteDaSemana(week: number, stage: BabyStage): { src: string; nova: boolean } {
  const w = Math.max(WEEK_MIN, Math.min(WEEK_MAX, Math.round(week)));
  const propria = ARTE_POR_SEMANA[w];
  return propria ? { src: propria, nova: true } : { src: STAGE_IMG[stage], nova: false };
}

/* FUNDO BRANCO CHAPADO — só na arte antiga.
   `baby-embriao` e `baby-termo` não têm transparência: o branco está gravado no
   PNG, e o `multiply` existe para apagá-lo sobre fundo claro. Sobre o céu
   noturno da home isso nunca funcionou — a semana 6 mostra um QUADRICULADO de
   transparência e a 40 uma CAIXA BRANCA, ambos em produção hoje.

   A arte nova tem alfa de verdade e não passa por aqui. O `multiply` fica
   restrito ao caminho de fallback, e some junto com a última imagem antiga. */
const WHITE_BG_STAGES = new Set<BabyStage>(["embriao", "termo"]);

/**
 * Tons de pele do bebê (0 = arte original clara → 4 = pele retinta).
 * Aplicados por filtro SVG de gamma por canal sobre a arte PNG: escurece a
 * pele preservando o branco do fundo. `swatch` é a cor mostrada na paleta
 * de escolha (cadastro/perfil).
 */
export const BABY_TONES: { label: string; swatch: string; exp: [number, number, number] }[] = [
  { label: "Claro", swatch: "#f7d9c4", exp: [1, 1, 1] },
  { label: "Claro médio", swatch: "#eec39a", exp: [1.18, 1.3, 1.42] },
  { label: "Médio", swatch: "#d9a066", exp: [1.42, 1.62, 1.85] },
  { label: "Moreno", swatch: "#a9714b", exp: [1.8, 2.15, 2.5] },
  { label: "Retinto", swatch: "#7a4b32", exp: [2.3, 2.85, 3.4] },
];

/** Normaliza um valor livre (banco) para um índice válido da paleta. */
export function clampTone(tone: number | null | undefined): number {
  const t = Math.round(Number(tone ?? 0));
  return Number.isFinite(t) ? Math.min(BABY_TONES.length - 1, Math.max(0, t)) : 0;
}

function growth(week: number) {
  return Math.max(0, Math.min(1, (week - WEEK_MIN) / (WEEK_MAX - WEEK_MIN)));
}

/**
 * QUANTO DA CAIXA A TINTA DO BEBÊ OCUPA, em cada arte.
 *
 * Medido com bounding box do alfa, não estimado. A arte antiga nunca foi
 * uniforme, e é essa variação que faz o bebê SALTAR de tamanho ao cruzar a
 * fronteira de um estágio — o salto não é crescimento, é o enquadramento do
 * arquivo mudando.
 *
 * A arte nova sai toda normalizada em 83% por `scripts/bebes/normalizar.mjs`.
 */
const TINTA_DA_ARTE: Record<BabyStage, number> = {
  embriao: 0.873,
  inicial: 0.721,
  feto: 0.788,
  tardio: 0.83,
  termo: 0.887,
};
const TINTA_DA_ARTE_NOVA = 0.83;

/**
 * A ESCALA NASCE DA BOLHA, não de um número por estágio.
 *
 * O bebê estava SAINDO da bolha nas semanas finais — medido na tela: 312px de
 * tinta contra 220px de bolha na semana 40, 42% maior. A caixa branca gravada
 * no PNG escondia isso; quando ela foi removida, a geometria real apareceu.
 *
 * A causa: `scale-[1.43]` da home foi calibrado numa semana só (a 19, padrão do
 * preview), onde a tinta dá ~55% da caixa. O comentário lá diz isso com todas
 * as letras. Só que a escala interna sobe até 1,1 nas semanas finais e a tinta
 * de `termo` é 88,7% do arquivo — o produto estoura a bolha.
 *
 * Agora a conta é direta e verificável. A bolha da home mede 220px numa caixa
 * de 320px, ou seja 68,75% dela. Deixando 15% de folga para o bebê respirar
 * dentro do vidro:
 *
 *   tinta máxima na caixa = 0,6875 × 0,85 ≈ 0,585
 *
 * `escalaDoCorpo` devolve quanto ESCALAR A IMAGEM para que a tinta atinja o
 * alvo daquela semana — e por isso divide pela tinta da arte. Trocar a arte
 * deixa de mexer no tamanho: quem manda é a semana, não o arquivo.
 *
 * O expoente 0,65 comprime a curva para a frente porque o crescimento real é
 * assim: entre 4 e 20 semanas o bebê ganha proporcionalmente muito mais do que
 * entre 30 e 42. Uma reta faria o primeiro trimestre parecer parado.
 */
const TINTA_ALVO_MIN = 0.14;
const TINTA_ALVO_MAX = 0.585;

function escalaDoCorpo(week: number, stage: BabyStage, arteNova: boolean): number {
  const alvo = TINTA_ALVO_MIN + (TINTA_ALVO_MAX - TINTA_ALVO_MIN) * Math.pow(growth(week), 0.65);
  const tinta = arteNova ? TINTA_DA_ARTE_NOVA : TINTA_DA_ARTE[stage];
  return alvo / tinta;
}

export function BabyIllustration({
  week,
  showSac = true,
  showInfo = true,
  className,
  tone = 0,
}: {
  week: number;
  /** false = bebê "livre", sem o círculo do saco amniótico */
  showSac?: boolean;
  /** false = oculta a legenda de estágio/tamanho/peso abaixo do SVG */
  showInfo?: boolean;
  /** classes do <svg> — sobrescreve o tamanho padrão */
  className?: string;
  /** Tom de pele do bebê (índice em BABY_TONES; 0 = arte original). */
  tone?: number;
}) {
  const stage = babyStage(week);
  const toneIdx = clampTone(tone);
  const [er, eg, eb] = BABY_TONES[toneIdx].exp;
  const toneFilterId = `baby-tone-${toneIdx}`;
  const g = growth(week);
  const sacR = 72 + g * 16;
  const info = babyForWeek(week);

  const arte = arteDaSemana(week, stage);
  /* Sem `freeBoost`. Ele existia para inchar o bebê 18% quando o componente não
     desenhava o próprio saco — um ajuste relativo, feito quando o tamanho vinha
     de um número por estágio. Agora o alvo é ABSOLUTO (fração da caixa) e já
     cabe nos dois casos: dentro da bolha da home (68,75% da caixa) e dentro do
     saco que o próprio componente desenha (72% a 88%). Um alvo só, sem exceção
     que precise ser lembrada. */
  const bodyScale = Math.min(1.1, escalaDoCorpo(week, stage, arte.nova));
  const tx = 100 * (1 - bodyScale);
  /* Só a arte antiga precisa do `multiply`: a nova tem alfa de verdade. */
  const isWhiteBg = !arte.nova && WHITE_BG_STAGES.has(stage);

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Ilustração — ${STAGE_LABEL[stage]}, semana ${week}`}
        className={className ?? "h-48 w-48 md:h-56 md:w-56"}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* ── Saco amniótico ─────────────────────────────────── */}
          <radialGradient id="sac" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fef8f2" />
            <stop offset="52%" stopColor="#fae6d0" />
            <stop offset="100%" stopColor="#efceb0" />
          </radialGradient>
          <radialGradient id="sac-glow" cx="39%" cy="34%" r="54%">
            <stop offset="0%" stopColor="#fffdf8" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#fffdf8" stopOpacity="0" />
          </radialGradient>
          <filter id="blur-m">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          {toneIdx > 0 && (
            <filter id={toneFilterId} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="gamma" amplitude="1" exponent={er} offset="0" />
                <feFuncG type="gamma" amplitude="1" exponent={eg} offset="0" />
                <feFuncB type="gamma" amplitude="1" exponent={eb} offset="0" />
              </feComponentTransfer>
            </filter>
          )}
          {showSac && (
            <clipPath id="sac-clip">
              <circle cx="100" cy="100" r={sacR} />
            </clipPath>
          )}
        </defs>

        {/* ── Saco amniótico (opcional) ─────────────────────────── */}
        {showSac && (
          <>
            <circle cx="100" cy="100" r={sacR} fill="url(#sac)" />
            <circle cx="100" cy="100" r={sacR} fill="url(#sac-glow)" />
            <circle
              cx="100"
              cy="100"
              r={sacR}
              fill="none"
              stroke="#d08860"
              strokeWidth="2.2"
              strokeOpacity="0.26"
            />
            {/* Reflexo principal */}
            <ellipse
              cx={100 - sacR * 0.29}
              cy={100 - sacR * 0.31}
              rx={sacR * 0.25}
              ry={sacR * 0.12}
              fill="white"
              fillOpacity="0.3"
              transform={`rotate(-24 ${100 - sacR * 0.29} ${100 - sacR * 0.31})`}
            />
            {/* Reflexo secundário */}
            <ellipse
              cx={100 - sacR * 0.19}
              cy={100 - sacR * 0.41}
              rx={sacR * 0.09}
              ry={sacR * 0.05}
              fill="white"
              fillOpacity="0.52"
              transform={`rotate(-19 ${100 - sacR * 0.19} ${100 - sacR * 0.41})`}
            />
          </>
        )}

        {/* ── Imagem do bebê — escala contínua semana a semana ─────── */}
        <g
          transform={`translate(${tx} ${tx}) scale(${bodyScale})`}
          clipPath={showSac ? "url(#sac-clip)" : undefined}
        >
          <image
            href={arte.src}
            x="0"
            y="0"
            width="200"
            height="200"
            preserveAspectRatio="xMidYMid meet"
            filter={toneIdx > 0 ? `url(#${toneFilterId})` : undefined}
            style={isWhiteBg ? { mixBlendMode: "multiply" } : undefined}
          />
        </g>
      </svg>

      {/* ── Informações da semana ─────────── */}
      {showInfo && (
        <div className="mt-2 w-full text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/80">
            {STAGE_LABEL[stage]}
          </p>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-xs font-semibold text-foreground">
            <span>{info.size}</span>
            {info.weight !== "—" && (
              <>
                <span className="text-border">·</span>
                <span>{info.weight}</span>
              </>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-primary/70">{info.fruit}</p>
          <p className="mx-auto mt-1 max-w-[220px] text-[11px] leading-snug text-muted-foreground">
            {info.desc}
          </p>
        </div>
      )}
    </div>
  );
}
