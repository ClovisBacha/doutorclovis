/**
 * PÔR UM ÍCONE NA LINHA DE BASE DO NÚMERO AO LADO.
 *
 * ─── O DEFEITO ──────────────────────────────────────────────────────────────
 *
 * A fita de estatísticas do Caminho (chama · calendário · troféu · saldo) usa
 * `items-center`: as CAIXAS dos ícones ficam centradas na linha. Mas o desenho
 * não ocupa a caixa toda, e cada arte tem uma margem interna diferente —
 * medidas nas próprias folhas:
 *
 *   · chama      → a tinta termina a 78,1% da altura da caixa
 *   · calendário → a 100% (o traço encosta na borda)
 *   · troféu     → a 98,3%
 *
 * Com as caixas centradas, isso põe as bases da tinta em três alturas
 * diferentes: 33,3 · 37,0 · 39,1 numa fita cuja base do texto está em 31,5. O
 * troféu é o que mais salta porque é a caixa mais alta E a tinta mais baixa —
 * ele fica pendurado 7,5px abaixo dos números.
 *
 * ─── A RÉGUA ────────────────────────────────────────────────────────────────
 *
 * Um alvo só, para todos: **a base da tinta pousa na linha de base do texto**.
 * É onde os algarismos apoiam, e é o que faz uma fila de ícones e números ler
 * como uma linha só em vez de coisas soltas.
 *
 * Deslocar por px cravado resolveria hoje e quebraria no primeiro ícone que
 * mudasse de tamanho — por isso a conta recebe a altura e devolve o
 * deslocamento, em vez de um número por ícone espalhado pela tela.
 */

/**
 * Distância da linha de base ao CENTRO da caixa de linha, em `em`.
 *
 * Medida na própria fita (18px, `font-extrabold`): base em 31,5 e centro da
 * linha em 26,0 → 5,5px, ou 0,3056em. É propriedade da fonte, não do ícone,
 * então escala junto com o tamanho do número.
 */
const BASE_ACIMA_DO_CENTRO = 0.3056;

export type Alinhamento = {
  /** Altura da caixa do ícone, em px. */
  altura: number;
  /**
   * Onde a TINTA termina dentro da caixa, de 0 a 1. Sai de medição na arte, e
   * nunca de estimativa: `1` para um traço que encosta na borda, `0.7813` para
   * a chama, `0.9833` para o troféu.
   */
  baseDaTinta: number;
  /** Tamanho da fonte do número ao lado, em px. */
  fonte?: number;
};

/**
 * Quanto mover o ícone no eixo Y (px). Negativo sobe.
 *
 * A caixa está centrada na linha, então a base da tinta está a
 * `altura × (baseDaTinta − 0,5)` abaixo do centro; a base do texto está a
 * `0,3056 × fonte` abaixo do mesmo centro. O deslocamento é a diferença.
 */
export function deslocamentoDaLinha({ altura, baseDaTinta, fonte = 18 }: Alinhamento): number {
  const baseDoTexto = BASE_ACIMA_DO_CENTRO * fonte;
  const baseDaArte = altura * (baseDaTinta - 0.5);
  return +(baseDoTexto - baseDaArte).toFixed(2);
}
