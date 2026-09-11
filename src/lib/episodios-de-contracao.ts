/**
 * OS EPISÓDIOS DE CONTRAÇÃO — porque uma noite não são duzentas linhas.
 *
 * ⚠️ **A VIEW PROJETA UMA LINHA POR CONTRAÇÃO, E O PRONTUÁRIO DESENHAVA CADA
 * UMA.** Isso está certo no banco (`clinical_events` entrega números crus) e
 * era errado na tela: uma noite de trabalho de parto grava dezenas ou centenas
 * de linhas, e a linha do tempo do médico mostra **as quarenta primeiras**.
 * Medido no desenho: bastava uma noite cronometrada para as quarenta serem
 * todas "intensidade 2 · 45s" — e a pressão alterada, o sintoma e a
 * pré-consulta daquela semana saírem da tela sem nenhum sinal.
 *
 * É o mesmo mecanismo que fez `contracao` sair da FILA de trabalho
 * (`clinical.functions.ts`: "uma noite de trabalho de parto grava centenas de
 * linhas que consumiam o teto de 400"). Lá a resposta foi tirar da fila; aqui
 * não dá para tirar da linha do tempo sem esconder dado dela — a resposta é
 * AGRUPAR.
 *
 * ⚠️ **O QUE O MÉDICO PRECISA NÃO É A CONTRAÇÃO, É O EPISÓDIO.** "47
 * contrações em 4h, de 3 em 3 min, fortes" responde a pergunta que ele faz;
 * quarenta linhas soltas com o mesmo texto, não. E é a MESMA leitura que a
 * paciente já via na tela dela — sem isto, os dois lados do app olham o mesmo
 * dado e enxergam coisas diferentes.
 *
 * ⚠️ **NADA AQUI É LIMITE CLÍNICO.** A gravidade de contração continua vindo
 * de `sinais-clinicos.ts` (`sinalContracoesPrematuras`, `sinalContracoesFrequentes`),
 * que a régua da tela dela já aplica; este arquivo só descreve o que houve.
 */
import { nivelDeIntensidade } from "@/lib/intensidade-da-contracao";

export type ContracaoDoEpisodio = {
  /** Instante do começo, ISO. */
  em: string;
  /** 1–3, quando ela marcou. */
  intensidade?: number | null;
  /** Segundos, quando a contração foi encerrada. */
  duracaoSeg?: number | null;
};

export type EpisodioDeContracao = {
  /** ISO do começo da primeira contração do episódio. */
  inicio: string;
  /** ISO do começo da última. */
  fim: string;
  quantas: number;
  /** Duração do episódio, em minutos (do começo da primeira ao da última). */
  duracaoMin: number;
  /** Intervalo típico entre elas, em minutos. `null` com uma só. */
  intervaloMin: number | null;
  /** Duração média das encerradas, em segundos. `null` se nenhuma fechou. */
  duracaoSeg: number | null;
  /** A intensidade que mais apareceu, quando há maioria clara. */
  predominante: number | null;
};

/**
 * ⚠️ **DUAS HORAS DE FOLGA SEPARAM DOIS EPISÓDIOS, e o número não é
 * arbitrário:** é a MESMA janela que a tela da paciente usa para analisar o
 * padrão (`ANALYSIS_WINDOW_MS` em `contracoes-tab.tsx`). Se o app já considera
 * que uma contração de mais de duas horas atrás não descreve o padrão de
 * agora, duas contrações separadas por esse tanto não são o mesmo episódio.
 *
 * Um corte menor partiria uma noite real em pedaços (elas espaçam e voltam);
 * um bem maior juntaria a tarde e a madrugada numa linha só.
 */
export const FOLGA_ENTRE_EPISODIOS_MIN = 120;

/** Mediana — a média é arrastada por um vão longo no começo. */
function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/**
 * Agrupa as contrações em episódios, do mais RECENTE para o mais antigo.
 *
 * ⚠️ A ordem de saída é a da linha do tempo do prontuário (mais novo primeiro),
 * e a entrada pode vir em qualquer ordem: quem chama é a leitura da view, que
 * já ordena por `ocorrido_em desc`, e o rascunho de achados, que ordena
 * crescente. Ordenar aqui dentro é o que impede o chamador de decidir errado.
 */
