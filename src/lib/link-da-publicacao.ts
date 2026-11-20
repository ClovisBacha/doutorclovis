/**
 * O LINK PÚBLICO DE UMA PUBLICAÇÃO.
 *
 * O perfil já tinha endereço (`/p/<codigo>`, a vitrine). Uma publicação sozinha
 * não tinha nenhum — não havia como mandar UMA foto para o WhatsApp da família.
 *
 * ⚠️ **O CÓDIGO É PRÓPRIO E SORTEADO, e NUNCA o uuid do post.** O uuid viaja em
 * toda reação, todo salvo, toda marcação e toda linha da caixa ♡: transformá-lo
 * em endereço público faria qualquer pessoa que já o tenha visto abrir a
 * publicação FORA do app, sem conta, para sempre. Um código próprio é uma
 * CAPACIDADE — só tem quem recebeu o link.
 *
 * ⚠️ **E ele nasce por publicação, não por conta**: dois posts da mesma
 * paciente têm códigos diferentes, então revogar um não derruba o outro.
 */

/** O alfabeto e o tamanho do código. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TAMANHO_DO_CODIGO = 10;

/**
 * Sorteia um código.
 *
 * ⚠️ **32^10 ≈ 10^15**, e a razão do tamanho é essa: com um código curto, um
 * varredor acharia publicações de gestantes por tentativa e erro — e o
 * conteúdo aqui é foto de barriga e de ultrassom. O alfabeto não tem `I`, `O`,
 * `0` nem `1`: o código é lido em voz alta e digitado à mão.
 */
export function codigoDaPublicacao(aleatorio: () => number = Math.random): string {
  let saida = "";
  for (let i = 0; i < TAMANHO_DO_CODIGO; i++) {
    saida += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
  }
  return saida;
}

/** Um código válido tem exatamente esta forma. */
export function codigoDaPublicacaoLimpo(bruto: string | null | undefined): string | null {
  const t = (bruto ?? "").trim().toUpperCase();
  return new RegExp(`^[${ALFABETO}]{${TAMANHO_DO_CODIGO}}$`).test(t) ? t : null;
}

/**
 * O endereço, ou `null` quando não há código.
 *
 * ⚠️ **`null` e não um link quebrado.** Sem código, o botão de compartilhar
 * pede que ela tente de novo — um endereço que abre "publicação indisponível"
 * é pior que nenhum: ela manda para trinta pessoas antes de descobrir.
 */
export function linkDaPublicacao(
  codigo: string | null | undefined,
  origem?: string,
): string | null {
  const limpo = codigoDaPublicacaoLimpo(codigo);
  if (!limpo) return null;
  /* ⚠️ `SITE`, e nunca `location.origin`: este link é COPIADO para o WhatsApp,
     e `origin` num preview da Vercel gravaria o endereço do preview na conversa
     para sempre. É a mesma decisão do link do chá de bebê, que já custou uma
     volta aqui. */
  const base = (origem ?? "https://www.obstetrica.com.br").replace(/\/+$/, "");
  return `${base}/pub/${limpo}`;
}
