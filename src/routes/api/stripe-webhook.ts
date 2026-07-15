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
    // Ao REVOGAR, não apaga o premium se a paciente tem OUTRA assinatura ativa
    // (ex.: convite do médico) — subscriptions é a fonte de verdade.
    let keep = grants;
    if (!grants) {
      const { data: other } = await (supabaseAdmin as any)
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("product", "quiz_premium")
        .neq("stripe_subscription_id", sub.id)
        .in("status", ["active", "trialing"])
        .limit(1);
      if (other && other.length > 0) keep = true;
    }
    await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ quiz_premium: keep })
      .eq("id", userId);
  } else if (product === "doctor_plan") {
    const p = plan ?? "";
    const planKey = p.startsWith("black")
      ? "black"
      : p.startsWith("elite")
        ? "elite"
        : p.startsWith("pro")
          ? "pro"
          : "starter";
    if (grants) {
      await (supabaseAdmin as any)
        .from("doctors")
        .update({ plan: planKey, active: true, plan_expires_at: periodEnd })
        .eq("id", userId);
      // Indicação: se este médico foi indicado e ainda não gerou recompensa,
      // dá +30 dias ao indicador. Idempotente (referral_rewarded). Nunca
      // derruba o fluxo principal se falhar (colunas podem não existir ainda).
      try {
        await rewardReferrer(userId);
      } catch (e) {
        console.error("[webhook] referral reward failed", e);
      }
    } else {
      // cancelou / não pagou → rebaixa para free MANTENDO active=true: o médico
      // continua com o painel no plano grátis e pode reassinar quando quiser
      // (entitlements caem para free por causa do plano, não por desativação).
      await (supabaseAdmin as any)
        .from("doctors")
        .update({ plan: "free", plan_expires_at: null })
        .eq("id", userId);
    }
  }
}

/**
 * Recompensa de indicação: quando o médico `referredDoctorId` assina um plano
 * pago, o médico que o indicou (referred_by) ganha +30 dias — uma única vez
 * (referral_rewarded). Sem auto-indicação. Estende a partir de max(hoje, prazo
 * atual) para não encurtar quem já tem prazo à frente.
 */
async function rewardReferrer(referredDoctorId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  const { data: referred } = await sb
    .from("doctors")
    .select("referred_by, referral_rewarded")
    .eq("id", referredDoctorId)
    .maybeSingle();
  const referrerId = referred?.referred_by as string | null | undefined;
  if (!referrerId || referred?.referral_rewarded || referrerId === referredDoctorId) return;

  const { data: referrer } = await sb
    .from("doctors")
    .select("plan_expires_at")
    .eq("id", referrerId)
    .maybeSingle();
  if (!referrer) return; // indicador não existe mais → não recompensa

  const now = Date.now();
  const currentMs = referrer.plan_expires_at
    ? new Date(referrer.plan_expires_at as string).getTime()
    : 0;
  const base = Number.isNaN(currentMs) ? now : Math.max(now, currentMs);
  const newExpiry = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();

  await sb.from("doctors").update({ plan_expires_at: newExpiry }).eq("id", referrerId);
  // Marca ANTES de qualquer nova execução (idempotência), na linha do indicado.
  await sb.from("doctors").update({ referral_rewarded: true }).eq("id", referredDoctorId);
}
