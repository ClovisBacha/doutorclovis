import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Escopo multi-tenant da teleconsulta: equipe da instalação (ADMIN_EMAILS) OU
 * médico assinante ativo. A equipe vê/muta tudo; o assinante só o que estiver
 * vinculado ao PRÓPRIO doctor_id. Mesmo padrão de admin.functions.ts.
 */
type TeleScope = {
  user: { id: string; email?: string | null };
  isTeam: boolean;
  doctorId: string | null;
};

async function requireScope(accessToken: string): Promise<TeleScope | null> {
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

function scopedBy(qb: any, scope: TeleScope) {
  return scope.isTeam ? qb : qb.eq("doctor_id", scope.doctorId);
}

/**
 * Fail-closed: a linha `id` é dele HOJE?
 *
 * ─── POR QUE NÃO BASTA O CARIMBO ────────────────────────────────────────────
 *
 * `teleconsulta_sessions.doctor_id` é gravado quando a sessão é criada.
 * `encerrarAcompanhamento` zera `patient_profiles.doctor_id` e não toca em
 * carimbo nenhum — é uma tabela só.
 *
 * A LISTA já tinha sido corrigida para o vínculo atual, e é isso que tornava
 * esta função pior do que parecia: a sessão da ex-paciente sumia da tela do
 * médico anterior, mas as AÇÕES continuavam autorizando por id. Ele não vê mais
 * a linha, e ainda assim pode abrir a sala dela e gravar nota clínica nela — só
 * precisa do id, que ele já teve na mão enquanto ela era paciente.
 *
 * Autorização assimétrica em relação à leitura é a pior forma disto: some da
 * tela, e por isso ninguém percebe que continua permitido.
 */
async function ownsTele(sb: any, id: string, scope: TeleScope): Promise<boolean> {
  if (scope.isTeam) return true;
  const { data } = await sb
    .from("teleconsulta_sessions")
    .select("doctor_id,patient_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.doctor_id !== scope.doctorId) return false;
  /* O carimbo bate. Falta a pergunta que a lista já faz: ela ainda é paciente
     dele? `vinculadasAgora` devolve conjunto VAZIO quando não há médico
     resolvido — falha fechando, que é o que se quer numa autorização. */
  const { vinculadasAgora } = await import("./vinculo.server");
  const atuais = await vinculadasAgora(sb, { isTeam: false, doctorId: scope.doctorId });
  if (atuais === null) return true;
  return atuais.has(String(data.patient_user_id));
}

export type TeleconsultaSession = {
  id: string;
  patient_user_id: string;
  patient_name: string | null;
  scheduled_for: string | null;
  room_name: string;
  status: "agendada" | "sala_aberta" | "encerrada";
  doctor_notes: string | null;
  patient_notes: string | null;
  clinical_note: string | null;
  meet_url: string | null;
  created_at: string;
};

const AdminTk = z.object({ accessToken: z.string().min(10) });

export const createTeleconsulta = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        patientUserId: z.string().uuid(),
        scheduledFor: z.string().nullable(),
        doctorNotes: z.string().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Não autorizado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Assinante só cria teleconsulta para PACIENTE dele; a linha nasce com o
    // doctor_id dele. Equipe pode para qualquer paciente (doctor_id = null/dono).
    let doctorId: string | null = null;
    if (!scope.isTeam) {
      const { data: prof } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("doctor_id")
        .eq("id", data.patientUserId)
        .maybeSingle();
      if (!prof || prof.doctor_id !== scope.doctorId)
        return { ok: false as const, error: "Paciente não é sua." };
      doctorId = scope.doctorId;
    }

    const { data: row, error } = await (supabaseAdmin as any)
      .from("teleconsulta_sessions")
      .insert({
        patient_user_id: data.patientUserId,
        scheduled_for: data.scheduledFor,
        doctor_notes: data.doctorNotes,
        status: "agendada",
        doctor_id: doctorId,
      })
      .select()
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, session: row as TeleconsultaSession };
  });

