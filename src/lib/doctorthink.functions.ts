/**
 * Gestão das chaves de API do DoctorThink (super-admin). O dono cria uma chave
 * por app cliente, vê o uso e revoga quando quiser. A chave CRUA aparece só na
 * criação (guardamos só o hash).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TokenSchema, requireSuperAdmin, safe } from "@/lib/platform-admin.server";
import { writeAudit } from "@/lib/audit.server";

export type DoctorThinkKey = {
  id: string;
  tenant_id: string;
  doctor_id: string | null;
  name: string | null;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
};

/** Cria uma chave de API. Retorna a chave CRUA uma única vez. */
export const createDoctorThinkKey = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        tenantId: z
          .string()
          .min(2)
          .max(40)
          .regex(/^[a-z0-9_-]+$/, "só minúsculas, números, - e _"),
        name: z.string().max(80).optional(),
        doctorId: z.string().uuid().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { generateApiKey, hashApiKey } = await import("@/lib/doctorthink/api-keys.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rawKey = generateApiKey();
    const { error } = await (supabaseAdmin as any).from("doctorthink_api_keys").insert({
      tenant_id: data.tenantId,
      doctor_id: data.doctorId ?? null,
      name: data.name?.trim() || null,
      key_hash: hashApiKey(rawKey),
    });
    if (error?.code === "42P01") return { ok: false as const, reason: "migracao" as const };
    if (error) return { ok: false as const };
    await writeAudit({ id: user.id, email: user.email }, "doctorthink.key.create", data.tenantId, {
      name: data.name ?? null,
    });
    // A chave crua só existe aqui — o cliente deve guardá-la agora.
    return { ok: true as const, apiKey: rawKey };
  });

/** Lista as chaves (sem o hash e sem a chave crua). */
export const listDoctorThinkKeys = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const, keys: [] as DoctorThinkKey[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const keys = await safe<DoctorThinkKey[]>(
      async () =>
        ((
          await (supabaseAdmin as any)
            .from("doctorthink_api_keys")
            .select("id,tenant_id,doctor_id,name,active,last_used_at,created_at")
            .order("created_at", { ascending: false })
            .limit(200)
        ).data ?? []) as DoctorThinkKey[],
      [],
    );
    return { ok: true as const, keys };
  });

/** Revoga (desativa) uma chave. */
export const revokeDoctorThinkKey = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("doctorthink_api_keys")
      .update({ active: false })
      .eq("id", data.id);
    if (!error)
      await writeAudit({ id: user.id, email: user.email }, "doctorthink.key.revoke", data.id);
    return { ok: !error };
  });

export type DoctorThinkUsage = {
  isSuperAdmin: true;
  totals: {
    calls: number;
    callsThisMonth: number;
    ask: number;
    train: number;
    coveredPct: number | null;
  };
  byTenant: {
    tenantId: string;
    calls: number;
    callsThisMonth: number;
    ask: number;
    train: number;
  }[];
  generatedAt: string;
};

/** Resumo de uso da API do DoctorThink (super-admin) — base para faturar. */
export const getDoctorThinkUsage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    type Row = {
      tenant_id: string;
      endpoint: string;
      had_coverage: boolean | null;
      created_at: string;
    };
    const rows = await safe<Row[]>(
      async () =>
        ((
          await (supabaseAdmin as any)
            .from("doctorthink_usage")
            .select("tenant_id,endpoint,had_coverage,created_at")
            .limit(100000)
        ).data ?? []) as Row[],
      [],
    );

    const totals = { calls: 0, callsThisMonth: 0, ask: 0, train: 0 };
    let askCovered = 0;
    let askTotal = 0;
    const byTenantMap = new Map<
      string,
      { calls: number; callsThisMonth: number; ask: number; train: number }
    >();
    for (const r of rows) {
      totals.calls += 1;
      const thisMonth = r.created_at >= monthStart;
      if (thisMonth) totals.callsThisMonth += 1;
      if (r.endpoint === "ask") {
        totals.ask += 1;
        askTotal += 1;
        if (r.had_coverage === true) askCovered += 1;
      } else if (r.endpoint === "train") {
        totals.train += 1;
      }
      const t = byTenantMap.get(r.tenant_id) ?? { calls: 0, callsThisMonth: 0, ask: 0, train: 0 };
      t.calls += 1;
      if (thisMonth) t.callsThisMonth += 1;
      if (r.endpoint === "ask") t.ask += 1;
      else if (r.endpoint === "train") t.train += 1;
      byTenantMap.set(r.tenant_id, t);
    }

    const usage: DoctorThinkUsage = {
      isSuperAdmin: true,
      totals: {
        ...totals,
        coveredPct: askTotal > 0 ? Math.round((askCovered / askTotal) * 100) : null,
      },
      byTenant: [...byTenantMap.entries()]
        .map(([tenantId, v]) => ({ tenantId, ...v }))
        .sort((a, b) => b.calls - a.calls),
      generatedAt: new Date().toISOString(),
    };
    return { ok: true as const, usage };
  });
