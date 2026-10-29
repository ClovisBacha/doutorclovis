import { RESPOSTA_DO_SOCORRO } from "@/lib/socorro-na-nutricao";

/**
 * A RESPOSTA DO SOCORRO NO APP — a do site, menos uma promessa.
 *
 * A régua (`pedeSocorro`) e o título são os do site, sem mudar uma letra. O
 * TEXTO do site diz que o botão vermelho "avisa o seu médico" — e este app
 * não tem médico vinculado nesta versão (decisão do dono). Prometer que
 * alguém vai ver, para quem está escrevendo um sinal de pré-eclâmpsia, é a
 * mentira que este produto não conta.
 *
 * Por isso: o primeiro e o último parágrafos do site (o "não é assunto de
 * cardápio" e o "não espere resposta por aqui"), e no meio o caminho que
 * EXISTE no app: 192 e o SOS, que fala com o contato de emergência.
 * `socorro.test.ts` quebra se o site mudar a forma do texto.
 */
const DO_SITE = RESPOSTA_DO_SOCORRO.split("\n\n");

export const MEIO_DO_SOCORRO_NO_APP =
  "Ligue 192 (SAMU) agora. Se puder, use também o SOS do app para avisar o seu contato de emergência.";

export const RESPOSTA_DO_SOCORRO_NO_APP = [
  DO_SITE[0],
  MEIO_DO_SOCORRO_NO_APP,
  DO_SITE[DO_SITE.length - 1],
].join("\n\n");
