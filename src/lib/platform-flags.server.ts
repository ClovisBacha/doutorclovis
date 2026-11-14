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

/**
 * ⚠️ **UMA FALHA DE LEITURA NÃO PODE DESARMAR O INTERRUPTOR — e ela desarmava.**
 *
 * A ausência de linha vale "ligado", e isso está certo: uma feature nova não
 * pode quebrar num banco que ainda não tem a tabela. O defeito era tratar
 * **falha de leitura** como ausência — e, pior, **GRAVAR essa falha no cache
 * por trinta segundos**.
 *
 * A conta: o dono desliga alguma coisa porque ela está causando dano. O banco
 * oscila. A leitura falha, o cache guarda "sem flag" (= ligado), e cada
 * requisição seguinte re-serve isso — e, enquanto a oscilação durar, cada
 * expiração do cache re-grava a mesma mentira. **O interruptor de emergência
 * fica inoperante justamente no momento em que ele é acionado**, sem erro na
 * tela e sem log.
 *
 * Duas correções, e as duas são sobre a direção da falha:
 *
 *   1. **Tabela AUSENTE continua valendo "ligado" e é cacheada** — é o caso
 *      esperado num banco atrás das migrations, e a resposta certa.
 *   2. **Qualquer outro erro serve o ÚLTIMO VALOR CONHECIDO** (mesmo vencido) e
 *      **não escreve no cache**. Sem valor anterior, responde "sem flag" — não
 *      há o que fazer melhor na primeira leitura da vida — mas também não
 *      grava, para a próxima requisição tentar de novo em vez de herdar o
 *      engano por trinta segundos.
 */
const AUSENTE = new Set(["42P01", "42P17", "PGRST205"]);

async function readFlag(key: string, nowMs: number): Promise<FlagRow> {
  const hit = cache.get(key);
  if (hit && hit.exp > nowMs) return hit.row;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_flags")
      .select("enabled,rollout_pct")
      .eq("key", key)
      .maybeSingle();
    if (error && !AUSENTE.has(String(error.code))) {
      /* Não consegui ler. O último valor conhecido é infinitamente melhor que
         "ligado" — e nada é gravado, para não congelar o engano. */
      return hit ? hit.row : null;
    }
    const row: FlagRow = data
      ? { enabled: !!data.enabled, rollout_pct: data.rollout_pct ?? 100 }
      : null;
    cache.set(key, { row, exp: nowMs + TTL_MS });
    return row;
  } catch {
    /* Idem: exceção de rede não vira "ligado" quando já se sabia o contrário. */
    return hit ? hit.row : null;
  }
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

/**
 * Opt-in ESTRITO: ligado só se existir linha da flag com enabled=true (ausência
 * = DESLIGADO). Para features novas que NÃO devem ligar sozinhas — o oposto do
 * kill switch. O rollout_pct continua valendo.
 */
export async function isFlagExplicitlyEnabled(key: string, userId?: string): Promise<boolean> {
  const row = await readFlag(key, Date.now());
  if (!row || !row.enabled) return false; // ausência ou desligado → OFF
  const pct = row.rollout_pct;
  if (pct >= 100) return true;
  if (pct <= 0) return false;
  if (!userId) return false; // sem usuário não segmenta → não liga por acidente
  return bucket(key + userId) < pct;
}

/** Limpa o cache (usado logo após o dono salvar uma flag). */
export function clearFlagCache(): void {
  cache.clear();
}
