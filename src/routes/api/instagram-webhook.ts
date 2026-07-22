import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

/**
 * Webhook do Instagram — porta que credita 100 Sementinhas 🌱 quando a paciente
 * marca @obstetrica.app num Story. Verificação real da Meta (não dá pra forjar).
 *
 * ─── Configuração na Meta (uma vez) ──────────────────────────────────────
 * 1. @obstetrica.app precisa ser conta Instagram Business/Creator ligada a uma
 *    Página do Facebook.
 * 2. Meta for Developers → criar App → produtos "Instagram" + "Webhooks".
 * 3. Permissões: instagram_basic, instagram_manage_messages (menções em Story
 *    chegam pela Messaging API como attachment `story_mention`),
 *    pages_manage_metadata. Passar pela App Review da Meta.
 * 4. Webhooks → objeto "instagram" → assinar o campo `messages` (e `mentions`).
 *    Callback URL: https://www.obstetrica.com.br/api/instagram-webhook
 *    Verify token: o valor de INSTAGRAM_VERIFY_TOKEN.
 * 5. Variáveis de ambiente (Vercel):
 *      INSTAGRAM_VERIFY_TOKEN  — string secreta que você inventa (bate no passo 4)
 *      INSTAGRAM_APP_SECRET    — "App Secret" do app da Meta (valida a assinatura)
 *      INSTAGRAM_PAGE_TOKEN    — token de acesso p/ resolver o @ de quem marcou
 *
 * Enquanto essas variáveis não existirem, o endpoint fica inerte (o app nem
 * mostra o card de compartilhar) — nada quebra.
 *
 * Observação honesta: o formato exato do payload de Story mention pode variar
 * conforme o produto/versão da Meta. O parser abaixo é defensivo (cobre as
 * formas conhecidas) e loga o corpo recebido — assim, no 1º Story real, dá pra
 * conferir o shape e afinar o extrator se precisar.
 */
export const Route = createFileRoute("/api/instagram-webhook")({
  server: {
    handlers: {
      // Handshake de verificação da Meta ao cadastrar o webhook.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const expected = process.env.INSTAGRAM_VERIFY_TOKEN || "";
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        const secret = process.env.INSTAGRAM_APP_SECRET || "";
        const raw = await request.text();
        const sig =
          request.headers.get("x-hub-signature-256") || request.headers.get("x-hub-signature");

        // Sem config → inerte (200 pra Meta não ficar re-tentando).
        if (!secret) return new Response("ok", { status: 200 });
        if (!verifySignature(raw, sig, secret)) {
          return new Response("assinatura inválida", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("json inválido", { status: 400 });
        }

        try {
          const igsids = extractStoryMentionSenderIds(payload);
          const usernames = extractMentionUsernames(payload);
          if (igsids.length === 0 && usernames.length === 0) {
            // Nada acionável (ex.: eco de mensagem própria). Loga p/ inspeção.
            console.log("[instagram-webhook] sem menção acionável:", raw.slice(0, 800));
            return new Response("ok", { status: 200 });
          }
          await creditMentions(igsids, usernames);
        } catch (e) {
          console.error("[instagram-webhook] falha ao creditar", e);
          // 200 mesmo assim: um erro nosso não deve fazer a Meta re-tentar em loop.
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

/** Valida X-Hub-Signature-256 (HMAC-SHA256 do corpo cru com o App Secret). */
function verifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const [algo, sent] = header.includes("=") ? header.split("=") : ["sha256", header];
  const hash = crypto
    .createHmac(algo === "sha1" ? "sha1" : "sha256", secret)
    .update(raw, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(hash);
    const b = Buffer.from(sent);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type IgEntry = {
  messaging?: Array<{
    sender?: { id?: string };
    message?: { attachments?: Array<{ type?: string }> };
  }>;
  changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
};

/**
 * IGSIDs (ids de quem marcou) de menções em STORY — chegam pela Messaging API
 * como um attachment `story_mention`. Retorna os sender.id p/ resolver o @.
 */
function extractStoryMentionSenderIds(payload: unknown): string[] {
  const out: string[] = [];
  const entries = (payload as { entry?: IgEntry[] })?.entry ?? [];
  for (const e of entries) {
    for (const m of e.messaging ?? []) {
      const isStory = (m.message?.attachments ?? []).some((a) => a?.type === "story_mention");
      if (isStory && m.sender?.id) out.push(String(m.sender.id));
    }
  }
  return [...new Set(out)];
}

/**
 * @s citados diretamente no payload (campo `mentions` ou um `username` que a
 * Meta às vezes inclui). Fallback caso o shape já traga o handle.
 */
function extractMentionUsernames(payload: unknown): string[] {
  const out: string[] = [];
  const entries = (payload as { entry?: IgEntry[] })?.entry ?? [];
  for (const e of entries) {
    for (const c of e.changes ?? []) {
      if (c.field !== "mentions") continue;
      const u = (c.value?.username ?? c.value?.from_username) as string | undefined;
      if (u) out.push(String(u));
    }
  }
  return [...new Set(out)];
}

/** Resolve o @ (username) de um IGSID via Graph API, se houver token. */
async function resolveUsername(igsid: string): Promise<string | null> {
  const token = process.env.INSTAGRAM_PAGE_TOKEN || "";
  if (!token) return null;
  try {
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(
      igsid,
    )}?fields=username&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as { username?: string };
    return j.username ?? null;
  } catch {
    return null;
  }
}

/** Casa IGSIDs/usernames com contas e credita 100 🌱 (idempotente por semana). */
async function creditMentions(igsids: string[], usernames: string[]): Promise<void> {
  const { findUidByInstagramHandle, grantInstagramShare } =
    await import("@/lib/instagram.functions");
  const handles = [...usernames];
  for (const igsid of igsids) {
    const u = await resolveUsername(igsid);
    if (u) handles.push(u);
  }
  const seen = new Set<string>();
  for (const h of handles) {
    const uid = await findUidByInstagramHandle(h);
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    const granted = await grantInstagramShare(uid);
    if (granted > 0) console.log(`[instagram-webhook] +${granted} 🌱 p/ @${h}`);
  }
}
