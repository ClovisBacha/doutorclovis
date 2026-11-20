/**
 * As declarações do `.mjs` ao lado — ele é `.mjs` porque
 * `varrer-bancadas.mjs` roda por `node`, fora do build, e não importa `.ts`.
 *
 * ⚠️ **Sem este arquivo o `tsc` reprova o teste que a EXERCITA** (TS7016), e a
 * única saída seria duplicar a régua em `.ts` — que é exatamente a segunda
 * cópia que ela existe para não ter: a varredura e o teste passariam a medir
 * réguas diferentes, e a divergência apareceria como a catraca aprovando o
 * defeito que ela documenta.
 */
export function porQueSePerdeu(pedido: string, efetivo: string | null): string | null;
export function parametrosPerdidos(pedida: string, efetiva: string): string[];
