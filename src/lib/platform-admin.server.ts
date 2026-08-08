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

/** Resolve o usuário logado (qualquer papel) a partir do access token. */
export async function getUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

/** true se o usuário é um médico (linha em `doctors`). */
export async function userIsDoctor(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return !!data;
}

/** Executa um bloco de forma isolada: erro → valor default (resiliência). */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/* A TABELA DE PREÇOS mudou de casa: agora vive em `lib/entitlements`, que o
   navegador também importa. O painel precisa dela para comparar o valor gerado
   com a mensalidade, e manter uma cópia aqui garantiria que um dia as duas
   discordassem — com a tela mentindo sobre a própria cobrança. */
export { PLAN_PRICE } from "./entitlements";
import { mensalidadeCentavos } from "./entitlements";
import { ANUAL_MENSAL_EQUIV_CENTAVOS, MENSAL_CENTAVOS } from "./promo";

/**
 * Preço mensal do plano do médico em centavos (anual normalizado ao mensal).
 *
 * `mensagensCompradas` é `doctors.ai_messages_per_cycle`. Sem ele, o plano
 * `mensagens` conta sempre a ENTRADA (R$ 29,90) — o que subestima quem comprou
 * mais, em até dez vezes. Quem tem a coluna à mão passa; quem não tem recebe o
 * piso, nunca um número inventado para cima.
 */
export function doctorPlanMonthlyCents(plan: string, mensagensCompradas?: number | null): number {
  return mensalidadeCentavos(plan, mensagensCompradas);
}

/**
 * Premium da paciente, normalizado ao MÊS — para somar no MRR.
 *
 * Os dois números eram literais (990 e 1990) e o do anual ficou para trás: o
 * anual passou a R$ 109,90, cujo equivalente mensal é R$ 9,16, não R$ 9,90.
 * São 74 centavos por assinante anual — 8% a mais — somados a um número que o
 * fundador usa para saber como o negócio vai. Uma quarta tabela de preços
 * escondida num arquivo de servidor.
 *
 * Agora sai de `promo.ts`, como todo o resto.
 */
export function patientPremiumMonthlyCents(plan: string | null): number {
  return plan === "annual" ? ANUAL_MENSAL_EQUIV_CENTAVOS : MENSAL_CENTAVOS;
}

/** Status de assinatura que concede ACESSO (espelha statusGrantsAccess). */
export const ACCESS_STATUS = new Set(["active", "trialing"]);
/**
 * Status que representa RECEITA realizada (assinatura paga de verdade). Teste
 * (`trialing`) dá acesso mas NÃO entra no MRR — senão um trial grátis contaria
 * como pagante e o forecast nunca somaria conversões. Separação essencial.
 */
export const PAYING_STATUS = new Set(["active"]);
/** Consulta particular "paga" = confirmada pelo médico ou já realizada. */
export const PAID_STATUS = new Set(["confirmado", "realizado"]);
export const CANCELLED_STATUS = new Set(["cancelado"]);

/** Teto generoso p/ leituras que agregam totais em JS (evita db-max-rows). */
export const MAX_ROWS = 100000;

/** Começo do mês corrente em ISO (para recortes "neste mês"). */
export function monthStartISO(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
