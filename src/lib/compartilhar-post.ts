/**
 * COMPARTILHAR UMA PUBLICAÇÃO PARA FORA DO APP.
 *
 * ⚠️ **SÓ A PRÓPRIA, e essa é a regra inteira.**
 *
 * A tentação é copiar o Instagram, que deixa compartilhar o post de qualquer
 * um. Lá isso funciona porque o que sai é um LINK: quem abre passa pelas
 * mesmas travas de privacidade do perfil de origem. Aqui não existe página
 * pública de publicação, então o que sairia é a FOTO — e uma foto que sai do
 * app não volta.
 *
 * Compartilhar a ultrassom de outra paciente no WhatsApp da família, mesmo de
 * um post público, é tirar da autora a decisão de onde a imagem dela circula.
 * Ela escolheu publicar aqui, não em todo lugar.
 *
 * ⚠️ **E O LINK DE INDICAÇÃO VAI JUNTO.** Este é o único momento em que uma
 * paciente mostra o app a alguém de fora por vontade própria — sem o código,
 * a amiga que se interessar chega pela porta da frente e a indicação não é
 * atribuída a ninguém. É o mesmo defeito que o botão "Convidar" das Amigas
 * teve, mandando `/auth` puro.
 */

export type RecusaDeCompartilhar = "nao_e_sua" | "sem_conteudo";

export function podeCompartilharPost(v: {
  souAAutora: boolean;
  temImagem: boolean;
  temVideo: boolean;
  temTexto: boolean;
}): RecusaDeCompartilhar | null {
  if (!v.souAAutora) return "nao_e_sua";
  if (!v.temImagem && !v.temVideo && !v.temTexto) return "sem_conteudo";
  return null;
}

/**
 * O texto que vai junto com a imagem.
 *
 * ⚠️ **A LEGENDA DELA VEM PRIMEIRO, e o convite depois.** Invertido, o
 * compartilhamento lê como propaganda do aplicativo com uma foto anexada — e o
 * que ela quer mostrar é o bebê.
 *
 * ⚠️ **E SEM LINK NÃO HÁ FRASE DE CONVITE.** Um "conheça o app" sem endereço
 * não leva ninguém a lugar nenhum, e ocupa o espaço que a legenda dela poderia
 * usar. É a mesma decisão de `linkDeIndicacao` devolver `null`.
 */
export function textoDoCompartilhamento(
  legenda: string | null | undefined,
  link: string | null,
): string {
  const dela = (legenda ?? "").trim();
  if (!link) return dela;
  const convite = `Acompanho minha gestação aqui: ${link}`;
  return dela ? `${dela}\n\n${convite}` : convite;
}

/**
 * ⚠️ **O NAVEGADOR SABE COMPARTILHAR ARQUIVO?**
 *
 * `navigator.share` existe em quase todo celular, mas `share({ files })` é
 * outra coisa — e num navegador que aceita o primeiro e recusa o segundo, a
 * chamada falha DEPOIS de a paciente ter tocado, com a folha do sistema já
 * aberta. `canShare` responde antes.
 *
 * Sem suporte a arquivo, o caminho é o texto: pior, e ainda assim melhor que um
 * botão que não faz nada.
 */
export function comoCompartilhar(nav: {
  share?: unknown;
  canShare?: (d: { files?: unknown[] }) => boolean;
}): "arquivo" | "texto" | "nenhum" {
  if (typeof nav?.share !== "function") return "nenhum";
  try {
    if (typeof nav.canShare === "function" && nav.canShare({ files: [] })) return "arquivo";
  } catch {
    /* Alguns navegadores lançam em vez de responder `false`. */
  }
  return "texto";
}
