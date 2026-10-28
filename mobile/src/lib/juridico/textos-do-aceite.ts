/**
 * Os textos do aceite — o cadastro e a tela que aparece quando os termos mudam
 * (ou para quem entrou pela Apple e nunca aceitou nada). Num lugar só, para o
 * cadastro e o aceite pedirem exatamente a mesma coisa.
 *
 * Sem react-native: é testado pelo bun.
 */

/**
 * O consentimento do dado de saúde — específico e destacado (LGPD, art. 11, I):
 * diz QUAIS dados, PARA QUÊ, e onde ler mais. É exatamente a lista do que o app
 * guarda de saúde (decisão do dono de 21/10/2026).
 */
export const TEXTO_DO_CONSENTIMENTO_DE_SAUDE =
  "Autorizo o app a guardar e usar os meus dados de saúde — o cartão do SOS (tipo sanguíneo, alergias e medicações), a datação da gestação, o nascimento e os movimentos do bebê — para o SOS e o acompanhamento do bebê, como explica a Política de privacidade.";

/** O essencial, em linguagem simples, antes das caixas. */
export const PONTOS_DO_ACEITE: readonly string[] = [
  "O Obstétrica é uma comunidade de gestantes e mães, com um jogo de cuidado diário. Ele não dá orientação médica: em emergência, use o SOS ou ligue 192.",
  "De saúde, o app guarda só o que o SOS e o acompanhamento do bebê usam: o cartão do SOS, a datação da gestação, o nascimento e os movimentos do bebê.",
  "No SOS, a sua localização vai para quem você cadastrou como contato de emergência e para quem acompanha a sua gestação.",
  "O que você publica na Comunidade aparece para quem você escolher. Respeito é regra: há denúncia, bloqueio e moderação.",
  "Você pode excluir a conta quando quiser, no Perfil, e isso apaga os seus dados.",
];
