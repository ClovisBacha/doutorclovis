/**
 * A RÉGUA DE MESCLA DA JORNADA — local × nuvem (`journey_state.data`).
 *
 * É a mesma de `mergeJourneyValue` do site (src/lib/journey-sync.ts), copiada
 * em puro porque aquele arquivo importa `sonner` (DOM) e não entra no app.
 * Se uma mudar, a outra muda junto — `sincronia.test.ts` ancora os casos.
 *
 * O blob inteiro é last-write-wins, mas o PROGRESSO só cresce: dias feitos,
 * figurinhas e os checks de cada dia nunca "desfazem". Por isso, ao baixar:
 *   · listas de dias/figurinhas → união ordenada;
 *   · `dc-path-lessons` (nota por semana) → a maior vence;
 *   · `dc-path-(pos-)day-<D>` → OU das flags (uma vez feito, feito);
 *   · o resto (estado mutável) → a nuvem vence;
 *   · chave que só existe aqui → fica (é progresso que ainda não subiu).
 */

import { PREFIXO, type Blob } from "~/lib/jornada/momentos";

const LISTAS_QUE_SO_CRESCEM = new Set([
  "dc-path-done-days",
  "dc-path-pos-done-days",
  "dc-path-stickers",
  "dc-path-pos-stickers",
]);

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function mesclarValor(chave: string, local: unknown, nuvem: unknown): unknown {
  if (LISTAS_QUE_SO_CRESCEM.has(chave)) {
    if (Array.isArray(local) && Array.isArray(nuvem)) {
      return Array.from(new Set([...local, ...nuvem])).sort((a, b) => a - b);
    }
    return nuvem;
  }
  if (chave === "dc-path-lessons") {
    if (ehObjeto(local) && ehObjeto(nuvem)) {
      const fora: Record<string, unknown> = { ...nuvem };
      for (const [s, v] of Object.entries(local)) {
        const atual = fora[s];
        if (typeof v === "number" && (typeof atual !== "number" || v > atual)) fora[s] = v;
      }
      return fora;
    }
    return nuvem;
  }
  if (/^dc-path-(pos-)?day-\d+$/.test(chave)) {
    if (ehObjeto(local) && ehObjeto(nuvem)) {
      const fora: Record<string, unknown> = { ...nuvem };
      for (const [t, v] of Object.entries(local)) if (v) fora[t] = true;
      return fora;
    }
    return nuvem;
  }
  return nuvem;
}

/**
 * Mescla o blob local com o da nuvem. `localTinhaExtra` diz se sobrou algo
 * que a nuvem não tem — aí o chamador empurra de volta para ela convergir.
 */
export function mesclarBlob(
  local: Blob,
  nuvem: Blob,
): { blob: Blob; localTinhaExtra: boolean } {
  const fora: Blob = {};
  let localTinhaExtra = false;
  const chaves = new Set<string>();
  for (const k of Object.keys(local)) if (k.startsWith(PREFIXO)) chaves.add(k);
  for (const k of Object.keys(nuvem)) if (k.startsWith(PREFIXO)) chaves.add(k);
  for (const k of chaves) {
    const temNaNuvem = Object.prototype.hasOwnProperty.call(nuvem, k);
    if (!temNaNuvem) {
      fora[k] = local[k];
      localTinhaExtra = true;
      continue;
    }
    const temLocal = Object.prototype.hasOwnProperty.call(local, k);
    const mesclado = temLocal ? mesclarValor(k, local[k], nuvem[k]) : nuvem[k];
    if (JSON.stringify(mesclado) !== JSON.stringify(nuvem[k])) localTinhaExtra = true;
    fora[k] = mesclado;
  }
  return { blob: fora, localTinhaExtra };
}
