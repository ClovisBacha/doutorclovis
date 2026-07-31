import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { colunaAusente } from "./postgrest";

/** Escapa texto do usuário antes de interpolar em HTML de e-mail (anti-injeção). */
function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Quem é "o médico": e-mails autorizados, separados por vírgula em ADMIN_EMAILS.
// Ex.: ADMIN_EMAILS="bachaclovis@gmail.com,secretaria@consultorio.com"
function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  if (!adminEmails().includes(data.user.email.toLowerCase())) return null;
  return data.user;
}

/**
 * Escopo multi-tenant do painel: equipe da instalação (ADMIN_EMAILS) OU médico
 * assinante ativo. Retorna quem é (isTeam) e o doctor_id do assinante para
 * recortar os dados. A equipe vê a instalação inteira; o assinante vê apenas o
 * que estiver vinculado ao PRÓPRIO doctor_id.
 */
type PanelScope = {
  user: { id: string; email?: string | null };
  isTeam: boolean;
  doctorId: string | null;
};

async function requireScope(accessToken: string): Promise<PanelScope | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  if (adminEmails().includes(data.user.email.toLowerCase())) {
    return { user: data.user, isTeam: true, doctorId: null };
  }
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (doc?.active) return { user: data.user, isTeam: false, doctorId: doc.id as string };
  return null;
}

/** Recorta uma query por doctor_id quando o chamador é um médico assinante. */
function scopedBy(qb: any, scope: PanelScope) {
  return scope.isTeam ? qb : qb.eq("doctor_id", scope.doctorId);
}

/* O recorte por vínculo ATUAL — e por que o carimbo na linha não serve — está
   em `./vinculo.server`. Aqui as duas listas clínicas já têm o conjunto certo à
   mão: `profiles` vem de `patient_profiles` filtrado por `doctor_id`, que é o
   vínculo de hoje. */

/**
 * Verifica se o chamador PODE mutar a linha `id` da tabela `table`.
 * Fail-closed: a equipe sempre pode; o assinante só se o doctor_id da linha
 * for exatamente o dele (linha sem doctor_id → negado para assinante).
 */
async function assertOwnsRow(
  sb: any,
  table: string,
  id: string,
  scope: PanelScope,
): Promise<boolean> {
  if (scope.isTeam) return true;
  const { data } = await sb.from(table).select("doctor_id").eq("id", id).maybeSingle();
  return !!data && data.doctor_id === scope.doctorId;
}

const TokenSchema = z.object({ accessToken: z.string().min(10) });

/** Diz se o usuário do token é um administrador (usado para mostrar o link). */
export const checkIsAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => ({ isAdmin: (await requireAdmin(data.accessToken)) !== null }));

export type AdminAppointment = {
  id: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  preferred_date: string;
  preferred_time: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
};

export type AdminQuestion = {
  id: string;
  question: string;
  answered: boolean;
  created_at: string;
  patient: string;
};

export type PatientEngagement = {
  id: string;
  display_name: string | null;
  baby_name: string | null;
  lmp_date: string | null;
  reference_date: string | null;
  reference_weeks: number | null;
  reference_days: number | null;
  isActive: boolean;
  lastActivityAt: string | null;
  hasUnseenForm: boolean;
  /**
   * Quando a conta dela nasceu. Sem isto, "nenhum registro na janela" era
   * indistinguível entre a paciente que sumiu e a que se cadastrou ontem — e a
   * segunda entrava na lista de sumidas no dia seguinte ao cadastro.
   */
  createdAt?: string | null;
};

export type AdminPreConsulta = {
  id: string;
  user_id: string;
  patient_name: string;
  submitted_at: string;
  weeks_at_submission: number | null;
  current_weight: number | null;
  systolic: number | null;
  diastolic: number | null;
  symptoms: string[];
  medications: string | null;
  questions: string | null;
  emotional_state: string | null;
  other_notes: string | null;
  seen_by_doctor: boolean;
};

