import semana06 from "@/assets/bebes/semana-06.webp";
import semana10 from "@/assets/bebes/semana-10.webp";
import semana20 from "@/assets/bebes/semana-20.webp";
import semana30 from "@/assets/bebes/semana-30.webp";
import semana40 from "@/assets/bebes/semana-40.webp";
import { babyStage, babyForWeek, WEEK_MIN, WEEK_MAX, type BabyStage } from "@/lib/gestacao";
import { semanaDaArte } from "@/lib/arte-do-bebe";

export const STAGE_LABEL: Record<BabyStage, string> = {
  embriao: "Embrião",
  inicial: "Feto inicial",
  feto: "Feto",
  tardio: "Feto (reta final)",
  termo: "Bebê a termo",
};

/* As faixas e a escolha da arte moram em `lib/arte-do-bebe.ts` (puro, testado):
   este arquivo abre com cinco `import` de `.webp` e um teste morreria na
   primeira linha. Reexportado aqui porque quem já importava daqui continua
   funcionando. */
export { STAGE_RANGES } from "@/lib/arte-do-bebe";

/**
 * AS CINCO ARTES DO DONO — e por que são cinco.
 *
 * Pedido dele (ago/2026): "tire todos os bebês e só coloque os que tem no
 * drive, na qualidade exata deles, não perca a qualidade".
 *
 * Saíram daqui DUAS séries: os cinco PNGs por estágio (`baby-embriao` e
 * companhia) e os 39 `.webp` gerados semana a semana. As 39 tinham a vantagem
 * de mudar toda semana; nenhuma delas era arte que o dono aprovou, e é ele quem
 * responde pelo que a paciente vê do próprio filho.
 *
 * ─── O QUE AINDA MUDA TODA SEMANA ───────────────────────────────────────────
 *
 * O TAMANHO. `escalaDoCorpo` é contínuo na semana, então entre a 20 e a 21 o
 * bebê cresce um pouco mesmo desenhado pela mesma arte. Cinco desenhos não
 * viraram cinco tamanhos.
 *
 * ─── `tinta`: MEDIDA, NUNCA ESTIMADA ────────────────────────────────────────
 *
 * Quanto do maior lado do arquivo a tinta ocupa, medido por
 * `scripts/bebes/do-drive.mjs` (α ≥ 128, sobre o maior lado — que é o lado que
 * o `preserveAspectRatio="meet"` faz caber no quadrado de 200).
 *
 * É o que impede o bebê de SALTAR de tamanho ao trocar de arte: o salto não
 * seria crescimento, seria o enquadramento do arquivo mudando. As cinco variam
 * de 58,6% a 91,4% — mais de 30 pontos —, então sem este número a semana 36
 * mostraria um bebê 56% maior que a 35 sem nada ter acontecido.
 *
 * ⚠️ Trocar um arquivo obriga a medir de novo. O script imprime o valor.
 */
const ARTES: { semana: number; src: string; tinta: number }[] = [
  { semana: 6, src: semana06, tinta: 0.5856 },
  { semana: 10, src: semana10, tinta: 0.64 },
  { semana: 20, src: semana20, tinta: 0.8125 },
  { semana: 30, src: semana30, tinta: 0.7109 },
  { semana: 40, src: semana40, tinta: 0.9137 },
];

/** O arquivo da semana. Quem decide QUAL é `semanaDaArte`, em `lib/`. */
function arteDaSemana(week: number): { src: string; tinta: number } {
  const alvo = semanaDaArte(week);
  return ARTES.find((a) => a.semana === alvo) ?? ARTES[0];
}

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

function escalaDoCorpo(week: number, tinta: number): number {
  const alvo = TINTA_ALVO_MIN + (TINTA_ALVO_MAX - TINTA_ALVO_MIN) * Math.pow(growth(week), 0.65);
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

  const arte = arteDaSemana(week);
  /* Sem `freeBoost`. Ele existia para inchar o bebê 18% quando o componente não
     desenhava o próprio saco — um ajuste relativo, feito quando o tamanho vinha
     de um número por estágio. Agora o alvo é ABSOLUTO (fração da caixa) e já
     cabe nos dois casos: dentro da bolha da home (68,75% da caixa) e dentro do
     saco que o próprio componente desenha (72% a 88%). Um alvo só, sem exceção
     que precise ser lembrada. */
  const bodyScale = Math.min(1.1, escalaDoCorpo(week, arte.tinta));
  const tx = 100 * (1 - bodyScale);

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
          <p className="mt-0.5 text-xs text-primary/70">{info.fruit}</p>
          <p className="mx-auto mt-1 max-w-[220px] text-xs leading-snug text-muted-foreground">
            {info.desc}
          </p>
        </div>
      )}
    </div>
  );
}
