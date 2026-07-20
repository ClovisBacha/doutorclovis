/**
 * Feature flags / kill switch. Semântica à prova de acidente:
 *  - SEM linha para a chave → ligado (a ausência nunca quebra uma feature).
 *  - linha com enabled=false → desligado (kill switch do dono).
 *  - rollout_pct < 100 → liberação gradual determinística por usuário (hash).
 *
 * Cache em memória de 30s por chave para não bater no banco a cada request.
 */

type FlagRow = { enabled: boolean; rollout_pct: number } | null;
const cache = new Map<string, { row: FlagRow; exp: number }>();
const TTL_MS = 30_000;

/** Hash estável 0..99 a partir de uma string (djb2). */
function bucket(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i);
  return Math.abs(h) % 100;
}

async function readFlag(key: string, nowMs: number): Promise<FlagRow> {
  const hit = cache.get(key);
  if (hit && hit.exp > nowMs) return hit.row;
  let row: FlagRow = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("platform_flags")
      .select("enabled,rollout_pct")
      .eq("key", key)
      .maybeSingle();
    row = data ? { enabled: !!data.enabled, rollout_pct: data.rollout_pct ?? 100 } : null;
  } catch {
    row = null; // tabela ausente → trata como "sem flag" → ligado
  }
  cache.set(key, { row, exp: nowMs + TTL_MS });
  return row;
}

/** A feature `key` está ligada para este usuário? */
export async function isFlagEnabled(key: string, userId?: string): Promise<boolean> {
  const row = await readFlag(key, Date.now());
  if (!row) return true; // sem linha → ligado
  if (!row.enabled) return false; // kill switch
  const pct = row.rollout_pct;
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  if (!userId) return true; // sem usuário não dá pra segmentar → não bloqueia
  return bucket(key + userId) < pct;
}

/** Limpa o cache (usado logo após o dono salvar uma flag). */
export function clearFlagCache(): void {
  cache.clear();
}