export const getTeleconsultasAdmin = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AdminTk.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Não autorizado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Sem FK entre teleconsulta_sessions e patient_profiles, o embed do
    // PostgREST falha (PGRST200) — buscamos os nomes em uma segunda query.
    const { data: rows, error } = await scopedBy(
      (supabaseAdmin as any)
        .from("teleconsulta_sessions")
        .select("*")
        .order("created_at", { ascending: false }),
      scope,
    );
    if (error) return { ok: false as const, error: error.message };
    const userIds = [
      ...new Set((rows ?? []).map((r: any) => r.patient_user_id as string)),
    ] as string[];
    const nameById = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("patient_profiles")
        .select("id, display_name")
        .in("id", userIds);
      for (const p of (profiles ?? []) as { id: string; display_name: string | null }[])
        nameById.set(p.id, p.display_name);
    }
    /* Vínculo ATUAL, não o carimbo da linha: sem isto o médico anterior seguia
       lendo `patient_notes` (o que ELA escreveu antes da consulta),
       `clinical_note` e o `meet_url` da sala. Ver `./vinculo.server`. */
    const { vinculadasAgora, soVinculadas } = await import("./vinculo.server");
    const atuais = await vinculadasAgora(supabaseAdmin as any, scope);

    const sessions: TeleconsultaSession[] = soVinculadas(
      (rows ?? []) as any[],
      atuais,
      (r) => r.patient_user_id as string,
    ).map((r: any) => ({
      ...r,
      patient_name: nameById.get(r.patient_user_id) ?? null,
    }));
    return { ok: true as const, sessions };
  });

export const updateTeleconsultaStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid(),
        status: z.enum(["agendada", "sala_aberta", "encerrada"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await ownsTele(supabaseAdmin as any, data.id, scope))) return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .update({ status: data.status })
      .eq("id", data.id);
    return { ok: !error };
  });

export const getMyTeleconsultas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const, error: "Não autenticado" };
    /* A NOTA CLÍNICA NÃO TRAFEGA PARA O NAVEGADOR DELA.
    
       `select("*")` levava `clinical_note` — a nota SOAP, muitas vezes gerada
       por IA e ainda não revisada pelo médico — e `doctor_notes` para o cliente
       dela. Não era renderizado, o que é pior: um vazamento à espera de um
       `console.log`, de uma extensão ou de qualquer um abrindo a aba de rede.

       `doctor_notes` FICA (é o recado que ele escreve para ela ao criar a
       sessão). `clinical_note` sai. É a mesma decisão de `consultations`, onde
       o prontuário nunca sai do servidor e só o resumo vai. */
    const { data: rows, error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .select(
        "id,patient_user_id,scheduled_for,room_name,status,doctor_notes,patient_notes,created_at,meet_url",
      )
      .eq("patient_user_id", u.user.id)
      .neq("status", "encerrada")
      .order("scheduled_for", { ascending: true, nullsFirst: false });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, sessions: (rows ?? []) as unknown as TeleconsultaSession[] };
  });

export const saveDoctorClinicalNote = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid(),
        clinicalNote: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await ownsTele(supabaseAdmin as any, data.id, scope))) return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .update({ clinical_note: data.clinicalNote })
      .eq("id", data.id);
    return { ok: !error };
  });

export const generateClinicalNote = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        patient: z.object({
          name: z.string(),
          weeksAtSubmission: z.number().nullable(),
          weight: z.number().nullable(),
          systolic: z.number().nullable(),
          diastolic: z.number().nullable(),
          symptoms: z.array(z.string()),
          medications: z.string().nullable(),
          questions: z.string().nullable(),
          emotionalState: z.string().nullable(),
        }),
        bullets: z.string().min(5),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Não autorizado" };

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) return { ok: false as const, error: "API key não configurada" };

    const { generateText } = await import("ai");
    const { createChatProvider, DEFAULT_CHAT_MODEL } = await import("./ai-gateway.server");
    const google = createChatProvider(key);

    const p = data.patient;
    const preConsultaSummary = `
- Paciente: ${p.name}
- IG na consulta: ${p.weeksAtSubmission ? `${p.weeksAtSubmission} semanas` : "não informada"}
- Peso: ${p.weight ? `${p.weight} kg` : "não informado"}
- PA: ${p.systolic && p.diastolic ? `${p.systolic}/${p.diastolic} mmHg` : "não aferida"}
- Sintomas relatados: ${p.symptoms.length > 0 ? p.symptoms.join(", ") : "nenhum"}
- Medicamentos em uso: ${p.medications || "não informado"}
- Dúvidas da paciente: ${p.questions || "nenhuma"}
- Estado emocional: ${p.emotionalState || "não relatado"}`;

    const prompt = `Você é um assistente médico especialista em obstetrícia. Gere uma nota clínica de consulta de pré-natal em formato SOAP (Subjetivo, Objetivo, Avaliação, Plano) em português brasileiro, concisa e profissional.

PRÉ-CONSULTA DA PACIENTE:
${preConsultaSummary}

PONTOS DO MÉDICO DURANTE A CONSULTA:
${data.bullets}

Gere a nota SOAP. Use formatação clara com cabeçalhos em negrito. Seja específico e clínico. Máximo 400 palavras.`;

    const result = await generateText({
      model: google(process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL),
      prompt,
      maxOutputTokens: 600,
    });

    /* MEDIDO. Uma trava mecânica achou oito chamadas pagas de modelo que ninguém
     media — esta era uma delas. O consumo não existia em `ai_usage`: nem no
     card, nem na projeção do mês. Canal próprio, e a cota conta só `app`. */
    const { registrarUsoAgora } = await import("./uso-ia.server");
    await registrarUsoAgora({
      especie: "chat",
      modelo: process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL,
      doctorId: scope.doctorId,
      /* OS TOKENS, que estavam na mao e nao eram passados: a linha era gravada
         com zero e a tabela media a RESPOSTA, nunca o custo. */
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      canal: "teleconsulta",
    });
    return { ok: true as const, note: result.text };
  });

