import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Fila de espera por semana + cascata de ofertas.
 *
 * Sem horário na semana desejada, a paciente entra na FILA. Quando uma consulta
 * confirmada é cancelada, a vaga é oferecida à 1ª da fila daquela semana; ela
 * tem 4h pra aceitar. Se não responder, a oferta CASCATA pra próxima. Tudo
 * server-only (service role); a paciente nunca escreve direto na tabela.
 *
 * A fila avança de duas formas (redundância proposital):
 *  - proativamente pelo cron /api/waitlist-tick (a cada poucos minutos), e
 *  - preguiçosamente (sweepWaitlist) toda vez que alguém lê/mexe na fila —
 *    assim ela progride mesmo que o cron não esteja configurado.
 */

/** Prazo que a 1ª da fila tem pra aceitar a vaga antes de passar pra próxima. */
export const WAITLIST_RESPONSE_HOURS = 4;

/** Escapa texto antes de interpolar em HTML de e-mail (anti-injeção). */
function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Segunda-feira (YYYY-MM-DD) da semana da data dada. */
export function mondayOf(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=domingo..6=sábado
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

function fmtDateBr(ymd: string): string {
  return new Date(ymd + "T00:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

type Db = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

async function authEmail(accessToken: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  return error || !data.user?.email ? null : data.user.email.toLowerCase();
}

/** Avisa a paciente da vaga ofertada (best-effort). */
async function notifyOffer(row: {
  patient_name?: string | null;
  patient_email?: string | null;
  offer_date?: string | null;
  offer_time?: string | null;
}): Promise<void> {
  if (!row.patient_email || !row.offer_date) return;
  try {
    const { sendEmail, emailLayout } = await import("@/lib/email.server");
    await sendEmail({
      to: row.patient_email,
      replyTo: process.env.ADMIN_EMAILS?.split(",")[0]?.trim(),
      subject: "Abriu uma vaga pra você! 🗓️",
      html: emailLayout(
        `Olá, ${esc((row.patient_name ?? "").split(" ")[0]) || "tudo bem"}!`,
        `<p style="margin:0 0 14px">Abriu uma vaga na semana que você estava esperando:</p>
         <p style="margin:0 0 6px"><strong>Data:</strong> ${fmtDateBr(row.offer_date)}</p>
         <p style="margin:0 0 6px"><strong>Horário:</strong> ${esc(row.offer_time)}</p>
         <p style="margin:14px 0 0">Você tem <strong>${WAITLIST_RESPONSE_HOURS} horas</strong> pra aceitar na aba <strong>Consultas</strong> do app — depois a vaga passa pra próxima da fila.</p>
         <p style="margin:10px 0 0"><a href="https://www.obstetrica.com.br/minha-conta" style="color:#a85a44">Aceitar no app →</a></p>`,
      ),
    });
  } catch (e) {
    console.error("waitlist offer email failed", e);
  }
}

/** Casa doctor_id no filtro (null vira `.is`). */
function scopeDoctor(q: any, doctorId: string | null) {
  return doctorId ? q.eq("doctor_id", doctorId) : q.is("doctor_id", null);
}

/**
 * Oferta a vaga (offerDate/offerTime) à PRÓXIMA da fila 'waiting' daquela
 * semana. Antes, confere se o slot já não foi confirmado por alguém (aí a vaga
 * sumiu e não oferta). Retorna true se ofertou.
 */
async function offerNextForWeek(
  admin: Db,
  doctorId: string | null,
  weekStart: string,
  offerDate: string,
  offerTime: string,
): Promise<boolean> {
  // Nunca oferta um horário que já passou (cascata lenta / cancelamento tardio):
  // sem isto, dava pra "confirmar" consulta numa data no passado.
  if (new Date(`${offerDate}T${offerTime}`).getTime() <= Date.now()) return false;
  // O slot ainda está livre? (ninguém confirmou nesse horário)
  const { data: taken } = await scopeDoctor(
    (admin as any)
      .from("appointment_requests")
      .select("id")
      .eq("status", "confirmed")
      .eq("confirmed_date", offerDate)
      .eq("confirmed_time", offerTime),
    doctorId,
  ).limit(1);
  if (taken?.length) return false;

  const { data: next } = await scopeDoctor(
    (admin as any)
      .from("appointment_waitlist")
      .select("id, patient_name, patient_email")
      .eq("week_start", weekStart)
      .eq("status", "waiting"),
    doctorId,
  )
    .order("created_at", { ascending: true })
    .limit(1);
  const entry = next?.[0];
  if (!entry) return false;

  const deadline = new Date(Date.now() + WAITLIST_RESPONSE_HOURS * 3600_000).toISOString();
  const { data: claimed } = await (admin as any)
    .from("appointment_waitlist")
    .update({
      status: "offered",
      offer_date: offerDate,
      offer_time: offerTime,
      offer_deadline: deadline,
      offered_at: new Date().toISOString(),
    })
    .eq("id", entry.id)
    .eq("status", "waiting") // trava contra corrida
    .select("id");
  if (!claimed?.length) return false;
  await notifyOffer({
    patient_name: entry.patient_name,
    patient_email: entry.patient_email,
    offer_date: offerDate,
    offer_time: offerTime,
  });
  return true;
}

/**
 * Oferta um slot recém-liberado (por cancelamento) à 1ª da fila daquela semana.
 * Chamado do updateAppointmentStatus quando uma consulta CONFIRMADA é cancelada.
 */
export async function offerFreedSlot(
  admin: Db,
  doctorId: string | null,
  date: string,
  time: string,
): Promise<void> {
  try {
    await offerNextForWeek(admin, doctorId, mondayOf(date), date, time);
  } catch (e) {
    console.error("offerFreedSlot failed", e);
  }
}

/**
 * Varre ofertas VENCIDAS (deadline passou sem resposta): marca 'expired' e
 * cascata a MESMA vaga pra próxima da fila. Idempotente; seguro pra rodar
 * quantas vezes quiser (cron + preguiçoso). Retorna quantas expirou.
 */
export async function sweepWaitlist(admin: Db): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: overdue } = await (admin as any)
    .from("appointment_waitlist")
    .select("id, doctor_id, week_start, offer_date, offer_time")
    .eq("status", "offered")
    .lt("offer_deadline", nowIso)
    .limit(50);
  if (!overdue?.length) return 0;
  let n = 0;
  for (const o of overdue as any[]) {
    // Marca expirada SÓ se ainda estiver 'offered' (evita corrida com aceite).
    const { data: exp } = await (admin as any)
      .from("appointment_waitlist")
      .update({ status: "expired" })
      .eq("id", o.id)
      .eq("status", "offered")
      .select("id");
    if (!exp?.length) continue;
    n++;
    if (o.offer_date && o.offer_time) {
      await offerNextForWeek(admin, o.doctor_id ?? null, o.week_start, o.offer_date, o.offer_time);
    }
  }
  return n;
}

/** Entra na fila de espera de uma semana. Paciente logada. */
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: uerr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (uerr || !u.user?.email) return { ok: false as const, error: "Não autenticado" };
    const email = u.user.email.toLowerCase();
    const uid = u.user.id;
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("display_name, doctor_id, phone")
      .eq("id", uid)
      .maybeSingle();
    const name = (prof?.display_name as string) || email.split("@")[0];
    const week = mondayOf(data.weekStart);
    const { error } = await (supabaseAdmin as any).from("appointment_waitlist").insert({
      doctor_id: prof?.doctor_id ?? null,
      patient_name: name,
      patient_email: email,
      patient_phone: prof?.phone ?? null,
      reason: data.reason ?? null,
      week_start: week,
    });
    if (error) {
      // 23505 = índice único: já está na fila dessa semana.
      if ((error as { code?: string }).code === "23505") {
        return { ok: true as const, already: true };
      }
      return { ok: false as const, error: "Não foi possível entrar na fila" };
    }
    return { ok: true as const, already: false };
  });

