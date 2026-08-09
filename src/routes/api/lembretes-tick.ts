import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";

/** Compara dois segredos em tempo constante (evita timing attack). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * LEMBRETE DE CONSULTA — 24 h antes e 4 h antes.
 *
 * ─── POR QUE ISTO VALE DINHEIRO ─────────────────────────────────────────────
 *
 * Falta em consultório de alto risco é vaga perdida duas vezes: o médico fica
 * com o buraco, e quem estava na fila de espera não foi chamada. A paciente
 * marcou há três semanas e esqueceu.
 *
 * ─── A DECISÃO NÃO ESTÁ AQUI ────────────────────────────────────────────────
 *
 * Quem decide o que está vencido é `src/lib/lembretes.ts` — função pura, sem
 * banco, testada. Este arquivo faz só o trabalho sujo: ler as duas fontes, ler
 * o que já foi enviado, mandar, e registrar.
 *
 * ─── O QUE IMPEDE O SPAM ────────────────────────────────────────────────────
 *
 * Duas coisas, e as duas precisam existir. A régua não repete o que está em
 * `appointment_reminders`; e o índice único dessa tabela recusa a segunda
 * gravação se dois crons rodarem no mesmo segundo. Sem a segunda, uma corrida
 * mandaria o aviso duas vezes — e "sua consulta é amanhã" repetido faz a
 * paciente desligar as notificações do app, que é o mesmo canal por onde chega
 * o aviso de emergência.
 *
 * O registro é gravado ANTES do envio, de propósito: um push que falha e não
 * repete é um lembrete perdido; um push que repete a cada hora é o produto
 * perdendo o canal.
 *
 * Protegido por CRON_SECRET (header `Authorization: Bearer <CRON_SECRET>`).
 * Agende de hora em hora — a janela é aberta ("faltam 24 h ou menos"), então um
 * cron atrasado manda tarde em vez de não mandar.
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
    const { chaveDoLembrete, lembretesVencidos, textoDoLembrete } = await import("@/lib/lembretes");
    type Compromisso = import("@/lib/lembretes").Compromisso;
    const { paredeDaClinica } = await import("@/lib/disponibilidade");

    const agora = new Date();
    /* A janela de leitura é generosa (48 h): a régua é que decide o que está
       vencido. Puxar só 24 h aqui faria a decisão acontecer em dois lugares. */
    const ate = new Date(agora.getTime() + 48 * 3600_000);
    const hojeYmd = paredeDaClinica(agora.toISOString())?.dia ?? "";
    const ateYmd = paredeDaClinica(ate.toISOString())?.dia ?? "";

    const [consultas, teles, enviados, pre] = await Promise.all([
      (supabaseAdmin as any)
        .from("appointment_requests")
        .select("id, patient_name, patient_email, confirmed_date, confirmed_time")
        .eq("status", "confirmed")
        .gte("confirmed_date", hojeYmd)
        .lte("confirmed_date", ateYmd),
      (supabaseAdmin as any)
        .from("teleconsulta_sessions")
        .select("id, patient_user_id, scheduled_for, status")
        .neq("status", "encerrada")
        .not("scheduled_for", "is", null)
        .gte("scheduled_for", agora.toISOString())
        .lte("scheduled_for", ate.toISOString()),
      (supabaseAdmin as any)
        .from("appointment_reminders")
        .select("fonte, fonte_id, especie")
        .gte("enviado_em", new Date(agora.getTime() - 72 * 3600_000).toISOString()),
      /* Quem já mandou a pré-consulta nos últimos 20 dias. A janela é generosa
         de propósito: pedir de novo o que ela respondeu semana passada é a
         forma mais rápida de ensinar que os avisos deste app não valem
         leitura — e é o mesmo canal por onde chega a emergência. */
      (supabaseAdmin as any)
        .from("pre_consultation_forms")
        .select("user_id")
        .gte("submitted_at", new Date(agora.getTime() - 20 * 86400_000).toISOString()),
    ]);

    /* Sem a tabela de registro, NÃO manda nada. Enviar sem poder registrar é
       exatamente o cenário de repetir de hora em hora. */
    if (enviados.error) {
      const { faltaNoBanco } = await import("@/lib/postgrest");
      return json(
        {
          ok: false,
          reason: faltaNoBanco(enviados.error)
            ? "rode o APLICAR_LEMBRETES.sql no Supabase"
            : "nao consegui ler os lembretes ja enviados",
        },
        200,
      );
    }

    const jaEnviados = new Set(
      ((enviados.data ?? []) as any[]).map((r) =>
        chaveDoLembrete({ fonte: r.fonte, id: r.fonte_id }, r.especie),
      ),
    );

    /* Falha ao ler as pré-consultas vira "ninguém respondeu"? NÃO: isso pediria
       de novo a todo mundo. Conjunto vazio só quando a leitura deu certo. */
    const jaResponderam = new Set<string>(
      pre.error ? [] : ((pre.data ?? []) as any[]).map((r) => String(r.user_id)),
    );
    const preIndisponivel = !!pre.error;

    const compromissos: Compromisso[] = [];

    for (const a of (consultas.data ?? []) as any[]) {
      if (!a.confirmed_date || !a.confirmed_time) continue;
      /* `confirmed_time` é TEXTO e já aceitou "manhã" nesta base. Sem hora de
         verdade não dá para calcular quanto falta — e "manhã" viraria
         `Invalid Date`, que a régua descarta em silêncio. Descartar aqui, com
         o motivo escrito, é mais honesto. */
      const hora = String(a.confirmed_time).slice(0, 5);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) continue;
      compromissos.push({
        id: a.id,
        fonte: "consulta",
        /* O horário é hora de parede do consultório; o `-03:00` a transforma no
           instante certo. Sem fuso, `new Date` leria como local do servidor —
           que na Vercel é UTC, e são três horas de erro. */
        quando: `${a.confirmed_date}T${hora}:00-03:00`,
        email: a.patient_email ?? null,
        userId: null,
        nome: a.patient_name ?? null,
      });
    }

    for (const t of (teles.data ?? []) as any[]) {
      const uid = t.patient_user_id ?? null;
      compromissos.push({
        id: t.id,
        fonte: "teleconsulta",
        quando: String(t.scheduled_for),
        email: null,
        userId: uid,
        nome: null,
        /* Sem conseguir ler as respostas, trata como PRONTA: calar o pedido é
           errar para o lado de não incomodar. */
        preConsultaPronta: preIndisponivel || (uid ? jaResponderam.has(String(uid)) : false),
      });
    }

    const vencidos = lembretesVencidos(compromissos, agora, jaEnviados);
    if (vencidos.length === 0) return json({ ok: true, enviados: 0 });

    const { sendPushToEmail, sendPushToUser, pushConfigured } = await import("@/lib/push.server");
    const temPush = pushConfigured();
    let contados = 0;

    for (const l of vencidos) {
      const c = l.compromisso;
      /* ── REGISTRA PRIMEIRO ──
         O índice único faz esta linha falhar quando outro cron já registrou —
         e nesse caso o `continue` é a resposta certa: quem registrou primeiro
         é quem manda. */
      const { error: erroRegistro } = await (supabaseAdmin as any)
        .from("appointment_reminders")
        .insert({ fonte: c.fonte, fonte_id: c.id, especie: l.especie, canais: null });
      if (erroRegistro) continue;

      const p = paredeDaClinica(c.quando);
      const { titulo, corpo } = textoDoLembrete(l, p?.hora ?? "");
      const canais: string[] = [];

      try {
        if (temPush && c.userId) {
          await sendPushToUser(c.userId, { title: titulo, body: corpo, url: "/minha-conta" });
          canais.push("push");
        } else if (temPush && c.email) {
          await sendPushToEmail(c.email, { title: titulo, body: corpo, url: "/minha-conta" });
          canais.push("push");
        }
      } catch {
        /* Push que falha não desfaz o registro: repetir de hora em hora é pior
           que perder um lembrete. O e-mail abaixo ainda tenta. */
      }

      try {
        if (c.email) {
          const { sendEmail, emailLayout } = await import("@/lib/email.server");
          await sendEmail({
            to: c.email,
            subject: titulo,
            html: emailLayout(titulo, `<p style="margin:0">${corpo}</p>`),
          });
          canais.push("email");
        }
      } catch {
        /* idem */
      }

      /* O que de fato saiu fica registrado — é como se descobre depois que o
         push está configurado e mesmo assim ninguém recebe.
         O erro é CHECADO mesmo sendo diagnóstico: um `canais` que nunca grava
         faria a coluna parecer dizer "nenhum canal funcionou" quando o que
         falhou foi a gravação — um diagnóstico que mente é pior que nenhum. */
      const { error: erroCanais } = await (supabaseAdmin as any)
        .from("appointment_reminders")
        .update({ canais: canais.join(",") || "nenhum" })
        .eq("fonte", c.fonte)
        .eq("fonte_id", c.id)
        .eq("especie", l.especie);
      if (erroCanais) console.error("lembrete enviado, canais não registrados", erroCanais);

      contados++;
    }

    return json({ ok: true, enviados: contados, avaliados: compromissos.length });
  } catch (e) {
    console.error("lembretes-tick falhou", e);
    return json({ ok: false, reason: "erro" }, 200);
  }
}

export const Route = createFileRoute("/api/lembretes-tick")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
