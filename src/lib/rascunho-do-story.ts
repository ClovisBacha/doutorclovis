/**
 * O RASCUNHO DO STORY — o que sobrevive a fechar o app no meio.
 *
 * O compositor de post já tinha rascunho (`rascunho-do-post.ts`); o de story,
 * não. E aqui a perda dói MAIS por uma razão que o post não tem: **o story
 * expira em 24 horas**. Perder o texto de um post custa reescrever; perder o de
 * um story pode custar a janela inteira em que aquilo fazia sentido — a foto do
 * ultrassom que ela ia publicar na saída do exame, a pergunta que ela ia abrir
 * naquela tarde.
 *
 * ─── AS MESMAS TRÊS DECISÕES DO RASCUNHO DO POST ───────────────────────────
 *
 * ⚠️ **1. A FOTO NÃO ENTRA.** É a decisão do post, pela mesma razão e com o
 * mesmo custo: um data URL de story chega a ~1,5 MB (é o teto do
 * `publicarStory`), e os ~5 MB de cota do `localStorage` são compartilhados com
 * o `journey_state`, que carrega a jornada inteira dela. O que quebra quando a
 * cota estoura não é o rascunho — é a PRÓXIMA gravação de qualquer coisa.
 *
 * ⚠️ E aqui a conta é ainda mais desfavorável que no post: um story é UMA foto,
 * que ela reescolhe em dois toques, contra até 560 caracteres de digitação
 * (200 do texto + seis opções de enquete de 60). O rascunho guarda o que custou
 * tempo.
 *
 * ⚠️ **2. OFERECE, NUNCA PREENCHE SOZINHO.** Encher o campo com o texto de
 * ontem no momento em que ela abre o compositor para publicar outra coisa é
 * como um story sai errado — e ele não dá para editar depois de publicado.
 *
 * ⚠️ **3. A CHAVE CARREGA O ID DA CONTA.** Aparelho compartilhado (o
 * companheiro, a mãe, a irmã) é o caso comum, e o rascunho de um story sobre a
 * gestação é texto íntimo.
 *
 * ─── E UMA DECISÃO QUE É SÓ DAQUI ──────────────────────────────────────────
 *
 * ⚠️ **A VALIDADE É DE UM DIA, e não de sete.** O rascunho do post vale uma
 * semana porque uma publicação continua fazendo sentido dali a dias. Um story é
 * uma coisa de HOJE: ele expira em 24 h depois de publicado, e um texto de
 * quatro dias atrás oferecido de volta não é memória, é confusão — pior aqui,
 * porque ela pode publicá-lo sem reler achando que é o de agora.
 */

/** Quanto tempo um rascunho de story continua valendo. */
export const VALIDADE_DIAS = 1;

export type RascunhoDoStory = {
  /** O texto que vai por cima da foto. */
  texto: string;
  /** As opções da enquete, ou `null` quando não há enquete aberta. */
  enquete: string[] | null;
  /** Ela tinha ligado a caixinha de perguntas neste story? */
  perguntaAberta: boolean;
  /**
   * Ela tinha ligado o carimbo da semana?
   *
   * ⚠️ **Restaurado sem conferir nada, e isso é seguro porque quem manda é o
   * SERVIDOR.** O carimbo é derivado na leitura a partir de `semanaPublica`:
   * quem já pariu, quem não tem DUM e quem passou de 42 semanas não recebem
   * carimbo nenhum, mesmo com o booleano ligado. Restaurar `true` num dia em
   * que a régua cala não publica semana nenhuma.
   */
  carimbarSemana: boolean;
  /**
   * A camada que ela tinha escolhido.
   *
   * ⚠️ **Guardada, e é obrigatório.** Sem ela, quem escreve um story marcado "só
   * amigas", é interrompida e recupera o rascunho publica ABERTO sem reparar —
   * o pior desfecho possível de um recurso de conveniência. Na leitura ela passa
   * por `camadaDoStory`, que faz desconhecido cair no PADRÃO e nunca no mais
   * aberto.
   */
  camada?: string;
  /** Quando foi guardado (ISO). É o que a validade compara. */
  em: string;
};

