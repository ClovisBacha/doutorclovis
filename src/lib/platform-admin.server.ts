/**
 * Núcleo compartilhado do console do dono (super-admin): identidade, gate,
 * utilitários e constantes de preço. Fonte ÚNICA — evita divergência entre
 * platform.functions.ts, insights.functions.ts e os módulos novos.
 *
 * `.server.ts`: só roda no servidor; todo acesso a banco é via supabaseAdmin.
 */
import { z } from "zod";

/** E-mail do dono da plataforma (PLATFORM_ADMIN_EMAIL ou 1º de ADMIN_EMAILS). */
export function platformAdminEmail(): string {
  const explicit = (process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
  if (explicit) return explicit;
  return (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim().toLowerCase() || "";
}

/** Gate do super-admin: igualdade estrita de e-mail. Retorna o user ou null. */
export async function requireSuperAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  const email = data.user?.email?.toLowerCase();
  const owner = platformAdminEmail();
  if (error || !email || !owner || email !== owner) return null;
  return data.user;
}

export const TokenSchema = z.object({ accessToken: z.string().min(10) });

/** Executa um bloco de forma isolada: erro → valor default (resiliência). */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// Preços mensais de lista por plano do médico (jul/2026). Clínica = sob consulta.
export const PLAN_PRICE: Record<string, number> = {
  trial: 0,
  free: 0,
  starter: 149,
  pro: 297,
  clinica: 0,
  elite: 597,
  black: 1499,
};

/** Preço mensal do plano do médico em centavos (anual normalizado ao mensal). */
export function doctorPlanMonthlyCents(plan: string): number {
  const base = plan.replace(/_annual$/, "");
  return (PLAN_PRICE[base] ?? 0) * 100;
}

/** Premium da paciente: R$19,90/mês; anual equivale a ~R$9,90/mês. */
export function patientPremiumMonthlyCents(plan: string | null): number {
  return plan === "annual" ? 990 : 1990;
}

/** Status de assinatura que concede acesso (espelha statusGrantsAccess). */
export const ACCESS_STATUS = new Set(["active", "trialing"]);
/** Consulta particular "paga" = confirmada pelo médico ou já realizada. */
export const PAID_STATUS = new Set(["confirmado", "realizado"]);
export const CANCELLED_STATUS = new Set(["cancelado"]);

/** Teto generoso p/ leituras que agregam totais em JS (evita db-max-rows). */
export const MAX_ROWS = 100000;

/** Começo do mês corrente em ISO (para recortes "neste mês"). */
export function monthStartISO(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
