/**
 * WhatsApp Cloud API (Meta) — cliente server-side.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Variáveis necessárias:
 *   WHATSAPP_PHONE_NUMBER_ID  — ID do número no Meta Business (ex: "123456789")
 *   WHATSAPP_ACCESS_TOKEN     — Token permanente (System User) do Meta Business
 *   WHATSAPP_VERIFY_TOKEN     — String secreta para verificação do webhook
 */

const GRAPH = "https://graph.facebook.com/v21.0";

function phoneId() {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID não configurado");
  return id;
}

function token() {
  const t = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!t) throw new Error("WHATSAPP_ACCESS_TOKEN não configurado");
  return t;
}

/** Envia mensagem de texto simples */
export async function waSendText(to: string, text: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${phoneId()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text, preview_url: false },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[WhatsApp] Erro ao enviar:", err);
    throw new Error(`WhatsApp API error ${res.status}: ${err}`);
  }
}

/** Marca mensagem como lida (fire-and-forget) */
export function waMarkRead(messageId: string): void {
  fetch(`${GRAPH}/${phoneId()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  }).catch(() => {});
}

/** Envia botões de resposta rápida (até 3) */
export async function waSendButtons(
  to: string,
  body: string,
  buttons: { id: string; title: string }[],
): Promise<void> {
  const res = await fetch(`${GRAPH}/${phoneId()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    }),
  });
  if (!res.ok) {
    // fallback to text
    await waSendText(to, body);
  }
}

/**
 * Extrai o texto da mensagem recebida.
 * Suporta text, interactive (button_reply, list_reply) e audio (retorna null).
 */
export function extractMessageText(message: Record<string, unknown>): string | null {
  const type = message.type as string;
  if (type === "text") {
    return (message.text as { body: string })?.body ?? null;
  }
  if (type === "interactive") {
    const ia = message.interactive as Record<string, unknown>;
    if (ia?.type === "button_reply") {
      return (ia.button_reply as { title: string })?.title ?? null;
    }
    if (ia?.type === "list_reply") {
      return (ia.list_reply as { title: string })?.title ?? null;
    }
  }
  return null;
}

/**
 * Envia uma mensagem de MODELO (template) aprovado no Meta Business.
 *
 * A diferença importa e é a razão de esta função existir: `waSendText` só
 * chega se a pessoa tiver escrito para o número nas últimas 24h. O contato de
 * emergência de uma paciente nunca escreveu — então, para o aviso do SOS, o
 * texto livre falha com erro 131047 e o modelo é o único caminho.
 *
 * `params` preenche os {{1}}, {{2}}… do corpo aprovado, na ordem.
 */
export async function waSendTemplate(
  to: string,
  name: string,
  lang: string,
  params: string[],
): Promise<void> {
  const res = await fetch(`${GRAPH}/${phoneId()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name,
        language: { code: lang },
        components: params.length
          ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
          : [],
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[WhatsApp] Erro ao enviar template:", err);
    throw new Error(`WhatsApp template error ${res.status}: ${err}`);
  }
}

/** Verifica se o webhook está configurado corretamente */
export function waConfigured(): boolean {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

/**
 * WhatsApp por médico: dado o phone_number_id que RECEBEU a mensagem (Meta
 * Cloud API), resolve o doctor_id mapeado em doctor_whatsapp_numbers. Retorna
 * null se não houver número passado ou mapeamento — aí o agente usa o cérebro
 * do dono (comportamento atual). Best-effort: qualquer falha → null.
 */
export async function resolveDoctorIdByWhatsappNumber(
  phoneNumberId: string | null | undefined,
): Promise<string | null> {
  if (!phoneNumberId) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("doctor_whatsapp_numbers")
      .select("doctor_id")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();
    return (data?.doctor_id as string | null) ?? null;
  } catch {
    return null;
  }
}
