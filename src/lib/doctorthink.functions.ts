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
            .select("id,tenant_id,name,active,last_used_at,created_at")
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
