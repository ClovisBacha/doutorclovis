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
  let plan: string | null = (data.plan ?? null) as string | null;
  // Trial expirado (14 dias) cai para free — o "grátis por 14 dias" tem fim.
  if (
    data.plan === "trial" &&
    data.plan_expires_at &&
    new Date(data.plan_expires_at).getTime() < Date.now()
  ) {
    plan = "free";
  }
  // Assento de clínica: membro de clínica ATIVA herda o plano Clínica
  // (nunca rebaixa quem já tem plano igual ou superior).
  if (data.clinic_id && PLAN_RANK[normalizePlan(plan)] < PLAN_RANK["clinica"]) {
    try {
      const { data: clinic } = await sb
        .from("clinics")
        .select("active")
        .eq("id", data.clinic_id)
        .maybeSingle();
      if (clinic?.active) plan = "clinica";
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
