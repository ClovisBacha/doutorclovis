/**
 * O QUE CADA CHAVE DO PERFIL SIGNIFICA — os textos, num lugar só.
 *
 * ─── POR QUE UM ARQUIVO ─────────────────────────────────────────────────────
 *
 * A chave `perfil_publico` passou a ter DUAS portas: a tela de configurações da
 * Comunidade e o ritual de boas-vindas. E o texto dela é o consentimento —
 * `rede-social.tsx` já registra, por escrito, que "a explicação é a defesa:
 * 'não podemos expor a paciente sem ela saber' só é verdade se ela puder ler,
 * ali, o que ligar aquilo significa".
 *
 * Duas cópias desse texto divergem no primeiro ajuste, e a divergência aparece
 * como duas telas prometendo coisas diferentes sobre o MESMO interruptor —
 * exatamente o defeito que a auditoria acabou de achar quando `/p/<codigo>`
 * passou a publicar na web sob um texto que dizia "no app".
 *
 * ⚠️ **Texto de consentimento mora em `lib/`, como toda régua.** Enterrado num
 * componente, ele é o que ninguém revisa — e é o único texto do app cuja
 * imprecisão tem consequência jurídica.
 */

/**
 * A chave de dentro do app.
 *
 * ⚠️ **"No app", e a frase é literal.** Ela NÃO autoriza a página aberta na
 * internet: essa é `vitrine_publica`, chave própria, com texto próprio. As duas
 * andaram juntas por uma leva e foi um defeito.
 */
export const TEXTO_PERFIL_PUBLICO = {
  ligado:
    "Qualquer pessoa no app pode te achar e te acompanhar. " +
    "Cada publicação continua com a camada que você escolher.",
  desligado: "Só quem você aceitar te acompanha, e você não aparece na busca.",
} as const;

/**
 * O convite do ritual de boas-vindas.
 *
 * ⚠️ **Ele oferece, e nunca liga sozinho.** O padrão é DESLIGADO, como a chave
 * é no banco: um perfil que nasce aberto exporia milhares de gestantes de alto
 * risco por omissão, sem ninguém nunca ter pedido plateia. É a mesma decisão de
 * `PERFIL_PUBLICO_PADRAO`.
 *
 * ⚠️ **E ele NÃO promete gente.** "Conheça outras gestantes como você" promete
 * uma comunidade cheia a quem entra num app que pode ter cinco contas — e a
 * decepção acontece no primeiro minuto, que é o pior lugar para ela acontecer.
 * O texto descreve o que a CHAVE faz, e mais nada.
 *
 * ⚠️ **Nem promete cuidado.** Mesma proibição das frases do mascote e do
 * rodapé de convite: quem lê está grávida, e promessa clínica é do médico dela.
 */
export const CONVITE_DA_COMUNIDADE = {
  titulo: "Entrar na Comunidade",
  sub:
    "Outras gestantes podem te achar e acompanhar o que você publicar. " +
    "Dá para mudar quando quiser, no seu perfil.",
} as const;

/**
 * O ritual deve oferecer a Comunidade?
 *
 * ⚠️ **Nunca em Modo Cuidado.** O ritual só abre para conta recém-criada, então
 * o caso é raro — e é justamente por ser raro que ele passaria despercebido:
 * quem criou a conta depois de uma perda encontraria, no primeiro minuto, um
 * convite para virar visível numa rede de gestantes.
 */
export function ofereceAComunidade(f: { emCuidado: boolean }): boolean {
  return !f.emCuidado;
}
