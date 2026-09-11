/**
 * A FILA DE CONTRAÇÕES — o cronômetro parou de depender da rede.
 *
 * ⚠️ **A CONTRAÇÃO SE PERDIA SEM REDE, E O CENÁRIO É O CARRO A CAMINHO DA
 * MATERNIDADE.** `startContraction` fazia `insert` direto no Supabase e
 * esperava a resposta: sem rede saía um toast — "Não foi possível registrar a
 * contração" — e a contração simplesmente não existia. Num 4G de elevador, de
 * estacionamento de hospital ou de quarto nos fundos, o app que ela abriu
 * justamente para não perder a conta era o que perdia a conta.
 *
 * E havia um segundo custo, que valia mesmo COM rede: o cronômetro só partia
 * depois do `insert` voltar. O dedo tocava, a dor já estava lá, e o relógio
 * começava a contar uma ou duas latências depois.
 *
 * ─── O DESENHO: TODA CONTRAÇÃO NASCE LOCAL ─────────────────────────────────
 *
 * A contração é gravada NO APARELHO no instante do toque e sobe ao servidor
 * quando ela FECHA. Isso troca duas escritas de rede (insert no começo, update
 * no fim) por uma só, e põe o único ponto de falha depois do fim da dor — não
 * no meio dela.
 *
 * ⚠️ **É por isso que a contração EM CURSO é retomada daqui, e não do banco.**
 * Ela fecha o app durante a contração e volta: o `started_at` que vale é o do
 * aparelho onde ela tocou. Ninguém troca de celular no meio de uma contração.
 *
 * ⚠️ **A CHAVE NÃO LEVA O PREFIXO `dc-path-`.** Aquele viaja no blob do
 * `journey_state` e dispara um PUSH a cada gravação — e aqui a gravação
 * acontece a cada toque, em trabalho de parto. E leva o id da CONTA: o
 * aparelho é compartilhado, e a contração de uma não pode aparecer na lista da
 * outra.
 */

export type ContracaoPendente = {
  /** Id local. Começa com `PREFIXO_LOCAL` — é o que distingue da linha do banco. */
  id: string;
  started_at: string;
  ended_at: string | null;
  intensity: number;
  /**
   * Quantas vezes já tentamos subir.
   *
   * ⚠️ Ela existe por causa da DUPLICATA: se o `insert` deu certo e a resposta
   * se perdeu no caminho, a segunda tentativa criaria uma segunda contração no
   * mesmo instante. A partir da primeira tentativa o chamador confere antes de
   * inserir — `contraction_logs` não tem chave única, então a chave natural é
   * o `started_at`, que é único por construção (ninguém começa duas contrações
   * no mesmo milissegundo).
   */
  tentativas: number;
};

export const PREFIXO_LOCAL = "local-";

/**
 * ⚠️ **SETE DIAS, e o limite existe pelo lado do `localStorage`.** Uma
 * contração pendente é dado clínico e não se joga fora por pressa — mas uma
 * fila eterna acumula, e a cota que estourar derruba a PRÓXIMA gravação de
 * qualquer coisa, inclusive o `journey_state`. Sete dias cobrem qualquer
 * viagem, internação ou troca de aparelho; depois disso o episódio já passou e
 * a linha não muda conduta nenhuma.
 */
export const VALIDADE_DIAS = 7;

export function ehLocal(id: string): boolean {
  return id.startsWith(PREFIXO_LOCAL);
}

export function chaveDaFila(uid: string): string {
  return `dc-contracoes-fila:${uid}`;
}

function seguro<T>(f: () => T, padrao: T): T {
  try {
    return f();
  } catch {
    /* `localStorage` lança em janela privada, com dados de site bloqueados e
       em captura de miniatura. Uma fila que estoura aqui derrubaria o toque
       que INICIA a contração. */
    return padrao;
  }
}