export type WaitlistEntry = {
  id: string;
  week_start: string;
  status: string;
  offer_date: string | null;
  offer_time: string | null;
  offer_deadline: string | null;
};

/** Lê a fila da própria paciente (e varre ofertas vencidas de passagem). */
export const getMyWaitlist = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const email = await authEmail(data.accessToken);
    if (!email) return { ok: false as const, entries: [] as WaitlistEntry[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await sweepWaitlist(supabaseAdmin).catch(() => {});
    const { data: rows } = await (supabaseAdmin as any)
      .from("appointment_waitlist")
      .select("id, week_start, status, offer_date, offer_time, offer_deadline")
      .eq("patient_email", email)
      .in("status", ["waiting", "offered"])
      .order("week_start", { ascending: true });
    return { ok: true as const, entries: (rows ?? []) as WaitlistEntry[] };
  });

/** Sai da fila (cancela a própria entrada, se ainda ativa). */
export const leaveWaitlist = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const email = await authEmail(data.accessToken);
    if (!email) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("appointment_waitlist")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("patient_email", email)
      .in("status", ["waiting", "offered"]);
    return { ok: true as const };
  });

/**
 * A paciente ACEITA ou RECUSA a vaga ofertada. Aceitar → cria a consulta
 * confirmada no slot (com backstop do índice único contra double-booking) e
 * marca 'booked'. Recusar/expirada → 'declined'/'expired' e cascata pra próxima.
 */
