/**
 * DoctorThink — ORQUESTRADOR portável do fluxo do cérebro.
 *
 * Junta o núcleo puro (core.ts) com a porta de armazenamento (BrainStore) para
 * responder uma consulta: checa canal → busca semântica → fallback por palavras
 * → monta o bloco → registra hit/lacuna. NÃO conhece Supabase nem Obstétrica —
 * recebe o store e os rótulos de domínio por parâmetro. É o mesmo fluxo do
 * getBrainContext da Obstétrica, agora reutilizável por qualquer app.
 */
import type { BrainStore, BrainQuery, BrainContextResult } from "./contract";
import {
  assembleBrainBlock,
  rankEntriesByKeywords,
  type BrainBlockLabels,
  type BrainEntry,
} from "./core";

export type OrchestratorOptions = {
  /** Teto de entradas carregadas para o ranking por palavras. */
  maxEntriesLoaded: number;
  /** Quantas entradas entram no bloco (semântica e keyword). */
  maxEntriesScored: number;
};

export async function runBrainQuery(
  query: BrainQuery,
  store: BrainStore,
  labels: BrainBlockLabels,
  opts: OrchestratorOptions,
): Promise<BrainContextResult> {
  const profile = await store.loadProfile(query.doctorId);
  const enabledChannels = profile.channels;

  // Default-DENY: só serve se o canal estiver EXPLICITAMENTE habilitado no mapa
  // do profissional (plano + toggle). Canal desconhecido → nega (nada vaza).
  const channelOn = enabledChannels[query.channel] === true;
  if (!channelOn) return { block: "", hadCoverage: false, enabledChannels };

  const entries = await store.loadApprovedEntries(query.doctorId, opts.maxEntriesLoaded);

  // 1ª) Semântica (o store encapsula embedding + vetor). Falha/indisponível → null.
  let selected: BrainEntry[] = [];
  if (entries.length > 0) {
    const semantic = await store.semanticSearch(
      query.doctorId,
      query.message,
      opts.maxEntriesScored,
    );
    if (semantic && semantic.length > 0) selected = semantic;
  }
  // 2ª) Fallback por palavras (núcleo puro).
  if (selected.length === 0) {
    selected = rankEntriesByKeywords(query.message, entries, opts.maxEntriesScored);
  }

  // Miss registra lacuna (autoaprendizado) — nunca no canal de teste.
  if (selected.length === 0 && query.channel !== "teste") {
    store.logGap(query.doctorId, query.message, query.channel);
  }

  const block = assembleBrainBlock(
    { persona: profile.persona, samplePhrases: profile.samplePhrases, rules: profile.rules },
    selected,
    labels,
  );
  if (!block) return { block: "", hadCoverage: false, enabledChannels };

  store.logHit(query.doctorId, query.channel);
  return { block, hadCoverage: selected.length > 0, enabledChannels };
}
