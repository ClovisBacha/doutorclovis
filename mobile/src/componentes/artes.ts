/**
 * As artes do site, reaproveitadas no app (uma cópia aqui divergiria da do
 * site no primeiro ajuste de arte). Caminho relativo a mobile/src/componentes.
 *
 * As cinco artes do bebê (`BEBE`, 6 a 40 semanas) saíram em 19/11/2026: o app
 * não desenha mais o bebê, e a Bolha é a personagem (`sem-bebe-ilustrado.test.ts`).
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
