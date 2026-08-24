/**
 * QUAL DAS CINCO ARTES DO DRIVE DESENHA CADA SEMANA — e os cinco estágios.
 *
 * A régua mora aqui, e não em `components/baby-illustration.tsx`, por um motivo
 * mecânico: aquele arquivo abre com cinco `import` de `.webp`, e um teste
 * morreria na primeira linha. É a mesma razão pela qual `fala-do-mascote.ts`
 * ficou fora do componente que importa a `Bolha`.
 *
 * O componente continua dono das ARTES (o `src` e a `tinta` medida de cada
 * arquivo); o que subiu para cá é só a decisão de QUAL SEMANA cada uma
 * representa, que é o que precisa concordar com os estágios.
 */

import { WEEK_MIN, WEEK_MAX, type BabyStage } from "@/lib/gestacao";

/** As cinco semanas que o dono aprovou, em ordem. */
export const SEMANAS_DAS_ARTES = [6, 10, 20, 30, 40] as const;

export const STAGE_RANGES: Record<BabyStage, [number, number]> = {
  embriao: [4, 9],
  inicial: [10, 15],
  feto: [16, 27],
  tardio: [28, 36],
  termo: [37, 42],
};

/**
 * A arte MAIS PRÓXIMA da semana, com empate para a mais NOVA.
 *
 * Empate para baixo não é detalhe de implementação: na 15 e na 25 a distância é
 * a mesma para os dois lados, e mostrar um bebê mais desenvolvido do que ele
 * está é o erro que um app de gestação não pode cometer. Adiantar a arte
 * antecipa marcos — cabelo, unhas, gordura — que ainda não existem.
 *
 * Faixas que isto produz: 4–8 → 6 · 9–15 → 10 · 16–25 → 20 · 26–35 → 30 ·
 * 36–42 → 40.
 */
export function semanaDaArte(week: number): number {
  const w = Math.max(WEEK_MIN, Math.min(WEEK_MAX, Math.round(week)));
  let melhor = SEMANAS_DAS_ARTES[0] as number;
  for (const s of SEMANAS_DAS_ARTES) {
    if (Math.abs(s - w) < Math.abs(melhor - w)) melhor = s;
  }
  return melhor;
}

/**
 * A semana que REPRESENTA um estágio na Jornada do Bebê.
 *
 * ⚠️ Existe porque a régua de cima é a errada para uma lista rotulada por
 * estágio. As cinco artes são 6 · 10 · 20 · 30 · 40 e os cinco estágios têm
 * bordas próprias: na 27ª semana (fim do "feto") a arte mais próxima é a de 30,
 * que é a do "tardio". A linha "você está aqui · Feto" e a linha seguinte
 * mostravam O MESMO desenho — e a jornada, que existe para mostrar a mudança,
 * passava a negá-la. Vale para 26–27 e para a 36.
 *
 * O meio do intervalo cai na arte daquele estágio nos cinco casos (é o que
 * `arte-do-bebe.test.ts` cobra), então as cinco linhas ficam com cinco desenhos
 * diferentes, sempre.
 */
export function semanaTipicaDoEstagio(stage: BabyStage): number {
  const [min, max] = STAGE_RANGES[stage];
  return Math.round((min + max) / 2);
}
