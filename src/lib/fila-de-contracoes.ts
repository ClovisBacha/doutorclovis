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
 *
 * ⚠️ **O MECANISMO MORA EM `fila-local.ts`, e este arquivo só declara a FORMA.**
 * A aba irmã (o contador de movimentos) ganhou a mesma fila, e duas cópias
 * escritas à mão divergiriam no primeiro conserto — com a divergência
 * aparecendo como uma das duas perdendo dado clínico em silêncio. O que fica
 * aqui é o que NÃO é genérico: o que a contração carrega, e o que conta como
 * pronta para subir.
 */
import {
  comPacote as comPacoteGenerico,
  ehLocal,
  gravarFilaEm,
  lerFilaDe,
  mesclar,
  podar as podarGenerico,
  PREFIXO_LOCAL,
  semPacote as semPacoteGenerico,
  VALIDADE_DIAS,
  type PacoteLocal,
} from "@/lib/fila-local";

export { ehLocal, mesclar, PREFIXO_LOCAL, VALIDADE_DIAS };

export type ContracaoPendente = PacoteLocal & {
  started_at: string;
  ended_at: string | null;
  intensity: number;
};

export function chaveDaFila(uid: string): string {
  return `dc-contracoes-fila:${uid}`;
}

export function lerFila(uid: string, agora: number): ContracaoPendente[] {
  if (!uid) return [];
  return lerFilaDe(chaveDaFila(uid), ehPendente, agora);
}

export function gravarFila(uid: string, lista: readonly ContracaoPendente[]): void {
  if (!uid) return;
  gravarFilaEm(chaveDaFila(uid), lista);
}

export function podar(lista: readonly ContracaoPendente[], agora: number): ContracaoPendente[] {
  return podarGenerico(lista, agora);
}

export function comPacote(
  lista: readonly ContracaoPendente[],
  pacote: ContracaoPendente,
  agora: number,
): ContracaoPendente[] {
  return comPacoteGenerico(lista, pacote, agora);
}

export function semPacote(lista: readonly ContracaoPendente[], id: string): ContracaoPendente[] {
  return semPacoteGenerico(lista, id);
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

/**
 * As que estão prontas para subir: as ENCERRADAS.
 *
 * ⚠️ A contração em curso NÃO sobe. Ela ainda vai ganhar `ended_at`, e uma
 * linha sem fim no banco é exatamente o que a tela retoma como "contração
 * aberta" — ou seja, subir cedo faria o cronômetro de OUTRO carregamento
 * ressuscitar uma contração que já acabou.
 *
 * ⚠️ É isto que NÃO é genérico: na fila de chutes tudo que entra já está
 * fechado, porque a contagem em curso mora em `sessao-guardada.ts`.
 */
export function prontasParaSubir(lista: readonly ContracaoPendente[]): ContracaoPendente[] {
  return lista.filter((c) => c.ended_at != null);
}
