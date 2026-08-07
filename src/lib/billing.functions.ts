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
/* quiz: monthly|annual · médico: `mensagens` (o que se vende) + os nomeados,
   que continuam aceitos só porque há médicos gravados neles. */
const PLANS = [
  "monthly",
  "annual",
  "mensagens",
  "essencial",
  "essencial_annual",
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
        /**
         * Quantas mensagens de IA por mês ele está comprando (plano `mensagens`).
         *
         * A faixa é validada de novo no servidor, contra a MESMA escada que
         * calcula o preço — não contra números escritos aqui. O Stripe cobra
         * pelo Price graduado, então mandar 99.999 não daria um plano de graça;
         * daria uma fatura de milhares de reais e um teto de IA que a plataforma
         * não consegue pagar. A trava existe para o segundo caso.
         */
        mensagens: z.number().int().positive().optional(),
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

    /* ─── A QUANTIDADE, QUE É O PLANO ────────────────────────────────────────
     *
     * Este é o elo que faltava. `createCheckoutSession` ganhou `quantity` e o
     * webhook aprendeu a ler `items.data[0].quantity` — mas ninguém MANDAVA a
     * quantidade, então todo checkout ia com 1. Uma mensagem de IA por mês, ao
     * preço da faixa fixa: o médico paga R$ 29,90 e recebe uma resposta.
     *
     * É a quinta vez nesta base que o teste prova a função extraída e não o
     * CHAMADOR. Por isso `cadeia-do-stripe.test.ts` agora afirma esta linha.
     *
     * A faixa vem da escada, nunca de literais: um número escrito aqui seria a
     * segunda tabela de preços, e é assim que a tela e a fatura divergem.
     */
    let quantity: number | undefined;
    let quantityRange: { min: number; max: number } | undefined;
    if (data.product === "doctor_plan" && data.plan === "mensagens") {
      const { ENTRADA_MENSAGENS, TETO_AUTOATENDIMENTO } = await import("@/lib/planos-medico");
      const pedido = data.mensagens ?? ENTRADA_MENSAGENS;
      if (pedido < ENTRADA_MENSAGENS || pedido > TETO_AUTOATENDIMENTO) {
        /* Acima do teto do autoatendimento é contrato de Clínica, provisionado
           à mão — não é um checkout que alguém fecha sozinho no site. */
        return { ok: false as const, error: "fora_da_escada" as const };
      }
      quantity = pedido;
      quantityRange = { min: ENTRADA_MENSAGENS, max: TETO_AUTOATENDIMENTO };
    }

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
          /* Atribuição persistida na paciente (relatório por influenciador).
             Não derruba a compra — o `refCode` segue para a metadata da
             Stripe e é dela que o webhook credita a comissão. Mas o relatório
             por influenciador sai errado, e sem log ninguém descobre: é uma
             divergência entre duas fontes que ninguém compara. */
          const { error: refErr } = await (supabaseAdmin as any)
            .from("patient_profiles")
            .update({ ref_code: refCode })
            .eq("id", u.user.id)
            .is("ref_code", null); // 1º afiliado vence; não sobrescreve
          if (refErr) console.error("[afiliado] atribuição não gravou", code, refErr);
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

    /* ── O CUPOM DO MÉDICO ────────────────────────────────────────────
       20% nos DOIS planos, mensal e anual.

       ─── O QUE ESTAVA AQUI ANTES ────────────────────────────────────────
       A oferta de boas-vindas: 62% no primeiro ano do anual, automática, para
       quem nunca tinha assinado. Foi aposentada junto com a mudança do anual
       para R$ 109,90 — com o preço novo ela entregava R$ 89,90 e o cupom do
       médico entrega R$ 87,92, praticamente a mesma coisa. Manter as duas
       faria o cupom do médico não valer nada; empilhá-las levaria a assinatura
       a R$ 71,92.

       ─── POR QUE PORCENTAGEM AQUI, E VALOR FIXO LÁ ──────────────────────
       A oferta antiga usava cupom de VALOR FIXO de propósito: os 62% incidiam
       sobre o preço de pagar mês a mês (R$ 238,80) enquanto o Stripe cobrava o
       Price do anual (R$ 118,80), então uma porcentagem obrigaria o Stripe a
       arredondar — e um centavo de diferença entre a tela e a fatura é uma
       reclamação.

       Aqui os 20% incidem sobre o PRÓPRIO preço cobrado, e as duas contas
       fecham exatas em centavos: 1990 × 0,8 = 1592 e 10990 × 0,8 = 8792. Sem
       arredondamento no meio, porcentagem é o instrumento certo — e é o único
       que funciona nos dois planos com um cupom só.

       ─── NOS DOIS PLANOS, E ISSO É DECISÃO ──────────────────────────────
       A oferta antiga era só no anual, com um motivo escrito: desconto num
       plano mensal vira "um mês barato seguido de onze cheios", que é a versão
       que gera estorno. O cupom do médico é `duration: forever` — ela mantém os
       20% enquanto for assinante —, então esse defeito não existe aqui.

       O cupom de convite-de-paciente (no plano do MÉDICO) continua com
       prioridade sobre este: são produtos diferentes e nunca colidem. */
    if (!discountCoupon && data.product === "quiz_premium") {
      try {
        const { lerPrecos } = await import("@/lib/promo.functions");
        const precos = await lerPrecos(u.user.id);
        if (precos.temCupom) {
          const { CUPOM_MEDICO_ID, CUPOM_MEDICO_PCT } = await import("@/lib/promo");
          discountCoupon = await ensurePercentCoupon(CUPOM_MEDICO_ID, CUPOM_MEDICO_PCT);
        }
      } catch {
        /* Falhou? Segue SEM desconto. Preferir não descontar a descontar
           errado: o checkout nunca é bloqueado por causa do cupom. */
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
        quantity,
        quantityRange,
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
