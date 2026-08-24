/**
 * O RASCUNHO DO COMPOSITOR — o que sobrevive a fechar o app no meio.
 *
 * Pedido do dono (ideia 8): publicar exige foto + legenda + camada de
 * visibilidade num app que ela abre no ônibus, na fila do exame, com o celular
 * na mão e uma criança no colo. Gestante é interrompida o tempo todo, e hoje
 * qualquer interrupção apagava tudo.
 *
 * ─── AS TRÊS DECISÕES ──────────────────────────────────────────────────────
 *
 * ⚠️ **1. AS FOTOS NÃO ENTRAM.** Cada foto do post é um data URL de ~300 KB, e
 * cabem dez. Guardar isso encostaria nos ~5 MB de cota do `localStorage` — e o
 * que quebra quando a cota estoura NÃO é o rascunho: é a próxima gravação de
 * QUALQUER coisa, incluindo o `journey_state`, que carrega a jornada inteira
 * dela. Um recurso de conveniência não pode arriscar o progresso do jogo.
 * O rascunho guarda o que custou tempo de escrever; a foto ela escolhe de novo
 * em dois toques.
 *
 * ⚠️ **2. OFERECE, NUNCA PREENCHE SOZINHO.** Encher o campo com um texto de
 * três dias atrás no momento em que ela abre o compositor para postar outra
 * coisa é como uma publicação sai errada. A tela pergunta; ela decide.
 *
 * ⚠️ **3. A CHAVE CARREGA O ID DA CONTA.** O aparelho é compartilhado com mais
 * gente do que se imagina (o companheiro, a mãe, a irmã) — e o rascunho de uma
 * publicação sobre a gestação é texto íntimo. Sem o id na chave, quem entrasse
 * depois abriria o compositor com o rascunho da anterior.
 */

import type { Visibilidade } from "./rede-social";

/** Quanto tempo um rascunho continua valendo. */
export const VALIDADE_DIAS = 7;

export type RascunhoDoPost = {
  texto: string;
  visibilidade: Visibilidade;
  /** As opções da enquete, ou `null` quando não há enquete aberta. */
  enquete: string[] | null;
  /** Ela tinha marcado "anexar a aula de hoje"? */
  comAula: boolean;
  /**
   * Os ids de quem ela tinha marcado.
   *
   * ⚠️ Restaurados sem conferir nada — e isso é seguro porque quem confere é o
   * SERVIDOR, na publicação (`marcadasPermitidas`). Uma amiga que entrou em
   * Modo Cuidado nesse meio-tempo simplesmente não entra na gravação, sem a
   * tela precisar saber por quê.
   */
  marcadas: string[];
  /** Quando foi guardado (ISO). É o que a validade compara. */
  em: string;
};

/** A chave do aparelho, por CONTA. */
export function chaveDoRascunho(userId: string): string {
  return `dc-rede-rascunho-${userId}`;
}

/**
 * Vale a pena oferecer este rascunho de volta?
 *
 * ⚠️ **A camada de visibilidade sozinha NÃO conta.** Ela nasce preenchida
 * (`amigas` é o padrão), então um rascunho com só ela é o estado de quem abriu
 * o compositor e desistiu — e oferecer "você tinha um rascunho" sobre nada é a
 * forma mais barata de a tela perder a credibilidade.
 */
export function ehRascunhoUtil(r: RascunhoDoPost | null | undefined): boolean {
  if (!r) return false;
  if (r.texto.trim()) return true;
  if ((r.enquete ?? []).some((o) => o.trim())) return true;
  if (r.marcadas.length > 0) return true;
  if (r.comAula) return true;
  return false;
}

/**
 * Lê o que estava guardado, ou `null`.
 *
 * ⚠️ **Tolerante a lixo e a formato antigo.** O que está no `localStorage` foi
 * escrito por uma versão anterior do app, ou por nada — e um `JSON.parse` solto
 * aqui derrubaria a abertura do compositor. Na dúvida, é como se não houvesse
 * rascunho.
 */
export function lerRascunho(bruto: string | null, agora: Date): RascunhoDoPost | null {
  if (!bruto) return null;
  let o: unknown;
  try {
    o = JSON.parse(bruto);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;

  const em = typeof r.em === "string" ? r.em : "";
  const quando = em ? Date.parse(em) : NaN;
  if (!Number.isFinite(quando)) return null;
  /* Vencido some. Um texto de três semanas atrás oferecido de volta não é
     memória — é confusão. */
  const dias = (agora.getTime() - quando) / 86_400_000;
  if (dias > VALIDADE_DIAS || dias < -1) return null;

  const vis = r.visibilidade;
  const rascunho: RascunhoDoPost = {
    texto: typeof r.texto === "string" ? r.texto : "",
    visibilidade:
      vis === "publico" || vis === "seguidores" || vis === "amigas"
        ? vis
        : /* ⚠️ Formato desconhecido cai no MAIS FECHADO. O erro possível aqui é
             publicar para menos gente do que ela queria, nunca para mais — a
             mesma régua do padrão do compositor. */
          "amigas",
    enquete: Array.isArray(r.enquete)
      ? (r.enquete as unknown[]).filter((x): x is string => typeof x === "string")
      : null,
    comAula: r.comAula === true,
    marcadas: Array.isArray(r.marcadas)
      ? (r.marcadas as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    em,
  };
  return ehRascunhoUtil(rascunho) ? rascunho : null;
}

/** O que vai para o armazenamento. */
export function paraGuardar(
  r: Omit<RascunhoDoPost, "em">,
  agora: Date,
): { guardar: true; texto: string } | { guardar: false } {
  /* ⚠️ **CAMPO A CAMPO, e nunca `{ ...r }`.** O espalhamento gravava o que
     recebesse: uma foto acrescentada ao objeto do compositor entraria no
     `localStorage` mesmo sem existir no TIPO, porque `JSON.stringify` não
     conhece tipo nenhum. E o que quebra quando a cota de ~5 MB estoura não é
     este rascunho — é a PRÓXIMA gravação de qualquer coisa, inclusive o
     `journey_state`, que carrega a jornada inteira dela. O que não é copiado
     não é guardado. */
  const cheio: RascunhoDoPost = {
    texto: r.texto,
    visibilidade: r.visibilidade,
    enquete: r.enquete,
    comAula: r.comAula,
    marcadas: r.marcadas,
    em: agora.toISOString(),
  };
  /* ⚠️ Rascunho vazio APAGA o que estava lá, em vez de gravar um vazio: se ela
     apagou tudo, é porque desistiu daquele texto — e reoferecê-lo depois seria
     devolver o que ela acabou de tirar da tela. */
  if (!ehRascunhoUtil(cheio)) return { guardar: false };
  return { guardar: true, texto: JSON.stringify(cheio) };
}
