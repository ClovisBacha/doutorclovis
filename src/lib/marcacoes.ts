/**
 * MARCAR QUEM ESTAVA JUNTO — a régua.
 *
 * Pedido do dono (ideia 10): o post aparece nos dois perfis, e é a mecânica que
 * faz uma pessoa trazer outra sem nenhum convite.
 *
 * ─── AS QUATRO DECISÕES QUE ATRAVESSAM ESTE ARQUIVO ────────────────────────
 *
 * ⚠️ **1. SÓ DENTRO DO GRAFO JÁ CONECTADO.** Não há busca por nome aqui, e
 * nunca haverá: buscar por nome transformaria a base de pacientes numa lista
 * navegável, e num app de gestação de alto risco esse é o dado que menos pode
 * vazar. Marca-se quem já é amiga — a mesma régua (`saoAmigas`) que governa
 * Cantinho, dupla e presente.
 *
 * ⚠️ **2. A MARCADA PODE TIRAR A MARCAÇÃO.** Ter o próprio nome numa foto de
 * gestação de outra pessoa não é decisão de quem publicou. Sem essa saída, a
 * única defesa dela seria pedir para a amiga apagar o post inteiro.
 *
 * ⚠️ **3. A MARCAÇÃO NÃO AMPLIA A VISIBILIDADE.** Um post `amigas` marcado
 * continua visível só para as amigas de QUEM PUBLICOU. Se a marcação
 * escancarasse o post para a rede da marcada, ela viraria a porta dos fundos da
 * camada de visibilidade — e a camada é o recurso.
 *
 * ⚠️ **4. NÃO MANDA PUSH.** É a mesma régua de `avisoMandaPush`: o push deste
 * app é o canal do aviso de emergência. A marcação aparece na caixa de
 * Atividade, com emblema, e pode ser desfeita a qualquer momento — não há prazo
 * nem decisão presa esperando por ela, que é o que faria o push valer.
 */

/**
 * Quantas pessoas cabem numa marcação.
 *
 * Cinco, e o número tem razão: uma foto de gestação não é um evento de trinta
 * pessoas. É "eu e minha irmã", "eu e as meninas do grupo". Um teto baixo
 * também bota limite no custo — cada marcada exige conferir o vínculo, o
 * bloqueio e o Modo Cuidado, uma por uma, no servidor.
 */
export const MARCADAS_MAX = 5;

/** O que o servidor sabe sobre uma candidata a ser marcada. */
export type CandidataAMarcar = {
  id: string;
  /** Sou eu mesma? */
  souEu: boolean;
  /** O grafo de amizade, nos dois sentidos (`saoAmigas`). */
  somosAmigas: boolean;
  /** Alguma das duas bloqueou a outra. */
  bloqueio: boolean;
  /** Ela está em Modo Cuidado. */
  emCuidado: boolean;
};

/**
 * Pode marcar?
 *
 * ⚠️ **Modo Cuidado recusa, e recusa CALADO.** Quem perdeu a gestação não
 * aparece marcada numa foto de barriga — e a tela de quem marcou não pode dizer
 * o motivo, pela mesma razão que a lista de Amigas some sem anunciar: "Fulana
 * saiu" contaria a perda dela para outra pessoa. Do lado de quem publica, a
 * amiga simplesmente não está na lista.
 */
export function podeSerMarcada(c: CandidataAMarcar): boolean {
  if (c.souEu) return false;
  if (!c.somosAmigas) return false;
  if (c.bloqueio) return false;
  if (c.emCuidado) return false;
  return true;
}

/**
 * Filtra e limita o que veio do cliente.
 *
 * ⚠️ **Nunca confie na lista do corpo do pedido.** Um id forjado marcaria
 * qualquer paciente da plataforma numa foto — e o nome dela apareceria embaixo
 * de uma imagem que ela nunca viu. Esta função existe para ser chamada NO
 * SERVIDOR, com o que o banco respondeu sobre cada candidata.
 */
export function marcadasPermitidas(candidatas: CandidataAMarcar[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const c of candidatas) {
    if (vistas.has(c.id)) continue;
    vistas.add(c.id);
    if (!podeSerMarcada(c)) continue;
    saida.push(c.id);
    if (saida.length >= MARCADAS_MAX) break;
  }
  return saida;
}

/**
 * A linha "com Fulana" embaixo do nome de quem publicou.
 *
 * ⚠️ **Até dois nomes por extenso; do terceiro em diante, contagem.** Cinco
 * nomes numa linha estouram a largura de um iPhone e empurram a hora do post
 * para a linha de baixo — e o objetivo da linha é ser lida de relance, não
 * inventariada.
 */
export function textoDeMarcadas(nomes: string[]): string | null {
  const limpos = nomes.map((n) => n.trim()).filter(Boolean);
  if (limpos.length === 0) return null;
  if (limpos.length === 1) return `com ${limpos[0]}`;
  if (limpos.length === 2) return `com ${limpos[0]} e ${limpos[1]}`;
  const restam = limpos.length - 1;
  return `com ${limpos[0]} e mais ${restam}`;
}
