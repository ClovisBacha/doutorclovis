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
    "doctor_plan:elite": env.STRIPE_PRICE_DOCTOR_ELITE_MONTHLY,
    "doctor_plan:elite_annual": env.STRIPE_PRICE_DOCTOR_ELITE_ANNUAL,
    "doctor_plan:black": env.STRIPE_PRICE_DOCTOR_BLACK_MONTHLY,
    "doctor_plan:black_annual": env.STRIPE_PRICE_DOCTOR_BLACK_ANNUAL,
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
  /** Código de afiliado (influenciador) a carimbar na assinatura. */
  refCode?: string | null;
  /** Cupom Stripe a aplicar (ex.: convite de paciente = 15% off p/ sempre). */
  discountCoupon?: string | null;
}): Promise<{ url: string | null }> {
  const params: Record<string, unknown> = {
    mode: "subscription",
    "line_items[0][price]": opts.priceId,
    "line_items[0][quantity]": 1,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.userId,
    // metadados no session E na assinatura → o webhook sabe quem/what liberar
    "metadata[user_id]": opts.userId,
    "metadata[product]": opts.product,
    "metadata[plan]": opts.plan,
    "subscription_data[metadata][user_id]": opts.userId,
    "subscription_data[metadata][product]": opts.product,
    "subscription_data[metadata][plan]": opts.plan,
  };
  if (opts.refCode) {
    params["metadata[ref_code]"] = opts.refCode;
    params["subscription_data[metadata][ref_code]"] = opts.refCode;
  }
  // Stripe não aceita `discounts` junto com `allow_promotion_codes` — com
  // desconto de convite aplicado, o campo de cupom manual sai do checkout.
  if (opts.discountCoupon) params["discounts[0][coupon]"] = opts.discountCoupon;
  else params.allow_promotion_codes = true;
  if (opts.customerId) params.customer = opts.customerId;
  else if (opts.email) params.customer_email = opts.email;
  const session = await stripeFetch<{ url?: string }>("/checkout/sessions", "POST", params);
  return { url: session.url ?? null };
}

/**
 * Checkout de COBRANÇA ÚNICA (`mode: "payment"`) — hoje só os pacotes de
 * Sementinhas.
 *
 * Usa `price_data` inline em vez de um Price cadastrado: o preço do pacote
 * mora em `pacotes-sementinhas.ts`, e ter também um `STRIPE_PRICE_SEM_*` por
 * pacote criaria uma segunda fonte de verdade que diverge no dia em que
 * alguém mudar um e esquecer o outro. O encoder de `stripeFetch` é recursivo,
 * então o objeto aninhado vai como form-encoded sem trabalho extra.
 *
 * `metadata` carrega o que o webhook precisa para creditar: quem, qual pacote,
 * e QUANTAS Sementinhas. O valor creditado é revalidado no servidor contra o
 * catálogo — o metadata é pista, não autoridade.
 */
export async function createOneTimeCheckout(opts: {
  userId: string;
  email?: string | null;
  customerId?: string | null;
  /** Identificador do pacote no catálogo do app. */
  sku: string;
  /** Rótulo mostrado no checkout do Stripe. */
  nome: string;
  centavos: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null }> {
  const params: Record<string, unknown> = {
    mode: "payment",
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": opts.centavos,
    "line_items[0][price_data][product_data][name]": opts.nome,
    "line_items[0][quantity]": 1,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    client_reference_id: opts.userId,
    "metadata[user_id]": opts.userId,
    "metadata[product]": "sementinhas",
    "metadata[sku]": opts.sku,
    /* Consumível não aceita cupom: o pacote já é a promoção, e cupom sobre
       moeda virtual é o caminho mais curto para arbitragem. */
    "payment_intent_data[metadata][user_id]": opts.userId,
    "payment_intent_data[metadata][product]": "sementinhas",
    "payment_intent_data[metadata][sku]": opts.sku,
  };
  if (opts.customerId) params.customer = opts.customerId;
  else if (opts.email) params.customer_email = opts.email;
  const session = await stripeFetch<{ url?: string }>("/checkout/sessions", "POST", params);
  return { url: session.url ?? null };
}

/**
 * Garante que o cupom de porcentagem existe no Stripe (idempotente por id).
 * Usado no "+15% convite de paciente" — criado uma vez, reutilizado sempre.
 */
/**
 * Cupom de VALOR FIXO, em centavos.
 *
 * Existe porque a oferta de boas-vindas precisa fechar a fatura num número
 * exato: a tela promete R$ 93,13, e o Price do plano anual é R$ 118,80. Como
 * porcentagem isso seria 21,61%, e 11.880 × 21,61% = 2.567,268 — quem
 * arredondaria seria o Stripe, não o app. Um centavo de diferença entre a
 * tela e a fatura é uma reclamação; com valor fixo não existe arredondamento.
 *
 * `duration: "once"` porque o desconto é do PRIMEIRO ano. A renovação volta
 * ao preço de lista, e a tela diz isso.
 */
export async function ensureAmountCoupon(
  id: string,
  amountOffCentavos: number,
  nome: string,
): Promise<string | null> {
  try {
    await stripeFetch<{ id: string }>(`/coupons/${id}`, "GET");
    return id;
  } catch {
    try {
      const c = await stripeFetch<{ id: string }>("/coupons", "POST", {
        id,
        amount_off: amountOffCentavos,
        currency: "brl",
        duration: "once",
        name: nome,
      });
      return c.id;
    } catch {
      return null; // sem cupom, o checkout segue sem desconto (nunca bloqueia)
    }
  }
}

export async function ensurePercentCoupon(
  id: string,
  percentOff: number,
  /* `forever` = vale em toda renovação (é o do convite de paciente).
     `once` = só a primeira cobrança — é o da oferta de boas-vindas, que
     desconta o primeiro ano e depois volta ao preço cheio. A duração faz
     parte da IDENTIDADE do cupom no Stripe: id igual com duração diferente
     não se corrige sozinho, por isso cada oferta tem o seu id. */
  duration: "forever" | "once" = "forever",
  nome?: string,
): Promise<string | null> {
  try {
    await stripeFetch<{ id: string }>(`/coupons/${id}`, "GET");
    return id;
  } catch {
    try {
      const c = await stripeFetch<{ id: string }>("/coupons", "POST", {
        id,
        percent_off: percentOff,
        duration,
        name: nome ?? `Convite de paciente (-${percentOff}%)`,
      });
      return c.id;
    } catch {
      return null; // sem cupom, o checkout segue sem desconto (nunca bloqueia)
    }
  }
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
  // Janela de tolerância (5 min): um webhook válido capturado não pode ser
  // reenviado indefinidamente (anti-replay, igual à SDK oficial do Stripe).
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts * 1000) > 5 * 60 * 1000) return false;
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
