import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({ token: z.string().min(8).max(64) });

export type CompanionView = {
  display_name: string | null;
  baby_name: string | null;
  lmp_date: string | null;
  due_date: string | null;
  reference_date: string | null;
  reference_weeks: number | null;
  reference_days: number | null;
  /** BPM fetal medido pelo médico na consulta ("Sentir o coração" v2). */
  fetal_bpm?: number | null;
  fetal_bpm_at?: string | null;
};

/**
 * Resolve um convite de acompanhante pelo token, no servidor.
 *
 * Antes, o navegador (anônimo) lia as tabelas direto, o que (a) exigia uma
 * política RLS que deixava qualquer um listar TODOS os convites e (b) nem
 * conseguia ler o perfil (sem grant para anon). Agora a busca roda server-side
 * com a service role, valida a expiração e devolve só os campos mínimos.
 */
export const getCompanionView = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invite, error } = await supabaseAdmin
      .from("companion_invites")
      .select("user_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();

    if (error || !invite) return { ok: false as const, reason: "invalid" as const };
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }

    const base =
      "display_name,baby_name,lmp_date,due_date,reference_date,reference_weeks,reference_days";
    const first = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select(`${base},fetal_bpm,fetal_bpm_at`)
      .eq("id", invite.user_id)
      .maybeSingle();
    let profile = first.data;
    if (first.error?.code === "42703") {
      // Colunas fetal_bpm ainda não aplicadas no banco: segue sem elas.
      const fallback = await supabaseAdmin
        .from("patient_profiles")
        .select(base)
        .eq("id", invite.user_id)
        .maybeSingle();
      profile = fallback.data;
    }

    if (!profile) return { ok: false as const, reason: "invalid" as const };
    return { ok: true as const, profile: profile as CompanionView };
  });
