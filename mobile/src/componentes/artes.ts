/**
 * As artes da Bolha. Quase todas são as do site, reaproveitadas (caminho
 * relativo a mobile/src/componentes); o site não muda mais, então a que
 * precisa de conserto ganha uma cópia consertada no app, em
 * `mobile/assets/bolha/`.
 *
 * 23/11/2026, o dono: "a imagem dele de coração está ficando cortada em
 * cima" e "as imagens originais têm no Drive". Duas artes vinham CORTADAS na
 * borda de cima: o encaixe do script do site deixava os enfeites soltos fora
 * da conta. As duas foram refeitas das ORIGINAIS do Drive, inteiras, por
 * `mobile/scripts/bolha-do-drive.mjs`, com a bolha do mesmo tamanho: a
 * apaixonada desceu 62 px na tela de 960 (a bolhinha do alto cabe), a
 * estudiosa 22 px (a ponta do capelo). `artes-da-bolha.test.ts` cobra.
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
  apaixonado: require("../../assets/bolha/apaixonado.webp"),
  estudiosa: require("../../assets/bolha/estudiosa.webp"),
  exercicio: require("../../../src/assets/bolha/exercicio.webp"),
} as const;

/**
 * A BOLHA DO CÉU da tela do bebê (24/11/2026), já no tamanho EXATO em que ela
 * aparece (212 pt: 212, 424 e 636 px, o `@2x` e o `@3x` que o iOS escolhe),
 * reduzida da arte de 960 com o filtro de alta qualidade
 * (`mobile/assets/bolha/ceu/`). A de 960 na vista de 636 deixava o iOS
 * reduzir na placa de vídeo, com o filtro trilinear, que mistura a arte com
 * uma cópia pela metade: a Bolha saía desfocada (o dono, de novo, no build 56).
 */
export const BOLHA_DO_CEU = {
  feliz: require("../../assets/bolha/ceu/feliz.webp"),
  surpresa: require("../../assets/bolha/ceu/surpresa.webp"),
} as const;
