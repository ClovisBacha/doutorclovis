/**
 * Webhook do WhatsApp Cloud API (Meta).
 *
 * GET  /api/whatsapp  — verificação do webhook (Meta chama uma vez ao configurar)
 * POST /api/whatsapp  — recebe mensagens em tempo real
 *
 * Configure no Meta for Developers:
 *  1. Crie um App do tipo "Business"
 *  2. Adicione o produto "WhatsApp"
 *  3. Em Webhooks → URL de callback: https://SEU_DOMINIO/api/whatsapp
 *     Verify token: valor de WHATSAPP_VERIFY_TOKEN
 *  4. Assine o campo "messages"
 *  5. Em Configurações do App → Básico, copie o "Chave Secreta do App"
 *     para WHATSAPP_APP_SECRET — usado para validar a assinatura
 *     X-Hub-Signature-256 de cada POST (sem isso, qualquer um poderia
 *     forjar mensagens e disparar respostas/agendamentos).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsAppMessage } from "@/lib/whatsapp-agent.server";
import { waMarkRead, extractMessageText } from "@/lib/whatsapp.server";

/** Valida o HMAC-SHA256 que a Meta envia em X-Hub-Signature-256 ("sha256=<hex>"). */
function verifyMetaSignature(raw: string, header: string | null, secret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/whatsapp")({
  server: {
    handlers: {
      /** Meta chama GET para verificar o webhook */
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const verifyToken = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const expected = process.env.WHATSAPP_VERIFY_TOKEN;
        if (!expected) {
          return new Response("WHATSAPP_VERIFY_TOKEN não configurado", { status: 500 });
        }

        if (mode === "subscribe" && verifyToken === expected && challenge) {
          return new Response(challenge, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        }

        return new Response("Token inválido", { status: 403 });
      },

      /** Meta envia POST com cada mensagem recebida */
      POST: async ({ request }) => {
        // Assinatura ANTES de qualquer processamento: o corpo cru é a base do
        // HMAC. Sem segredo configurado → fail-closed (não processa nada),
        // mas responde 200 para a Meta não desabilitar o webhook por retry.
        const raw = await request.text();
        const secret = process.env.WHATSAPP_APP_SECRET;
        if (!secret) {
          console.error(
            "[WhatsApp webhook] WHATSAPP_APP_SECRET não configurado — mensagem ignorada",
          );
          return new Response("OK", { status: 200 });
        }
        if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
          return new Response("assinatura inválida", { status: 401 });
        }

        // Retorna 200 imediatamente para o Meta (evita retry)
        // O processamento real acontece em background
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("OK", { status: 200 });
        }

        // Processa de forma não-bloqueante
        processWebhook(body).catch((err) => {
          console.error("[WhatsApp webhook] Erro:", err);
        });

        return new Response("OK", { status: 200 });
      },
    },
  },
});

/* ------------------------------------------------------------------ */
/* Processamento assíncrono                                             */
/* ------------------------------------------------------------------ */

async function processWebhook(body: unknown): Promise<void> {
  const payload = body as Record<string, unknown>;

  // Estrutura do payload: { object: "whatsapp_business_account", entry: [...] }
  if (payload.object !== "whatsapp_business_account") return;

  const entries = (payload.entry as unknown[]) ?? [];

  for (const entry of entries) {
    const e = entry as Record<string, unknown>;
    const changes = (e.changes as unknown[]) ?? [];

    for (const change of changes) {
      const c = change as Record<string, unknown>;
      if (c.field !== "messages") continue;

      const value = c.value as Record<string, unknown>;
      const messages = (value?.messages as unknown[]) ?? [];
      const contacts = (value?.contacts as unknown[]) ?? [];
      // Número (Meta) que recebeu a mensagem → roteia para o médico dele.
      const metadata = value?.metadata as Record<string, unknown> | undefined;
      const phoneNumberId = (metadata?.phone_number_id as string | undefined) ?? null;

      for (const msg of messages) {
        const m = msg as Record<string, unknown>;

        // Ignora status updates (delivered, read, etc.)
        if (m.type === "reaction" || !m.from) continue;

        const fromPhone = m.from as string;
        const messageId = m.id as string;

        // Tenta obter o nome do contato
        const contact = contacts.find((c) => (c as Record<string, unknown>).wa_id === fromPhone) as
          | Record<string, unknown>
          | undefined;
        const _contactName = (contact?.profile as Record<string, unknown>)?.name ?? null;

        // Extrai texto da mensagem
        const text = extractMessageText(m);
        if (!text) {
          // Mensagem sem texto suportado (imagem, sticker, etc.)
          // Poderíamos responder pedindo texto, mas por ora ignoramos
          continue;
        }

        // Marca como lida (fire-and-forget)
        waMarkRead(messageId);

        // Processa com o agente de IA
        await handleWhatsAppMessage(fromPhone, text, messageId, phoneNumberId);
      }
    }
  }
}
