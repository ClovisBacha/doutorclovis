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

export type PlanKey =
  | "trial"
  | "free"
  | "essencial"
  | "starter"
  | "pro"
  | "clinica"
  | "elite"
  | "black";

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
  /**
   * Respostas da IA que o médico tem por ciclo (`null` = ilimitado).
   *
   * ─── Por que MENSAGEM e não token ────────────────────────────────────────
   * Token é o que a plataforma paga; mensagem é o que o médico entende. Vender
   * em token seria vender numa unidade que ninguém sabe estimar — e um plano
   * que o comprador não consegue dimensionar não é um plano, é uma aposta.
   * A conversão vive na leitura de `ai_usage`, que grava as duas coisas: quem
   * consumiu e quantos tokens custou. É de lá que sai a margem real.
   *
   * ─── Por que o teto existe ───────────────────────────────────────────────
   * Sem ele, "pacientes ilimitadas" é uma promessa cujo custo é ilimitado
   * também. O teto não serve para limitar o médico — serve para o preço ser
   * verdadeiro.
   */
  aiRepliesPerCycle: number | null;
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
  /* Sem IA no plano: o teto é zero, não `null` — `null` quer dizer ilimitado. */
  aiRepliesPerCycle: 0,
};

/**
 * Essencial — o primeiro degrau pago.
 *
 * ─── O buraco que ele preenche ──────────────────────────────────────────
 *
 * Entre o Free (5 pacientes, SEM IA nenhuma) e o Starter (50 pacientes, R$149)
 * não havia nada. O obstetra que está começando não tinha como experimentar o
 * Segundo Cérebro sem saltar direto para o plano de R$149 — e é justamente ele
 * quem traz as primeiras pacientes para a plataforma.
 *
 * ─── Por que o limite é PACIENTE, e não uso da IA ───────────────────────
 *
 * Racionar a IA ("100 perguntas/mês") exigiria contador, tela de saldo e um
 * novo jeito de falhar. Pior: ensinaria o médico que a IA é escassa, e ele
 * pararia de indicar o app às pacientes — o oposto do que a plataforma quer.
 *
 * `maxPatients` já é aplicado em todo lugar, custa zero, e o upgrade acontece
 * SOZINHO: quem gosta chega a 15 pacientes em poucas semanas e sobe sem se
 * sentir punido.
 *
 * ─── E por que ele NÃO tem as ferramentas avançadas ─────────────────────
 *
 * É a segunda razão de o Starter existir — sem isso, a única diferença entre os
 * dois seria o número de pacientes, e aí a conta por paciente favorece tanto o
 * Starter (R$2,98 contra R$3,33) que o Essencial não venderia.
 *
 * A tensão é real e vale estar escrita: este é um app de alto risco, e biometria
 * fetal, EPDS, DMG e pré-eclâmpsia são o que um obstetra de alto risco usa. A
 * aposta é que o Essencial é para quem está começando NA PLATAFORMA, e que é o
 * primeiro caso de alto risco que empurra para o Starter — que é exatamente o
 * momento em que subir faz sentido para ele.
 */
const ESSENCIAL: Entitlements = {
  label: "Essencial",
  maxPatients: 15,
  maxBrains: 1,
  aiApp: true,
  aiWhatsapp: false,
  clinicalToolsAdvanced: false,
  dashboardAdvanced: false,
  prioritySupport: false,
  teamSeats: false,
  premiumInvitesPerMonth: 0,
  badge: "",
  dedicatedManager: false,
  /* 500 respostas ≈ R$ 0,10 por resposta no preço de R$ 49,90. */
  aiRepliesPerCycle: 500,
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
  aiRepliesPerCycle: 1_500,
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
  aiRepliesPerCycle: 4_000,
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
  /* Contrato sob medida: o teto é combinado, não tabelado. */
  aiRepliesPerCycle: null,
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
  aiRepliesPerCycle: 10_000,
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
  aiRepliesPerCycle: 30_000,
};

// Trial = experimenta o Pro por 14 dias (mesmas capacidades do Pro), mas SEM
// selo — quem está só testando não exibe "Pro verificado" às pacientes.
/* O trial herda as CAPACIDADES do Pro, mas não o teto dele: são coisas
   diferentes. Capacidade é o que ele pode experimentar; teto é quanto a
   plataforma paga para que ele experimente. Médico novo não entra mais em
   trial — isto vale só para quem já estava dentro quando a porta fechou. */
const TRIAL: Entitlements = { ...PRO, label: "Trial", badge: "", aiRepliesPerCycle: 500 };

export const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlements> = {
  trial: TRIAL,
  free: FREE,
  essencial: ESSENCIAL,
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
  /* R$102 existe só como âncora riscada na tela de vendas — o preço COBRADO é
     este. Ancorar em 102 e cobrar 102 colocaria o plano a 31% do Starter, perto
     demais para abrir um segmento: por paciente sairia R$6,80 contra R$2,98 do
     Starter, e quem faz a conta sobe. A um terço do Starter, é outro público. */
  essencial: 49.9,
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
  essencial: 2,
  starter: 3,
  pro: 4,
  elite: 5,
  /* `clinica` fica ABAIXO de black, e isto é uma correção.
     
     Ela estava em 6, no topo, com o comentário "o plano mais caro". Mas o preço
     dela é "sob consulta" (`PLAN_PRICE.clinica = 0`) e o Black custa R$ 1.499 —
     e o assento de clínica é concedido automaticamente a qualquer membro de uma
     clínica ativa. Ou seja: um assento de valor indefinido passava na frente de
     quem paga o plano mais caro da tabela, na busca que a paciente vê. */
  clinica: 6,
  black: 7, // o mais caro da tabela — topo da escada
};

/** Normaliza um valor livre de `doctors.plan` para uma PlanKey conhecida. */
export function normalizePlan(plan: string | null | undefined): PlanKey {
  const p = (plan ?? "").trim().toLowerCase();
  if (
    p === "trial" ||
    p === "free" ||
    p === "essencial" ||
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