/** Sala Meet avulsa (API Meet spaces), sem evento de agenda. Fallback. */
async function createGoogleMeetRoom(refreshOverride?: string | null): Promise<string | null> {
  try {
    const accessToken = await googleAccessToken(refreshOverride);
    if (!accessToken) return null;
    const spaceRes = await fetch("https://meet.googleapis.com/v2/spaces", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!spaceRes.ok) return null;
    const space = (await spaceRes.json()) as { meetingUri?: string };
    return space.meetingUri ?? null;
  } catch {
    return null;
  }
}

/**
 * Convite da sala por e-mail.
 *
 * `doctorId` é quem assina: antes o e-mail dizia "Dr. Clóvis Bacha —
 * Ginecologista e Obstetra" para paciente de qualquer médico da plataforma.
 * Sem médico resolvido, ninguém assina — a moldura vira a da plataforma.
 */
async function sendPatientMeetEmail(
  patientEmail: string,
  patientName: string,
  meetUrl: string,
  scheduledFor: string | null,
  doctorId: string | null,
): Promise<void> {
  const dateStr = scheduledFor
    ? new Date(scheduledFor).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })
    : "hoje";
  const { sendEmail, emailLayout, escEmail } = await import("@/lib/email.server");
  const { destinoMedico } = await import("@/lib/doctor-mail.server");
  const med = await destinoMedico(doctorId);
  const quem = med.nome ? escEmail(med.nome) : "Seu médico";
  await sendEmail({
    to: patientEmail,
    replyTo: med.email || undefined,
    subject: med.nome
      ? `Sua teleconsulta está pronta — ${med.nome}`
      : "Sua teleconsulta está pronta",
    html: emailLayout(
      "Sua teleconsulta está pronta",
      `<p style="margin:0 0 10px">Olá, ${escEmail(patientName)}!</p>
       <p style="margin:0 0 14px">${quem} abriu sua sala de teleconsulta para <strong>${dateStr}</strong>.</p>
       <p style="margin:0 0 6px"><a href="${meetUrl}" style="display:inline-block;background:#a85a44;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;margin:8px 0">Entrar na teleconsulta</a></p>
       <p style="margin:10px 0 0;font-size:13px;color:#9b8178">Ou abra o app → Minha Conta → Teleconsulta e toque no link da sessão.</p>`,
      med.marca,
    ),
  });
}

/**
 * Troca um refresh token por um access token do Google (ou null).
 * `refreshOverride` = token da conta DO MÉDICO (nível 2); sem ele, cai na conta
 * central da instalação (GOOGLE_MEET_REFRESH_TOKEN).
 */
async function googleAccessToken(refreshOverride?: string | null): Promise<string | null> {
  const clientId = process.env.GOOGLE_MEET_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_MEET_CLIENT_SECRET;
  const refreshToken = refreshOverride || process.env.GOOGLE_MEET_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const { access_token } = (await res.json()) as { access_token?: string };
  return access_token ?? null;
}

/**
 * Cria um evento no Google Agenda com Google Meet embutido e convida médico +
 * paciente por e-mail — o próprio Google envia o convite (com data/hora e link
 * do Meet). Reutiliza as credenciais GOOGLE_MEET_*; o refresh token precisa ter
 * o escopo https://www.googleapis.com/auth/calendar.events (ver docs/GOOGLE_MEET.md).
 * Retorna a URL do Meet + os e-mails convidados, ou null (não configurado/falha)
 * para o chamador cair no fallback.
 */
