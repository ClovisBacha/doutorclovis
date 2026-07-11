/**
 * Cliente Stripe mínimo (server-only), sem SDK — só `fetch` + `crypto`, no
 * mesmo espírito da integração do Mercado Pago já existente. Cobre o que o
 * fluxo de assinatura precisa: criar Checkout, abrir o portal de cobrança,
 * ler uma assinatura e verificar a assinatura (HMAC) do webhook.
 *
 * Segredos vêm SÓ do ambiente (Vercel), nunca do repositório:
 *   STRIPE_SECRET_KEY        — chave secreta (sk_live_… / sk_test_…)
 *   STRIPE_WEBHOOK_SECRET    — segredo do endpoint de webhook (whsec_…)
 *   STRIPE_PRICE_*           — IDs de Price (price_…) criados no painel Stripe
 */
import crypto from "node:crypto";

const STRIPE_API = "https://api.stripe.com/v1";

function key(): string {
  return process.env.STRIPE_SECRET_KEY || "";
}

/** Stripe está configurado neste ambiente? (sem chave, o fluxo faz fallback.) */
export function stripeConfigured(): boolean {
  return !!key();
}

/** Codifica objeto aninhado no formato x-www-form-urlencoded que o Stripe usa. */
function encodeForm(obj: Record<string, unknown>, prefix = "", out: string[] = []): string {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) {
      encodeForm(v as Record<string, unknown>, name, out);
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object")
          encodeForm(item as Record<string, unknown>, `${name}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out.join("&");
}

async function stripeFetch<T>(
  path: string,
  method: "GET" | "POST",
  params?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" && params ? encodeForm(params) : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json?.error?.message || `Stripe ${path} falhou (${res.status})`);
  }
  return json;
}

/** Produto/plano que o app conhece → ID de Price no Stripe (via ambiente). */
export type BillingProduct = "quiz_premium" | "doctor_plan";

export function priceIdFor(product: BillingProduct, plan: string): string | null {
  const env = process.env;
  const map: Record<string, string | undefined> = {
    "quiz_premium:monthly": env.STRIPE_PRICE_QUIZ_MONTHLY,
    "quiz_premium:annual": env.STRIPE_PRICE_QUIZ_ANNUAL,
    "doctor_plan:starter": env.STRIPE_PRICE_DOCTOR_STARTER_MONTHLY,
    "doctor_plan:starter_annual": env.STRIPE_PRICE_DOCTOR_STARTER_ANNUAL,
    "doctor_plan:pro": env.STRIPE_PRICE_DOCTOR_PRO_MONTHLY,
    "doctor_plan:pro_annual": env.STRIPE_PRICE_DOCTOR_PRO_ANNUAL,
  };
  return map[`${product}:${plan}`] ?? null;
}

/** Cria uma sessão de Checkout (assinatura recorrente) e devolve a URL. */
export async function createCheckoutSession(opts: {
  priceId: string;
  userId: string;
  email?: string | null;
  customerId?: string | null;
  product: BillingProduct;
  plan: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null }> {
  const params: Record<string, unknown> = {
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": 1,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.userId,
    allow_promotion_codes: true,
    // metadados no session E na assinatura → o webhook sabe quem/what liberar
    "metadata[user_id]": opts.userId,
    "metadata[product]": opts.product,
    "metadata[plan]": opts.plan,
    "subscription_data[metadata][user_id]": opts.userId,
    "subscription_data[metadata][product]": opts.product,
    "subscription_data[metadata][plan]": opts.plan,
  };
  if (opts.customerId) params.customer = opts.customerId;
  else if (opts.email) params.customer_email = opts.email;
  const session = await stripeFetch<{ url?: string }>("/checkout/sessions", "POST", params);
  return { url: session.url ?? null };
}

/** Abre o portal de cobrança (cancelar, trocar cartão) e devolve a URL. */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string | null }> {
  const session = await stripeFetch<{ url?: string }>("/billing_portal/sessions", "POST", {
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url ?? null };
}

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  current_period_end?: number;
  items?: { data?: { price?: { id?: string } }[] };
  metadata?: Record<string, string>;
};

/** Lê a assinatura direto na API (o webhook NUNCA confia só no corpo). */
export async function getSubscription(id: string): Promise<StripeSubscription> {
  return stripeFetch<StripeSubscription>(`/subscriptions/${id}`, "GET");
}

export type StripeCheckoutSession = {
  id: string;
  customer?: string;
  subscription?: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
};

export async function getCheckoutSession(id: string): Promise<StripeCheckoutSession> {
  return stripeFetch<StripeCheckoutSession>(`/checkout/sessions/${id}`, "GET");
}

/**
 * Verifica a assinatura do webhook (cabeçalho `Stripe-Signature`) via HMAC
 * SHA-256 do payload cru, com comparação em tempo constante. Sem isso, um
 * atacante poderia forjar "pagamento aprovado".
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header || !secret) return false;
  const parts: Record<string, string> = {};
  for (const kv of header.split(",")) {
    const [k, val] = kv.split("=");
    if (k && val) parts[k.trim()] = val.trim();
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Status que concedem acesso. */
export function statusGrantsAccess(status: string): boolean {
  return status === "active" || status === "trialing";
}
