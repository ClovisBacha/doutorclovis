import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { colunaAusente, faltaNoBanco } from "./postgrest";

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

    /* ─── AS TRÊS LEITURAS PODEM FALHAR, E DUAS DELAS MENTEM CALADAS ─────────
     *
     * `supabase-js` não lança: devolve `{ data, error }`. Os três `error` eram
     * descartados.
     *
     * O de `profiles` é o pior, e não é óbvio: `nameById` alimenta o FILTRO das
     * perguntas logo abaixo (`nameById.has(q.user_id)`). Se essa leitura falha,
     * o mapa fica vazio e o filtro derruba TODAS as perguntas — a fila do
     * médico esvazia inteira por causa de uma consulta que nem é a das
     * perguntas, e a tela diz que não há nada a responder.
     *
     * Não devolvo `ok:false`: os agendamentos podem ter vindo bem, e jogar fora
     * dado bom por causa de outra consulta seria trocar uma mentira por um
     * apagão. O painel já tem a faixa de fonte falhada — ela passa a acender
     * também por aqui. */
    const leituraFalhou = !!(appts.error || questions.error || profiles.error);

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

    /* A CONTAGEM EXATA de perguntas pendentes.
       O badge da fita de abas era `questions.filter(q => !q.answered).length`
       sobre as 200 mais RECENTES — e o card do Cérebro lista as mais ANTIGAS.
       Com 73 na fila, a fita dizia um número e o card outro, na mesma tela; e
       num consultório com mais de 200 perguntas no histórico, o badge podia
       contar MENOS que a realidade, escondendo trabalho.
       `head: true` traz só o número, sem as linhas. */
    const pendentes = await scopedBy(
      sb
        .from("doctor_questions")
        .select("id", { count: "exact", head: true })
        .eq("answered", false),
      scope,
    );

    return {
      ok: true as const,
      /** Alguma das três leituras falhou — o que está aqui pode estar incompleto. */
      incompleto: leituraFalhou,
      isTeam: scope.isTeam,
      appointments: (appts.data ?? []) as AdminAppointment[],
      questions: questionsWithName,
      /* `null` quando a contagem falhou — a tela cai no cálculo por amostra em
         vez de mostrar zero, que seria dizer "não há trabalho". */
      pendingQuestions:
        typeof (pendentes as { count?: number })?.count === "number"
          ? ((pendentes as { count?: number }).count as number)
          : null,
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

const MarcarNoDiaSchema = z.object({
  accessToken: z.string().min(10),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  nome: z.string().trim().min(2).max(120),
  /**
   * Vazio quando `pacienteId` vem preenchido — nesse caso quem resolve o
   * e-mail é o SERVIDOR.
   *
   * O e-mail da paciente mora em `auth.users`, e nem `patient_profiles` nem
   * `listMyPatients` o carregam. A tela não teria como preencher o campo ao
   * escolher uma paciente da lista: o nome entraria, o e-mail ficaria em
   * branco, e o médico digitaria de cabeça o e-mail de quem já está cadastrada
   * — errando um caractere e mandando a confirmação para o vazio.
   */
  email: z.union([z.string().trim().email().max(200), z.literal("")]),
  /** Paciente vinculada, quando é uma. `null` para quem só tem e-mail. */
  pacienteId: z.string().uuid().nullable(),
  telefone: z.string().trim().max(40),
  motivo: z.string().trim().max(300),
  precoBrl: z.number().int().nonnegative().nullable(),
  /** Em minutos, 5–240 — mesma faixa da grade de horários do médico
      (`doctor_slots.slot_minutes`) e da validação do lado da tela. */
  duracaoMinutos: z.number().int().min(5).max(240),
});

/**
 * O MÉDICO MARCA A CONSULTA, no dia, do calendário.
 *
 * ─── O QUE FALTAVA ─────────────────────────────────────────────────────────
 *
 * Toda linha de `appointment_requests` nascia da PACIENTE: ela pedia, ele
 * confirmava. Não havia caminho para o contrário — o médico combinar no
 * telefone e lançar na agenda. Ele via o mês e não podia escrever nele.
 *
 * ─── NASCE CONFIRMADA, E ISSO É O PONTO ────────────────────────────────────
 *
 * `status: "confirmed"` com `confirmed_date/time` preenchidos. Nascer
 * `pending` faria a própria consulta que ele acabou de marcar aparecer na fila
 * de trabalho pedindo que ele a confirmasse — trabalho inventado, e uma agenda
 * em que o compromisso dele aparece tracejado.
 *
 * `preferred_date/time` recebem o mesmo valor porque são `NOT NULL` desde a
 * primeira migration: são "o que a paciente pediu", e aqui quem pediu foi ele.
 *
 * ─── E-MAIL, NÃO CADASTRO ──────────────────────────────────────────────────
 *
 * `patient_email` é o que a tabela sempre exigiu, e é o que permite marcar para
 * quem NÃO tem conta no app: a intermediação é do consultório. Se ela for
 * paciente vinculada, a tela manda o e-mail dela e o efeito é o mesmo — com a
 * diferença de que aí o aviso também chega por push.
 */
export const marcarConsultaNoDia = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => MarcarNoDiaSchema.parse(i))
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    /* ─── QUEM É ELA, RESOLVIDO NO SERVIDOR ─────────────────────────────────
       Duas coisas acontecem aqui, e a segunda é a que importa:

       1. O e-mail vem de `auth.users`, que só o service role enxerga.
       2. O VÍNCULO é conferido. Sem isto, um `pacienteId` qualquer no corpo do
          pedido faria este endpoint devolver o e-mail de qualquer paciente da
          plataforma para qualquer médico assinante — recorte pelo vínculo
          ATUAL (`patient_profiles.doctor_id`), como no resto do produto. */
    let nome = data.nome;
    let email = data.email;
    if (data.pacienteId) {
      const { data: prof } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("id, display_name, doctor_id")
        .eq("id", data.pacienteId)
        .maybeSingle();
      if (!prof) return { ok: false as const, error: "Paciente não encontrada." };
      if (!scope.isTeam && prof.doctor_id !== scope.doctorId)
        return { ok: false as const, error: "Paciente não é sua." };
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.pacienteId);
      const doCadastro = u?.user?.email ?? "";
      /* O que o médico digitou GANHA do cadastro: ele pode estar marcando para
         o e-mail que ela usa de verdade, e não o do login. Só cai no cadastro
         quando ele deixou em branco. */
      email = data.email || doCadastro;
      nome = data.nome || (prof.display_name as string | null) || "Paciente";
    }
    if (!email) {
      return {
        ok: false as const,
        error: "Sem e-mail para avisar — preencha, ou escolha uma paciente do app.",
      };
    }

    /* ─── O CHOQUE É DE FAIXA, NÃO DE MINUTO EXATO ───────────────────────────
       Mesma checagem de choque do `confirmAppointment`, e pelo mesmo motivo:
       duas pacientes em horários que se cruzam é o erro que a agenda existe
       para impedir. O índice único parcial (`appt_confirmed_slot`) continua
       sendo o backstop de verdade contra o INSTANTE exato — esta consulta lê o
       DIA inteiro e usa a mesma régua pura do formulário (`agenda-unificada`)
       para pegar também o choque por SOBREPOSIÇÃO: 10:00–10:30 marcado, 10:15
       pedido agora, hora diferente e mesmo assim colide. */
    const { minutosDesdeMeiaNoite, DURACAO_PADRAO_MINUTOS } = await import("./agenda-unificada");
    const { data: doDia } = await scopedBy(
      (supabaseAdmin as any)
        .from("appointment_requests")
        .select("id, patient_name, confirmed_time, duration_minutes")
        .eq("status", "confirmed")
        .eq("confirmed_date", data.dia),
      scope,
    );
    const inicioNovo = minutosDesdeMeiaNoite(data.hora);
    const fimNovo = inicioNovo + data.duracaoMinutos;
    const choque = ((doDia ?? []) as any[]).find((c) => {
      /* `confirmed_time` é TEXTO e já aceitou "manhã" nesta base — o valor não
         vira número, `NaN < x` é sempre falso, e a linha simplesmente não
         colide (nem colidia antes, com a igualdade exata). */
      if (!c.confirmed_time) return false;
      const inicioExistente = minutosDesdeMeiaNoite(String(c.confirmed_time).slice(0, 5));
      const duracaoExistente =
        c.duration_minutes && c.duration_minutes > 0 ? c.duration_minutes : DURACAO_PADRAO_MINUTOS;
      const fimExistente = inicioExistente + duracaoExistente;
      return inicioNovo < fimExistente && inicioExistente < fimNovo;
    });
    if (choque) {
      return {
        ok: false as const,
        error: `Já existe consulta confirmada nesse horário (${choque.patient_name ?? "outra paciente"}).`,
      };
    }

    const linha: Record<string, unknown> = {
      patient_name: nome,
      patient_email: email,
      /* ─── O ELO COM A CONTA DELA ───────────────────────────────────────
           `appointment_requests` sempre identificou por e-mail DIGITADO, e por
           isso a consulta nunca soube de qual paciente do app ela é. Sem este
           campo não dá para dizer se a pré-consulta dela chegou, nem juntar o
           que ela registrou entre duas consultas, nem pôr a consulta na linha
           do tempo clínica — tudo dependia de casar e-mails, e um caractere
           diferente quebra o casamento em silêncio.
           `null` continua válido: consulta de quem não tem conta é caso
           legítimo, e é o que o consultório intermedia. */
      patient_user_id: data.pacienteId,
      /* `NOT NULL` sem default desde a primeira migration. Marcar por telefone
         sem ter o telefone é comum; a string vazia mantém a coluna honesta em
         vez de inventar um número. */
      patient_phone: data.telefone,
      reason: data.motivo || "Consulta",
      preferred_date: data.dia,
      preferred_time: data.hora,
      confirmed_date: data.dia,
      confirmed_time: data.hora,
      status: "confirmed",
      price_brl: data.precoBrl,
      doctor_id: scope.isTeam ? null : scope.doctorId,
      /* Em minutos — o "das X até Y" que o médico escolheu na tela. Nasceu
         DEPOIS de `patient_user_id`, então o recuo abaixo tem de saber tirar
         os dois, um por vez, e não só o primeiro. */
      duration_minutes: data.duracaoMinutos,
    };

    const gravar = () =>
      (supabaseAdmin as any).from("appointment_requests").insert(linha).select("id").single();

    let { data: nova, error } = await gravar();

    /* ─── AS COLUNAS NOVAS NÃO PODEM DERRUBAR O QUE JÁ FUNCIONAVA ────────────
       `patient_user_id` e `duration_minutes` chegaram em levas de SQL
       diferentes. Num banco que ainda não rodou um dos dois, o PostgREST
       recusa o INSERT INTEIRO com PGRST204 ("coluna desconhecida no payload")
       — e marcar consulta, que funcionava ontem, pararia de funcionar hoje por
       causa de um campo novo e opcional.
       Tira uma coluna nova por vez e tenta de novo, até sobrar só o que o
       banco realmente tem: o PGRST204 não diz QUAL coluna faltou, então uma
       remoção só resolveria o caso de faltar exatamente a primeira da lista.
       É `PGRST204` e não `42703`: aquele é erro do Postgres em SELECT, e
       escrito aqui seria um recuo que nunca roda. */
    const { colunaAusente } = await import("./postgrest");
    for (const coluna of ["patient_user_id", "duration_minutes"] as const) {
      if (!error || !colunaAusente(error)) break;
      if (!(coluna in linha)) continue;
      delete linha[coluna];
      ({ data: nova, error } = await gravar());
    }

    if (error) {
      const code = (error as { code?: string }).code;
      /* 23505 = índice único do slot. Outra confirmação entrou na fração de
         segundo entre a checagem acima e este INSERT. */
      if (code === "23505")
        return { ok: false as const, error: "Já existe consulta confirmada nesse horário." };
      /* Se AINDA falta coluna depois do laço acima ter tirado as duas colunas
         novas, o que falta é a leva antiga de colunas da agenda — outro SQL,
         outra instrução. `colunaAusente` já está em escopo, da checagem acima. */
      if (colunaAusente(error))
        return {
          ok: false as const,
          error: "Faltam colunas de agenda no banco. Rode o APLICAR_PENDENTES.sql no Supabase.",
        };
      return { ok: false as const, error: error.message };
    }

    /* O aviso fecha o ciclo, e a falha dele NÃO desfaz a consulta: ela já está
       na agenda dele, que é o que ele pediu. */
    let avisou = false;
    try {
      const { sendEmail, emailLayout } = await import("@/lib/email.server");
      const { destinoMedico } = await import("@/lib/doctor-mail.server");
      const med = await destinoMedico(scope.isTeam ? null : scope.doctorId);
      const dataBr = new Date(data.dia + "T00:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
      await sendEmail({
        to: email,
        replyTo: med.email || undefined,
        subject: "Sua consulta foi marcada ✅",
        html: emailLayout(
          `Olá, ${esc(nome.split(" ")[0]) || "tudo bem"}!`,
          `<p style="margin:0 0 14px">Sua consulta foi <strong>marcada</strong>:</p>
           <p style="margin:0 0 6px"><strong>Data:</strong> ${dataBr}</p>
           <p style="margin:0 0 6px"><strong>Horário:</strong> ${esc(data.hora)}</p>
           <p style="margin:14px 0 0;font-size:13px;color:#9b8178">Precisa remarcar? Responda este e-mail.</p>`,
          med.marca,
        ),
      });
      avisou = true;
      const { sendPushToEmail } = await import("@/lib/push.server");
      await sendPushToEmail(email, {
        title: "Consulta marcada ✅",
        body: `${nome.split(" ")[0]}: ${dataBr} às ${data.hora}.`,
        url: "/minha-conta",
      });
    } catch (e) {
      console.error("aviso de consulta marcada falhou", e);
    }

    /* `avisou` sobe para a tela porque "marcada ✓" e "marcada, mas ela não foi
       avisada" são dois desfechos diferentes — e o segundo é o que faz ele
       pegar o telefone. Sem `RESEND_API_KEY` o envio é no-op silencioso. */
    return { ok: true as const, id: nova.id as string, avisou, error: null };
  });

