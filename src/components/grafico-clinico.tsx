import { useId, useMemo, useState } from "react";
import type { Serie } from "@/lib/clinical.functions";

/**
 * A SÉRIE CLÍNICA, DESENHADA.
 *
 * ─── O QUE ISTO RESOLVE ─────────────────────────────────────────────────────
 *
 * O prontuário mostrava o ÚLTIMO valor de cada medida e uma variação semanal.
 * Isso responde "como ela está", e não responde a pergunta que o obstetra faz
 * de verdade: "para onde isso está indo?". Peso subindo 200 g por semana e peso
 * subindo 900 g por semana têm o mesmo "último peso" na tela.
 *
 * ─── AS DECISÕES DE DESENHO, E POR QUE CADA UMA ─────────────────────────────
 *
 * **Um gráfico por medida, nunca dois eixos.** Pressão em mmHg e peso em kg no
 * mesmo desenho exigiria duas escalas — e duas escalas fazem qualquer par de
 * linhas parecer correlacionado, porque quem desenha escolhe a inclinação. As
 * duas linhas que dividem um gráfico aqui são sistólica e diastólica, que são a
 * MESMA unidade.
 *
 * **A cor da linha é identidade; a do ponto é gravidade.** A linha diz qual
 * medida é; o anel do ponto diz se aquele valor pede atenção — e vem de
 * `sinais-clinicos`, a mesma régua do app da paciente e do painel. Um valor
 * grave nunca é só uma cor: ganha anel maior e entra na legenda com o nome.
 *
 * **Faixa de referência ao fundo, e não linhas de corte.** Uma faixa clara diz
 * "isto aqui é o esperado" sem competir com os dados. Linhas tracejadas de
 * limite viram grade e o olho para de distinguir dado de régua.
 *
 * **Menos de dois pontos não vira gráfico.** Um ponto sozinho desenha uma linha
 * reta que sugere estabilidade onde só há uma medida.
 */

/**
 * Identidade da linha, em variáveis CSS.
 *
 * Os quatro tons passaram nas seis checagens do validador nos DOIS modos —
 * banda de luminosidade, piso de croma, separação para daltonismo (ΔE 16,4
 * deutan no claro; 14,1 no escuro) e contraste contra a superfície do cartão. O
 * escuro tem passo PRÓPRIO, e não o mesmo tom rebatido: a banda do modo escuro
 * é mais estreita (L 0,48–0,67), e o ciano do claro sai dela.
 *
 * Por variável, e não por `light-dark()` ou por JS: `light-dark()` é recente
 * demais para um app que roda em WebView de celular antigo, e ler o tema em JS
 * erraria quando o médico usa o interruptor manual em vez do tema do sistema.
 * A variante `dark:` já existe no projeto (`&:is(.dark *)`).
 */
const TOKENS_DE_COR =
  "[--serie-a:#4F46E5] [--serie-b:#0891B2] dark:[--serie-a:#6366F1] dark:[--serie-b:#0E9AB8]";

/** Gravidade. Reservada: nunca vira "série 3". Sempre com rótulo junto. */
const COR_DA_GRAVIDADE = {
  normal: null,
  atencao: "#B45309",
  grave: "#BE123C",
} as const;

export type PontoMarcado = {
  em: string;
  valor: number;
  gravidade?: "normal" | "atencao" | "grave" | null;
};

export type SerieDesenhavel = {
  rotulo: string;
  unidade: string;
  pontos: PontoMarcado[];
  /** Faixa esperada, quando existe. Vira um fundo claro, não uma linha. */
  referencia?: { de: number; ate: number } | null;
};

/* O espaço de desenho, em pixels. O SVG escala com `w-full h-auto`, mantendo a
   proporção — é isso que faz o ponto continuar redondo num cartão largo. */
const LARGURA = 600;
const ALTURA = 190;
/* 10px de folga lateral, e não 6: com raio 5,5 mais o anel de 1, o primeiro e
   o último ponto encostavam na borda do cartão. */
const PAD = { esq: 12, dir: 12, topo: 12, base: 12 };

