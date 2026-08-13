import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { diaDela, estaNaHora, meditouEm, textoDoLembrete } =
      await import("@/lib/lembrete-de-meditacao");
    const { sequenciaAteODia } = await import("@/lib/sequencia");
    const { sendPushToUser } = await import("@/lib/push.server");

    const agora = new Date();

    /* Só quem pediu. O índice parcial do SQL existe para esta linha. */
    const { data: perfis, error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("id, med_reminder_utc_min, med_reminder_offset, med_reminder_sent_at, care_mode")
      .not("med_reminder_utc_min", "is", null);

    if (error) {
      /* Coluna ainda não criada no banco (o SQL não foi aplicado) responde
         aqui, e responder 200 é de propósito: um cron que recebe 500 de hora
         em hora vira alarme, e não há nada de errado em o recurso ainda não
         existir. */
      return json({ ok: false, reason: "sem colunas de lembrete", detalhe: error.message });
    }

    type Perfil = {
      id: string;
      med_reminder_utc_min: number | null;
      med_reminder_offset: number | null;
      med_reminder_sent_at: string | null;
      care_mode: boolean | null;
    };

    const candidatas = ((perfis ?? []) as Perfil[]).filter((p) =>
      estaNaHora(
        {
          id: p.id,
          utcMin: p.med_reminder_utc_min,
          offset: p.med_reminder_offset ?? 0,
          enviadoEm: p.med_reminder_sent_at ? new Date(p.med_reminder_sent_at) : null,
          careMode: Boolean(p.care_mode),
        },
        agora,
      ),
    );

    if (!candidatas.length) return json({ ok: true, enviados: 0, avaliados: perfis?.length ?? 0 });

    /* Uma consulta para todas: uma por paciente seria N viagens por passada. */
    const { data: jornadas, error: erroJornada } = await (supabaseAdmin as any)
      .from("journey_state")
      .select("user_id, data")
      .in(
        "user_id",
        candidatas.map((p) => p.id),
      );

    if (erroJornada) {
      console.error("meditacao-tick: journey_state ilegível", erroJornada);
      return json({ ok: false, reason: "jornada ilegível", enviados: 0 });
    }

    const blobDe = new Map<string, unknown>(
      ((jornadas ?? []) as { user_id: string; data: unknown }[]).map((j) => [j.user_id, j.data]),
    );

    let enviados = 0;
    let jaMeditaram = 0;

    for (const p of candidatas) {
      const offset = p.med_reminder_offset ?? 0;
      const hoje = diaDela(agora, offset);
      const blob = blobDe.get(p.id) ?? null;

      if (meditouEm(blob, hoje)) {
        jaMeditaram++;
        continue;
      }

      /* ⚠️ REGISTRA ANTES DE MANDAR. Se o push falhar, ela perde UM lembrete;
         se o registro falhar depois de um push bem-sucedido, ela recebe um por
         hora até o fim do dia. */
      const { error: erroCarimbo } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .update({ med_reminder_sent_at: agora.toISOString() })
        .eq("id", p.id);
      if (erroCarimbo) {
        console.error("meditacao-tick: carimbo falhou, não mandei", erroCarimbo);
        continue;
      }

      const dias = ((blob as Record<string, { dias?: unknown }> | null)?.["dc-path-med-log"]
        ?.dias ?? []) as string[];
      /* A sequência é a DELA, no calendário DELA — ver `sequenciaAteODia`. */
      const seq = sequenciaAteODia(Array.isArray(dias) ? dias : [], hoje);
      const { title, body } = textoDoLembrete(seq);

      await sendPushToUser(p.id, { title, body, url: "/minha-conta?tab=Caminho" });
      enviados++;
    }

    return json({ ok: true, enviados, jaMeditaram, avaliados: candidatas.length });
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
