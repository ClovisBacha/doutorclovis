import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

/**
 * Verificação da assinatura do webhook do Mercado Pago (x-signature).
 * Formato: "ts=<ts>,v1=<hmac>"; manifest = "id:<data.id>;request-id:<rid>;ts:<ts>;"
 * (id em minúsculas quando alfanumérico, conforme docs do MP).
 * Só é EXIGIDA quando MERCADO_PAGO_WEBHOOK_SECRET está configurado — sem o
 * secret, mantém o comportamento anterior (mitigado pela re-consulta na API).
 */
function mpSignatureOk(request: Request, dataId: string): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!secret) return true; // não configurado: não bloqueia (compat)
  const sig = request.headers.get("x-signature") ?? "";
  const rid = request.headers.get("x-request-id") ?? "";
  const parts: Record<string, string> = {};
  for (const kv of sig.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${rid};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/mp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          type?: string;
          data?: { id?: string | number };
        } | null;

        // Only handle payment notifications
        if (!body || body.type !== "payment" || !body.data?.id) {
          return new Response("ok", { status: 200 });
        }

        // Assinatura inválida (quando o secret está configurado): ignora.
        if (!mpSignatureOk(request, String(body.data.id))) {
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
    },
  },
});