export function GraficoClinico({
  titulo,
  series,
}: {
  titulo: string;
  /** Uma ou duas — e as duas só quando dividem a MESMA unidade. */
  series: SerieDesenhavel[];
}) {
  const id = useId();
  const [ativo, setAtivo] = useState<{ i: number; j: number } | null>(null);

  const usaveis = series.filter((s) => s.pontos.length >= 2);
  const desenho = useMemo(() => {
    if (usaveis.length === 0) return null;
    const todos = usaveis.flatMap((s) => s.pontos);
    const ts = todos.map((p) => new Date(p.em).getTime()).filter((t) => !Number.isNaN(t));
    if (ts.length < 2) return null;

    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    const vs = todos.map((p) => p.valor);
    const refs = usaveis.flatMap((s) => (s.referencia ? [s.referencia.de, s.referencia.ate] : []));
    /* A faixa de referência entra na escala: sem ela, uma paciente sempre
       dentro do normal renderia um gráfico ampliado em variações de 2 mmHg —
       ruído desenhado como se fosse acontecimento. */
    let min = Math.min(...vs, ...refs);
    let max = Math.max(...vs, ...refs);
    if (max === min) {
      min -= 1;
      max += 1;
    }
    const folga = (max - min) * 0.12;
    min -= folga;
    max += folga;

    /* ─── COORDENADAS DE VERDADE, E NÃO 0–100 ESTICADO ─────────────────────
       A primeira versão desenhava num `viewBox` 0 0 100 100 com
       `preserveAspectRatio="none"`, esticado até a altura pedida. Isso deforma
       tudo o que não é linha: os pontos viram ELIPSES, mais achatadas quanto
       mais largo for o cartão. Com o espaço em pixels e proporção mantida, o
       ponto é redondo em qualquer largura. */
    const x = (em: string) => {
      const t = new Date(em).getTime();
      const p = t1 === t0 ? 0.5 : (t - t0) / (t1 - t0);
      return PAD.esq + p * (LARGURA - PAD.esq - PAD.dir);
    };
    const y = (v: number) => PAD.topo + ((max - v) / (max - min)) * (ALTURA - PAD.topo - PAD.base);
    return { x, y, min, max, t0, t1 };
  }, [usaveis]);

  if (!desenho) {
    return (
      <figure className="rounded-2xl border border-border bg-background p-4">
        <figcaption className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {titulo}
        </figcaption>
        {/* Diz o que falta, e não "sem dados": a paciente registrar duas vezes é
            uma ação concreta que o médico pode pedir a ela. */}
        <p className="mt-2 text-[13px] text-muted-foreground">
          Ainda não dá para desenhar — são precisos pelo menos dois registros.
        </p>
      </figure>
    );
  }

  const { x, y } = desenho;
  const duasLinhas = usaveis.length > 1;
  const faixa = usaveis.find((s) => s.referencia)?.referencia ?? null;
  const alerta = usaveis.some((s) => s.pontos.some((p) => p.gravidade && p.gravidade !== "normal"));

  return (
    <figure className={`rounded-2xl border border-border bg-background p-4 ${TOKENS_DE_COR}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {titulo}
        </figcaption>
        {/* O último valor como número grande: é o que ele lê primeiro, e um
            gráfico não substitui saber quanto é. */}
        <p className="tabular-nums text-sm">
          {usaveis.map((s, i) => (
            <span key={s.rotulo} className={i > 0 ? "ml-2" : ""}>
              <span className="font-semibold">{s.pontos[s.pontos.length - 1].valor}</span>
              <span className="text-muted-foreground"> {s.unidade}</span>
            </span>
          ))}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        role="img"
        aria-label={`${titulo}: ${usaveis
          .map((s) => `${s.rotulo}, ${s.pontos.length} registros`)
          .join("; ")}`}
        className="mt-2 h-auto w-full"
        onMouseLeave={() => setAtivo(null)}
      >
        {/* Faixa de referência — fundo, não linha. */}
        {usaveis.map((s, i) =>
          s.referencia ? (
            <rect
              key={`ref-${i}`}
              x={PAD.esq}
              y={y(s.referencia.ate)}
              width={LARGURA - PAD.esq - PAD.dir}
              height={Math.max(0, y(s.referencia.de) - y(s.referencia.ate))}
              className="fill-emerald-500/[0.07]"
            />
          ) : null,
        )}

        {/* Grade recessiva: três linhas, e só. */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.esq}
            x2={LARGURA - PAD.dir}
            y1={PAD.topo + f * (ALTURA - PAD.topo - PAD.base)}
            y2={PAD.topo + f * (ALTURA - PAD.topo - PAD.base)}
            className="stroke-border"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {usaveis.map((s, i) => {
          const cor = i === 0 ? "var(--serie-a)" : "var(--serie-b)";
          const d = s.pontos
            .map((p, j) => `${j === 0 ? "M" : "L"} ${x(p.em)} ${y(p.valor)}`)
            .join(" ");
          return (
            <g key={s.rotulo}>
              <path
                d={d}
                fill="none"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ stroke: cor }}
              />
              {s.pontos.map((p, j) => {
                const g = p.gravidade && p.gravidade !== "normal" ? p.gravidade : null;
                const corGrav = g ? COR_DA_GRAVIDADE[g] : null;
                const focado = ativo?.i === i && ativo?.j === j;
                return (
                  <g key={`${i}-${j}`}>
                    {/* Alvo invisível maior que o ponto: 4px de marca com 4px de
                        alvo é impossível de acertar no celular. */}
                    <circle
                      cx={x(p.em)}
                      cy={y(p.valor)}
                      r={14}
                      fill="transparent"
                      onMouseEnter={() => setAtivo({ i, j })}
                      onFocus={() => setAtivo({ i, j })}
                      tabIndex={0}
                      role="button"
                      aria-label={`${s.rotulo} ${p.valor} ${s.unidade} em ${new Date(
                        p.em,
                      ).toLocaleDateString("pt-BR")}`}
                    />
                    <circle
                      cx={x(p.em)}
                      cy={y(p.valor)}
                      r={corGrav ? 5.5 : focado ? 5.5 : 4}
                      style={{
                        fill: corGrav ?? cor,
                        /* Anel da cor do fundo: dois pontos que se encostam
                           viram uma mancha só sem ele. */
                        stroke: "var(--background)",
                      }}
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Legenda: sempre para duas linhas, e sempre que houver gravidade. A cor
          nunca é a única portadora da informação. */}
      {(duasLinhas || alerta) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {duasLinhas &&
            usaveis.map((s, i) => (
              <span key={s.rotulo} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: i === 0 ? "var(--serie-a)" : "var(--serie-b)" }}
                  aria-hidden
                />
                {s.rotulo}
              </span>
            ))}
          {alerta && (
            <>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: COR_DA_GRAVIDADE.atencao }}
                  aria-hidden
                />
                Atenção
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: COR_DA_GRAVIDADE.grave }}
                  aria-hidden
                />
                Fora da faixa
              </span>
            </>
          )}
        </div>
      )}

      {/* O valor apontado. Fica FORA do SVG: dentro, ele seria cortado pelo
          `viewBox` esticado e sairia com a fonte deformada. */}
      <p className="mt-1.5 min-h-[1.25rem] text-[11px] tabular-nums text-muted-foreground">
        {ativo && usaveis[ativo.i]?.pontos[ativo.j] ? (
          <>
            <span className="font-semibold text-foreground">
              {usaveis[ativo.i].pontos[ativo.j].valor} {usaveis[ativo.i].unidade}
            </span>{" "}
            · {usaveis[ativo.i].rotulo} ·{" "}
            {new Date(usaveis[ativo.i].pontos[ativo.j].em).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })}
          </>
        ) : (
          <>
            {usaveis[0].pontos.length} registros ·{" "}
            {new Date(usaveis[0].pontos[0].em).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}{" "}
            até hoje
            {/* A faixa verde ao fundo precisa se explicar: sem isto ela é uma
                mancha, e o médico não sabe se ela vale 90–140 ou 70–100. Em
                texto, e não como rótulo dentro do SVG — texto lá dentro escala
                junto com o desenho e sai com o corpo errado em cada largura. */}
            {faixa && ` · faixa esperada ${faixa.de}–${faixa.ate} ${usaveis[0].unidade}`}
          </>
        )}
      </p>
      <span className="sr-only" id={id}>
        {titulo}
      </span>
    </figure>
  );
}

/**
 * As duas linhas da PRESSÃO, com a gravidade vinda do PAR.
 *
 * ─── POR QUE ISTO NÃO É `daSerie` DUAS VEZES ────────────────────────────────
 *
 * `sinalPressao` avalia o PAR: ele recusa valores implausíveis, detecta campos
 * invertidos e classifica pela faixa dos dois juntos. Chamá-lo com a sistólica
 * e uma diastólica inventada — `sinalPressao(v, 70)` — é fabricar régua
 * clínica: 90/70 dispara "diferença implausível" e viraria um ponto laranja
 * numa pressão perfeitamente normal.
 *
 * Pior, é exatamente o defeito que o prontuário já documenta ter fechado: duas
 * séries independentes casavam uma sistólica de hoje com uma diastólica de
 * anteontem e mostravam "168/78" com etiqueta de grave — dado clínico inventado
 * pela composição de duas leituras.
 *
 * Aqui o par sai do MESMO evento, a gravidade é calculada uma vez, e ela pinta
 * os dois pontos. Evento sem os dois valores não entra: meia pressão não é
 * pressão.
 */
export function seriesDePressao(
  eventos: { ocorrido_em: string; dados: Record<string, unknown> }[],
  gravidadeDoPar: (s: number, d: number) => "normal" | "atencao" | "grave" | null,
): SerieDesenhavel[] {
  const sist: PontoMarcado[] = [];
  const dias: PontoMarcado[] = [];
  const ordenados = [...eventos].sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em));
  for (const e of ordenados) {
    const s = e.dados.systolic;
    const d = e.dados.diastolic;
    if (typeof s !== "number" || typeof d !== "number") continue;
    const g = gravidadeDoPar(s, d);
    sist.push({ em: e.ocorrido_em, valor: s, gravidade: g });
    dias.push({ em: e.ocorrido_em, valor: d, gravidade: g });
  }
  return [
    { rotulo: "Sistólica", unidade: "mmHg", pontos: sist, referencia: { de: 90, ate: 140 } },
    { rotulo: "Diastólica", unidade: "mmHg", pontos: dias, referencia: null },
  ];
}

/** Ponte do `Serie` do servidor para o que este gráfico desenha. */
export function daSerie(
  s: Serie,
  gravidadeDe?: (valor: number) => "normal" | "atencao" | "grave" | null,
  referencia?: { de: number; ate: number } | null,
): SerieDesenhavel {
  return {
    rotulo: s.rotulo,
    unidade: s.unidade,
    referencia: referencia ?? null,
    pontos: s.pontos.map((p) => ({
      em: p.em,
      valor: p.valor,
      gravidade: gravidadeDe ? gravidadeDe(p.valor) : null,
    })),
  };
}
