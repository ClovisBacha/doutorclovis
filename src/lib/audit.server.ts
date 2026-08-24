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
    const { error } = await (supabaseAdmin as any).from("audit_log").insert({
      actor_id: actor.id ?? null,
      actor_email: actor.email ?? null,
      action,
      target: target ?? null,
      meta: meta ?? null,
    });
    /* "Best-effort" não pode virar "não sabemos se funciona".
       Um log de auditoria que não grava é PIOR que nenhum: numa disputa, a
       ausência de linha é lida como "a ação não aconteceu", e é exatamente
       isso que ele existe para desmentir. O `catch` sozinho nunca soube de
       nada — o supabase-js devolve `{ error }` em vez de lançar, então a
       tabela podia estar ausente há meses sem uma única pista. */
    if (error) console.error("[auditoria] ação NÃO registrada:", action, target, error);
  } catch (e) {
    /* import quebrado ou rede fora: continua sem derrubar a ação em si. */
    console.error("[auditoria] ação NÃO registrada:", action, target, e);
  }
}