/**
 * A chave do aparelho, por CONTA.
 *
 * ⚠️ **O PREFIXO É PRÓPRIO, e não `dc-rede-rascunho-` com um sufixo.** A
 * primeira versão era `dc-rede-rascunho-story-${userId}`, que COMEÇA com a
 * chave do rascunho do post — e o teste pegou. Não é o risco teórico de um
 * `userId` chamado "story-…" (uuid nunca é isso): é que qualquer varredura por
 * prefixo, do tipo que este repositório já precisou fazer para não estourar a
 * cota do `localStorage`, levaria os dois de uma vez. Prefixos distintos são
 * de graça; a limpeza que apaga o rascunho errado não é.
 */
export function chaveDoRascunhoDeStory(userId: string): string {
  return `dc-rede-story-rascunho-${userId}`;
}

/**
 * Vale a pena oferecer este rascunho de volta?
 *
 * ⚠️ **OS DOIS INTERRUPTORES SOZINHOS NÃO CONTAM.** `carimbarSemana` e
 * `perguntaAberta` são um toque cada; oferecer "você tinha um rascunho" para
 * devolver um booleano é a forma mais barata de a tela perder a credibilidade —
 * e é a mesma razão pela qual a camada de visibilidade não conta no rascunho do
 * post. O que justifica a pergunta é TEXTO digitado.
 */
export function ehRascunhoUtil(r: RascunhoDoStory | null | undefined): boolean {
  if (!r) return false;
  if (r.texto.trim()) return true;
  if ((r.enquete ?? []).some((o) => o.trim())) return true;
  return false;
}

/**
 * Lê o que estava guardado, ou `null`.
 *
 * ⚠️ **Tolerante a lixo e a formato antigo**, como o do post: o que está no
 * `localStorage` foi escrito por uma versão anterior do app, ou por nada — e um
 * `JSON.parse` solto aqui derrubaria a abertura do compositor. Na dúvida, é
 * como se não houvesse rascunho.
 */
export function lerRascunhoDeStory(bruto: string | null, agora: Date): RascunhoDoStory | null {
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
  const dias = (agora.getTime() - quando) / 86_400_000;
  /* ⚠️ `dias < -1` recusa carimbo no FUTURO: relógio dessincronizado grava um
     `em` adiante, e sem esta linha o rascunho valeria para sempre. */
  if (dias > VALIDADE_DIAS || dias < -1) return null;

  const rascunho: RascunhoDoStory = {
    texto: typeof r.texto === "string" ? r.texto : "",
    enquete: Array.isArray(r.enquete)
      ? (r.enquete as unknown[]).filter((x): x is string => typeof x === "string")
      : null,
    perguntaAberta: r.perguntaAberta === true,
    carimbarSemana: r.carimbarSemana === true,
    camada: typeof r.camada === "string" ? r.camada : undefined,
    em,
  };
  return ehRascunhoUtil(rascunho) ? rascunho : null;
}

/** O que vai para o armazenamento. */
export function paraGuardar(
  r: Omit<RascunhoDoStory, "em">,
  agora: Date,
): { guardar: true; texto: string } | { guardar: false } {
  /* ⚠️ **CAMPO A CAMPO, e nunca `{ ...r }`.** É a lição já paga no rascunho do
     post: o espalhamento grava o que RECEBER, e uma foto acrescentada ao objeto
     do compositor entraria no `localStorage` mesmo sem existir no TIPO, porque
     `JSON.stringify` não conhece tipo nenhum. Num story a foto vai a 1,5 MB —
     um terço da cota inteira numa gravação só. O que não é copiado não é
     guardado. */
  const cheio: RascunhoDoStory = {
    texto: r.texto,
    enquete: r.enquete,
    perguntaAberta: r.perguntaAberta,
    carimbarSemana: r.carimbarSemana,
    camada: r.camada,
    em: agora.toISOString(),
  };
  /* ⚠️ Rascunho vazio APAGA o que estava lá, em vez de gravar um vazio: se ela
     apagou tudo, é porque desistiu daquele texto. */
  if (!ehRascunhoUtil(cheio)) return { guardar: false };
  return { guardar: true, texto: JSON.stringify(cheio) };
}
