/**
 * API keys do DoctorThink standalone: geração, hash (sha256) e autenticação.
 * Guardamos só o hash — a chave crua aparece uma vez, na criação.
 */
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export function generateApiKey(): string {
  return "dtk_" + randomBytes(24).toString("hex");
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Autentica pelo header Authorization/X-API-Key. null se inválida/inativa. */
export async function authApiKey(
  header: string | null | undefined,
): Promise<{ tenantId: string; doctorId: string | null } | null> {
  if (!header) return null;
  const key = header.trim().replace(/^Bearer\s+/i, "");
  if (!key) return null;
  try {
    const { data } = await db
      .from("doctorthink_api_keys")
      .select("id,tenant_id,doctor_id,active")
      .eq("key_hash", hashApiKey(key))
      .maybeSingle();
    if (!data || data.active === false) return null;
    db.from("doctorthink_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id)
      .then(
        () => {},
        () => {},
      );
    return {
      tenantId: data.tenant_id as string,
      doctorId: (data.doctor_id ?? null) as string | null,
    };
  } catch {
    return null;
  }
}
