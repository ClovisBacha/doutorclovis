import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CourseProgress = {
  module_week: number;
  quiz_score: number;
  completed_at: string;
};

export const getCourseProgress = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const { data: rows } = await supabaseAdmin
      .from("course_progress")
      .select("module_week, quiz_score, completed_at")
      .eq("user_id", u.user.id);
    return { ok: true as const, progress: (rows ?? []) as CourseProgress[] };
  });

export const markModuleComplete = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        moduleWeek: z.number().int().min(4).max(42),
        quizScore: z.number().int().min(0).max(100),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await supabaseAdmin.from("course_progress").upsert(
      {
        user_id: u.user.id,
        module_week: data.moduleWeek,
        quiz_score: data.quizScore,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,module_week" },
    );
    return { ok: !error };
  });

/* `savePanicEvent` foi REMOVIDA daqui.

   Ela gravava um `panic_events` e não avisava ninguém — um segundo SOS, com
   regras próprias, exposto como endpoint HTTP vivo mesmo depois de perder o
   último chamador. Duas emergências com comportamentos diferentes no mesmo app
   é o tipo de coisa que só se descobre no dia em que a errada é chamada.
   O caminho único é `dispararEmergencia` (`emergencia.functions.ts`), que
   registra o evento E aciona os canais. */

export const getRecentPanicByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("companion_invites")
      .select("user_id, expires_at")
      .eq("token", data.token)
      .single();
    if (!invite) return { ok: false as const };
    if (invite.expires_at && new Date(invite.expires_at) < new Date())
      return { ok: false as const };
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // last 30 min
    const { data: events } = await supabaseAdmin
      .from("panic_events")
      .select("*")
      .eq("user_id", invite.user_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    return { ok: true as const, event: events?.[0] ?? null };
  });
