import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Modo Cuidado 🤍 — pausa ética da gamificação.
 *
 * Quando ativo, o servidor NÃO concede Sementinhas nem comemora, e o cliente
 * troca a experiência festiva por acolhimento. É um estado da paciente, que ela
 * ativa/desativa quando quiser. Nada é deletado — só pausado.
 */

/** Lê care_mode do perfil (server-only). Usado para suprimir ganho/comemoração. */
export async function isCareModeActive(client: SupabaseClient, uid: string): Promise<boolean> {
  const { data } = await client.from("patient_profiles").select("care_mode").eq("id", uid).single();
  return Boolean((data as { care_mode?: boolean } | null)?.care_mode);
}

export const getCareMode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    return { ok: true as const, careMode: await isCareModeActive(supabaseAdmin, u.user.id) };
  });

export const setCareMode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), on: z.boolean() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, error: "Não autenticado" };
    const patch = {
      care_mode: data.on,
      care_mode_since: data.on ? new Date().toISOString() : null,
    };
    const { error: upErr } = await (
      supabaseAdmin.from("patient_profiles") as unknown as {
        update: (v: typeof patch) => {
          eq: (col: string, val: string) => Promise<{ error: unknown }>;
        };
      }
    )
      .update(patch)
      .eq("id", u.user.id);
    if (upErr) return { ok: false as const, error: "Falha ao salvar" };
    return { ok: true as const, careMode: data.on };
  });
