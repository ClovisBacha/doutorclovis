/**
 * Funções de assinatura (Stripe) chamadas pela UI.
 *   - createSubscriptionCheckout: paciente/médico → URL do Checkout do Stripe
 *   - openBillingPortal: gerenciar/cancelar assinatura no portal do Stripe
 *   - getMyBilling: estado da(s) assinatura(s) do usuário logado
 *
 * A liberação de acesso NÃO acontece aqui — quem libera é o webhook
 * (/api/stripe-webhook), após o Stripe confirmar o pagamento. Assim, "pagou →
 * acesso na hora" é automático e à prova de fraude (a UI nunca concede nada).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DOCTOR } from "@/lib/doctor.config";

const PRODUCTS = ["quiz_premium", "doctor_plan"] as const;
// quiz: monthly|annual · médico: starter|pro (+ _annual)
const PLANS = [
  "monthly",
  "annual",
  "starter",
  "starter_annual",
  "pro",
  "pro_annual",
  "elite",
  "elite_annual",
  "black",
  "black_annual",
] as const;

function siteUrl(): string {
  return (process.env.SITE_URL || DOCTOR.siteUrl || "https://www.obstetrica.com.br").replace(
    /\/$/,
    "",
  );
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        product: z.enum(PRODUCTS),
        plan: z.enum(PLANS),
        // para onde voltar depois do checkout (rota do app)
        returnPath: z.string().default("/minha-conta"),
        // código de afiliado (influenciador) capturado do link ?ref= no site
        refCode: z.string().max(40).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { stripeConfigured, priceIdFor, createCheckoutSession, ensurePercentCoupon } =
      await import("@/lib/stripe.server");
    /* ── A divisão, aplicada no servidor ──────────────────────────────
       Um checkout do Stripe É o canal "site", por definição — não há como
       criar um a partir do app. Então esta checagem não depende de nenhum
       campo que o cliente mande, e não há requisição forjada que a contorne:
       `premium_paciente` tem canal "app" e é recusado aqui, ponto.

       É o que garante que a compra da paciente não escape para o Stripe
       enquanto o app estiver em revisão — que é o cenário que reprova. */
    const { podeComprar } = await import("@/lib/canal-de-venda");
    const veredito = podeComprar(
      data.product === "doctor_plan" ? "plano_medico" : "premium_paciente",
      "site",
    );
    if (!veredito.pode) {
      return { ok: false as const, error: "canal_errado" as const, texto: veredito.texto };
    }

    if (!stripeConfigured()) {
      return { ok: false as const, error: "pagamento_indisponivel" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };

    const priceId = priceIdFor(data.product, data.plan);
    if (!priceId) return { ok: false as const, error: "plano_indisponivel" };

    // ── Afiliado (Premium da paciente): valida o código contra a tabela e
    // carimba na assinatura — o webhook credita 50% de cada fatura paga.
    let refCode: string | null = null;
    if (data.product === "quiz_premium" && data.refCode?.trim()) {
      try {
        const code = data.refCode.trim().toUpperCase();
        const { data: aff } = await (supabaseAdmin as any)
          .from("affiliates")
          .select("code,active")
          .eq("code", code)
          .maybeSingle();
        if (aff?.active) {
          refCode = aff.code as string;
          // Atribuição persistida na paciente (relatório por influenciador).
          await (supabaseAdmin as any)
            .from("patient_profiles")
            .update({ ref_code: refCode })
            .eq("id", u.user.id)
            .is("ref_code", null); // 1º afiliado vence; não sobrescreve
        }
      } catch {
        /* tabela ausente → segue sem afiliado */
      }
    }

    // ── Convite de paciente (+15% p/ sempre no plano do médico): se este
    // médico foi convidado por uma paciente, o desconto entra no checkout.
    let discountCoupon: string | null = null;
    if (data.product === "doctor_plan") {
      try {
        const { data: doc } = await (supabaseAdmin as any)
          .from("doctors")
          .select("invited_by_patient")
          .eq("id", u.user.id)
          .maybeSingle();
        if (doc?.invited_by_patient) {
          discountCoupon = await ensurePercentCoupon("convite-paciente-15", 15);
        }
      } catch {
        /* coluna ausente → segue sem desconto */
      }
    }

    /* ── Oferta de boas-vindas ────────────────────────────────────────
       61% no PRIMEIRO ANO do plano anual, e só enquanto a janela de 2h59
       estiver aberta — conferida AQUI, no servidor, relendo o instante do
       banco. Se a decisão morasse no cliente, bastaria uma requisição forjada
       para comprar com desconto meses depois de a promoção ter acabado.

       Só o anual: o desconto existe para trocar o compromisso de um ano por
       um preço melhor, e num plano mensal ele viraria um mês barato seguido
       de onze cheios — que é a versão que gera estorno.

       O cupom de convite tem prioridade: ele é `duration: forever` e vale
       mais para ela do que 61% numa cobrança só. */
    if (!discountCoupon && data.product === "quiz_premium" && data.plan === "annual") {
      try {
        const { lerOferta } = await import("@/lib/promo.functions");
        const oferta = await lerOferta(u.user.id);
        if (oferta.ativa) {
          const { ABATIMENTO_CENTAVOS, CUPOM_ID, DESCONTO_PCT } = await import("@/lib/promo");
          const { ensureAmountCoupon } = await import("@/lib/stripe.server");
          /* Valor FIXO, não porcentagem: os 61% incidem sobre o preço de
             pagar mês a mês (R$ 238,80), e o que o Stripe cobra é o Price do
             anual (R$ 118,80). Abater R$ 25,67 fecha a fatura exatamente nos
             R$ 93,13 que a tela promete — sem arredondamento no meio. */
          discountCoupon = await ensureAmountCoupon(
            CUPOM_ID,
            ABATIMENTO_CENTAVOS,
            `Boas-vindas (-${DESCONTO_PCT}% no 1º ano)`,
          );
        }
      } catch {
        /* Falhou? Segue SEM desconto. Preferir não descontar a descontar
           errado: o checkout nunca é bloqueado por causa da promoção. */
      }
    }

    // Reaproveita o customer do Stripe se o usuário já assinou algo antes.
    const { data: existing } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", u.user.id)
      .not("stripe_customer_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const base = siteUrl();
    const ret = data.returnPath.startsWith("/") ? data.returnPath : `/${data.returnPath}`;
    try {
      const { url } = await createCheckoutSession({
        priceId,
        userId: u.user.id,
        email: u.user.email,
        customerId: existing?.stripe_customer_id ?? null,
        product: data.product,
        plan: data.plan,
        successUrl: `${base}${ret}?assinatura=sucesso`,
        cancelUrl: `${base}${ret}?assinatura=cancelada`,
        refCode,
        discountCoupon,
      });
      if (!url) return { ok: false as const, error: "checkout_sem_url" };
      return { ok: true as const, url };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "erro_checkout" };
    }
  });

