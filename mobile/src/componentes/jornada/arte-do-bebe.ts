/** O bebê ilustrado mais próximo da semana (as artes de 6, 10, 20, 30 e 40). */
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
