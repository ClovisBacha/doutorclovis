/**
 * Entitlements por plano — fonte única de verdade das capacidades de cada
 * plano de médico. Módulo isomórfico (sem imports server-only): serve tanto
 * para os gates no servidor quanto para mostrar/bloquear recursos na UI.
 *
 * Valores de plano gravados em `doctors.plan`:
 *   trial | free | starter | pro | clinica | elite | black
 * O card "Pro Equipe" da página de vendas corresponde ao plano `clinica`.
 * Plano desconhecido cai em `free` (o mais restritivo) — nunca libera demais.
 *
 * As capacidades espelham exatamente o que é prometido em /medicos.
 * Escada de LIMITES (pacientes por médico · cérebros por conta):
 *   - Free:    5 pacientes  · 1 médico  · SEM IA (organiza o consultório).
 *   - Starter: 50 pacientes · 1 cérebro · IA no app.
 *   - Pro:     150 pacientes · 1 cérebro · IA também no WhatsApp.
 *   - Elite:   300 pacientes/médico · até 5 cérebros (equipe) + 25 convites.
 *   - Black:   500 pacientes/médico · até 20 cérebros + 250 convites + topo.
 *   - Clínica: personalizado (orçamento por contrato) — vários médicos,
 *              sem tetos rígidos; painel operando cada cérebro individualmente.
 *   - Trial:   experimenta o Pro por tempo limitado.
 */

export type PlanKey = "trial" | "free" | "starter" | "pro" | "clinica" | "elite" | "black";

export type Entitlements = {
  /** Rótulo curto para UI. */
  label: string;
  /** Máximo de pacientes ativas por médico (null = ilimitado). */
  maxPatients: number | null;
  /** Máximo de cérebros/médicos na conta ou clínica (null = ilimitado). */
  maxBrains: number | null;
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
  /** Convites premium que o médico pode dar às pacientes por mês (0 = nenhum). */
  premiumInvitesPerMonth: number;
  /** Selo de verificação exibido às pacientes ("" = sem selo). */
  badge: "" | "Starter" | "Pro" | "Elite" | "Black";
  /** Gerente de conta dedicado. */
  dedicatedManager: boolean;
};

const FREE: Entitlements = {
  label: "Free",
  maxPatients: 5,
  maxBrains: 1,
  aiApp: false,
  aiWhatsapp: false,
  clinicalToolsAdvanced: false,
  dashboardAdvanced: false,
  prioritySupport: false,
  teamSeats: false,
  premiumInvitesPerMonth: 0,
  badge: "",
  dedicatedManager: false,
};

const STARTER: Entitlements = {
  label: "Starter",
  maxPatients: 50,
  maxBrains: 1,
  aiApp: true,
  aiWhatsapp: false,
  clinicalToolsAdvanced: true,
  dashboardAdvanced: false,
  prioritySupport: false,
  teamSeats: false,
  premiumInvitesPerMonth: 0,
  badge: "Starter",
  dedicatedManager: false,
};

const PRO: Entitlements = {
  label: "Pro",
  maxPatients: 150,
  maxBrains: 1,
  aiApp: true,
  aiWhatsapp: true,
  clinicalToolsAdvanced: true,
  dashboardAdvanced: true,
  prioritySupport: true,
  teamSeats: false,
  premiumInvitesPerMonth: 0,
  badge: "Pro",
  dedicatedManager: false,
};

// Clínica = plano personalizado (orçamento por contrato). Sem tetos rígidos:
// pacientes e médicos são acordados no fechamento, então null/null (a conta é
// provisionada pela nossa equipe já com o combinado).
const CLINICA: Entitlements = {
  ...PRO,
  label: "Clínica",
  maxPatients: null,
  maxBrains: null,
  teamSeats: true,
  prioritySupport: true,
  dedicatedManager: true,
};

// Elite = Pro + equipe + 25 convites premium/mês + selo "Elite".
const ELITE: Entitlements = {
  ...PRO,
  label: "Reconhecido",
  maxPatients: 300,
  maxBrains: 5,
  teamSeats: true,
  premiumInvitesPerMonth: 25,
  badge: "Elite",
};