export const openBillingPortal = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ accessToken: z.string().min(10), returnPath: z.string().default("/minha-conta") })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { stripeConfigured, createBillingPortalSession } = await import("@/lib/stripe.server");
    if (!stripeConfigured()) return { ok: false as const, error: "pagamento_indisponivel" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };

    const { data: row } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", u.user.id)
      .not("stripe_customer_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row?.stripe_customer_id) return { ok: false as const, error: "sem_assinatura" };

    const base = siteUrl();
    const ret = data.returnPath.startsWith("/") ? data.returnPath : `/${data.returnPath}`;
    try {
      const { url } = await createBillingPortalSession(row.stripe_customer_id, `${base}${ret}`);
      if (!url) return { ok: false as const, error: "portal_sem_url" };
      return { ok: true as const, url };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "erro_portal" };
    }
  });

export type MySubscription = {
  product: string;
  plan: string | null;
  status: string;
  source: string;
  current_period_end: string | null;
};

export const getMyBilling = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    const { data: rows } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("product,plan,status,source,current_period_end")
      .eq("user_id", u.user.id)
      .order("updated_at", { ascending: false });
    return { ok: true as const, subscriptions: (rows ?? []) as MySubscription[] };
  });

/** O médico logado tem convite de paciente (+15% no checkout)? */
export const getMyInviteDiscount = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (error || !u.user) return { ok: false as const, invited: false };
    try {
      const { data: doc } = await (supabaseAdmin as any)
        .from("doctors")
        .select("invited_by_patient")
        .eq("id", u.user.id)
        .maybeSingle();
      return { ok: true as const, invited: !!doc?.invited_by_patient };
    } catch {
      return { ok: true as const, invited: false };
    }
  });