/** Carrega os dados do painel do médico (pedidos de consulta + perguntas). */
export const getAdminData = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const [appts, questions, profiles] = await Promise.all([
      scopedBy(
        sb
          .from("appointment_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        scope,
      ),
      scopedBy(
        sb
          .from("doctor_questions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        scope,
      ),
      scopedBy(sb.from("patient_profiles").select("id,display_name,doctor_id"), scope),
    ]);

    const nameById = new Map(
      (profiles.data ?? []).map((p: { id: string; display_name: string | null }) => [
        p.id,
        p.display_name,
      ]),
    );
    /* `respondQuestion` já exige vínculo ATUAL para responder. Sem este filtro
       a fila mostrava perguntas que o médico LIA mas não conseguia responder —
       a incoerência entre as duas metades é o próprio sintoma. */
    const questionsWithName: AdminQuestion[] = (questions.data ?? [])
      .filter((q: { user_id: string }) => scope.isTeam || nameById.has(q.user_id))
      .map(
        (q: {
          id: string;
          user_id: string;
          question: string;
          answered: boolean;
          created_at: string;
        }) => ({
          id: q.id,
          question: q.question,
          answered: q.answered,
          created_at: q.created_at,
          patient: nameById.get(q.user_id) ?? "Paciente",
        }),
      );

    return {
      ok: true as const,
      isTeam: scope.isTeam,
      appointments: (appts.data ?? []) as AdminAppointment[],
      questions: questionsWithName,
    };
  });

const StatusSchema = z.object({
  accessToken: z.string().min(10),
  id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "done", "cancelled"]),
});

/** Atualiza o status de um pedido de consulta. */
export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => StatusSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "appointment_requests", data.id, scope)))
      return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("appointment_requests")
      .update({ status: data.status })
      .eq("id", data.id);

    // Cancelamento também fecha o ciclo: a paciente fica sabendo na hora.
    if (!error && data.status === "cancelled") {
      try {
        const { data: row } = await (supabaseAdmin as any)
          .from("appointment_requests")
          .select(
            "patient_name, patient_email, preferred_date, preferred_time, confirmed_date, confirmed_time, doctor_id",
          )
          .eq("id", data.id)
          .maybeSingle();
        // Se a consulta cancelada ESTAVA confirmada, a vaga abre: oferece à 1ª
        // da fila de espera daquela semana (cascata cuida do resto).
        if (row?.confirmed_date && row?.confirmed_time) {
          const { offerFreedSlot } = await import("@/lib/waitlist.functions");
          await offerFreedSlot(
            supabaseAdmin,
            (row.doctor_id as string | null) ?? null,
            row.confirmed_date,
            row.confirmed_time,
          );
        }
        if (row?.patient_email) {
          const { sendEmail, emailLayout } = await import("@/lib/email.server");
          const dataBr = new Date(row.preferred_date + "T00:00:00").toLocaleDateString("pt-BR");
          /* Quem assina e quem responde é o MÉDICO DELA. Antes o e-mail saía
             assinado pelo fundador e com reply-to na caixa da plataforma —
             paciente de outro médico respondia para o lugar errado. */
          const { destinoMedico } = await import("@/lib/doctor-mail.server");
          const med = await destinoMedico((row.doctor_id as string | null) ?? null);
          await sendEmail({
            to: row.patient_email,
            replyTo: med.email || undefined,
            subject: "Sobre sua solicitação de consulta",
            html: emailLayout(
              `Olá, ${esc((row.patient_name ?? "").split(" ")[0]) || "tudo bem"}!`,
              `<p style="margin:0 0 14px">Não foi possível confirmar sua consulta solicitada para ${dataBr} às ${esc(row.preferred_time)}.</p>
               <p style="margin:0 0 6px">Responda este e-mail ou solicite um novo horário — teremos prazer em encontrar uma alternativa.</p>`,
              med.marca,
            ),
          });
        }
      } catch (e) {
        console.error("cancellation email failed", e);
      }
    }

    return { ok: !error };
  });

