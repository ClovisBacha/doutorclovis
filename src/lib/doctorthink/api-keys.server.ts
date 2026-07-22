/**
 * Chaves de API do DoctorThink: geração, hashing e autenticação.
 * Guardamos só o HASH (sha256) — a chave crua aparece UMA vez, na criação.
 */
import { createHash, randomBytes } from "node:crypto";

/** Gera uma chave crua nova (prefixo dtk_ + 24 bytes hex). */
export function generateApiKey(): string {
  return "dtk_" + randomBytes(24).toString("hex");
}

/** Hash sha256 (hex) da chave — o que fica no banco. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Autentica uma chave crua (header Authorization: Bearer ... ou X-API-Key).
 * Retorna o inquilino se válida e ativa; null caso contrário. Atualiza
 * last_used_at (best-effort).
 */
export async function authApiKey(
  rawHeader: string | null | undefined,
): Promise<{ tenantId: string; doctorId: string | null } | null> {
  if (!rawHeader) return null;
  const key = rawHeader.trim().replace(/^Bearer\s+/i, "");
  if (!key) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("doctorthink_api_keys")
      .select("id,tenant_id,doctor_id,active")
      .eq("key_hash", hashApiKey(key))
      .maybeSingle();
    if (!data || data.active === false) return null;
    // Marca uso (best-effort, sem propagar erro).
    void (async () => {
      try {
        await (supabaseAdmin as any)
          .from("doctorthink_api_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", data.id);
      } catch {
        /* telemetria best-effort */
      }
    })();
    return {
      tenantId: data.tenant_id as string,
      doctorId: (data.doctor_id ?? null) as string | null,
    };
  } catch {
    return null;
  }
}
