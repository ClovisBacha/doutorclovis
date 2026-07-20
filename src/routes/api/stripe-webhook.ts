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
 *            customer.subscription.updated, customer.subscription.deleted,
 *            invoice.paid  ← comissão de afiliado (50% de cada fatura paga)
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
          } else if (type === "invoice.paid") {
            // Comissão de afiliado: 50% de CADA fatura paga de assinatura
            // atribuída a um código (permuta com influenciador). Idempotente
            // por (código, fatura) — retry do Stripe não duplica.
            const invoice = event.data?.object ?? {};
            try {
              await creditAffiliate(invoice);
            } catch (e) {
              console.error("[webhook] affiliate credit failed", e);
            }
          } else if (type === "charge.refunded") {
            // Reembolso: registra o incidente para o dono ver no /admin.
            const charge = event.data?.object ?? {};
            try {
              await recordPaymentIncident("refund", {
                chargeId: charge.id,
                customerId: charge.customer,
                amountCents: charge.amount_refunded ?? charge.amount ?? 0,
                reason: charge.refunds?.data?.[0]?.reason ?? null,
              });
            } catch (e) {
              console.error("[webhook] refund record failed", e);
            }
          } else if (type === "charge.dispute.created") {
            // Disputa/chargeback: dinheiro sob contestação.
            const dispute = event.data?.object ?? {};
            try {
              await recordPaymentIncident("dispute", {
                chargeId: dispute.charge,
                customerId: null,
                amountCents: dispute.amount ?? 0,
                reason: dispute.reason ?? null,
              });
            } catch (e) {
              console.error("[webhook] dispute record failed", e);
            }
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

/** Registra um reembolso/disputa em payment_incidents (idempotente por charge). */
async function recordPaymentIncident(
  kind: "refund" | "dispute",
  data: {
    chargeId?: string | null;
    customerId?: string | null;
    amountCents?: number;
    reason?: string | null;
  },
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Tenta ligar ao usuário pelo customer (via subscriptions).
  let userId: string | null = null;
  if (data.customerId) {
    const { data: sub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", data.customerId)
      .limit(1)
      .maybeSingle();
    userId = sub?.user_id ?? null;
  }
  await (supabaseAdmin as any).from("payment_incidents").upsert(
    {
      kind,
      stripe_charge_id: data.chargeId ? String(data.chargeId) : null,
      stripe_customer_id: data.customerId ? String(data.customerId) : null,
      user_id: userId,
      amount_cents: data.amountCents ?? 0,
      reason: data.reason ?? null,
    },
    { onConflict: "kind,stripe_charge_id" },
  );
}

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
      // Convite de paciente: o médico que ela convidou assinou → ela ganha o
      // Premium do app (uma única vez, claim atômico). Best-effort.
      try {
        await rewardInvitingPatient(userId);
      } catch (e) {
        console.error("[webhook] patient invite reward failed", e);
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

  // Claim ATÔMICO: o UPDATE ... WHERE referral_rewarded=false só afeta a linha
  // se ninguém tiver recompensado antes. Em corrida (checkout.session.completed
  // e customer.subscription.created chegam quase juntos no 1º pagamento), só um
  // vencedor recebe a linha de volta — impede recompensa dupla (+60).
  const { data: claimed } = await sb
    .from("doctors")
    .update({ referral_rewarded: true })
    .eq("id", referredDoctorId)
    .eq("referral_rewarded", false)
    .select("id");
  if (!claimed || claimed.length === 0) return; // já recompensado / perdeu a corrida

  const { data: referrer } = await sb
    .from("doctors")
    .select("plan_expires_at")
    .eq("id", referrerId)
    .maybeSingle();
  if (!referrer) return; // indicador não existe mais → recompensa se perde (raro)

  const now = Date.now();
  const currentMs = referrer.plan_expires_at
    ? new Date(referrer.plan_expires_at as string).getTime()
    : 0;
  const base = Number.isNaN(currentMs) ? now : Math.max(now, currentMs);
  const newExpiry = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();

  await sb.from("doctors").update({ plan_expires_at: newExpiry }).eq("id", referrerId);
}

/**
 * Recompensa para a paciente que convidou o médico: quando o médico convidado
 * assina um plano pago, a paciente ganha 1 ANO de Premium do app grátis (vale
 * ~R$108). Claim atômico em invited_reward_given (retry do Stripe não duplica).
 * O Premium entra como linha em `subscriptions` (source 'convite', com
 * current_period_end +1 ano) para o "keep" do quiz_premium sobreviver a
 * cancelamentos de outras assinaturas e o prazo ficar registrado.
 */
async function rewardInvitingPatient(doctorId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  const { data: doc } = await sb
    .from("doctors")
    .select("invited_by_patient, invited_reward_given")
    .eq("id", doctorId)
    .maybeSingle();
  const patientId = doc?.invited_by_patient as string | null | undefined;
  if (!patientId || doc?.invited_reward_given) return;

  const { data: claimed } = await sb
    .from("doctors")
    .update({ invited_reward_given: true })
    .eq("id", doctorId)
    .eq("invited_reward_given", false)
    .select("id");
  if (!claimed || claimed.length === 0) return;

  const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("subscriptions").upsert(
    {
      user_id: patientId,
      product: "quiz_premium",
      plan: "convite_medico_1ano",
      source: "convite",
      status: "active",
      stripe_subscription_id: `convite_${doctorId}`,
      current_period_end: oneYear,
    },
    { onConflict: "stripe_subscription_id" },
  );
  await sb.from("patient_profiles").update({ quiz_premium: true }).eq("id", patientId);
}

/**
 * Comissão de afiliado (permuta com influenciador): a assinatura carrega
 * ref_code nos metadados; cada `invoice.paid` dessa assinatura credita
 * commission_pct (padrão 50%) do valor pago no livro-razão. Idempotente por
 * (código, fatura) via UNIQUE — o insert duplicado falha em silêncio.
 */
async function creditAffiliate(invoice: {
  id?: string;
  subscription?: string;
  amount_paid?: number;
}): Promise<void> {
  const invoiceId = invoice?.id;
  const subId = invoice?.subscription ? String(invoice.subscription) : null;
  const amountPaid = Math.max(0, Math.round(Number(invoice?.amount_paid ?? 0)));
  if (!invoiceId || !subId || amountPaid <= 0) return;

  const { getSubscription } = await import("@/lib/stripe.server");
  const sub = await getSubscription(subId);
  const refCode = (sub.metadata?.ref_code || "").trim().toUpperCase();
  if (!refCode) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const { data: aff } = await sb
    .from("affiliates")
    .select("code,commission_pct,active")
    .eq("code", refCode)
    .maybeSingle();
  if (!aff?.active) return;

  const pct = Math.min(100, Math.max(0, Number(aff.commission_pct ?? 50)));
  const commission = Math.round((amountPaid * pct) / 100);
  // UNIQUE(affiliate_code, stripe_invoice_id) → retry não duplica crédito.
  await sb.from("affiliate_earnings").insert({
    affiliate_code: refCode,
    user_id: sub.metadata?.user_id ?? null,
    stripe_invoice_id: invoiceId,
    amount_paid_cents: amountPaid,
    commission_cents: commission,
  });
}
