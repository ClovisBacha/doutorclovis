import { createServerFn } from "@tanstack/react-start";
import { paraLike } from "@/lib/like-seguro";
import { z } from "zod";

/** Escapa texto do usuário antes de interpolar em HTML de e-mail (anti-injeção). */
function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const Schema = z.object({
  /* Token da sessão, quando a paciente está logada.
     
     Sem ele, o médico era resolvido pelo E-MAIL DIGITADO no formulário — e
     quem se cadastrou com um e-mail e digitou outro tinha o pedido gravado com
     `doctor_id` nulo. Como o painel filtra por `doctor_id`, esse pedido caía
     no painel de NINGUÉM: a paciente esperava resposta e o médico via a lista
     vazia. O token diz de quem é a sessão sem depender do que foi digitado. */
  accessToken: z.string().optional(),
  patient_name: z.string().min(2).max(120),
  patient_email: z.string().email().max(160),
  patient_phone: z.string().min(8).max(40),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_time: z.string().min(3).max(20),
  reason: z.string().min(3).max(200),
  notes: z.string().max(1000).optional().nullable(),
  /** Honeypot anti-spam: campo invisível no form — humano nunca preenche. */
  website: z.string().max(200).optional().nullable(),
});

/**
 * Resolve o médico dono desta consulta pelo e-mail da paciente (a consulta é
 * pública, sem sessão — o e-mail é a chave). email → uid (RPC
 * get_user_id_by_email, a mesma de secondbrain.server.ts) → doctor_id do perfil.
 * Best-effort: qualquer falha ou paciente sem médico escolhido → null (a
 * consulta ainda é criada; só não fica vinculada a um médico assinante).
 */
async function resolveDoctorIdForEmail(email: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: uid, error } = await (supabaseAdmin as any).rpc("get_user_id_by_email", {
      p_email: email.toLowerCase(),
    });
    if (error || !uid) return null;
    const { data: profile } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", uid)
      .maybeSingle();
    return (profile?.doctor_id as string | null) ?? null;
  } catch {
    return null;
  }
}

/** Médico da paciente pela SESSÃO — não depende do e-mail digitado. */
async function resolveDoctorIdForSession(accessToken?: string): Promise<string | null> {
  if (!accessToken || accessToken.length < 10) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
    if (!u.user) return null;
    const { data: profile } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", u.user.id)
      .maybeSingle();
    return (profile?.doctor_id as string | null) ?? null;
  } catch {
    return null;
  }
}

