/**
 * Entitlements por plano — fonte única de verdade das capacidades de cada
 * plano de médico. Módulo isomórfico (sem imports server-only): serve tanto
 * para os gates no servidor quanto para mostrar/bloquear recursos na UI.
 *
 * Valores de plano gravados em `doctors.plan`:
 *   trial | free | starter | pro | clinica
 * O card "Pro Equipe" da página de vendas corresponde ao plano `clinica`.
 * Plano desconhecido cai em `free` (o mais restritivo) — nunca libera demais.
 *
 * As capacidades espelham exatamente o que é prometido em /medicos:
 *   - Free:    organiza o consultório, até 5 pacientes, SEM IA.
 *   - Starter: a IA responde as pacientes no APP, pacientes ilimitadas.
 *   - Pro:     a IA também atende/agenda no WhatsApp + dashboard avançado.
 *   - Clínica: o Pro para vários médicos (assentos de equipe).
 *   - Trial:   experimenta o Pro por tempo limitado.
 */

export type PlanKey = "trial" | "free" | "starter" | "pro" | "clinica";

export type Entitlements = {
  /** Rótulo curto para UI. */
  label: string;
  /** Máximo de pacientes ativas por médico (null = ilimitado). */
  maxPatients: number | null;
  /** Segundo Cérebro (IA) responde as pacientes no app. */
  aiApp: boolean;
  /** Agente de IA atende e agenda no WhatsApp. */
  aiWhatsapp: boolean;
  /** Ferramentas clínicas avançadas (biometria, EPDS, DMG, pré-eclâmpsia). */
  clinicalToolsAdvanced: boolean;
  /** Dashboard avançado (FAQ inteligente, risco de abandono). */
  dashboardAdvanced: boolean;
  /** Suporte prioritário. */
  prioritySupport: boolean;
  /** Vários médicos numa conta só (assentos de equipe). */
  teamSeats: boolean;
};

const FREE: Entitlements = {
  label: "Free",
  maxPatients: 5,
  aiApp: false,
  aiWhatsapp: false,
  clinicalToolsAdvanced: false,
  dashboardAdvanced: false,
  prioritySupport: false,
  teamSeats: false,
};

const STARTER: Entitlements = {
  label: "Starter",
  maxPatients: null,
  aiApp: true,
  aiWhatsapp: false,
  clinicalToolsAdvanced: true,
  dashboardAdvanced: false,
  prioritySupport: false,
  teamSeats: false,
};

const PRO: Entitlements = {
  label: "Pro",
  maxPatients: null,
  aiApp: true,
  aiWhatsapp: true,
  clinicalToolsAdvanced: true,
  dashboardAdvanced: true,
  prioritySupport: true,
  teamSeats: false,
};

const CLINICA: Entitlements = { ...PRO, label: "Pro Equipe", teamSeats: true };

// Trial = experimenta o Pro por 14 dias (mesmas capacidades do Pro).
const TRIAL: Entitlements = { ...PRO, label: "Trial" };

export const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlements> = {
  trial: TRIAL,
  free: FREE,
  starter: STARTER,
  pro: PRO,
  clinica: CLINICA,
};

/**
 * A equipe da instalação (ADMIN_EMAILS) tem acesso total — é a conta dona
 * da plataforma (ex.: o médico fundador + secretária), nunca um assinante limitado.
 */
export const OWNER_ENTITLEMENTS: Entitlements = { ...CLINICA, label: "Instalação" };

/** Normaliza um valor livre de `doctors.plan` para uma PlanKey conhecida. */
export function normalizePlan(plan: string | null | undefined): PlanKey {
  const p = (plan ?? "").trim().toLowerCase();
  if (p === "trial" || p === "free" || p === "starter" || p === "pro" || p === "clinica") {
    return p;
  }
  // Aliases da página de vendas / legado → plano de clínica.
  if (p === "enterprise" || p === "equipe" || p === "clinic") return "clinica";
  return "free";
}

/** Entitlements de um valor de plano (aceita valores livres/legados). */
export function entitlementsFor(plan: string | null | undefined): Entitlements {
  return PLAN_ENTITLEMENTS[normalizePlan(plan)];
}
