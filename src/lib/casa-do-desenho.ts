/**
 * O NÚMERO CALCULADO QUE VAI PARA A TELA PRECISA CASAR DOS DOIS LADOS.
 *
 * `Math.sin`/`Math.cos` devolvem float de 17 dígitos. O navegador ARREDONDA ao
 * ler de volta um atributo `style` ou um atributo de SVG — a CSSOM não guarda
 * dezessete casas —, então o React compara o que ele calculou com o que voltou,
 * vê que não bate, e **descarta a árvore inteira para redesenhá-la**.
 *
 * Medido nas duas vezes em que isto apareceu neste repositório:
 *
 *   trilha do Jogo   left: "31.615223689149722%"  ×  "31.6152%"
 *   anel do ciclo    cx={39.635166577877314}      ×  cx="39.63516657787733"
 *
 * ⚠️ **A RÉGUA MORA AQUI PORQUE JÁ ERAM DUAS TELAS.** Ela nasceu privada dentro
 * de `gestacao-path.tsx` (como `casaDaTrilha`), e o anel de fases do ciclo —
 * escrito noutro arquivo, meses depois — repetiu o defeito inteiro. Duas
 * cópias divergiriam no primeiro ajuste; nenhuma cópia é como a terceira tela
 * nasce com ele de novo.
 *
 * ⚠️ **VALE PARA ATRIBUTO DE SVG TAMBÉM, e não só para `style`.** A primeira
 * redação da lição falava só de `style`, e foi justamente num `cx` de
 * `<circle>` que ela reapareceu.
 *
 * Três casas: numa tela de 393px, 0,004px em porcentagem; num `viewBox` de
 * 220, 0,001 unidade. Abaixo de um pixel físico, e idêntico dos dois lados.
 */
export function casaDoDesenho(v: number): number {
  return Math.round(v * 1000) / 1000;
}