export const submitAppointmentRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data }) => {
    // Bot preencheu o honeypot → finge sucesso e descarta (sem insert, sem
    // e-mail). Responder "ok" evita que o script perceba e mude de tática.
    if (data.website) return { ok: true as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    /* Primeiro pela SESSÃO (quem está de fato logada), depois pelo e-mail
       digitado. A ordem é o conserto: o e-mail do formulário é o que ela
       escreveu agora, não necessariamente o da conta dela. */
    const doctorId =
      (await resolveDoctorIdForSession(data.accessToken)) ??
      (await resolveDoctorIdForEmail(data.patient_email));
    const { error } = await (supabaseAdmin as any).from("appointment_requests").insert({
      patient_name: data.patient_name,
      patient_email: data.patient_email.toLowerCase(),
      patient_phone: data.patient_phone,
      preferred_date: data.preferred_date,
      preferred_time: data.preferred_time,
      reason: data.reason,
      notes: data.notes ?? null,
      doctor_id: doctorId,
    });
    if (error) {
      console.error("appointment insert failed", error);
      return {
        ok: false as const,
        error: "Não foi possível enviar agora. Tente novamente em instantes.",
      };
    }

    // Confirmação para a paciente + aviso para o consultório (não bloqueia o
    // fluxo se o e-mail falhar ou não estiver configurado).
    try {
      const { sendEmail, emailLayout } = await import("@/lib/email.server");
      const { avisarMedico } = await import("@/lib/doctor-mail.server");
      /* O aviso vai para o MÉDICO DELA. Antes ia para ADMIN_EMAILS: nome,
         telefone, e-mail e motivo da consulta de paciente de qualquer médico
         caíam na caixa da plataforma, e o médico que precisava confirmar o
         horário nunca era avisado. `plataformaSeOrfa` cobre o formulário
         público do site, onde ainda não existe médico para avisar. */
      const aviso = await avisarMedico(doctorId, { plataformaSeOrfa: true });
      const dataBr = new Date(data.preferred_date + "T00:00:00").toLocaleDateString("pt-BR");
      const resumo = `
        <p style="margin:0 0 6px"><strong>Data preferida:</strong> ${dataBr} às ${esc(data.preferred_time)}</p>
        <p style="margin:0 0 6px"><strong>Motivo:</strong> ${esc(data.reason)}</p>
        ${data.notes ? `<p style="margin:0 0 6px"><strong>Observações:</strong> ${esc(data.notes)}</p>` : ""}`;

      await sendEmail({
        to: data.patient_email,
        replyTo: aviso.para[0],
        subject: "Recebemos seu pedido de consulta 💛",
        html: emailLayout(
          `Olá, ${esc(data.patient_name.split(" ")[0])}!`,
          `<p style="margin:0 0 14px">Recebemos sua solicitação de consulta. ${
            aviso.nome
              ? `${esc(aviso.nome)} vai confirmar o horário disponível`
              : "Vamos confirmar o horário disponível com o seu médico"
          } em até 1 dia útil.</p>
           ${resumo}
           <p style="margin:14px 0 0;font-size:13px;color:#9b8178">Em caso de urgência, ligue 192 (SAMU) ou procure o pronto-socorro.</p>`,
          aviso.marca,
        ),
      });

      if (aviso.para.length) {
        await sendEmail({
          to: aviso.para,
          replyTo: data.patient_email,
          subject: `Novo pedido de consulta — ${data.patient_name}`,
          html: emailLayout(
            "Novo pedido de consulta",
            `<p style="margin:0 0 6px"><strong>Paciente:</strong> ${esc(data.patient_name)}</p>
             <p style="margin:0 0 6px"><strong>Contato:</strong> ${esc(data.patient_phone)} · ${esc(data.patient_email)}</p>
             ${resumo}
             <p style="margin:14px 0 0"><a href="https://www.obstetrica.com.br/painel" style="color:#a85a44">Abrir o painel do médico →</a></p>`,
            aviso.marca,
          ),
        });
      }
    } catch (e) {
      console.error("appointment email failed", e);
    }

    /* Push para o MÉDICO. Este pedido só ia por e-mail — e "marcar consulta"
       é justamente o que ele resolve pelo celular, entre uma paciente e
       outra. E-mail ele lê quando senta no computador; o pedido esfria até lá.

       Bloco próprio, depois do try dos e-mails: falha de e-mail não pode
       engolir o push, e falha de push não pode derrubar o pedido — do ponto de
       vista da paciente, o agendamento JÁ foi aceito quando chegou aqui. */
    if (doctorId) {
      try {
        const { sendPushToUser } = await import("@/lib/push.server");
        const dataBr = new Date(data.preferred_date + "T00:00:00").toLocaleDateString("pt-BR");
        await sendPushToUser(doctorId, {
          title: `📅 ${data.patient_name.split(" ")[0]} pediu uma consulta`,
          body: `${dataBr} às ${data.preferred_time} · ${data.reason}`,
          url: "/painel",
        });
      } catch (e) {
        console.error("appointment push failed", e);
      }
    }

    return { ok: true as const };
  });

/* ── Consultas da própria paciente (fecha o ciclo médico→paciente) ─────────
   A tabela não tem user_id (o agendamento é público, por e-mail); o vínculo
   é o e-mail da conta logada. Server function com service role: a RLS de
   SELECT é só do admin, então a paciente lê via servidor, nunca direto. */

export type MyAppointment = {
  id: string;
  preferred_date: string;
  preferred_time: string;
  confirmed_date: string | null;
  confirmed_time: string | null;
  proposed_date: string | null;
  proposed_time: string | null;
  status: "pending" | "confirmed" | "done" | "cancelled" | "counter_proposed" | "declined";
  reason: string;
  price_brl: number | null;
  payment_status: string | null;
  created_at: string;
};

