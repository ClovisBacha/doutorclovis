/**
 * Log de auditoria (LGPD / segurança): registra ações sensíveis do super-admin
 * — mudança de plano de médico, criação de cupom, afiliado, flag, comunicado.
 * Best-effort: NUNCA lança (uma falha de log não pode derrubar a ação em si).
 */

export type AuditActor = { id?: string | null; email?: string | null };

export async function writeAudit(
  actor: AuditActor,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown> | null,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("audit_log").insert({
      actor_id: actor.id ?? null,
      actor_email: actor.email ?? null,
      action,
      target: target ?? null,
      meta: meta ?? null,
    });
  } catch {
    /* tabela ausente ou erro de rede → ignora (log é auxiliar) */
  }
}
