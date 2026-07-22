/**
 * Leitura do log de auditoria (super-admin). A escrita é feita pelo helper
 * writeAudit (audit.server.ts), chamado nas mutações sensíveis do dono.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSuperAdmin, safe } from "@/lib/platform-admin.server";

export type AuditEntry = {
  id: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  meta: Record<string, string | number | boolean | null> | null;
  created_at: string;
};

export const getAuditLog = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        action: z.string().max(60).optional().nullable(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const, entries: [] as AuditEntry[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entries = await safe<AuditEntry[]>(async () => {
      let q = (supabaseAdmin as any)
        .from("audit_log")
        .select("id,actor_email,action,target,meta,created_at")
        .order("created_at", { ascending: false })
        .limit(data.limit);
      if (data.action) q = q.eq("action", data.action);
      return ((await q).data ?? []) as AuditEntry[];
    }, []);
    return { ok: true as const, entries };
  });