export const getMyAppointments = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: uerr } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u?.user?.email;
    if (uerr || !email) return { ok: false as const, appointments: [] as MyAppointment[] };
    // Varredura preguiçosa: aproveita a visita pra avançar a fila de espera
    // (expira ofertas vencidas e passa pra próxima), sem depender só do cron.
    try {
      const { sweepWaitlist } = await import("@/lib/waitlist.functions");
      await sweepWaitlist(supabaseAdmin);
    } catch {
      /* fila é secundária ao carregar consultas */
    }
    /* ⚠️ **OS LEMBRETES GANHARAM A MESMA REDUNDÂNCIA, e por um motivo medido:**
       `vercel.json` agenda só o `push-weekly-tick`. O `lembretes-tick` depende
       de cron EXTERNO, e enquanto ele não existir o recurso fica escuro — o
       aviso de 24 h, o de 4 h e o pedido de pré-consulta de 48 h simplesmente
       não saem. A fila de espera já tinha resolvido isto, e o comentário dela
       diz por quê: "assim ela progride mesmo que o cron não esteja
       configurado".

       ⚠️ **O que torna seguro chamar aqui não é a varredura, é a
       IDEMPOTÊNCIA:** a régua não repete o que está em `appointment_reminders`
       e o índice único recusa a segunda gravação. O pior caso é leitura a mais,
       nunca push repetido — que é o que faria a paciente desligar as
       notificações do app, o mesmo canal do aviso de emergência.

       E `varrerLembretes` tem estrangulador próprio, porque a varredura é
       GLOBAL: sem ele, cada visita leria os compromissos da plataforma
       inteira. */
    try {
      const { varrerLembretes } = await import("@/lib/lembretes.server");
      await varrerLembretes();
    } catch {
      /* lembrete é secundário ao carregar consultas — nunca derruba a tela */
    }
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .select(
        "id, preferred_date, preferred_time, confirmed_date, confirmed_time, proposed_date, proposed_time, status, reason, price_brl, payment_status, created_at",
      )
      // ilike mantém a insensibilidade a maiúsculas para linhas antigas, mas o
      // e-mail precisa ter %/_ escapados: sem isso viram curingas LIKE e uma
      // conta maria_jose@ leria as consultas de maria.jose@ (vazamento).
      .ilike("patient_email", paraLike(email))
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("getMyAppointments failed", error);
      return { ok: false as const, appointments: [] as MyAppointment[] };
    }
    return { ok: true as const, appointments: (rows ?? []) as MyAppointment[] };
  });

/**
 * A paciente APROVA ou RECUSA o horário sugerido pelo médico (contraproposta).
 * Aprovar → vira 'confirmed' com o horário sugerido (checa conflito de slot na
 * agenda do MESMO médico). Recusar → 'declined'. A paciente é identificada pelo
 * e-mail da sessão (a consulta é por e-mail, sem user_id); só age na PRÓPRIA
 * consulta e só quando ela está de fato 'counter_proposed'. Server-only.
 */
