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
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { stripeConfigured, priceIdFor, createCheckoutSession } =
      await import("@/lib/stripe.server");
    if (!stripeConfigured()) {
      return { ok: false as const, error: "pagamento_indisponivel" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };

    const priceId = priceIdFor(data.product, data.plan);
    if (!priceId) return { ok: false as const, error: "plano_indisponivel" };

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
