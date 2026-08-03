/**
 * Compra de Sementinhas — o lado servidor.
 *
 * A UI nunca credita nada. Ela leva ao Checkout; quem põe Sementinhas na
 * carteira é o webhook, depois de o Stripe confirmar o pagamento. É a mesma
 * regra da assinatura (`billing.functions.ts`), e por um motivo mais forte
 * ainda aqui: saldo é acumulativo. Um crédito indevido não se corrige
 * desligando um booleano.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PACOTE_POR_ID } from "@/lib/pacotes-sementinhas";

/** URLs de volta do Checkout. Espelha o que billing.functions.ts faz. */
function urlsDeRetorno(returnPath: string) {
  const base = (process.env.SITE_URL || "https://www.obstetrica.com.br").replace(/\/$/, "");
  const p = returnPath.startsWith("/") ? returnPath : `/${returnPath}`;
  return {
    successUrl: `${base}${p}?sementinhas=ok`,
    cancelUrl: `${base}${p}?sementinhas=cancelado`,
  };
}

export const createSementinhasCheckout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        pacoteId: z.string().min(3).max(40),
        returnPath: z.string().max(120).default("/minha-conta"),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    /* O pacote é resolvido pelo CATÁLOGO DO SERVIDOR. O cliente manda um id,
       nunca um preço nem uma quantidade — senão bastaria editar a requisição
       para comprar 10.000 Sementinhas por R$ 39,90. */
    const pacote = PACOTE_POR_ID[data.pacoteId];
    if (!pacote) return { ok: false as const, error: "pacote_inexistente" };

    const { stripeConfigured, createOneTimeCheckout } = await import("@/lib/stripe.server");
    if (!stripeConfigured()) return { ok: false as const, error: "pagamento_indisponivel" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, error: "nao_autenticado" };

    // Reaproveita o customer do Stripe se ela já assinou algo antes.
    const { data: existing } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", u.user.id)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .maybeSingle();

    const { successUrl, cancelUrl } = urlsDeRetorno(data.returnPath);
    try {
      const { url } = await createOneTimeCheckout({
        userId: u.user.id,
        email: u.user.email ?? null,
        customerId:
          (existing as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null,
        sku: pacote.id,
        nome: `${pacote.quantidade.toLocaleString("pt-BR")} Sementinhas`,
        centavos: pacote.centavos,
        successUrl,
        cancelUrl,
      });
      if (!url) return { ok: false as const, error: "checkout_sem_url" };
      return { ok: true as const, url };
    } catch (e) {
      console.error("[createSementinhasCheckout]", e);
      return { ok: false as const, error: "falha_checkout" };
    }
  });
