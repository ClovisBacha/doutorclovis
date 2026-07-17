import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Lives gerenciáveis: a equipe (ADMIN_EMAILS) cadastra no painel e a página
 * pública /lives lê daqui — fim das datas fixas no código, que "envelheciam"
 * sozinhas. Leitura pública passa pelo servidor (tabela sem acesso anon);
 * se a tabela ainda não existir (migração pendente), a página usa o fallback.
 */

export type Live = {
  id: string;
  title: string;
  scheduled_at: string | null;
  link: string | null;
  is_published: boolean;
  created_at: string;
};

async function requireAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u, error } = await supabaseAdmin.auth.getUser(accessToken);
  const email = u?.user?.email?.toLowerCase();
  if (error || !email) return null;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email) ? u.user : null;
}

/** Página pública: só lives publicadas, mais recentes primeiro. */
export const listLivesPublic = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("lives")
    .select("id,title,scheduled_at,link,is_published,created_at")
    .eq("is_published", true)
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) return { ok: false as const, lives: [] as Live[] };
  return { ok: true as const, lives: (data ?? []) as Live[] };
});

/** Painel (equipe): todas, inclusive despublicadas. */
export const listLivesAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const, lives: [] as Live[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("lives")
      .select("id,title,scheduled_at,link,is_published,created_at")
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error?.code === "42P01") {
      return { ok: false as const, lives: [] as Live[], missingTable: true as const };
    }
    if (error) return { ok: false as const, lives: [] as Live[] };
    return { ok: true as const, lives: (rows ?? []) as Live[] };
  });

export const saveLive = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid().optional().nullable(),
        title: z.string().min(3).max(160),
        scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
        link: z.string().url().max(300).optional().nullable(),
        isPublished: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      title: data.title,
      scheduled_at: data.scheduledAt ?? null,
      link: data.link ?? null,
      is_published: data.isPublished,
    };
    const q = data.id
      ? (supabaseAdmin as any).from("lives").update(row).eq("id", data.id)
      : (supabaseAdmin as any).from("lives").insert(row);
    const { error } = await q;
    if (error?.code === "42P01") {
      return {
        ok: false as const,
        error: "Aplique a migração 'lives' no Supabase (APLICAR_PENDENTES.sql).",
      };
    }
    if (error) {
      console.error("saveLive failed", error);
      return { ok: false as const, error: "Não foi possível salvar. Tente novamente." };
    }
    return { ok: true as const, error: null };
  });

export const deleteLive = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("lives").delete().eq("id", data.id);
    return { ok: !error };
  });