export function episodiosDeContracao(
  contracoes: readonly ContracaoDoEpisodio[],
): EpisodioDeContracao[] {
  const ordenadas = [...contracoes]
    .filter((c) => Number.isFinite(new Date(c.em).getTime()))
    .sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime());
  if (!ordenadas.length) return [];

  const grupos: ContracaoDoEpisodio[][] = [[ordenadas[0]]];
  for (let i = 1; i < ordenadas.length; i++) {
    const folga =
      (new Date(ordenadas[i].em).getTime() - new Date(ordenadas[i - 1].em).getTime()) / 60000;
    if (folga > FOLGA_ENTRE_EPISODIOS_MIN) grupos.push([ordenadas[i]]);
    else grupos[grupos.length - 1].push(ordenadas[i]);
  }

  return grupos
    .map((g) => {
      const ts = g.map((c) => new Date(c.em).getTime());
      const intervalos: number[] = [];
      for (let i = 1; i < ts.length; i++) intervalos.push((ts[i] - ts[i - 1]) / 60000);
      const duracoes = g
        .map((c) => c.duracaoSeg)
        .filter((d): d is number => typeof d === "number" && d > 0);
      return {
        inicio: new Date(ts[0]).toISOString(),
        fim: new Date(ts[ts.length - 1]).toISOString(),
        quantas: g.length,
        duracaoMin: Math.round((ts[ts.length - 1] - ts[0]) / 60000),
        intervaloMin: intervalos.length ? Math.round(mediana(intervalos)) : null,
        duracaoSeg: duracoes.length
          ? Math.round(duracoes.reduce((s, d) => s + d, 0) / duracoes.length)
          : null,
        predominante: predominanteDe(g),
      };
    })
    .reverse();
}

/**
 * A intensidade que mais apareceu — e só quando há MAIORIA.
 *
 * ⚠️ Abaixo de 60% não existe "predominante": um episódio com quatro leves,
 * três moderadas e três fortes não é um episódio "leve", e rotulá-lo assim
 * seria o resumo AFIRMANDO uma leitura que os números não sustentam. Empate
 * também cala.
 */
function predominanteDe(g: readonly ContracaoDoEpisodio[]): number | null {
  const marcadas = g
    .map((c) => c.intensidade)
    .filter((n): n is number => typeof n === "number" && n >= 1 && n <= 3);
  if (!marcadas.length) return null;
  const conta = new Map<number, number>();
  for (const n of marcadas) conta.set(n, (conta.get(n) ?? 0) + 1);
  let melhor: number | null = null;
  let maior = 0;
  let empate = false;
  for (const [n, q] of conta) {
    if (q > maior) {
      maior = q;
      melhor = n;
      empate = false;
    } else if (q === maior) empate = true;
  }
  if (empate) return null;
  return maior / marcadas.length >= 0.6 ? melhor : null;
}

/**
 * O episódio em uma linha, para o médico.
 *
 * ⚠️ **O RÓTULO DA INTENSIDADE SAI DO CATÁLOGO ÚNICO**, nunca de um `if` de
 * número aqui: é o mesmo vocabulário que a tela dela usa, e duas tabelas
 * divergiriam no primeiro ajuste — com a divergência aparecendo como o painel
 * chamando de outra coisa o que ela marcou.
 *
 * ⚠️ **Cada peça só aparece quando existe.** Sem contração encerrada não há
 * duração; sem maioria clara não há predominante; com uma contração só não há
 * intervalo. Preencher qualquer uma delas com um padrão faria o resumo afirmar
 * uma medida que não foi tomada.
 */
export function fraseDoEpisodio(ep: EpisodioDeContracao): string {
  const partes: string[] = [ep.quantas === 1 ? "1 contração" : `${ep.quantas} contrações`];
  if (ep.quantas > 1) partes.push(`em ${duracaoCurta(ep.duracaoMin)}`);
  if (ep.intervaloMin != null) partes.push(`a cada ${ep.intervaloMin} min`);
  if (ep.duracaoSeg != null) partes.push(`~${ep.duracaoSeg}s`);
  const nivel = nivelDeIntensidade(ep.predominante);
  if (nivel) partes.push(ep.quantas === 1 ? nivel.frase : nivel.plural);
  return partes.join(", ");
}

/** "40 min" · "4h10" — minutos abaixo de uma hora, horas e minutos acima. */
export function duracaoCurta(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos < 0) return "—";
  const m = Math.round(minutos);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const resto = m % 60;
  return resto ? `${h}h${String(resto).padStart(2, "0")}` : `${h}h`;
}
