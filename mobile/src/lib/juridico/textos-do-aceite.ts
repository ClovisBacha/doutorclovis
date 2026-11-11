/**
 * Os textos do aceite — o cadastro e a tela que aparece quando os termos mudam
 * (ou para quem entrou pela Apple e nunca aceitou nada). Num lugar só, para o
 * cadastro e o aceite pedirem exatamente a mesma coisa.
 *
 * Escritos para o app de 11/11/2026 (decisão do dono): um jogo para aprender
 * sobre a gestação, sem o SOS e sem a Comunidade (`SOS_NO_APP` e
 * `COMUNIDADE_NO_APP` desligados em `config.ts`). Religou um deles? Estes
 * textos, os Termos e a Privacidade voltam a descrevê-lo.
 *
 * Sem react-native: é testado pelo bun.
 */

/**
 * O consentimento do dado de saúde — específico e destacado (LGPD, art. 11, I):
 * diz QUAIS dados, PARA QUÊ, e onde ler mais. É exatamente a lista do que o app
 * guarda de saúde.
 */
export const TEXTO_DO_CONSENTIMENTO_DE_SAUDE =
  "Autorizo o app a guardar e usar os meus dados de saúde — a datação da gestação, o nascimento e os movimentos do bebê — para montar a trilha de cada semana e acompanhar o bebê, como explica a Política de privacidade.";

/** A caixa dos Termos, igual no cadastro e no aceite. */
export const TEXTO_DOS_TERMOS = "Li e concordo com os Termos de uso e a Política de privacidade.";

/** O essencial, em linguagem simples, antes das caixas. */
export const PONTOS_DO_ACEITE: readonly string[] = [
  "O Obstétrica é um jogo para aprender sobre a gestação, um pouco por dia — como um Duolingo para gestantes. Ele não dá orientação médica: em emergência, ligue 192.",
  "De saúde, o app guarda só o que a trilha e o acompanhamento do bebê usam: a datação da gestação, o nascimento e os movimentos do bebê.",
  "As suas amigas no app veem o seu nome, a sua foto, o nome do bebê e o seu progresso no jogo — nunca um dado de saúde.",
  "Você pode baixar uma cópia dos seus dados e excluir a conta quando quiser, no Perfil.",
];