const ConfirmSchema = z.object({
  accessToken: z.string().min(10),
  id: z.string().uuid(),
  confirmedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confirmedTime: z.string().min(4).max(8),
  priceBrl: z.number().int().nullable(),
  internalNotes: z.string().max(2000).nullable(),
});

/**
 * Confirma um pedido de consulta com data/hora (service role — o UPDATE pelo
 * navegador dependia de claim is_admin no JWT e falhava silenciosamente).
 * Recusa quando já existe outra consulta confirmada no mesmo horário.
 */
export const confirmAppointment = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ConfirmSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "appointment_requests", data.id, scope)))
      return { ok: false as const, error: "Sem permissão." };

    // Conflito de slot: outra consulta confirmada na mesma data/hora. Para o
    // médico assinante, o conflito é só na PRÓPRIA agenda (slots de outro
    // médico não colidem com a dele).
    const { data: clash } = await scopedBy(
      (supabaseAdmin as any)
        .from("appointment_requests")
        .select("id, patient_name")
        .eq("status", "confirmed")
        .eq("confirmed_date", data.confirmedDate)
        .eq("confirmed_time", data.confirmedTime)
        .neq("id", data.id),
      scope,
    ).limit(1);
    if (clash?.length) {
      return {
        ok: false as const,
        error: `Já existe consulta confirmada nesse horário (${clash[0].patient_name ?? "outra paciente"}).`,
      };
    }

    const { error } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .update({
        status: "confirmed",
        confirmed_date: data.confirmedDate,
        confirmed_time: data.confirmedTime,
        proposed_date: null,
        proposed_time: null,
        price_brl: data.priceBrl,
        internal_notes: data.internalNotes,
      })
      .eq("id", data.id);
    // 23505 = índice único do slot (doctor_id, confirmed_date, confirmed_time):
    // outra consulta foi confirmada nesse horário na fração de segundo entre a
    // checagem acima e este UPDATE. Backstop real contra double-booking.
    if (error)
      return {
        ok: false as const,
        error:
          (error as { code?: string }).code === "23505"
            ? "Já existe consulta confirmada nesse horário."
            : error.message,
      };

    // Fecha o ciclo com a paciente: e-mail de confirmação com data/hora.
    // Não bloqueia o fluxo se o e-mail falhar ou não estiver configurado.
    try {
      const { data: row } = await (supabaseAdmin as any)
        .from("appointment_requests")
        .select("patient_name, patient_email, doctor_id")
        .eq("id", data.id)
        .maybeSingle();
      if (row?.patient_email) {
        const { sendEmail, emailLayout } = await import("@/lib/email.server");
        const { destinoMedico } = await import("@/lib/doctor-mail.server");
        const med = await destinoMedico((row.doctor_id as string | null) ?? null);
        const dataBr = new Date(data.confirmedDate + "T00:00:00").toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        const preco =
          data.priceBrl != null
            ? `<p style="margin:0 0 6px"><strong>Valor:</strong> R$ ${(data.priceBrl / 100).toFixed(2)}</p>`
            : "";
        await sendEmail({
          to: row.patient_email,
          replyTo: med.email || undefined,
          subject: "Sua consulta foi confirmada ✅",
          html: emailLayout(
            `Olá, ${esc((row.patient_name ?? "").split(" ")[0]) || "tudo bem"}!`,
            `<p style="margin:0 0 14px">Sua consulta foi <strong>confirmada</strong>:</p>
             <p style="margin:0 0 6px"><strong>Data:</strong> ${dataBr}</p>
             <p style="margin:0 0 6px"><strong>Horário:</strong> ${data.confirmedTime}</p>
             ${preco}
             <p style="margin:14px 0 0">Você também acompanha o status na aba <strong>Consultas</strong> do app.</p>
             <p style="margin:10px 0 0;font-size:13px;color:#9b8178">Precisa remarcar? Responda este e-mail.</p>`,
            med.marca,
          ),
        });
        const { sendPushToEmail } = await import("@/lib/push.server");
        await sendPushToEmail(row.patient_email, {
          title: "Consulta confirmada ✅",
          body: `${(row.patient_name ?? "").split(" ")[0] || "Tudo certo"}: ${dataBr} às ${data.confirmedTime}.`,
          url: "/minha-conta",
        });
      }
    } catch (e) {
      console.error("confirmation email failed", e);
    }

    return { ok: true as const, error: null };
  });

