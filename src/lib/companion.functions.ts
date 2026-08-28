import { createServerFn } from "@tanstack/react-start";
import { codigoParaConvite } from "@/lib/convite.functions";
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
  /**
   * ⚠️ O Modo Cuidado da GESTANTE — e ele precisou chegar até aqui.
   *
   * O painel do acompanhante desenha o "Sentir o coração", que toca o lub-dub e
   * vibra no ritmo do bebê. Sem este campo, o marido ou a mãe abria o link e
   * **ouvia o batimento de um bebê que não existe mais** — e o pior é que ela
   * não está do lado para explicar.
   *
   * ⚠️ **E O ALCANCE CRESCEU: no luto NENHUMA aba de gestação abre.** O
   * portão original cobria só o batimento, e as outras três continuavam —
   * tamanho e descrição da semana, o que fazer no dia do parto, e dicas todas
   * de gestação ("acompanhe às consultas do pré-natal", "lanches leves para o
   * enjoo matinal"). Nada disso serve para quem abre o link nesse momento.
   *
   * O que fica é a EMERGÊNCIA, que já vivia fora das abas: o alerta de SOS com
   * localização e o botão do SAMU. Era a razão que este comentário dava para
   * manter o resto, e ela vale inteira sem uma única aba.
   *
   * ⚠️ E a tela NÃO conta o que aconteceu — o Modo Cuidado pode ser ligado
   * pelo médico, e quem tem o link pode não saber de nada.
   */
  care_mode?: boolean | null;
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
      "display_name,baby_name,lmp_date,due_date,reference_date,reference_weeks,reference_days,care_mode";
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

    // Recompensa: a gestante ganha 100 🌱 quando o convite dela é REALMENTE
    // usado (alguém abriu o link do acompanhante). Uma única vez por gestante
    // (dedupe fixo), nunca em Modo Cuidado. Best-effort — nunca quebra a
    // visualização do acompanhante se falhar.
    try {
      await rewardCompanionShare(invite.user_id);
    } catch (e) {
      console.error("[companion] reward failed", e);
    }

    return {
      ok: true as const,
      profile: profile as CompanionView,
      /* ⚠️ O código dela, para o rodapé de convite — `null` em Modo Cuidado.
         O painel do acompanhante continua de pé no luto (ele é a rede de apoio
         dela, e o contato de emergência entra por aqui); o que some é só o
         convite, que diz "se você também está grávida". Ver `codigoParaConvite`. */
      codigoDeConvite: await codigoParaConvite(supabaseAdmin as any, invite.user_id as string),
    };
  });

/** Concede 100 🌱 à gestante quando o link do acompanhante é aberto (1x). */
async function rewardCompanionShare(uid: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { typedDb } = await import("@/integrations/supabase/types.extended");
  const { grantSementinhas, SEMENTINHAS } = await import("@/lib/sementinhas.functions");
  const { isCareModeActive } = await import("@/lib/care-mode.functions");
  if (await isCareModeActive(supabaseAdmin, uid)) return;
  await grantSementinhas(typedDb(supabaseAdmin), uid, [
    {
      amount: SEMENTINHAS.trimesterMilestone, // 100
      reason: "Acompanhante convidado 💞",
      dedupeKey: "companion_reward", // fixo → no máx. 1 por gestante
    },
  ]);
}
