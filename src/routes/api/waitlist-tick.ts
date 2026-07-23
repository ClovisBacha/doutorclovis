import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

/** Compara dois segredos em tempo constante (evita timing attack). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Cascata da fila de espera: expira ofertas vencidas (sem resposta em 4h) e
 * passa a vaga pra próxima da fila. Idempotente — pode ser chamado à vontade.
 *
 * Protegido por CRON_SECRET (header `Authorization: Bearer <CRON_SECRET>`).
 * Sem o secret configurado, responde 401 (fica inerte).
 *
 * ─── Como ligar a cascata automática (opcional, escolha UMA) ──────────────
 * A fila JÁ avança sozinha sempre que alguém abre o app (varredura preguiçosa).
 * Para avançar mesmo com todos offline, aponte um cron para esta URL:
 *   POST/GET https://www.obstetrica.com.br/api/waitlist-tick
 *   Header:  Authorization: Bearer <valor de CRON_SECRET>
 *
 * Opção A — Vercel Cron (precisa do plano Pro pra intervalos < 1 dia): adicione
 *   ao vercel.json:  "crons": [{ "path": "/api/waitlist-tick", "schedule": "*\/5 * * * *" }]
 *   (a Vercel injeta o header Authorization com CRON_SECRET automaticamente).
 * Opção B — Serviço externo grátis (cron-job.org, etc.): agende de 5 em 5 min
 *   apontando pra URL acima com o header Authorization.
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("forbidden", { status: 401 });
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sweepWaitlist } = await import("@/lib/waitlist.functions");
    const expired = await sweepWaitlist(supabaseAdmin);
    return new Response(JSON.stringify({ ok: true, expired }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[waitlist-tick] failed", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/waitlist-tick")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