const ProposeSchema = z.object({
  accessToken: z.string().min(10),
  id: z.string().uuid(),
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proposedTime: z.string().min(4).max(8),
  priceBrl: z.number().int().nullable(),
  internalNotes: z.string().max(2000).nullable(),
});

/**
 * Contraproposta: quando o horário pedido não dá, o médico SUGERE outro. Não
 * confirma nada ainda — grava proposed_date/time + status 'counter_proposed' e
 * avisa a paciente pra aprovar (ou recusar) no app. A confirmação real só
 * acontece quando ela aprova (respondToProposedTime).
 */
export const proposeAppointmentTime = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ProposeSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "appointment_requests", data.id, scope)))
      return { ok: false as const, error: "Sem permissão." };

    const { error } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .update({
        status: "counter_proposed",
        proposed_date: data.proposedDate,
        proposed_time: data.proposedTime,
        price_brl: data.priceBrl,
        internal_notes: data.internalNotes,
      })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };

    // Avisa a paciente que há um horário sugerido pra aprovar (best-effort).
    try {
      const { data: row } = await (supabaseAdmin as any)
        .from("appointment_requests")
        .select("patient_name, patient_email, doctor_id")
        .eq("id", data.id)
        .maybeSingle();
      if (row?.patient_email) {
        const { sendEmail, emailLayout } = await import("@/lib/email.server");
        const { destinoMedico } = await import("@/lib/doctor-mail.server");
        const med = await destinoMedico((row.doctor_id as string | null) ?? null);
        const dataBr = new Date(data.proposedDate + "T00:00:00").toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        await sendEmail({
          to: row.patient_email,
          replyTo: med.email || undefined,
          subject: "O médico sugeriu um novo horário 🗓️",
          html: emailLayout(
            `Olá, ${esc((row.patient_name ?? "").split(" ")[0]) || "tudo bem"}!`,
            `<p style="margin:0 0 14px">O horário que você pediu não estava disponível, então ${
              med.nome ? esc(med.nome) : "o médico"
            } <strong>sugeriu um novo horário</strong>:</p>
             <p style="margin:0 0 6px"><strong>Data:</strong> ${dataBr}</p>
             <p style="margin:0 0 6px"><strong>Horário:</strong> ${data.proposedTime}</p>
             <p style="margin:14px 0 0">Abra a aba <strong>Consultas</strong> no app para <strong>aprovar</strong> ou <strong>recusar</strong> esse horário.</p>
             <p style="margin:10px 0 0"><a href="https://www.obstetrica.com.br/minha-conta" style="color:#a85a44">Abrir o app →</a></p>`,
            med.marca,
          ),
        });
        const { sendPushToEmail } = await import("@/lib/push.server");
        await sendPushToEmail(row.patient_email, {
          title: "Novo horário sugerido 🗓️",
          body: `O médico sugeriu ${dataBr} às ${data.proposedTime}. Toque para aprovar ou recusar.`,
          url: "/minha-conta",
        });
      }
    } catch (e) {
      console.error("counter-proposal email failed", e);
    }

    return { ok: true as const, error: null };
  });

const PaidSchema = z.object({ accessToken: z.string().min(10), id: z.string().uuid() });
export const markAppointmentPaid = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => PaidSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "appointment_requests", data.id, scope)))
      return { ok: false as const, error: "Sem permissão." };
    const { error } = await (supabaseAdmin as any)
      .from("appointment_requests")
      .update({ payment_status: "pago" })
      .eq("id", data.id);
    return error
      ? { ok: false as const, error: error.message }
      : { ok: true as const, error: null };
  });

const BroadcastSchema = z.object({
  accessToken: z.string().min(10),
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(300),
});

