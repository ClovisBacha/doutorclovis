/**
 * As artes do site, reaproveitadas no app (uma cópia aqui divergiria da do
 * site no primeiro ajuste de arte). Caminho relativo a mobile/src/componentes.
 */
export const BOLHA = {
  feliz: require("../../../src/assets/bolha/feliz.webp"),
  comemorando: require("../../../src/assets/bolha/comemorando.webp"),
  dormindo: require("../../../src/assets/bolha/dormindo.webp"),
  surpresa: require("../../../src/assets/bolha/surpresa.webp"),
  orgulhosa: require("../../../src/assets/bolha/orgulhosa.webp"),
  apaixonado: require("../../../src/assets/bolha/apaixonado.webp"),
  estudiosa: require("../../../src/assets/bolha/estudiosa.webp"),
  exercicio: require("../../../src/assets/bolha/exercicio.webp"),
} as const;

/** As cinco artes do bebê (6, 10, 20, 30, 40 semanas) — `semanaDaArte` escolhe. */
export const BEBE: Record<number, number> = {
  6: require("../../../src/assets/bebes/semana-06.webp"),
  10: require("../../../src/assets/bebes/semana-10.webp"),
  20: require("../../../src/assets/bebes/semana-20.webp"),
  30: require("../../../src/assets/bebes/semana-30.webp"),
  40: require("../../../src/assets/bebes/semana-40.webp"),
};
