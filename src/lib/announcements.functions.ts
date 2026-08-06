/**
 * Comunicados (broadcast) — o dono envia avisos in-app para médicos e/ou
 * pacientes. CRUD só do super-admin; leitura por qualquer usuário logado,
 * filtrada pelo papel (médico/paciente), pela janela de tempo e pelos avisos
 * que a pessoa já dispensou.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  MAX_ROWS,
  TokenSchema,
  getUser,
  requireSuperAdmin,
  safe,
  userIsDoctor,
} from "@/lib/platform-admin.server";
import { writeAudit } from "@/lib/audit.server";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "medicos" | "pacientes" | "todos";
  level: "info" | "success" | "warning";
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

const AUDIENCE = z.enum(["medicos", "pacientes", "todos"]);
const LEVEL = z.enum(["info", "success", "warning"]);

/** Cria um comunicado (super-admin). */
export const createAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        title: z.string().min(2).max(160),
        body: z.string().min(2).max(2000),
        audience: AUDIENCE.default("todos"),
        level: LEVEL.default("info"),
        endsAt: z.string().datetime({ offset: true }).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("platform_announcements").insert({
      title: data.title,
      body: data.body,
      audience: data.audience,
      level: data.level,
      ends_at: data.endsAt ?? null,
    });
    if (error?.code === "42P01") return { ok: false as const, reason: "migracao" as const };
    if (error) return { ok: false as const };
    await writeAudit({ id: user.id, email: user.email }, "announcement.create", data.title, {
      audience: data.audience,
      level: data.level,
    });
    return { ok: true as const };
  });

/** Lista todos os comunicados (super-admin). */
export const listAnnouncementsAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const, announcements: [] as Announcement[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await safe<Announcement[]>(
      async () =>
        ((
          await (supabaseAdmin as any)
            .from("platform_announcements")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500)
        ).data ?? []) as Announcement[],
      [],
    );
    return { ok: true as const, announcements: rows };
  });

/** Ativa/desativa um comunicado (super-admin). */
export const toggleAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ accessToken: z.string().min(10), id: z.string().uuid(), active: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("platform_announcements")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) return { ok: false as const };
    await writeAudit({ id: user.id, email: user.email }, "announcement.toggle", data.id, {
      active: data.active,
    });
    return { ok: true as const };
  });

/**
 * Comunicados ativos para o usuário logado (médico ou paciente), dentro da
 * janela de tempo e ainda não dispensados. Usado pelo banner in-app.
 */
export const getActiveAnnouncements = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await getUser(data.accessToken);
    if (!user) return { ok: false as const, announcements: [] as Announcement[] };
    const isDoctor = await userIsDoctor(user.id);
    const audienceForRole = isDoctor ? "medicos" : "pacientes";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const rows = await safe<Announcement[]>(
      async () =>
        ((
          await (supabaseAdmin as any)
            .from("platform_announcements")
            .select("*")
            .eq("active", true)
            .in("audience", [audienceForRole, "todos"])
            .order("created_at", { ascending: false })
            .limit(20)
        ).data ?? []) as Announcement[],
      [],
    );
    const dismissed = await safe<Set<string>>(async () => {
      const { data: d } = await (supabaseAdmin as any)
        .from("announcement_dismissals")
        .select("announcement_id")
        .eq("user_id", user.id)
        .limit(MAX_ROWS);
      return new Set((d ?? []).map((x: any) => x.announcement_id as string));
    }, new Set());

    const visible = rows.filter(
      (a) =>
        !dismissed.has(a.id) &&
        (!a.starts_at || a.starts_at <= nowIso) &&
        (!a.ends_at || a.ends_at >= nowIso),
    );
    return { ok: true as const, announcements: visible };
  });

/** Usuário dispensa um comunicado (não some para os outros). */
export const dismissAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await getUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("announcement_dismissals")
      .upsert(
        { announcement_id: data.id, user_id: user.id },
        { onConflict: "announcement_id,user_id" },
      );
    /* "Dispensar" que não grava é o comunicado voltando toda vez que ela abre
       o app, sem nenhuma forma de calar — e com `ok: true` a tela some na
       hora, o que faz parecer que funcionou até o próximo carregamento. */
    if (error) {
      console.error("[comunicado] dispensa não gravou", data.id, error);
      return { ok: false as const };
    }
    return { ok: true as const };
  });
