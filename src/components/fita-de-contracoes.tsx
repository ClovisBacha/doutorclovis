/**
 * A FITA DA ÚLTIMA HORA — barra é DURAÇÃO, vão é INTERVALO.
 *
 * ⚠️ **Este é o desenho do gênero, e ele não é estética.** Os dois critérios
 * que a ACOG ensina para reconhecer o trabalho de parto — "elas ficam mais
 * JUNTAS" e "elas ficam mais LONGAS" — são exatamente as duas dimensões desta
 * fita, e ela entrega as duas de uma vez, sem a paciente fazer conta nenhuma.
 * Um número de "frequência média" esconde justamente o que interessa: se o
 * padrão está APERTANDO.
 *
 * ⚠️ **A janela é de SESSENTA MINUTOS**, e não "as últimas N contrações". O
 * "1" final do padrão combinado (5-1-1) quer dizer SUSTENTADO POR UMA HORA, e
 * o piso do NICHD para o pré-termo é seis POR HORA. Uma fita das "últimas
 * dez" responderia outra pergunta — e mudaria de escala a cada contração nova,
 * que é a pior coisa que um desenho de tendência pode fazer.
 *
 * ⚠️ **NÃO é o `GraficoClinico`.** Aquele é série temporal de VALOR (peso,
 * pressão, tempo até dez movimentos): um ponto por medida, uma linha ligando.
 * Aqui cada contração tem DURAÇÃO — ela ocupa um intervalo no eixo, não um
 * ponto — e o vão entre elas é metade da informação. Forçar um no molde do
 * outro apagaria uma das duas dimensões.
 *
 * ⚠️ E a intensidade entra como ALTURA, e não como uma quarta cor: a família
 * laranja já é a identidade da tela, e o vermelho está reservado para o
 * alarme. Altura é a codificação que sobra, e é a certa — "mais forte" lê como
 * "maior" sem precisar de legenda.
 */

export type ContracaoNaFita = {
  id: string;
  started_at: string;
  ended_at: string | null;
  intensity: number;
};

const HORA_MS = 3600000;

/** Altura da barra por intensidade, em fração da faixa. Leve · média · forte. */
const ALTURA: Record<number, string> = { 1: "40%", 2: "68%", 3: "100%" };

/**
 * @param agora  instante de referência, em ms. ⚠️ PARÂMETRO, nunca `Date.now()`
 *   aqui dentro — servidor e cliente calculariam origens diferentes e o React
 *   descartaria a árvore.
 */
export function FitaDeContracoes({
  contracoes,
  agora,
  sustentadoMin,
}: {
  contracoes: ContracaoNaFita[];
  agora: number;
  /** Há quantos minutos o padrão se mantém, quando há padrão. */
  sustentadoMin: number | null;
}) {
  const inicio = agora - HORA_MS;
  const naJanela = contracoes
    .map((c) => {
      const ini = new Date(c.started_at).getTime();
      const fim = c.ended_at ? new Date(c.ended_at).getTime() : agora;
      return { ...c, ini, fim };
    })
    .filter((c) => Number.isFinite(c.ini) && c.fim > inicio && c.ini <= agora)
    .sort((a, b) => a.ini - b.ini);

  /* ⚠️ Com uma só, a fita não é uma fita: é um traço solto que sugere um
     padrão onde há uma medida. A lista de baixo continua mostrando tudo. */
  if (naJanela.length < 2) return null;

  const emPorcento = (t: number) => ((Math.max(inicio, t) - inicio) / HORA_MS) * 100;

  return (
    <div className="rounded-3xl card-material p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-serif text-[15px] font-semibold text-orange-800">A última hora</p>
        <p className="text-xs text-muted-foreground">
          {naJanela.length} {naJanela.length === 1 ? "contração" : "contrações"}
        </p>
      </div>

      {/* A faixa. Cada barra ocupa o tempo que a contração durou; o vazio entre
          elas é o intervalo — que é o que a régua mede. */}
      <div
        className="relative mt-3 h-16 w-full overflow-hidden rounded-2xl bg-orange-50"
        role="img"
        aria-label={`${naJanela.length} contrações na última hora, desenhadas na linha do tempo: a largura de cada barra é a duração e o espaço entre elas é o intervalo.`}
      >
        {naJanela.map((c) => {
          const esq = emPorcento(c.ini);
          const dir = emPorcento(c.fim);
          /* Piso de largura: uma contração de 20 s numa hora vale 0,55% —
             invisível. O piso não mente sobre a ordem nem sobre o vão, que é o
             que a fita existe para mostrar. */
          const larg = Math.max(1.2, dir - esq);
          return (
            <div
              key={c.id}
              className={`absolute bottom-0 rounded-t-md ${
                c.ended_at ? "bg-orange-600" : "bg-orange-700 animate-pulse"
              }`}
              style={{
                left: `${esq}%`,
                width: `${larg}%`,
                height: ALTURA[c.intensity] ?? ALTURA[2],
              }}
            />
          );
        })}
      </div>

      <div className="mt-1 flex justify-between text-[13px] text-muted-foreground">
        <span>1 hora atrás</span>
        <span>agora</span>
      </div>

      {/* ⚠️ "Há quanto tempo o padrão se mantém" é a informação que quase nenhum
          app do gênero mostra — e ela já estava calculada na régua, sem
          ninguém desenhar. É ela que dá sentido ao "1" do padrão combinado. */}
      {sustentadoMin != null && sustentadoMin > 0 && (
        <p className="mt-2 text-sm text-orange-950">
          Elas estão vindo neste ritmo há <strong>{sustentadoMin} min</strong>.
        </p>
      )}

      <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
        A largura de cada barra é o tempo que a contração durou; o espaço entre elas é o intervalo.
        A altura é a intensidade que você marcou.
      </p>
    </div>
  );
}