export const respondWaitlistOffer = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ accessToken: z.string().min(10), id: z.string().uuid(), accept: z.boolean() })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const email = await authEmail(data.accessToken);
    if (!email) return { ok: false as const, error: "Não autenticado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: entry } = await (supabaseAdmin as any)
      .from("appointment_waitlist")
      .select(
        "id, doctor_id, patient_name, patient_email, patient_phone, reason, week_start, status, offer_date, offer_time, offer_deadline",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (
      !entry ||
      String(entry.patient_email ?? "").toLowerCase() !== email ||
      entry.status !== "offered"
    ) {
      return { ok: false as const, error: "Oferta não encontrada" };
    }
    // Prazo estourado no meio do caminho → expira e cascata.
    if (entry.offer_deadline && new Date(entry.offer_deadline).getTime() < Date.now()) {
      await (supabaseAdmin as any)
        .from("appointment_waitlist")
        .update({ status: "expired" })
        .eq("id", entry.id)
        .eq("status", "offered");
      if (entry.offer_date && entry.offer_time) {
        await offerNextForWeek(
          supabaseAdmin,
          entry.doctor_id ?? null,
          entry.week_start,
          entry.offer_date,
          entry.offer_time,
        ).catch(() => {});
      }
      return { ok: false as const, error: "O prazo dessa vaga terminou." };
    }

    if (!data.accept) {
      const { data: dec } = await (supabaseAdmin as any)
        .from("appointment_waitlist")
        .update({ status: "declined" })
        .eq("id", entry.id)
        .eq("status", "offered")
        .select("id");
      if (dec?.length && entry.offer_date && entry.offer_time) {
        await offerNextForWeek(
          supabaseAdmin,
          entry.doctor_id ?? null,
          entry.week_start,
          entry.offer_date,
          entry.offer_time,
        ).catch(() => {});
      }
      return { ok: true as const, status: "declined" as const };
    }

    // ACEITOU: cria a consulta confirmada no slot ofertado (índice único barra
    // double-booking se alguém confirmou nesse horário na fração de segundo).
    if (!entry.offer_date || !entry.offer_time) {
      return { ok: false as const, error: "Vaga inválida" };
    }
    const { error: insErr } = await (supabaseAdmin as any).from("appointment_requests").insert({
      patient_name: entry.patient_name,
      patient_email: email,
      patient_phone: entry.patient_phone ?? "",
      preferred_date: entry.offer_date,
      preferred_time: entry.offer_time,
      confirmed_date: entry.offer_date,
      confirmed_time: entry.offer_time,
      reason: entry.reason ?? "Vaga da fila de espera",
      status: "confirmed",
      doctor_id: entry.doctor_id ?? null,
    });
    if (insErr) {
      // Slot tomado: expira esta oferta e tenta a próxima.
      if ((insErr as { code?: string }).code === "23505") {
        await (supabaseAdmin as any)
          .from("appointment_waitlist")
          .update({ status: "expired" })
          .eq("id", entry.id)
          .eq("status", "offered");
        return { ok: false as const, error: "Esse horário acabou de ser preenchido." };
      }
      return { ok: false as const, error: "Não foi possível confirmar" };
    }
    await (supabaseAdmin as any)
      .from("appointment_waitlist")
      .update({ status: "booked" })
      .eq("id", entry.id);

    // Avisa o consultório (best-effort).
    try {
      const { sendEmail, emailLayout } = await import("@/lib/email.server");
      const notify = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (notify.length) {
        await sendEmail({
          to: notify,
          replyTo: email,
          subject: `Vaga da fila preenchida — ${entry.patient_name ?? "paciente"}`,
          html: emailLayout(
            "Fila de espera",
            `<p style="margin:0 0 6px">${esc(entry.patient_name ?? "A paciente")} aceitou a vaga de ${fmtDateBr(entry.offer_date)} às ${esc(entry.offer_time)}.</p>`,
          ),
        });
      }
    } catch (e) {
      console.error("waitlist booked email failed", e);
    }

    return { ok: true as const, status: "booked" as const };
  });
