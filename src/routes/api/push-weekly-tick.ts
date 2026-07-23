import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

/** Compara dois segredos em tempo constante (evita timing attack). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * Dica semanal por push: uma vez por dia, avisa cada paciente que ACABOU de
 * virar de semana de gestação (idade gestacional com `days === 0`). Como o
 * cruzamento de semana cai num único dia, cada paciente recebe no máximo uma
 * vez por semana — sem precisar de tabela de controle (stateless).
 *
 * Nunca notifica em Modo Cuidado. No-op sem as chaves VAPID.
 *
 * Protegido por CRON_SECRET (header `Authorization: Bearer <CRON_SECRET>`).
 *
 * ─── Como agendar (escolha UMA) ───────────────────────────────────────────
 * A) Vercel Cron (diário funciona no plano Hobby): já vem no vercel.json
 *    apontando pra cá. A Vercel injeta o header Authorization com CRON_SECRET.
 * B) Serviço externo grátis (cron-job.org, etc.): agende 1x/dia (ex.: 09h BRT)
 *    para https://www.obstetrica.com.br/api/push-weekly-tick com o header
 *    Authorization: Bearer <CRON_SECRET>.
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("forbidden", { status: 401 });
  }

  try {
    const { pushConfigured, sendPushToUser } = await import("@/lib/push.server");
    if (!pushConfigured()) {
      return new Response(JSON.stringify({ ok: true, notified: 0, reason: "not-configured" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeGestation, babyForWeek } = await import("@/lib/gestacao");

    const { data: rows } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("id, lmp_date, reference_date, reference_weeks, reference_days, care_mode, baby_name")
      .or("lmp_date.not.is.null,reference_date.not.is.null");

    const candidates = ((rows ?? []) as any[]).filter((p) => {
      if (p.care_mode) return false;
      const g = computeGestation({
        lmp: p.lmp_date,
        referenceDate: p.reference_date,
        referenceWeeks: p.reference_weeks,
        referenceDays: p.reference_days,
      });
      return !!g && g.days === 0 && g.weeks >= 4 && g.weeks <= 42;
    });

    let notified = 0;
    for (const p of candidates) {
      const g = computeGestation({
        lmp: p.lmp_date,
        referenceDate: p.reference_date,
        referenceWeeks: p.reference_weeks,
        referenceDays: p.reference_days,
      })!;
      const baby = babyForWeek(g.weeks);
      const who = p.baby_name ? p.baby_name : "seu bebê";
      const res = await sendPushToUser(p.id as string, {
        title: `Semana ${g.weeks} começou! 🌱`,
        body: `${who} agora tem o tamanho de ${baby.fruit.toLowerCase()}. ${baby.desc}`,
        url: "/minha-conta",
      });
      if (res.sent > 0) notified++;
    }

    return new Response(JSON.stringify({ ok: true, notified }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[push-weekly-tick] failed", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/push-weekly-tick")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