export const respondToProposedTime = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ accessToken: z.string().min(10), id: z.string().uuid(), approve: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: uerr } = await supabaseAdmin.auth.getUser(data.accessToken);
    const email = u?.user?.email;
    if (uerr || !email) return { ok: false as const, error: "Não autenticado" };

    // Só a PRÓPRIA consulta (e-mail bate) e só se estiver aguardando resposta.
    const { data: row } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .select(
        "id, patient_name, patient_email, doctor_id, status, proposed_date, proposed_time, price_brl",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (
      !row ||
      String(row.patient_email ?? "").toLowerCase() !== email.toLowerCase() ||
      row.status !== "counter_proposed"
    ) {
      return { ok: false as const, error: "Consulta não encontrada" };
    }

    if (!data.approve) {
      await (supabaseAdmin as any)
        .from("appointment_requests")
        .update({ status: "declined" })
        .eq("id", data.id);
      // Avisa o consultório que a paciente recusou (best-effort).
      try {
        const { sendEmail, emailLayout } = await import("@/lib/email.server");
        const { avisarMedico } = await import("@/lib/doctor-mail.server");
        /* Quem sugeriu o horário foi o médico dela — é ele que precisa saber
           que foi recusado. Sem `plataformaSeOrfa`: consulta dentro do app
           sempre tem médico, e se não tiver, ninguém precisa do dado. */
        const aviso = await avisarMedico(row.doctor_id);
        if (aviso.para.length) {
          await sendEmail({
            to: aviso.para,
            replyTo: row.patient_email,
            subject: `Horário sugerido recusado — ${row.patient_name ?? "paciente"}`,
            html: emailLayout(
              "Contraproposta recusada",
              `<p style="margin:0 0 6px">${esc(row.patient_name ?? "A paciente")} recusou o horário sugerido. Talvez queira sugerir outro.</p>`,
              aviso.marca,
            ),
          });
        }
      } catch (e) {
        console.error("decline email failed", e);
      }
      return { ok: true as const, status: "declined" as const };
    }

    // APROVOU: confirma o horário sugerido, checando conflito na agenda do médico.
    if (!row.proposed_date || !row.proposed_time) {
      return { ok: false as const, error: "Horário sugerido inválido" };
    }
    let clashQ = (supabaseAdmin as any)
      .from("appointment_requests")
      .select("id")
      .eq("status", "confirmed")
      .eq("confirmed_date", row.proposed_date)
      .eq("confirmed_time", row.proposed_time)
      .neq("id", data.id);
    // Conflito só na agenda do MESMO médico (isolamento multi-tenant).
    clashQ = row.doctor_id ? clashQ.eq("doctor_id", row.doctor_id) : clashQ.is("doctor_id", null);
    const { data: clash } = await clashQ.limit(1);
    if (clash?.length) {
      return {
        ok: false as const,
        error: "Esse horário acabou de ser preenchido. Peça um novo horário ao médico.",
      };
    }

    const { data: updRows, error: upErr } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .update({
        status: "confirmed",
        confirmed_date: row.proposed_date,
        confirmed_time: row.proposed_time,
        proposed_date: null,
        proposed_time: null,
      })
      .eq("id", data.id)
      .eq("status", "counter_proposed") // trava idempotente contra corrida
      .select("id");
    // 23505 = índice único do slot: alguém confirmou esse horário no meio do
    // caminho (backstop real contra double-booking, além da checagem acima).
    if (upErr) {
      return {
        ok: false as const,
        error:
          (upErr as { code?: string }).code === "23505"
            ? "Esse horário acabou de ser preenchido. Peça um novo horário ao médico."
            : "Não foi possível confirmar",
      };
    }
    // 0 linhas → o pedido já tinha sido respondido (perdeu a corrida do status).
    if (!updRows || updRows.length === 0) {
      return { ok: false as const, error: "Esse pedido já foi respondido." };
    }

    // Avisa o consultório que a paciente aprovou (best-effort).
    try {
      const { sendEmail, emailLayout } = await import("@/lib/email.server");
      const { avisarMedico } = await import("@/lib/doctor-mail.server");
      const aviso = await avisarMedico(row.doctor_id);
      const dataBr = new Date(row.proposed_date + "T00:00:00").toLocaleDateString("pt-BR");
      if (aviso.para.length) {
        await sendEmail({
          to: aviso.para,
          replyTo: row.patient_email,
          subject: `Horário confirmado pela paciente — ${row.patient_name ?? "paciente"}`,
          html: emailLayout(
            "Consulta confirmada",
            `<p style="margin:0 0 6px">${esc(row.patient_name ?? "A paciente")} aprovou o horário sugerido: ${dataBr} às ${esc(row.proposed_time)}.</p>`,
            aviso.marca,
          ),
        });
      }
    } catch (e) {
      console.error("approve email failed", e);
    }

    return { ok: true as const, status: "confirmed" as const };
  });
