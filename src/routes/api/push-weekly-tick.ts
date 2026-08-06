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

    /* ─── E A FILA DO MÉDICO, QUE NÃO ENVELHECIA ──────────────────────────
     *
     * `notifyDoctorOfGap` avisa UMA vez, no instante em que a lacuna nasce, e
     * deduplica. Depois disso, nada: uma dúvida que ficou 40 dias parada
     * produzia exatamente o mesmo silêncio de uma respondida ontem. Enquanto
     * isso, cada paciente que repetia a pergunta ouvia "registrei aqui para
     * ele ver".
     *
     * Aproveita este cron porque ele já roda diariamente e já é protegido —
     * criar um segundo agendamento para a mesma cadência seria mais uma coisa
     * para configurar e esquecer.
     *
     * A cadência é SEMANAL sem tabela de controle: só dispara na segunda-feira.
     * Um lembrete diário sobre a mesma fila é como a paciente que desliga as
     * notificações — o aviso perde o sentido de aviso.
     */
    const medicosAvisados = await cobrarLacunasParadas();

    return new Response(JSON.stringify({ ok: true, notified, medicosAvisados }), {
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

/**
 * Quantos dias uma lacuna precisa esperar para virar cobrança.
 *
 * Sete: menos que isso atropela o médico que viaja ou tira folga, e o aviso de
 * nascimento (`notifyDoctorOfGap`) já cobriu o dia zero. Mais que isso é
 * tempo demais para uma gestante esperar uma resposta que lhe foi prometida.
 */
const DIAS_PARA_COBRAR = 7;

/**
 * Avisa cada médico que tem lacuna parada há mais de uma semana.
 *
 * Stateless de propósito — não há tabela de "já cobrei". O controle é o dia da
 * semana: só roda na segunda-feira, então cada médico recebe no máximo um
 * lembrete por semana, exatamente como a dica semanal da paciente ao lado.
 */
async function cobrarLacunasParadas(): Promise<number> {
  /* Segunda-feira no fuso de Brasília, e não no do processo: a Vercel roda em
     UTC, e um cron das 21h BRT de domingo cairia na segunda de lá. É o mesmo
     defeito de fuso que já fez dois "este mês" começarem com três horas de
     diferença na mesma tela. */
  const hojeBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  if (hojeBR.getDay() !== 1) return 0;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPushToUser } = await import("@/lib/push.server");
  const limite = new Date(Date.now() - DIAS_PARA_COBRAR * 86_400_000).toISOString();

  const { data: rows, error } = await (supabaseAdmin as any)
    .from("brain_gaps")
    .select("doctor_id,created_at,hits")
    .eq("status", "aberta")
    .lt("created_at", limite)
    .limit(2000);
  if (error) {
    console.error("[lacunas paradas] não consegui ler a fila", error);
    return 0;
  }

  /* Agrupa por médico: um push por consultório, com o total e a espera mais
     longa. Uma notificação por lacuna transformaria a cobrança em spam, e o
     médico com vinte lacunas — que é justamente quem mais precisa ver — seria
     o mais castigado. */
  const porMedico = new Map<string, { quantas: number; maisAntiga: string }>();
  for (const g of (rows ?? []) as { doctor_id: string | null; created_at: string }[]) {
    if (!g.doctor_id) continue;
    const atual = porMedico.get(g.doctor_id);
    if (!atual) porMedico.set(g.doctor_id, { quantas: 1, maisAntiga: g.created_at });
    else {
      atual.quantas++;
      if (g.created_at < atual.maisAntiga) atual.maisAntiga = g.created_at;
    }
  }

  let avisados = 0;
  for (const [doctorId, info] of porMedico) {
    const dias = Math.floor((Date.now() - new Date(info.maisAntiga).getTime()) / 86_400_000);
    const res = await sendPushToUser(doctorId, {
      title:
        info.quantas === 1
          ? "1 paciente esperando sua resposta"
          : `${info.quantas} pacientes esperando sua resposta`,
      /* Sem gênero e sem alarme: é um lembrete de fila, não uma urgência
         clínica. A urgência tem outro caminho, e confundir os dois faz o
         médico deixar de abrir os dois. */
      body: `A dúvida mais antiga está há ${dias} dias no seu Segundo Cérebro.`,
      url: "/painel?tab=Cérebro",
    });
    if (res.sent > 0) avisados++;
  }
  return avisados;
}

export const Route = createFileRoute("/api/push-weekly-tick")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
