/**
 * A INTENSIDADE DA CONTRAÇÃO — o catálogo único dos três níveis.
 *
 * ⚠️ **ELE EXISTE PORQUE SÃO DOIS LEITORES, E OS DOIS PRECISAM CONCORDAR.**
 * Quem escolhe é a paciente (`contracoes-tab.tsx`); quem lê é ela, na lista, e
 * o MÉDICO, no prontuário (`prontuario-paciente.tsx`, via `clinical_events`).
 * E eles NÃO concordavam: o catálogo `INTENSITY_LABEL` morava dentro do
 * componente, então a tela dela dizia "Forte" e o painel imprimia
 * **"intensidade 3"** — um número cru que ele precisava decodificar, na linha
 * do tempo clínica.
 *
 * ⚠️ É palavra por palavra o defeito que a FORÇA DO MOVIMENTO teve e que
 * `forca-do-movimento.ts` consertou na leva anterior, deixado de pé no arquivo
 * vizinho. Este repositório registra essa forma tantas vezes que ela virou
 * regra: **a régua aplicada num lugar e esquecida no irmão é a maneira mais
 * comum de um defeito nascer aqui.**
 *
 * ⚠️ **OS TRÊS NÍVEIS FALAM — e esta é a diferença deliberada em relação à
 * força do movimento.** Lá o nível do meio é "como sempre", ou seja a AUSÊNCIA
 * de notícia, e por isso cala. Aqui não existe nível neutro: "Moderada" é uma
 * medida que ela tomou sobre a dor daquela contração, tão informativa quanto as
 * outras duas. Calá-la faria o prontuário mostrar buracos onde há dado.
 *
 * ⚠️ **E A INTENSIDADE NÃO É LIMIAR CLÍNICO.** Ela é autorrelato de dor, não
 * tem corte em diretriz nenhuma, e não entra em `sinais-clinicos.ts`. O que ela
 * faz é APARECER — na fita (como altura), na lista, no prontuário e na leitura
 * de tendência de `analise-de-contracoes.ts`, que a trata como FATO observável
 * ("elas estão ficando mais fortes") e nunca como gatilho de alarme.
 */

export type NivelDeIntensidade = {
  /** O que vai para `contraction_logs.intensity`. */
  valor: 1 | 2 | 3;
  /** O botão que ela toca durante a contração. */
  rotulo: string;
  /** A pastilha da linha da lista. */
  chip: string;
  /** O que o médico lê no prontuário — minúsculo, porque entra no meio da frase. */
  frase: string;
  /** O plural, para o resumo de um episódio inteiro. */
  plural: string;
};

export const NIVEIS_DE_INTENSIDADE: readonly NivelDeIntensidade[] = [
  { valor: 1, rotulo: "Leve", chip: "Leve", frase: "leve", plural: "leves" },
  { valor: 2, rotulo: "Moderada", chip: "Moderada", frase: "moderada", plural: "moderadas" },
  { valor: 3, rotulo: "Forte", chip: "Forte", frase: "forte", plural: "fortes" },
] as const;

/**
 * O que a tela mostra antes de ela marcar.
 *
 * ⚠️ É o nível do MEIO de propósito: a intensidade passou a ser marcada
 * DURANTE a contração (ver `contracoes-tab.tsx`), e o padrão de uma medida que
 * ela ainda não tomou tem de ser o centro da escala — abrir em "Leve" ou em
 * "Forte" empurraria o autorrelato para um dos lados de quem não mexeu.
 */
export const INTENSIDADE_PADRAO = 2;

/**
 * O nível, ou `null` fora do catálogo.
 *
 * ⚠️ Fora do catálogo devolve `null` — NUNCA o padrão. Quem escolhe o que
 * exibir na ausência de escolha é a TELA, num lugar só; cravar "moderada" aqui
 * faria o leitor AFIRMAR uma medida que ela não tomou. É a mesma régua de
 * `nivelDeForca`.
 */
export function nivelDeIntensidade(valor: number | null | undefined): NivelDeIntensidade | null {
  if (valor == null) return null;
  return NIVEIS_DE_INTENSIDADE.find((n) => n.valor === valor) ?? null;
}
