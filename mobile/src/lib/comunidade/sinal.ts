/**
 * "O feed precisa recarregar" — a tela de publicar marca, o feed consome ao
 * voltar ao foco. Publicar não devolve o post pronto (só o id), então a lista
 * tem de ser lida de novo; e o comentário novo, idem, na tela do post.
 */
let feedSujo = false;

export function marcarFeedSujo() {
  feedSujo = true;
}

export function consumirFeedSujo(): boolean {
  const era = feedSujo;
  feedSujo = false;
  return era;
}