// Black = o plano mais alto: tudo do Elite + 250 convites premium/mês, gerente
// de conta dedicado e selo "Black" exclusivo. Topo absoluto da busca.
const BLACK: Entitlements = {
  ...ELITE,
  label: "Black",
  maxPatients: 500,
  maxBrains: 20,
  premiumInvitesPerMonth: 250,
  badge: "Black",
  dedicatedManager: true,
};

// Trial = experimenta o Pro por 14 dias (mesmas capacidades do Pro), mas SEM
// selo — quem está só testando não exibe "Pro verificado" às pacientes.
const TRIAL: Entitlements = { ...PRO, label: "Trial", badge: "" };

export const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlements> = {
  trial: TRIAL,
  free: FREE,
  starter: STARTER,
  pro: PRO,
  clinica: CLINICA,
  elite: ELITE,
  black: BLACK,
};

/**
 * A equipe da instalação (ADMIN_EMAILS) tem acesso total — é a conta dona
 * da plataforma (ex.: o médico fundador + secretária), nunca um assinante limitado.
 */
export const OWNER_ENTITLEMENTS: Entitlements = {
  ...BLACK,
  label: "Instalação",
  maxPatients: null,
  maxBrains: null,
};

/** Ordem de prioridade dos planos (maior = melhor) — usado no ranking da busca. */
/**
 * Preço mensal de lista de cada plano do médico, em reais (jul/2026).
 *
 * Mora aqui, e não no módulo de servidor onde nasceu, porque o PAINEL precisa
 * dele: a prova de valor compara o tempo economizado com o que ele paga, e essa
 * comparação acontece na tela. Preço em dois arquivos é a divergência clássica —
 * um sobe, o outro fica, e a tela passa a mentir sobre a própria cobrança.
 *
 * Clínica é "sob consulta": zero aqui significa "não dá para comparar", e as
 * telas tratam zero como "não mostrar", nunca como "de graça".
 */
export const PLAN_PRICE: Record<string, number> = {
  trial: 0,
  free: 0,
  starter: 149,
  pro: 297,
  clinica: 0,
  elite: 597,
  black: 1499,
};

/**
 * Mensalidade do plano em CENTAVOS.
 *
 * Normaliza igual a `normalizePlan` — e isso não é preciosismo: enquanto esta
 * função indexava o dicionário cru, um `doctors.plan` gravado como `"Pro"` ou
 * `" pro"` dava entitlements de Pro e mensalidade ZERO, e a prova de valor
 * sumia da tela de um assinante pagante. Duas normalizações diferentes para a
 * mesma coluna, a vinte linhas de distância.
 */
export function mensalidadeCentavos(plan: string): number {
  const p = (plan ?? "")
    .trim()
    .toLowerCase()
    .replace(/_annual$/, "");
  const chave = /^(enterprise|equipe|clinic)$/.test(p) ? "clinica" : p;
  return (PLAN_PRICE[chave] ?? 0) * 100;
}

export const PLAN_RANK: Record<PlanKey, number> = {
  free: 0,
  trial: 1,
  starter: 2,
  pro: 3,
  elite: 4,
  /* `clinica` fica ABAIXO de black, e isto é uma correção.
     
     Ela estava em 6, no topo, com o comentário "o plano mais caro". Mas o preço
     dela é "sob consulta" (`PLAN_PRICE.clinica = 0`) e o Black custa R$ 1.499 —
     e o assento de clínica é concedido automaticamente a qualquer membro de uma
     clínica ativa. Ou seja: um assento de valor indefinido passava na frente de
     quem paga o plano mais caro da tabela, na busca que a paciente vê. */
  clinica: 5,
  black: 6, // o mais caro da tabela — topo da escada
};

/** Normaliza um valor livre de `doctors.plan` para uma PlanKey conhecida. */
export function normalizePlan(plan: string | null | undefined): PlanKey {
  const p = (plan ?? "").trim().toLowerCase();
  if (
    p === "trial" ||
    p === "free" ||
    p === "starter" ||
    p === "pro" ||
    p === "clinica" ||
    p === "elite" ||
    p === "black"
  ) {
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

/** Selo do médico (para as pacientes) a partir do valor de plano. */
export function badgeForPlan(
  plan: string | null | undefined,
): "" | "Starter" | "Pro" | "Elite" | "Black" {
  return entitlementsFor(plan).badge;
}
