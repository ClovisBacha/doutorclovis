/**
 * Tipos da especificação das 39 ilustrações do bebê.
 *
 * `scripts/bebes/especificacao.mjs` é JavaScript de propósito: ele roda por
 * `node` no pipeline de geração, sem passar por build. Mas o teste que trava a
 * régua de gordura (`src/lib/bebes-spec.test.ts`) importa dele, e o `tsc` do
 * projeto recusa import sem declaração.
 *
 * A saída fácil seria `// @ts-expect-error` no teste. Não serve: o teste passa
 * a mexer com `any` e perde justamente a checagem que faz dele um portão — um
 * campo renomeado na especificação passaria batido, que é exatamente a classe
 * de erro que já apareceu aqui (`marco` virou `marcoEn` e 21 prompts saíram
 * com `undefined`).
 */

declare module "*/scripts/bebes/especificacao.mjs" {
  /** Uma semana da série, de 4 a 42. */
  export type SemanaBebe = {
    /** Semana gestacional. */
    s: number;
    /**
     * O marco daquela semana é DESENHÁVEL?
     * `false` = é interno (órgãos, reflexos) e a diferença vem da pose.
     */
    visivel: boolean;
    /** A frase que a paciente lê no app — cópia de `BABY_BY_WEEK[n].desc`. */
    marco: string;
    /** A mesma frase em inglês, que é o que entra no prompt. */
    marcoEn?: string;
    /** O corpo naquela semana. */
    forma: string;
    /** O diferenciador visual quando o marco é interno. */
    pose: string;
  };

  export const SEMANAS: SemanaBebe[];
  export const ANCORAS: number[];
  export const ESTILO: string;
  /** Antes desta semana não se encadeia: não há rosto para preservar. */
  export const PRIMEIRA_SEMANA_ENCADEADA: number;
  /** A âncora de identidade da semana; `null` quando gera sem referência. */
  export function ancoraDe(semana: number): number | null;
  /** O prompt completo daquela semana, pronto para colar. */
  export function promptDa(semana: number): string;
}