/**
 * O CONTATO DE UMA PACIENTE VINCULADA — para pré-encher "Marcar consulta".
 *
 * ─── POR QUE ISTO NÃO VINHA JUNTO NA LISTA ──────────────────────────────────
 *
 * O e-mail mora em `auth.users`; o telefone, em `patient_profiles.phone`. Duas
 * fontes que a lista de pacientes do painel (`listMyPatients` /
 * `getEngagementData`) não carrega — trazê-las para LÁ encareceria toda leitura
 * da lista por um dado que só importa quando ele escolhe uma paciente no
 * formulário de marcar consulta. Por isso é uma chamada à parte, feita só no
 * clique.
 *
 * A resposta é editável na tela: um cadastro sem telefone, ou com o e-mail de
 * outra pessoa, não pode travar o formulário — só deixa os campos como
 * estavam, e o médico digita por cima.
 */
export const contatoDaPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), pacienteId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const scope = await requireScope(data.accessToken);
    if (!scope) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    /* Mesmo recorte de `marcarConsultaNoDia`: o VÍNCULO é conferido antes de
       ler qualquer coisa. Sem isto, um `pacienteId` qualquer no corpo do
       pedido devolveria o e-mail e o telefone de qualquer paciente da
       plataforma para qualquer médico assinante. */
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("id, doctor_id, phone")
      .eq("id", data.pacienteId)
      .maybeSingle();
    if (!prof) return { ok: false as const, error: "Paciente não encontrada." };
    if (!scope.isTeam && prof.doctor_id !== scope.doctorId)
      return { ok: false as const, error: "Paciente não é sua." };

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.pacienteId);
    return {
      ok: true as const,
      email: u?.user?.email ?? null,
      telefone: (prof.phone as string | null) ?? null,
    };
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
  /**
   * Vazio/ausente = TODAS as pacientes (o comportamento de sempre).
   * Presente = só estas — o filtro que faltava para "avisar as cinco de
   * quinta-feira" sem incomodar as outras 195.
   */
  patientIds: z.array(z.string().uuid()).max(1000).optional(),
});

