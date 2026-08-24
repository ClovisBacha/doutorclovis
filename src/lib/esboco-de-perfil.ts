/**
 * O ESBOÇO DO PERFIL — o que a tela já sabe antes de o servidor responder.
 *
 * ─── O DEFEITO QUE ISTO CONSERTA, e ele é o que o dono relatou ──────────────
 *
 * Palavras dele: _"quando eu vou entrar ali no feed, eu clico na foto ali do
 * paciente que fez a postagem, e às vezes demora muito tempo pra ler lá pra
 * área do perfil, demora ali cinco segundos, ou até mais"_.
 *
 * A causa não era só o servidor ser lento. `abrirPerfil` fazia
 * `setPerfil(null)` e trocava o destino — e a tela do perfil só é renderizada
 * quando `perfil` existe (`onde.t === "perfil" && perfil`). Com `perfil` nulo,
 * **nenhum ramo casava e a árvore caía de volta no FEED**.
 *
 * Ou seja: ela tocava no avatar e a tela não mudava. Nada piscava, nada
 * carregava, nenhum sinal de que o toque tinha sido registrado — e vários
 * segundos depois a tela saltava para o perfil. Do lado de quem usa, isso não
 * lê como "está carregando": lê como "o app travou", e a reação natural é
 * tocar de novo, o que dispara outra busca e piora o que já estava ruim.
 *
 * ⚠️ **Uma tela sem estado de carregamento transforma qualquer latência em
 * defeito percebido.** Meio segundo de espera com resposta visual é rápido;
 * meio segundo de tela imóvel é um app quebrado.
 *
 * ─── POR QUE O ESBOÇO PODE EXISTIR ─────────────────────────────────────────
 *
 * O feed **já tem** o nome, a foto e o selo de conta oficial de quem publicou —
 * eles estão desenhados no cartão em que ela acabou de tocar. Repetir esses
 * três na abertura do perfil não revela nada: é literalmente a informação que
 * estava na tela anterior, no mesmo instante, para a mesma pessoa.
 *
 * ⚠️ **E SÓ ESSES TRÊS.** Semana gestacional, nome do bebê, bio, contadores,
 * publicações e vínculo NÃO entram no esboço, mesmo quando o cliente teria como
 * adivinhar algum: quem decide o que aparece num perfil é `verPerfil`, no
 * servidor, cruzando Modo Cuidado, bloqueio nos dois sentidos, a camada de cada
 * post e as duas chaves do selo. Um esboço que mostrasse qualquer coisa além do
 * que já estava na tela anterior seria uma **segunda régua de visibilidade** —
 * exatamente o que este projeto proíbe desde `podeVerPost`.
 *
 * ⚠️ **O esboço nunca vira o perfil.** Ele é substituído pela resposta real, e
 * some inteiro quando ela é `indisponivel` (bloqueio, Modo Cuidado ou perfil
 * inexistente respondem a mesma palavra, e a tela não conta qual foi).
 */

/** O que o cartão do feed já tinha em mãos sobre quem publicou. */
export type PreviaDoAutor = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  /** Selo do consultório. Já estava desenhado no cartão do feed. */
  oficial?: boolean;
};

/**
 * O esboço, ou `null`.
 *
 * `null` quando não há o que desenhar — e aí a tela mostra o esqueleto sem
 * cabeçalho, que continua sendo melhor que voltar para o feed.
 */
export type EsbocoDePerfil = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  oficial: boolean;
};

/**
 * Monta o esboço a partir do que o feed sabia.
 *
 * ⚠️ **Nome vazio não vira esboço.** "Alguém" é o texto que o servidor usa
 * quando o `display_name` está em branco; repeti-lo aqui faria a abertura
 * mostrar "Alguém" e depois trocar pelo nome de verdade, que é a troca de
 * conteúdo sob os olhos de quem lê — o mesmo defeito que fez a frase do mascote
 * congelar depois de decidida.
 */
export function esbocoDoAutor(previa: PreviaDoAutor | null | undefined): EsbocoDePerfil | null {
  if (!previa?.id) return null;
  const nome = (previa.nome ?? "").trim();
  if (!nome || nome === "Alguém") return null;
  return {
    id: previa.id,
    nome,
    avatarUrl: previa.avatarUrl ?? null,
    oficial: previa.oficial === true,
  };
}

/**
 * Quantos quadrados o esqueleto da grade desenha.
 *
 * Nove, que é a grade de três colunas cheia até a dobra — o suficiente para a
 * tela ter a FORMA certa antes de ter o conteúdo. Menos que isso e a página
 * cresce embaixo do dedo quando as fotos chegam.
 */
export const QUADRADOS_DO_ESQUELETO = 9;
