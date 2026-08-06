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

        /* ─── 200 SIGNIFICA "PODE ESQUECER ESTE PAGAMENTO" ──────────────────
           Este arquivo inteiro respondia 200 para tudo, e cada 200 aqui é uma
           promessa ao Mercado Pago: recebi, tratei, não precisa reenviar.

           É o MESMO defeito que o webhook do Stripe acabou de fechar — a
           paciente paga, a consulta continua "pendente_pagamento" para sempre,
           e não há retry porque nós dissemos que estava tudo bem. Sobreviveu
           aqui porque o conserto foi feito no arquivo do outro meio de
           pagamento, não na CLASSE do erro.

           A régua agora: 200 só quando o evento foi resolvido ou quando
           reenviar não mudaria nada. Falha nossa (config ausente, MP fora do
           ar, escrita recusada) → 500, e o MP tenta de novo. */
        const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!mpToken) {
          /* Sem o token não dá para confirmar o pagamento — e responder 200
             faria o MP desistir de um evento que só falhou por configuração
             nossa. 500 mantém o evento vivo até alguém preencher a variável. */
          console.error(
            "[mp-webhook] MERCADO_PAGO_ACCESS_TOKEN ausente — pagamento não confirmado",
          );
          return new Response("configuração ausente", { status: 500 });
        }

        // Verify payment status directly with MP (never trust webhook body alone)
        const paymentId = String(body.data.id);
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${mpToken}` },
        }).catch(() => null);

        if (!res) {
          // Rede caiu no meio: reenviar resolve.
          console.error("[mp-webhook] falha de rede ao consultar o pagamento", paymentId);
          return new Response("indisponível", { status: 500 });
        }
        if (!res.ok) {
          /* 4xx é resposta definitiva do MP (pagamento inexistente, token
             inválido): reenviar dá o mesmo erro para sempre. 5xx é o MP fora
             do ar — aí vale insistir. */
          const definitivo = res.status >= 400 && res.status < 500;
          console.error("[mp-webhook] MP respondeu", res.status, "para", paymentId);
          return new Response("ok", { status: definitivo ? 200 : 500 });
        }

        const payment = (await res.json().catch(() => null)) as { status?: string } | null;
        if (!payment) return new Response("resposta ilegível", { status: 500 });

        if (payment.status === "approved") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("private_consultations")
            .update({ status: "confirmado" })
            .eq("mp_payment_id", paymentId)
            .in("status", ["pendente_pagamento", "pagamento_enviado"]);
          if (error) {
            /* A paciente PAGOU. Se a confirmação não gravou, o único caminho
               de volta é o MP reenviar — o `.in(...)` torna a operação
               idempotente, então repetir é seguro. */
            console.error("[mp-webhook] falha ao confirmar consulta paga", paymentId, error);
            return new Response("falha ao gravar", { status: 500 });
          }
        }

        return new Response("ok", { status: 200 });
      },

      // MP may send a GET to verify the endpoint
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