async function createGoogleCalendarMeet(params: {
  doctorEmail: string | null;
  patientEmail: string;
  patientName: string;
  scheduledFor: string | null;
  refreshOverride?: string | null;
}): Promise<{ meetUrl: string } | null> {
  try {
    const accessToken = await googleAccessToken(params.refreshOverride);
    if (!accessToken) return null;

    const start = params.scheduledFor ? new Date(params.scheduledFor) : new Date();
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 40 * 60 * 1000); // 40 min de duração

    const attendees = [
      { email: params.patientEmail },
      ...(params.doctorEmail ? [{ email: params.doctorEmail }] : []),
    ];
    const requestId = `dc-tele-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

    // conferenceDataVersion=1 habilita a criação do Meet; sendUpdates=all força
    // o Google a e-mailar o convite aos participantes.
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: `Teleconsulta — ${params.patientName}`,
          description:
            "Sala de teleconsulta gerada pelo portal. Entre pelo link do Google Meet no horário combinado.",
          start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
          end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
          attendees,
          conferenceData: {
            createRequest: {
              requestId,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    );
    if (!res.ok) return null;
    const event = (await res.json()) as {
      hangoutLink?: string;
      conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
    };
    const meetUrl =
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
      null;
    return meetUrl ? { meetUrl } : null;
  } catch {
    return null;
  }
}

export const openTeleconsultaRoom = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid(),
        patientUserId: z.string().uuid(),
        scheduledFor: z.string().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Não autorizado" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = scope.user;

    // Carrega a PRÓPRIA sessão (posse + dados vêm da linha, nunca do input:
    // impede abrir a sala de outro médico OU convidar o e-mail de um usuário
    // arbitrário passando um patientUserId qualquer).
    const { data: sess } = await (supabaseAdmin as any)
      .from("teleconsulta_sessions")
      .select("patient_user_id, scheduled_for, room_name, doctor_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!sess) return { ok: false as const, error: "Sessão não encontrada" };
    if (!scope.isTeam && sess.doctor_id !== scope.doctorId)
      return { ok: false as const, error: "Não autorizado" };
    const patientUserId = sess.patient_user_id as string;
    const scheduledFor = (sess.scheduled_for as string | null) ?? null;

    // Nível 2: se o médico conectou a PRÓPRIA Agenda Google, a reunião é criada
    // e hospedada na conta dele; senão usamos a conta central da instalação.
    const { getDoctorGoogleRefreshToken } = await import("./google-calendar.functions");
    const doctorRefresh = await getDoctorGoogleRefreshToken(admin.id);

    // Dados da paciente (e-mail + nome) — da PACIENTE da sessão, não do input.
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(patientUserId);
    const patientEmail = authUser?.user?.email ?? null;
    const { data: profile } = await supabaseAdmin
      .from("patient_profiles")
      .select("display_name")
      .eq("id", patientUserId)
      .maybeSingle();
    const patientName = (profile as any)?.display_name ?? "Paciente";

    // 1) Google Agenda + Meet: cria o evento e convida médico + paciente por
    //    e-mail (o próprio Google envia o convite com data/hora e link).
    let meetUrl: string | null = null;
    let invitedViaCalendar = false;
    if (patientEmail) {
      const cal = await createGoogleCalendarMeet({
        doctorEmail: admin.email ?? null,
        patientEmail,
        patientName,
        scheduledFor,
        refreshOverride: doctorRefresh,
      });
      if (cal) {
        meetUrl = cal.meetUrl;
        invitedViaCalendar = true;
      }
    }

    // 2) Fallbacks: sala Meet avulsa (spaces, na mesma conta) → Jitsi.
    if (!meetUrl) meetUrl = await createGoogleMeetRoom(doctorRefresh);
    if (!meetUrl) {
      meetUrl = `https://meet.jit.si/obstetrica-${sess.room_name ?? data.id}`;
    }

    const { error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .update({ status: "sala_aberta", meet_url: meetUrl })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };

    // 3) E-mail ao paciente: se o convite da Agenda já saiu (convida os dois),
    //    não duplica; senão manda o link por Resend (comportamento antigo).
    if (!invitedViaCalendar && patientEmail) {
      await sendPatientMeetEmail(patientEmail, patientName, meetUrl, scheduledFor, admin.id);
    }

    return { ok: true as const, meetUrl, invited: invitedViaCalendar };
  });

export const savePatientNotes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        id: z.string().uuid(),
        notes: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await supabaseAdmin
      .from("teleconsulta_sessions")
      .update({ patient_notes: data.notes })
      .eq("id", data.id)
      .eq("patient_user_id", u.user.id);
    return { ok: !error };
  });
