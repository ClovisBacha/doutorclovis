import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook do Stripe — a ÚNICA porta que concede/revoga acesso pago.
 *
 * Fluxo: Stripe confirma o pagamento → chama este endpoint → verificamos a
 * assinatura HMAC do corpo cru (senão qualquer um forjaria "pago") → lemos a
 * assinatura direto na API do Stripe (nunca confiamos só no aviso) → gravamos
 * em `subscriptions` e ligamos/desligamos o flag derivado:
 *   • quiz_premium  → patient_profiles.quiz_premium
 *   • doctor_plan   → doctors.plan / active / plan_expires_at
 *
 * Configurar em Stripe → Developers → Webhooks:
 *   URL: https://www.obstetrica.com.br/api/stripe-webhook
 *   Eventos: checkout.session.completed, customer.subscription.created,
 *            customer.subscription.updated, customer.subscription.deleted
 */
export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
        const raw = await request.text();
        const sig = request.headers.get("stripe-signature");

        const { verifyStripeSignature } = await import("@/lib/stripe.server");
        if (!secret || !verifyStripeSignature(raw, sig, secret)) {
          return new Response("assinatura inválida", { status: 400 });
        }

        let event: { type?: string; data?: { object?: any } };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("json inválido", { status: 400 });
        }

        const type = event.type || "";
        try {
          if (type === "checkout.session.completed") {
            const session = event.data?.object ?? {};
            if (session.subscription) await applySubscription(String(session.subscription));
          } else if (
            type === "customer.subscription.created" ||
            type === "customer.subscription.updated" ||
            type === "customer.subscription.deleted"
          ) {
            const sub = event.data?.object ?? {};
            if (sub.id) await applySubscription(String(sub.id));
          }
        } catch {
          // Erro ao aplicar → responde 500 para o Stripe re-tentar depois.
          return new Response("erro ao aplicar", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});

/** Lê a assinatura autoritativa no Stripe e sincroniza acesso + tabela. */
async function applySubscription(subscriptionId: string): Promise<void> {
  const { getSubscription, statusGrantsAccess } = await import("@/lib/stripe.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const sub = await getSubscription(subscriptionId);
  const meta = sub.metadata || {};
  const userId = meta.user_id;
  const product = meta.product; // 'quiz_premium' | 'doctor_plan'
  const plan = meta.plan ?? null; // 'monthly'|'annual'|'starter'|'pro'|...
  if (!userId || !product) return; // sem metadados não sabemos quem liberar

  const grants = statusGrantsAccess(sub.status);
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  // 1) system of record (upsert por stripe_subscription_id)
  await (supabaseAdmin as any).from("subscriptions").upsert(
    {
      user_id: userId,
      product,
      plan,
      source: "stripe",
      status: sub.status,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd,
    },
    { onConflict: "stripe_subscription_id" },
  );

  // 2) flag derivado que o resto do app já lê
  if (product === "quiz_premium") {
    await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ quiz_premium: grants })
      .eq("id", userId);
  } else if (product === "doctor_plan") {
    const planKey = (plan ?? "").startsWith("pro") ? "pro" : "starter";
    if (grants) {
      await (supabaseAdmin as any)
        .from("doctors")
        .update({ plan: planKey, active: true, plan_expires_at: periodEnd })
        .eq("id", userId);
    } else {
      // cancelou / não pagou → suspende (entitlements caem para free)
      await (supabaseAdmin as any).from("doctors").update({ active: false }).eq("id", userId);
    }
  }
}