/**
 * Envio manual de notificação: o médico manda um aviso (push) pra TODAS as
 * próprias pacientes. Escopo multi-tenant — o assinante só alcança as pacientes
 * do próprio doctor_id; a equipe alcança todas. No-op se o push não estiver
 * configurado. É comunicação direta do médico, então não é silenciada pelo
 * Modo Cuidado (que só cala a gamificação do app, não a voz do médico).
 */
export const sendDoctorBroadcast = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => BroadcastSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Sem permissão.", sent: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pushConfigured, sendPushToUser } = await import("@/lib/push.server");
    if (!pushConfigured())
      return { ok: false as const, error: "Notificações ainda não configuradas.", sent: 0 };

    const { data: patients } = await scopedBy(
      (supabaseAdmin as any).from("patient_profiles").select("id"),
      scope,
    );
    const ids = ((patients ?? []) as { id: string }[]).map((p) => p.id);

    let sent = 0;
    for (const id of ids) {
      const res = await sendPushToUser(id, {
        title: data.title,
        body: data.body,
        url: "/minha-conta",
      });
      if (res.sent > 0) sent++;
    }
    return { ok: true as const, error: null, sent };
  });

export type AdminWaitlistEntry = {
  id: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string | null;
  week_start: string;
  status: string;
  offer_date: string | null;
  offer_time: string | null;
  offer_deadline: string | null;
  created_at: string;
};

/**
 * [Painel] Fila de espera ATIVA do médico (waiting + offered), agrupável por
 * semana. Só leitura, escopada ao doctor_id do assinante (equipe vê tudo).
 */
export const getDoctorWaitlist = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, entries: [] as AdminWaitlistEntry[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await scopedBy(
      (supabaseAdmin as any)
        .from("appointment_waitlist")
        .select(
          "id, patient_name, patient_email, patient_phone, week_start, status, offer_date, offer_time, offer_deadline, created_at",
        )
        .in("status", ["waiting", "offered"]),
      scope,
    )
      .order("week_start", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(200);
    return { ok: true as const, entries: (rows ?? []) as AdminWaitlistEntry[] };
  });

const AnswerSchema = z.object({
  accessToken: z.string().min(10),
  id: z.string().uuid(),
  answered: z.boolean(),
});