/**
 * O que ainda não subiu, já podado e em ordem cronológica.
 *
 * ⚠️ Ordem CRESCENTE: quem sincroniza insere na ordem em que aconteceram, e a
 * tela mescla com o servidor por instante. Devolver fora de ordem faria o
 * intervalo entre contrações — o número que decide ir à maternidade — sair
 * negativo em alguma linha.
 */
export function lerFila(uid: string, agora: number): ContracaoPendente[] {
  if (typeof window === "undefined" || !uid) return [];
  return seguro(() => {
    const cru = window.localStorage.getItem(chaveDaFila(uid));
    if (!cru) return [];
    const bruto: unknown = JSON.parse(cru);
    if (!Array.isArray(bruto)) return [];
    return podar(bruto.filter(ehPendente), agora);
  }, []);
}

export function gravarFila(uid: string, lista: readonly ContracaoPendente[]): void {
  if (typeof window === "undefined" || !uid) return;
  seguro(() => {
    if (!lista.length) window.localStorage.removeItem(chaveDaFila(uid));
    else window.localStorage.setItem(chaveDaFila(uid), JSON.stringify(lista));
    return null;
  }, null);
}

/** Poda o que venceu — e o que tem instante no FUTURO. */
export function podar(lista: readonly ContracaoPendente[], agora: number): ContracaoPendente[] {
  const limite = agora - VALIDADE_DIAS * 24 * 3600000;
  return [...lista]
    .filter((c) => {
      const t = new Date(c.started_at).getTime();
      /* ⚠️ Instante no futuro também vence: relógio adiantado e depois
         corrigido deixaria uma pendente eterna na fila. */
      return Number.isFinite(t) && t >= limite && t <= agora + 3600000;
    })
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
}

function ehPendente(x: unknown): x is ContracaoPendente {
  if (!x || typeof x !== "object") return false;
  const c = x as Partial<ContracaoPendente>;
  return (
    typeof c.id === "string" &&
    ehLocal(c.id) &&
    typeof c.started_at === "string" &&
    (c.ended_at === null || typeof c.ended_at === "string") &&
    typeof c.intensity === "number"
  );
}

/** Põe ou substitui um pacote na fila, devolvendo a lista nova. */
export function comPacote(
  lista: readonly ContracaoPendente[],
  pacote: ContracaoPendente,
  agora: number,
): ContracaoPendente[] {
  const sem = lista.filter((c) => c.id !== pacote.id);
  return podar([...sem, pacote], agora);
}

export function semPacote(lista: readonly ContracaoPendente[], id: string): ContracaoPendente[] {
  return lista.filter((c) => c.id !== id);
}

/**
 * As que estão prontas para subir: as ENCERRADAS.
 *
 * ⚠️ A contração em curso NÃO sobe. Ela ainda vai ganhar `ended_at`, e uma
 * linha sem fim no banco é exatamente o que a tela retoma como "contração
 * aberta" — ou seja, subir cedo faria o cronômetro de OUTRO carregamento
 * ressuscitar uma contração que já acabou.
 */
export function prontasParaSubir(lista: readonly ContracaoPendente[]): ContracaoPendente[] {
  return lista.filter((c) => c.ended_at != null);
}

/**
 * Mescla o que veio do servidor com o que ainda está no aparelho.
 *
 * ⚠️ **O `started_at` DESEMPATA, e é isso que impede a contração de aparecer
 * duas vezes** no segundo em que ela sobe: entre o `insert` dar certo e o
 * `load()` responder, a mesma contração existe nos dois lugares. Quem vence é
 * a do SERVIDOR — ela já tem o id de verdade, que é o que o botão de apagar e
 * o de corrigir precisam.
 */
export function mesclar<T extends { id: string; started_at: string }>(
  doServidor: readonly T[],
  pendentes: readonly ContracaoPendente[],
): (T | ContracaoPendente)[] {
  const jaTem = new Set(doServidor.map((c) => c.started_at));
  const sobra = pendentes.filter((c) => !jaTem.has(c.started_at));
  return [...doServidor, ...sobra].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
  );
}
