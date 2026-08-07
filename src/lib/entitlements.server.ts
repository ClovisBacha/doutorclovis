/**
 * Resolução de entitlements no servidor: dado o usuário logado (ou um
 * doctor_id qualquer), qual plano ele tem e o que pode acessar.
 *
 * Regra de identidade (igual ao resto do painel):
 *   - Equipe da instalação (ADMIN_EMAILS) → acesso TOTAL (OWNER_ENTITLEMENTS).
 *   - Médico assinante → capacidades do seu `doctors.plan`.
 *   - Sem linha em `doctors` e fora da equipe → plano `free` (restritivo).
 *
 * É a fonte de verdade dos gates: nenhuma função deve olhar `plan` na mão,
 * sempre passar por aqui, para "quem pagou o plano X tem exatamente o X".
 */

import {
  entitlementsFor,
  OWNER_ENTITLEMENTS,
  normalizePlan,
  PLAN_RANK,
  type Entitlements,
  type PlanKey,
} from "./entitlements";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** É membro da equipe da instalação (ADMIN_EMAILS)? */
export function isPlatformTeamEmail(email?: string | null): boolean {
  return !!email && adminEmails().includes(email.toLowerCase());
}

/**
 * O PLANO QUE VALE HOJE — régua única de vencimento.
 *
 * ─── HAVIA DUAS, E A MAIS CARA ERA A PERMISSIVA ─────────────────────────────
 *
 * `planRowFor` rebaixava só o `trial`: um `pro` com `plan_expires_at` no
 * passado mantinha todas as capacidades pagas, indefinidamente.
 *
 * E a MESMA coluna, com a MESMA pergunta, já tinha resposta OPOSTA no
 * diretório de médicos (`planoValido`, em `doctors.functions.ts`), com a
 * justificativa escrita ao lado: "um Elite cujo cartão falhou continuava no
 * topo de toda busca indefinidamente, na frente de quem está pagando".
 *
 * Resultado: o médico com o cartão recusado perdia a posição na busca e
 * mantinha a IA — a régua barata era rigorosa e a cara era frouxa.
 *
 * ─── A CARÊNCIA É DE PROPÓSITO ──────────────────────────────────────────────
 *
 * Três dias. A renovação da Stripe não é instantânea: webhook atrasado, retry,
 * cartão que aprova na segunda tentativa. Sem carência, um assinante em dia
 * perderia a IA por algumas horas por um atraso que não é dele — e quem sente
 * isso é a gestante do outro lado, que de repente para de receber a voz do
 * médico. Errar por três dias de generosidade é muito mais barato.
 */
export const CARENCIA_DE_RENOVACAO_MS = 3 * 24 * 60 * 60 * 1000;

export function planoVigente(
  plan: string | null,
  expiraEm: string | null | undefined,
  agora = Date.now(),
): string | null {
  if (!expiraEm) return plan;
  const venc = new Date(expiraEm).getTime();
  /* Data ilegível não rebaixa ninguém: na dúvida o médico é atendido, e o
     estrago de rebaixar por engano recai sobre a paciente. */
  if (!Number.isFinite(venc)) return plan;
  return venc + CARENCIA_DE_RENOVACAO_MS < agora ? "free" : plan;
}

async function planRowFor(doctorId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const first = await sb
    .from("doctors")
    .select("plan,active,plan_expires_at,clinic_id")
    .eq("id", doctorId)
    .maybeSingle();
  let data = first.data;
  if (first.error?.code === "42703") {
    // Coluna clinic_id ainda não migrada: segue sem o assento de clínica.
    ({ data } = await sb
      .from("doctors")
      .select("plan,active,plan_expires_at")
      .eq("id", doctorId)
      .maybeSingle());
  }
  // Médico inativo (assinatura suspensa) perde as capacidades pagas → free.
  if (!data || data.active === false) return "free";
  /* Vencimento vale para TODO plano — trial e pago. Ver `planoVigente`. */
  let plan: string | null = planoVigente(
    (data.plan ?? null) as string | null,
    data.plan_expires_at as string | null | undefined,
  );
  // Assento de clínica: membro de clínica ATIVA herda as capacidades do
  // plano Clínica. SÓ sobe quem está abaixo do Elite — Elite/Black mantêm o
  // próprio plano (têm convites premium e selo que o Clínica não substitui;
  // trocar seria rebaixar por outro eixo).
  if (data.clinic_id && PLAN_RANK[normalizePlan(plan)] < PLAN_RANK["elite"]) {
    try {
      /* ─── O ASSENTO HERDA O PLANO DO DONO, NÃO UM CHEQUE EM BRANCO ───────
       *
       * Era `plan = "clinica"` fixo. E `clinica` tem `aiRepliesPerCycle: null`
       * (ilimitado, "contrato sob medida") e `maxPatients: null`. Ou seja:
       * qualquer médico adicionado a uma clínica ativa ganhava IA ILIMITADA e
       * pacientes ilimitadas — de graça, para sempre, e sem ninguém decidir.
       * Como a associação era por e-mail e sem aceite, bastava um admin
       * adicionar um médico para a plataforma passar a bancar o uso dele.
       *
       * O assento agora vale o plano do DONO da clínica, com o vencimento dele
       * também aplicado. Se o dono é Clínica, o membro tem Clínica; se o dono
       * caiu para free porque o cartão falhou, o assento cai junto — que é o
       * único jeito de o contrato fechar.
       */
      const { data: clinic } = await sb
        .from("clinics")
        .select("active,owner_user_id")
        .eq("id", data.clinic_id)
        .maybeSingle();
      if (clinic?.active && clinic.owner_user_id) {
        const { data: dono } = await sb
          .from("doctors")
          .select("plan,plan_expires_at,active")
          .eq("id", clinic.owner_user_id)
          .maybeSingle();
        const planoDoDono =
          dono && dono.active !== false
            ? planoVigente(
                (dono.plan ?? null) as string | null,
                dono.plan_expires_at as string | null | undefined,
              )
            : "free";
        /* Só SOBE. Um membro Pro numa clínica cujo dono é Starter não é
           rebaixado — ele paga o próprio plano. */
        if (PLAN_RANK[normalizePlan(planoDoDono)] > PLAN_RANK[normalizePlan(plan)]) {
          plan = planoDoDono;
        }
      }
    } catch {
      /* tabela clinics ainda não migrada */
    }
  }
  return plan;
}

/** Plano efetivo (PlanKey) do usuário logado. Equipe da instalação → clinica. */
export async function effectivePlan(user: { id: string; email?: string | null }): Promise<PlanKey> {
  if (isPlatformTeamEmail(user.email)) return "clinica";
  return normalizePlan(await planRowFor(user.id));
}

/** Entitlements do usuário logado (equipe da instalação → acesso total). */
export async function getEntitlements(user: {
  id: string;
  email?: string | null;
}): Promise<Entitlements> {
  if (isPlatformTeamEmail(user.email)) return OWNER_ENTITLEMENTS;
  return entitlementsFor(await planRowFor(user.id));
}

/**
 * Entitlements por doctor_id (sem o objeto user) — usado no runtime do chat/
 * WhatsApp para saber se o cérebro DAQUELE médico pode ser injetado no canal.
 * O `isOwner` marca a conta dona da instalação, que sempre tem acesso total
 * (ela pode não ter linha em `doctors`, ou ter uma linha em trial/free).
 */
export async function getEntitlementsByDoctorId(
  doctorId: string,
  isOwner = false,
): Promise<Entitlements> {
  if (isOwner) return OWNER_ENTITLEMENTS;
  return entitlementsFor(await planRowFor(doctorId));
}
