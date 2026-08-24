import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { varrerLembretesDeMeditacao } from "@/lib/meditacao.server";

/** Compara dois segredos em tempo constante (evita timing attack). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * LEMBRETE DIÁRIO DE MEDITAÇÃO — no horário que ela escolheu.
 *
 * ─── POR QUE ISTO VALE ──────────────────────────────────────────────────────
 *
 * Sequência mais empurrão no horário certo é a metade do Headspace que o Calm
 * não tem — e é o motivo de ele ser considerado o melhor app para quem está
 * começando um hábito. Aqui a chama existia desde o começo e o empurrão não:
 * a paciente decidia meditar todo dia às nove e o app nunca lembrava dela.
 *
 * ─── A DECISÃO NÃO ESTÁ AQUI ────────────────────────────────────────────────
 *
 * Quem decide o que está na hora é `src/lib/lembrete-de-meditacao.ts` — função
 * pura, sem banco, testada, com as duas armadilhas de fuso escritas por
 * extenso. Este arquivo faz o trabalho sujo: ler quem pediu, ler o que ela já
 * fez hoje, mandar, e registrar.
 *
 * ─── O QUE IMPEDE O SPAM ────────────────────────────────────────────────────
 *
 * `med_reminder_sent_at`, gravado ANTES do envio. Um push perdido é melhor que
 * um push de hora em hora: é o mesmo canal por onde chega o aviso de
 * emergência, e a paciente que desliga as notificações por causa de um
 * lembrete de meditação desliga TUDO. A coluna é revogada do `authenticated`
 * no SQL — só o servidor escreve nela.
 *
 * ─── E QUEM JÁ MEDITOU HOJE NÃO É INCOMODADA ────────────────────────────────
 *
 * A leitura é do `journey_state` dela, no calendário DELA (por isso o
 * deslocamento é guardado junto). Duas falhas diferentes, duas respostas:
 * blob em formato inesperado → manda (ela provavelmente não tem registro);
 * leitura que ERROU → não manda. "Não sei se ela já fez" erra para o lado de
 * não incomodar, como no pedido de pré-consulta.
 *
 * Protegido por CRON_SECRET (header `Authorization: Bearer <CRON_SECRET>`).
 * Agende de hora em hora — a janela é de 70 min, então um cron atrasado ainda
 * manda, e nunca manda horas depois.
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") || "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("forbidden", { status: 401 });
  }

  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "content-type": "application/json" },
    });

  try {
    const r = await varrerLembretesDeMeditacao({ forcar: true });
    return json({ ok: true, ...(r ?? { enviados: 0, jaMeditaram: 0, avaliados: 0 }) });
  } catch (e) {
    console.error("meditacao-tick falhou", e);
    return json({ ok: false, reason: "erro" }, 200);
  }
}

export const Route = createFileRoute("/api/meditacao-tick")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
