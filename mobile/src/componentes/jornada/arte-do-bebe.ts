/**
 * O bebê ilustrado da semana: a ÚLTIMA arte já alcançada (as de 6, 10, 20, 30
 * e 40 semanas), nunca a próxima. Uma regra só para o app inteiro (18/11/2026,
 * a vistoria): o "semana a semana" usava a arte mais PRÓXIMA (`semanaDaArte`
 * do site) e, da 26 à 29 e da 36 à 39, mostrava outro bebê para a mesma
 * semana, adiantado. A tela do bebê, o semana a semana, a barra que nasce, a
 * festa da semana e o cartão dos Stories passam todos por aqui.
 */
const BEBES = [
  { desde: 0, arte: require("../../../../src/assets/bebes/semana-06.webp") },
  { desde: 10, arte: require("../../../../src/assets/bebes/semana-10.webp") },
  { desde: 20, arte: require("../../../../src/assets/bebes/semana-20.webp") },
  { desde: 30, arte: require("../../../../src/assets/bebes/semana-30.webp") },
  { desde: 40, arte: require("../../../../src/assets/bebes/semana-40.webp") },
] as const;

export function arteDoBebe(semana: number): number {
  return [...BEBES].reverse().find((b) => semana >= b.desde)!.arte;
}
