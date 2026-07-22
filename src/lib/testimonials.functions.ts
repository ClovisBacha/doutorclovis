import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { typedDb } from "@/integrations/supabase/types.extended";
import { grantSementinhas, SEMENTINHAS } from "@/lib/sementinhas.functions";
import { isCareModeActive } from "@/lib/care-mode.functions";

/**
 * Depoimentos das pacientes → 100 Sementinhas ao ser APROVADO pelo médico.
 *
 * Nada é publicado sem aprovação (mesma ética do resto do app). A paciente
 * escreve/edita seu depoimento (volta a "pending" a cada edição); o médico
 * aprova/recusa no painel; ao aprovar, ela ganha 100 🌱 uma única vez. A tabela
 * é server-only — todo acesso passa por estas funções (service role).
 */

export type TestimonialStatus = "pending" | "approved" | "rejected";

type TestimonialRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  body: string;
  status: TestimonialStatus;
  created_at: string;
  reviewed_at: string | null;
};

async function authUid(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}

/** Quem é "o médico": e-mails autorizados em ADMIN_EMAILS. */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(accessToken: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return false;
  return adminEmails().includes(data.user.email.toLowerCase());
}

/** A paciente envia/edita seu depoimento. Reentra em análise (pending). */
export const submitTestimonial = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        body: z.string().trim().min(10).max(600),
        displayName: z.string().trim().max(60).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as {
      from: (t: string) => {
        upsert: (
          v: Record<string, unknown>,
          o: { onConflict: string },
        ) => Promise<{ error: unknown }>;
      };
    };
    const { error } = await sb.from("testimonials").upsert(
      {
        user_id: uid,
        body: data.body,
        display_name: data.displayName?.trim() || null,
        status: "pending",
        reviewed_at: null,
      },
      { onConflict: "user_id" },
    );
    if (error) return { ok: false as const, error: "Não foi possível enviar" };
    return { ok: true as const, status: "pending" as TestimonialStatus };
  });

/** A paciente lê o próprio depoimento (para editar / ver o status). */
export const getMyTestimonial = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const uid = await authUid(data.accessToken);
    if (!uid) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => { maybeSingle: () => Promise<{ data: TestimonialRow | null }> };
          };
        };
      }
    )
      .from("testimonials")
      .select("body, display_name, status")
      .eq("user_id", uid)
      .maybeSingle();
    return {
      ok: true as const,
      testimonial: row
        ? { body: row.body, displayName: row.display_name, status: row.status }
        : null,
    };
  });

/** Depoimentos APROVADOS para a página pública (sem dados sensíveis). */
export const getApprovedTestimonials = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (
    supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            c: string,
            v: string,
          ) => {
            order: (
              c: string,
              o: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{ data: TestimonialRow[] | null }>;
            };
          };
        };
      };
    }
  )
    .from("testimonials")
    .select("display_name, body, reviewed_at")
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(50);
  return {
    ok: true as const,
    items: ((data ?? []) as Pick<TestimonialRow, "display_name" | "body">[]).map((r) => ({
      name: r.display_name || "Paciente",
      body: r.body,
    })),
  };
});

/** [Médico] Lista depoimentos pendentes + revisados recentes. */
export const adminListTestimonials = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    if (!(await requireAdmin(data.accessToken))) return { ok: false as const, error: "Sem acesso" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              c: string,
              o: { ascending: boolean },
            ) => { limit: (n: number) => Promise<{ data: TestimonialRow[] | null }> };
          };
        };
      }
    )
      .from("testimonials")
      .select("id, display_name, body, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return { ok: true as const, items: (rows ?? []) as TestimonialRow[] };
  });

/** [Médico] Aprova/recusa. Ao aprovar, a paciente ganha 100 🌱 (uma vez). */
export const reviewTestimonial = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid(),
        approve: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    if (!(await requireAdmin(data.accessToken))) return { ok: false as const, error: "Sem acesso" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (
            c: string,
            v: string,
          ) => { select: (c: string) => Promise<{ data: unknown; error: unknown }> };
        };
      };
    };
    const status: TestimonialStatus = data.approve ? "approved" : "rejected";
    const { data: updated, error: upErr } = await sb
      .from("testimonials")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("user_id");
    const row = (Array.isArray(updated) ? updated[0] : null) as { user_id?: string } | null;
    // Falha/ID inexistente: não finge sucesso (o painel não deve marcar
    // "Publicado" sem nada ter mudado).
    if (upErr || !row?.user_id) return { ok: false as const, error: "Depoimento não encontrado" };
    const uid = row.user_id;
    // Recompensa só na APROVAÇÃO, uma vez por paciente (dedupe por user), fora
    // do Modo Cuidado. Best-effort: não derruba a revisão se falhar.
    if (data.approve && uid) {
      try {
        if (!(await isCareModeActive(supabaseAdmin, uid))) {
          await grantSementinhas(typedDb(supabaseAdmin), uid, [
            {
              amount: SEMENTINHAS.trimesterMilestone, // 100
              reason: "Depoimento publicado 💬",
              dedupeKey: `testimonial_approved:${uid}`,
            },
          ]);
        }
      } catch (e) {
        console.error("[testimonials] reward failed", e);
      }
    }
    return { ok: true as const, status };
  });
