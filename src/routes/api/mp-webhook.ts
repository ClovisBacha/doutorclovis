import { createAPIFileRoute } from "@tanstack/react-start/api";

export const APIRoute = createAPIFileRoute("/api/mp-webhook")({
  POST: async ({ request }) => {
    const body = await request.json().catch(() => null);

    // Only handle payment notifications
    if (!body || body.type !== "payment" || !body.data?.id) {
      return new Response("ok", { status: 200 });
    }

    const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!mpToken) return new Response("ok", { status: 200 });

    // Verify payment status directly with MP (never trust webhook body alone)
    const paymentId = String(body.data.id);
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    }).catch(() => null);

    if (!res?.ok) return new Response("ok", { status: 200 });

    const payment = (await res.json()) as { status?: string };

    if (payment.status === "approved") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("private_consultations")
        .update({ status: "confirmado" })
        .eq("mp_payment_id", paymentId)
        .in("status", ["pendente_pagamento", "pagamento_enviado"]);
    }

    return new Response("ok", { status: 200 });
  },

  // MP may send a GET to verify the endpoint
  GET: async () => new Response("ok", { status: 200 }),
});