/**
 * Envio manual de notificação: o médico manda um aviso (push) pra suas
 * pacientes — todas, ou só as que ele escolher. Escopo multi-tenant — o
 * assinante só alcança as pacientes do próprio doctor_id; a equipe alcança
 * todas. No-op se o push não estiver configurado. É comunicação direta do
 * médico, então não é silenciada pelo Modo Cuidado (que só cala a gamificação
 * do app, não a voz do médico).
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
    let ids = ((patients ?? []) as { id: string }[]).map((p) => p.id);

    /* ─── A INTERSEÇÃO É O QUE MANTÉM O RECORTE MULTI-TENANT ────────────────
       `ids` já é só quem é DESTE médico (`scopedBy`, acima). Filtrar por essa
       lista — e não confiar direto em `data.patientIds` — é o que impede um
       id forjado no corpo do pedido de mandar aviso para a paciente de outro
       médico: ela nunca entra no conjunto de partida, então a interseção a
       descarta sozinha, sem precisar de outra consulta. */
    if (data.patientIds && data.patientIds.length > 0) {
      const escolhidas = new Set(data.patientIds);
      ids = ids.filter((id) => escolhidas.has(id));
    }

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
    const { data: rows, error } = await scopedBy(
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
    /* ─── "VAZIA" E "NÃO CONSEGUI LER" NÃO PODEM TER A MESMA CARA ────────────
     *
     * `supabase-js` não lança: devolve `{ data, error }`. O `error` era
     * descartado, então tabela ausente (a `appointment_waitlist` nasce numa
     * migration pendente), grant revogado ou timeout viravam `ok: true` com
     * lista vazia — e a tela dizia, tranquila, "Ninguém na fila de espera no
     * momento".
     *
     * O médico lê isso e para de oferecer vaga. Do outro lado há gestantes
     * esperando por um horário que ele acha que ninguém quer. */
    if (error) return { ok: false as const, entries: [] as AdminWaitlistEntry[] };
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
        /* Tabela ainda não migrada é ausência ESPERADA, não falha: segue sem
           essa fonte de atividade, como antes.

           `faltaNoBanco` cobre `PGRST205` além de 42703/42P01 — e essa é a
           diferença entre um alarme útil e um alarme inútil. Produção não tem
           `contraction_logs`, `panic_events` nem `triage_logs`, e o PostgREST
           responde `PGRST205` (fora do schema cache), não `42P01`.
           Sem isso, `atividadeIncompleta` ficava permanentemente true e a faixa
           "📡 Não consegui ler todos os registros" aparecia em TODO
           carregamento do painel. Um alarme que grita sempre é um alarme que se
           aprende a ignorar — e o dia em que a leitura falhar de verdade, ele
           não vai significar nada. */
        if (error) {
          if (!faltaNoBanco(error)) erro = true;
          continue;
        }
        partes.push(...(linhas ?? []));
      }
      return { data: partes, erro };
    };

    const [healthLogs, journals, kicks, qs, forms, contracoes, panicos, triagens] =
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
        /* As duas abaixo faltavam, e a falta doía justamente em quem mais usa o
           app: cronometrar contração e acionar o SOS não contavam como sinal de
           vida. Uma gestante de 38 semanas contando contrações todo dia
           aparecia na lista de "sumidas". Tabela ainda não migrada devolve erro
           e `data` indefinida — o `?.forEach` abaixo ignora. */
        desde("contraction_logs", "created_at"),
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
      panicos,
      triagens,
    ].some((r) => (r as { erro?: boolean }).erro);
    registrar(healthLogs, "created_at");
    registrar(journals, "created_at");
    registrar(kicks, "started_at");
    registrar(contracoes, "created_at");
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
    const { error } = await supabaseAdmin
      .from("preconsulta_forms")
      .update({ seen_by_doctor: true })
      .eq("id", data.id);
    if (error) {
      console.error("[pré-consulta] marca de lido não gravou", data.id, error);
      return { ok: false as const };
    }
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

    /* TRILHA. Esta é a leitura mais ampla do produto e a única que não deixava
       rastro: `patient_profiles` inteiro, catorze dias de medidas, chutes,
       perguntas, a última pré-consulta — e o CONTEÚDO do diário dela.

       E `assertOwnsRow` devolve `true` incondicionalmente para a equipe
       (ADMIN_EMAILS), o que é decisão de produto ("a equipe vê a instalação
       inteira") mas torna esta a porta por onde o diário de qualquer paciente
       da plataforma sai para quem não é o médico dela. Uma porta assim tem que
       registrar quem passou. */
    try {
      const { writeAudit } = await import("./audit.server");
      await writeAudit(
        { id: scope.user.id, email: scope.user.email },
        scope.isTeam ? "relatorio.ler.equipe" : "relatorio.ler",
        data.userId,
        null,
      );
    } catch {
      /* trilha é auxiliar — o relatório não deixa de abrir por causa dela */
    }

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
