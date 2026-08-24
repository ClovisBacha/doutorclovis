/**
 * ONDE ELA PAROU DE LER — a régua, longe do DOM.
 *
 * Pedido do dono (ideia 4): que o feed guarde o lugar, do jeito que o modelo
 * faz. Hoje sair da aba e voltar devolve a paciente ao topo, e o feed é
 * cronológico: voltar ao topo é reler as mesmas cinco publicações e desistir
 * antes de chegar onde estava.
 *
 * ─── POR QUE O LUGAR É UM POST, E NUNCA UMA POSIÇÃO EM PIXELS ──────────────
 *
 * ⚠️ Guardar `scrollY` parece mais simples e é errado por construção: as fotos
 * do feed chegam por URL assinada e entram DEPOIS da primeira pintura, então a
 * altura da lista muda embaixo do número. Restaurar 2.400px devolve um ponto
 * arbitrário — às vezes o meio de uma foto, às vezes o rodapé. E basta uma
 * publicação nova no topo para todo o resto descer.
 *
 * O id do post é estável: se ele ainda está na lista, ela volta exatamente
 * para onde estava; se saiu (foi arquivado, ou a paciente ficou fora tempo
 * demais), o topo é a resposta certa e honesta.
 *
 * ─── E POR QUE ELE VENCE DEPRESSA ──────────────────────────────────────────
 *
 * ⚠️ Trinta minutos. "Onde eu parei" é uma pergunta sobre a MESMA sessão; um
 * lugar de ontem devolveria a paciente ao meio de um feed que mudou inteiro, e
 * o que ela quer de manhã é justamente o que apareceu de novo. Um lugar velho
 * é pior que nenhum, porque ela não tem como saber que o app a colocou ali de
 * propósito.
 */

/** Depois disto, o topo é a resposta certa. */
export const VALIDADE_MINUTOS = 30;

export type LugarNoFeed = {
  /** O post que estava no alto da tela quando ela saiu. */
  postId: string;
  /** ISO. */
  em: string;
};

/**
 * A chave carrega o ID DA CONTA.
 *
 * ⚠️ O aparelho é compartilhado — a irmã, a mãe, o marido. Sem o id, quem
 * entrasse depois começaria no lugar em que a outra parou, num feed de
 * publicações que não são as dela.
 */
export function chaveDoLugar(euId: string): string {
  return `dc-rede-lugar-${euId}`;
}

/** O que vai para o armazenamento. */
export function paraGuardar(postId: string, agora: Date): string | null {
  const id = (postId ?? "").trim();
  if (!id) return null;
  return JSON.stringify({ postId: id, em: agora.toISOString() } satisfies LugarNoFeed);
}

/**
 * Lê o lugar guardado — ou `null`.
 *
 * ⚠️ **Formato estranho vira `null`, nunca uma exceção.** Este valor pode ter
 * sido escrito por uma versão anterior, ou por outra aba, e derrubar a
 * Comunidade inteira por causa de um JSON torto seria trocar um conforto por
 * um defeito. É a mesma decisão de `lerRascunho`.
 */
export function lerLugar(cru: string | null | undefined, agora: Date): LugarNoFeed | null {
  if (!cru) return null;
  try {
    const o = JSON.parse(cru) as Partial<LugarNoFeed>;
    const id = typeof o.postId === "string" ? o.postId.trim() : "";
    const t = typeof o.em === "string" ? Date.parse(o.em) : NaN;
    if (!id || !Number.isFinite(t)) return null;
    const minutos = (agora.getTime() - t) / 60_000;
    /* ⚠️ Carimbo do FUTURO também é descartado: relógio dessincronizado (ou
       fuso trocado no meio) daria um lugar que nunca vence. */
    if (minutos < 0 || minutos > VALIDADE_MINUTOS) return null;
    return { postId: id, em: o.em as string };
  } catch {
    return null;
  }
}

/**
 * Vale voltar para lá?
 *
 * ⚠️ **Só se o post AINDA ESTIVER na lista.** Ele pode ter sido arquivado pela
 * autora, ou ter caído da primeira página. Rolar para um elemento que não
 * existe não faz nada — e a paciente ficaria no topo sem entender por que o
 * app às vezes guarda o lugar e às vezes não. Melhor não prometer.
 *
 * ⚠️ **E nunca para o PRIMEIRO da lista**: ela já está lá. Restaurar o topo
 * como se fosse um lugar guardado gasta uma rolagem à toa e, com o feed ainda
 * carregando imagens, dá um solavanco visível na tela.
 */
export function deveRestaurar(lugar: LugarNoFeed | null, idsNaTela: string[]): boolean {
  if (!lugar) return false;
  const i = idsNaTela.indexOf(lugar.postId);
  return i > 0;
}