/** Marca uma pergunta da paciente como respondida (ou não). */
export const setQuestionAnswered = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AnswerSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "doctor_questions", data.id, scope)))
      return { ok: false as const };
    /* `answered_at` junto, e não só a flag. Este é o botão "marcar respondida"
       da aba Perguntas — o caminho que o médico mais usa quando responde sem
       treinar a IA. Sem o carimbo, a resposta dele ficava invisível para
       qualquer contagem "deste mês", para sempre.

       Recuo por `colunaAusente`, que cobre `PGRST204` (payload de UPDATE) além
       de `42703` (leitura). Só com `42703`, que é como estava, o recuo nunca
       entrava no banco de produção de hoje — e o botão "marcar respondida"
       falhava sempre, sem pista para o médico. */
    let { error } = await (supabaseAdmin as any)
      .from("doctor_questions")
      .update(
        data.answered
          ? { answered: true, answered_at: new Date().toISOString() }
          : { answered: false, answered_at: null },
      )
      .eq("id", data.id);
    if (colunaAusente(error)) {
      ({ error } = await (supabaseAdmin as any)
        .from("doctor_questions")
        .update({ answered: data.answered })
        .eq("id", data.id));
    }
    return { ok: !error };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Feature 46: Dashboard de Engajamento
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna dados de engajamento de todas as pacientes (ativas/inativas na última semana). */
export const getEngagementData = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    /* JANELA DA ÚLTIMA ATIVIDADE — 45 dias, e não 7.

       Enquanto todas as consultas de atividade usavam a mesma janela de 7 dias,
       `lastActivityAt` só podia ser nulo ou de menos de uma semana atrás. Ou
       seja: a paciente que registrou algo há 8 dias vinha nula, e a tela dizia
       "Nunca registrou nada no app" sobre alguém que usa o app há meses — e os
       cortes de 14 e 30 dias do sinal de silêncio nunca podiam ser atingidos.

       45 dias cobre com folga o corte mais longo (30). Fora da janela não
       viramos "nunca": viramos "há mais de 45 dias", que é o que de fato
       sabemos. */
    const JANELA_ATIVIDADE_DIAS = 45;
    const inicioJanela = new Date(
      Date.now() - JANELA_ATIVIDADE_DIAS * 24 * 60 * 60 * 1000,
    ).toISOString();

    /* PERFIS PRIMEIRO, ATIVIDADE DEPOIS — e recortada pelas pacientes DELE.

       As consultas de atividade rodam com service role e não passavam por
       `scopedBy`: liam a plataforma inteira. Com o teto de 1000 linhas do
       PostgREST, o orçamento de um médico de cinco pacientes era disputado com
       todas as pacientes de todos os médicos — e ordenar por mais recente não
       resolve, PIORA: esta tela precisa justamente das linhas mais ANTIGAS, que
       são as primeiras a serem cortadas. O resultado seria uma paciente que
       usou o app na semana passada aparecendo em vermelho como sumida.

       `.in("user_id", ids)` recorta o volume pelo número de pacientes dele, que
       é a ordem de grandeza certa, e fecha o vazamento de orçamento entre
       consultórios. Custa uma ida a mais ao banco, em série. */
    const profiles = await scopedBy(
      sb
        .from("patient_profiles")
        .select(
          "id,display_name,baby_name,lmp_date,reference_date,reference_weeks,reference_days,doctor_id,created_at",
        ),
      scope,
    );
    const idsDele = ((profiles.data ?? []) as { id: string }[]).map((p) => p.id);

    /* EM LOTES DE 100 — porque `.in()` vai na URL.
       
       O PostgREST monta a lista na query string e cada uuid custa 39 caracteres
       depois do percent-encoding da vírgula. A partir de ~206 pacientes a
       request line passa dos 8 KB do buffer do proxy e volta 414 — e o sintoma
       é o pior possível: `data` nula, `error` que ninguém lê, mapa de atividade
       vazio e TODAS as pacientes marcadas como sumidas há mais de 45 dias, em
       vermelho, no dia em que o consultório passou de 205 para 206. Sem uma
       palavra de erro na tela.

       O erro passa a ser propagado: um lote que falha derruba a leitura inteira
       daquela tabela para o `catch` de quem chama, em vez de virar silêncio. */
    const LOTE = 100;
    const desde = async (tabela: string, coluna: string) => {
      if (idsDele.length === 0) return { data: [] as never[], erro: false };
      const partes: unknown[] = [];
      let erro = false;
      for (let i = 0; i < idsDele.length; i += LOTE) {
        const { data: linhas, error } = await (supabaseAdmin as any)
          .from(tabela)
          .select(`user_id,${coluna}`)
          .in("user_id", idsDele.slice(i, i + LOTE))
          .gte(coluna, inicioJanela);
        /* Tabela ainda não migrada (42703/42P01) é ausência esperada, não
           falha: segue sem essa fonte de atividade, como antes. */
        if (error) {
          const code = (error as { code?: string }).code;
          if (code !== "42703" && code !== "42P01") erro = true;
          continue;
        }
        partes.push(...(linhas ?? []));
      }
      return { data: partes, erro };
    };

    const [healthLogs, journals, kicks, qs, forms, contracoes, exames, panicos, triagens] =
      await Promise.all([
        desde("health_logs", "created_at"),
        desde("journal_entries", "created_at"),
        desde("kick_sessions", "started_at"),
        desde("doctor_questions", "created_at"),
        /* Pré-consulta tem janela PRÓPRIA e mais larga porque a lista de
           pendentes precisa dela inteira. Por isso ela não entra no mapa de
           atividade sem ser filtrada: um formulário de 300 dias atrás fazia a
           etiqueta dizer "sem registro há 300 dias" para quem registrou há 50 —
           um número específico, de aparência confiável, 250 dias errado. */
        scopedBy(
          sb
            .from("preconsulta_forms")
            .select("user_id,submitted_at,seen_by_doctor")
            .order("submitted_at", { ascending: false }),
          scope,
        ),
        /* As três abaixo faltavam, e a falta doía justamente em quem mais usa o
           app: cronometrar contração, subir exame e acionar o SOS não contavam
           como sinal de vida. Uma gestante de 38 semanas contando contrações
           todo dia aparecia na lista de "sumidas". Tabela ainda não migrada
           devolve erro e `data` indefinida — o `?.forEach` abaixo ignora. */
        desde("contraction_logs", "created_at"),
        desde("exam_files", "created_at"),
        desde("panic_events", "created_at"),
        /* Triagem de sintomas: ela abriu o app, descreveu o que sentia e
           recebeu uma orientação. Não contar isso como sinal de vida permitia
           que a paciente aparecesse na lista de "sumidas há 30 dias" no mesmo
           dia em que fez uma triagem VERMELHA. */
        desde("triage_logs", "created_at"),
      ]);

    // Map userId → most recent activity timestamp
    const activityMap = new Map<string, string>();
    const record = (uid: string, ts: string) => {
      if (!uid || !ts) return;
      const prev = activityMap.get(uid);
      if (!prev || ts > prev) activityMap.set(uid, ts);
    };
    type LinhaAtividade = Record<string, string | null>;
    const registrar = (res: { data?: unknown }, coluna: string) =>
      ((res?.data ?? []) as LinhaAtividade[]).forEach((r) =>
        record(String(r.user_id ?? ""), String(r[coluna] ?? "")),
      );
    /* Se ALGUMA leitura de atividade falhou de verdade, a tela não pode
       apresentar o resultado como se fosse completo — seria transformar uma
       falha de infraestrutura numa lista de pacientes abandonadas. */
    const atividadeIncompleta = [
      healthLogs,
      journals,
      kicks,
      qs,
      contracoes,
      exames,
      panicos,
      triagens,
    ].some((r) => (r as { erro?: boolean }).erro);
    registrar(healthLogs, "created_at");
    registrar(journals, "created_at");
    registrar(kicks, "started_at");
    registrar(contracoes, "created_at");
    registrar(exames, "created_at");
    registrar(panicos, "created_at");
    registrar(triagens, "created_at");
    /* Pré-consulta enviada também é sinal de vida — a lista já vinha carregada
       para outro fim e nunca era registrada como atividade. */
    (forms.data as { user_id: string; submitted_at: string | null }[] | null)?.forEach((r) => {
      if (r.submitted_at && r.submitted_at >= inicioJanela) record(r.user_id, r.submitted_at);
    });
    registrar(qs, "created_at");

    const unseenByUser = new Set<string>(
      ((forms.data ?? []) as { user_id: string; seen_by_doctor: boolean }[])
        .filter((f) => !f.seen_by_doctor)
        .map((f) => f.user_id),
    );

    type EngProfile = {
      id: string;
      display_name: string | null;
      baby_name: string | null;
      lmp_date: string | null;
      reference_date: string | null;
      reference_weeks: number | null;
      reference_days: number | null;
      created_at?: string | null;
    };
    const patients: PatientEngagement[] = ((profiles.data ?? []) as EngProfile[]).map((p) => {
      const lastAt = activityMap.get(p.id) ?? null;
      const isActive = lastAt != null && lastAt >= sevenDaysAgo;
      return {
        id: p.id,
        display_name: p.display_name,
        baby_name: p.baby_name,
        lmp_date: p.lmp_date,
        reference_date: p.reference_date,
        reference_weeks: p.reference_weeks,
        reference_days: p.reference_days,
        isActive,
        lastActivityAt: lastAt,
        hasUnseenForm: unseenByUser.has(p.id),
        createdAt: p.created_at ?? null,
      };
    });

    return {
      ok: true as const,
      patients,
      totalPatients: patients.length,
      activeLastWeek: patients.filter((p) => p.isActive).length,
      inactiveLastWeek: patients.filter((p) => !p.isActive).length,
      unseenPreConsultas: unseenByUser.size,
      /* A tela precisa saber ATÉ ONDE olhamos. Sem isso ela não tem como
         distinguir "não registrou nada" de "não registrou nada que a gente
         tenha ido buscar" — e foi essa confusão que fez o painel afirmar
         "nunca registrou nada no app" sobre paciente antiga. */
      janelaAtividadeDias: JANELA_ATIVIDADE_DIAS,
      /** Alguma fonte de atividade não pôde ser lida — a tela avisa em vez de
          afirmar que ninguém registrou nada. */
      atividadeIncompleta,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Feature 47: Pré-consultas no painel do médico
// ─────────────────────────────────────────────────────────────────────────────

/** Lista todas as pré-consultas submetidas pelas pacientes. */
export const getPreConsultaForms = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: forms } = await scopedBy(
      sb.from("preconsulta_forms").select("*").order("submitted_at", { ascending: false }),
      scope,
    ).limit(100);

    const { data: profiles } = await scopedBy(
      sb.from("patient_profiles").select("id,display_name,doctor_id"),
      scope,
    );

    const nameById = new Map(
      (profiles ?? []).map((p: { id: string; display_name: string | null }) => [
        p.id,
        p.display_name,
      ]),
    );

    /* `profiles` JÁ vem recortado por `doctor_id` de `patient_profiles`, que é
       o vínculo ATUAL. O nome, portanto, sempre esteve certo — a ex-paciente
       aparecia como "Paciente" genérica, com peso, pressão, sintomas e
       medicações dela intactos ao lado. O rótulo caía; o dado clínico não. */
    const result: AdminPreConsulta[] = (forms ?? [])
      .filter((f: any) => scope.isTeam || nameById.has(f.user_id))
      .map((f: any) => ({
        ...f,
        patient_name: nameById.get(f.user_id) ?? "Paciente",
      }));

    return { ok: true as const, forms: result };
  });

