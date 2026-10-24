/* eslint-disable */
/**
 * GERADO por scripts/gerar-sons-de-fundo.mjs — não edite à mão.
 *
 * Os sons de fundo da meditação, os MESMOS do site: laços de 30 s que emendam
 * sem costura (a síntese renderizada pelo motor do site; as oito gravações com
 * o laço fechado). `volume` é o nível que o som tinha ao vivo no site.
 */
import type { SomKey } from "@/lib/som-receitas";

export const SONS_DE_FUNDO: Record<SomKey, { arquivo: number; volume: number }> = {
  chuva: { arquivo: require("../../../assets/sons/fundo/chuva.m4a"), volume: 0.315 },
  "chuva-forte": { arquivo: require("../../../assets/sons/fundo/chuva-forte.m4a"), volume: 0.315 },
  "chuva-telhado": {
    arquivo: require("../../../assets/sons/fundo/chuva-telhado.m4a"),
    volume: 0.315,
  },
  "chuva-carro": { arquivo: require("../../../assets/sons/fundo/chuva-carro.m4a"), volume: 0.293 },
  tempestade: { arquivo: require("../../../assets/sons/fundo/tempestade.m4a"), volume: 0.291 },
  riacho: { arquivo: require("../../../assets/sons/fundo/riacho.m4a"), volume: 0.426 },
  cachoeira: { arquivo: require("../../../assets/sons/fundo/cachoeira.m4a"), volume: 0.252 },
  mar: { arquivo: require("../../../assets/sons/fundo/mar.m4a"), volume: 0.315 },
  lago: { arquivo: require("../../../assets/sons/fundo/lago.m4a"), volume: 0.315 },
  "vento-folhas": {
    arquivo: require("../../../assets/sons/fundo/vento-folhas.m4a"),
    volume: 0.288,
  },
  "vento-janela": {
    arquivo: require("../../../assets/sons/fundo/vento-janela.m4a"),
    volume: 0.272,
  },
  lareira: { arquivo: require("../../../assets/sons/fundo/lareira.m4a"), volume: 0.314 },
  fogueira: { arquivo: require("../../../assets/sons/fundo/fogueira.m4a"), volume: 0.985 },
  "floresta-noite": {
    arquivo: require("../../../assets/sons/fundo/floresta-noite.m4a"),
    volume: 0.143,
  },
  passaros: { arquivo: require("../../../assets/sons/fundo/passaros.m4a"), volume: 0.256 },
  sapos: { arquivo: require("../../../assets/sons/fundo/sapos.m4a"), volume: 0.405 },
  cigarras: { arquivo: require("../../../assets/sons/fundo/cigarras.m4a"), volume: 0.162 },
  coracao: { arquivo: require("../../../assets/sons/fundo/coracao.m4a"), volume: 0.315 },
  ventre: { arquivo: require("../../../assets/sons/fundo/ventre.m4a"), volume: 0.314 },
  pad: { arquivo: require("../../../assets/sons/fundo/pad.m4a"), volume: 0.199 },
  drone: { arquivo: require("../../../assets/sons/fundo/drone.m4a"), volume: 0.259 },
  tigela: { arquivo: require("../../../assets/sons/fundo/tigela.m4a"), volume: 0.315 },
  "sino-vento": { arquivo: require("../../../assets/sons/fundo/sino-vento.m4a"), volume: 0.315 },
  piano: { arquivo: require("../../../assets/sons/fundo/piano.m4a"), volume: 0.315 },
  aviao: { arquivo: require("../../../assets/sons/fundo/aviao.m4a"), volume: 0.298 },
  ventilador: { arquivo: require("../../../assets/sons/fundo/ventilador.m4a"), volume: 0.296 },
  "ar-condicionado": {
    arquivo: require("../../../assets/sons/fundo/ar-condicionado.m4a"),
    volume: 0.273,
  },
  secador: { arquivo: require("../../../assets/sons/fundo/secador.m4a"), volume: 0.31 },
  "maquina-lavar": {
    arquivo: require("../../../assets/sons/fundo/maquina-lavar.m4a"),
    volume: 0.315,
  },
  branco: { arquivo: require("../../../assets/sons/fundo/branco.m4a"), volume: 0.315 },
  rosa: { arquivo: require("../../../assets/sons/fundo/rosa.m4a"), volume: 0.263 },
  marrom: { arquivo: require("../../../assets/sons/fundo/marrom.m4a"), volume: 0.292 },
};

/** A arte de cada som (a do chip no site). Sem arte, o chip usa o emoji. */
export const ARTE_DO_SOM: Partial<Record<SomKey, number>> = {
  chuva: require("../../../../src/assets/sons/chuva.webp"),
  "chuva-forte": require("../../../../src/assets/sons/chuva-forte.webp"),
  "chuva-telhado": require("../../../../src/assets/sons/chuva-telhado.webp"),
  "chuva-carro": require("../../../../src/assets/sons/chuva-carro.webp"),
  tempestade: require("../../../../src/assets/sons/tempestade.webp"),
  riacho: require("../../../../src/assets/sons/riacho.webp"),
  cachoeira: require("../../../../src/assets/sons/cachoeira.webp"),
  mar: require("../../../../src/assets/sons/mar.webp"),
  lago: require("../../../../src/assets/sons/lago.webp"),
  "vento-folhas": require("../../../../src/assets/sons/vento-folhas.webp"),
  "vento-janela": require("../../../../src/assets/sons/vento-janela.webp"),
  lareira: require("../../../../src/assets/sons/lareira.webp"),
  fogueira: require("../../../../src/assets/sons/fogueira.webp"),
  "floresta-noite": require("../../../../src/assets/sons/floresta-noite.webp"),
  passaros: require("../../../../src/assets/sons/passaros.webp"),
  sapos: require("../../../../src/assets/sons/sapos.webp"),
  cigarras: require("../../../../src/assets/sons/cigarras.webp"),
  coracao: require("../../../../src/assets/sons/coracao.webp"),
  ventre: require("../../../../src/assets/sons/ventre.webp"),
  pad: require("../../../../src/assets/sons/pad.webp"),
  drone: require("../../../../src/assets/sons/drone.webp"),
  tigela: require("../../../../src/assets/sons/tigela.webp"),
  "sino-vento": require("../../../../src/assets/sons/sino-vento.webp"),
  piano: require("../../../../src/assets/sons/piano.webp"),
  aviao: require("../../../../src/assets/sons/aviao.webp"),
  ventilador: require("../../../../src/assets/sons/ventilador.webp"),
  "ar-condicionado": require("../../../../src/assets/sons/ar-condicionado.webp"),
  secador: require("../../../../src/assets/sons/secador.webp"),
  "maquina-lavar": require("../../../../src/assets/sons/maquina-lavar.webp"),
  branco: require("../../../../src/assets/sons/branco.webp"),
  rosa: require("../../../../src/assets/sons/rosa.webp"),
  marrom: require("../../../../src/assets/sons/marrom.webp"),
};