const SeenSchema = z.object({ accessToken: z.string().min(10), id: z.string().uuid() });

/** Marca uma pré-consulta como vista pelo médico. */
export const markPreConsultaSeen = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SeenSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await assertOwnsRow(supabaseAdmin as any, "preconsulta_forms", data.id, scope)))
      return { ok: false as const };
    await supabaseAdmin
      .from("preconsulta_forms")
      .update({ seen_by_doctor: true })
      .eq("id", data.id);
    return { ok: true as const };
  });

/** Gera relatório de uma paciente (últimas 2 semanas de registros). */
export const getPatientReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), userId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // A paciente precisa pertencer ao médico assinante (id do perfil = uid).
    if (!(await assertOwnsRow(supabaseAdmin as any, "patient_profiles", data.userId, scope)))
      return { ok: false as const };

    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const uid = data.userId;

    const [profile, healthLogs, journals, kicks, questions, preConsultas] = await Promise.all([
      supabaseAdmin.from("patient_profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin
        .from("health_logs")
        .select("*")
        .eq("user_id", uid)
        .gte("created_at", twoWeeksAgo)
        .order("log_date", { ascending: false }),
      supabaseAdmin
        .from("journal_entries")
        .select("*")
        .eq("user_id", uid)
        .gte("created_at", twoWeeksAgo)
        .order("entry_date", { ascending: false }),
      supabaseAdmin
        .from("kick_sessions")
        .select("*")
        .eq("user_id", uid)
        .gte("started_at", twoWeeksAgo)
        .order("started_at", { ascending: false }),
      supabaseAdmin
        .from("doctor_questions")
        .select("*")
        .eq("user_id", uid)
        .eq("answered", false)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("preconsulta_forms")
        .select("*")
        .eq("user_id", uid)
        .order("submitted_at", { ascending: false })
        .limit(1),
    ]);

    return {
      ok: true as const,
      profile: profile.data,
      healthLogs: healthLogs.data ?? [],
      journals: journals.data ?? [],
      kicks: kicks.data ?? [],
      pendingQuestions: questions.data ?? [],
      latestPreConsulta: preConsultas.data?.[0] ?? null,
    };
  });
