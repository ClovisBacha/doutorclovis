/**
 * Vínculo paciente ↔ médico — server functions.
 *
 * Fluxo (cadastro manual controlado pelo médico):
 *   1. a paciente BUSCA o médico (searchDoctors) e ENVIA solicitação (requestDoctor)
 *   2. o médico vê as pendências (listPatientRequests) e ACEITA/recusa
 *      (respondPatientRequest) — só ao aceitar a paciente passa a pertencer
 *      a ele (patient_profiles.doctor_id)
 *   3. a paciente acompanha o status (getMyDoctorLink); o médico lista as
 *      próprias pacientes (listMyPatients)
 *
 * A partir do vínculo, o chat/cérebro que a paciente usa no app é o do SEU
 * médico (ver api/chat.ts), e cada conta fica individual.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Escapa texto da paciente que vai dentro de HTML de e-mail. */
function escaparHtml(v: string): string {
  return v.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

async function requireUser(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

/** Confirma que o usuário logado é um médico assinante ativo. */
async function requireDoctor(accessToken: string) {
  const user = await requireUser(accessToken);
  if (!user) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", user.id)
    .maybeSingle();
  if (!doc || doc.active === false) return null;
  return user;
}

export type DoctorPublic = {
  id: string;
  display_name: string;
  title: string;
  specialty: string;
  slug: string | null;
};

export type MyDoctorLink = {
  doctor: DoctorPublic | null;
  pending: { id: string; doctor: DoctorPublic; created_at: string } | null;
};

export type PatientRequest = {
  id: string;
  patient_id: string;
  patient_name: string | null;
  message: string | null;
  created_at: string;
};

export type LinkedPatient = {
  id: string;
  display_name: string | null;
  due_date: string | null;
  created_at: string | null;
  /** Aulas premium do quiz diário (revisão liberada). */
  quiz_premium?: boolean | null;
  /** BPM fetal medido na consulta — alimenta o "Sentir o coração" da família. */
  fetal_bpm?: number | null;
  fetal_bpm_at?: string | null;
  /** Semana gestacional atual (calculada no servidor) — espelho do bebê no painel. */
  weeks?: number | null;
  /** Dias dentro da semana (0–6). Conduta em 36s0d ≠ 36s6d. */
  days?: number | null;
  /** Nascimento, quando já houve: liga o espelho pós-parto. */
  birth_date?: string | null;
  /** Nome do bebê — é como ela chama a gestação. */
  baby_name?: string | null;
  /** Tom de pele do bebê (0–4) escolhido pela paciente — espelho fiel. */
  baby_skin_tone?: number | null;
};

const TokenSchema = z.object({ accessToken: z.string().min(10) });

/** Busca médicos ativos que aceitam pacientes (nome/especialidade). */
/* A busca por RPC (`search_doctors`) foi removida daqui.
   
   Ela filtrava `d.verified = true` no SQL — ou seja, escondia todo médico
   recém-cadastrado — e ordenava por nome, ignorando o plano. Nenhuma tela a
   usava mais (o app passou a chamar o diretório de `doctors.functions.ts`),
   mas `createServerFn` publica um endereço HTTP de qualquer jeito: deixá-la
   exportada mantinha viva uma segunda busca com regras diferentes da que
   valem. Uma pergunta, uma resposta. */

export const requestDoctor = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        doctorId: z.string().uuid(),
        message: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const, reason: "auth" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // O médico precisa existir, estar ativo, aceitando pacientes e VERIFICADO
    // (mesmo gate da busca — impede solicitar vínculo a médico não verificado).
    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("id,active,accepting_patients,verified")
      .eq("id", data.doctorId)
      .maybeSingle();
    /* O selo (`verified`) saiu da condição: ele é reputação, não permissão.
       Exigi-lo aqui fazia a paciente achar o médico na busca — que agora
       mostra os não-conferidos — e receber "indisponível" ao tocar. */
    if (!doc || doc.active === false || doc.accepting_patients === false) {
      return { ok: false as const, reason: "unavailable" as const };
    }

    // Já vinculada a este médico? Nada a fazer.
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", user.id)
      .maybeSingle();
    if (prof?.doctor_id === data.doctorId) {
      return { ok: true as const, status: "accepted" as const };
    }

    // Já existe uma pendente para este médico? Reaproveita (idempotente).
    const { data: existing } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .select("id,status")
      .eq("patient_id", user.id)
      .eq("doctor_id", data.doctorId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true as const, status: "pending" as const };

    /* O teto do plano dele é checado AQUI, não só na hora do aceite.
       
       Antes, uma paciente pedia, o médico tentava aceitar, batia no limite — e
       o pedido ficava `pending` para sempre. Ela via "aguardando aceitar" sem
       fim e sem explicação, e nem podia buscar outro médico (a tela esconde a
       busca enquanto há pendência). Recusar na hora, com motivo, deixa ela
       procurar outro obstetra em vez de esperar por nada. */
    try {
      const { getEntitlementsByDoctorId } = await import("./entitlements.server");
      const ent = await getEntitlementsByDoctorId(data.doctorId);
      if (ent.maxPatients != null) {
        const { count, error: cntErr } = await (supabaseAdmin as any)
          .from("patient_profiles")
          .select("id", { count: "exact", head: true })
          .eq("doctor_id", data.doctorId);
        /* Falha FECHADA. Antes era `!cntErr && …`: qualquer falha da contagem
           (timeout, RLS, tabela indisponível) fazia `count` virar null, o teto
           desaparecer e o vínculo passar. Um limite que se desliga sozinho no
           primeiro erro de rede não é um limite. */
        if (cntErr || (count ?? 0) >= ent.maxPatients) {
          return { ok: false as const, reason: "lotado" as const };
        }
      }
    } catch {
      /* não bloqueia por falha na contagem: o aceite ainda checa */
    }

    const { error } = await (supabaseAdmin as any).from("patient_link_requests").insert({
      patient_id: user.id,
      doctor_id: data.doctorId,
      message: data.message ?? null,
      status: "pending",
    });
    if (error) return { ok: false as const, reason: "db" as const };

    /* AVISA O MÉDICO. Sem isto o pedido era um buraco silencioso: nada de push,
       nada de e-mail, e ele só descobriria abrindo o painel na aba Pacientes
       por conta própria. Do lado dela o cartão dizia "aguardando o médico
       aceitar" para sempre, sem que o médico soubesse que havia alguém
       esperando. Melhor esforço nos dois canais — falhar aqui não desfaz o
       pedido, que já está gravado. */
    /* AGUARDADO, não disparado e esquecido.
       
       Isto roda em função serverless (Vercel): quando a resposta é enviada, a
       execução pode ser congelada e recuperada na hora seguinte. Um
       `void (async () => …)()` depois do `return` é um envio que às vezes
       acontece e às vezes não — e "às vezes" aqui significa um pedido de
       paciente que ninguém fica sabendo, o exato buraco que este trecho existe
       para fechar. Os poucos milissegundos a mais na resposta valem a certeza.
       O `try` interno garante que uma falha de push ou de e-mail não desfaz o
       pedido, que já está gravado. */
    await (async () => {
      try {
        const { data: prof } = await (supabaseAdmin as any)
          .from("patient_profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        const nome = ((prof?.display_name as string) || "Uma gestante").trim();

        try {
          const { sendPushToUser } = await import("./push.server");
          await sendPushToUser(data.doctorId, {
            title: "Nova paciente quer te acompanhar",
            body: `${nome} enviou uma solicitação. Toque para aceitar.`,
            url: "/painel",
          });
        } catch {
          /* push é o canal opcional */
        }

        const { data: dUser } = await supabaseAdmin.auth.admin.getUserById(data.doctorId);
        const email = dUser?.user?.email;
        if (email) {
          const { sendEmail, emailLayout } = await import("./email.server");
          await sendEmail({
            to: email,
            subject: `👩‍🍼 ${nome} quer te acompanhar no app`,
            /* Escapado: o nome e a mensagem são texto que a paciente digitou, e
               vão para dentro de um HTML que outra pessoa abre. */
            html: emailLayout(
              "Nova solicitação de paciente",
              `<p style="margin:0 0 10px"><strong>${escaparHtml(nome)}</strong> enviou uma solicitação para ser acompanhada por você no app Obstétrica.</p>
               ${data.message ? `<p style="margin:0 0 10px;padding:10px 14px;background:#f8fafc;border-radius:10px">"${escaparHtml(data.message)}"</p>` : ""}
               <p style="margin:0">Aceite (ou recuse) no seu painel, na aba <strong>Pacientes</strong>.</p>`,
            ),
          });
        }
      } catch {
        /* melhor esforço — o pedido continua valendo */
      }
    })();

    return { ok: true as const, status: "pending" as const };
  });

/** Estado atual do vínculo da paciente: médico atual e/ou solicitação pendente. */
export const getMyDoctorLink = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", user.id)
      .maybeSingle();

    let doctor: DoctorPublic | null = null;
    if (prof?.doctor_id) {
      const { data: d } = await (supabaseAdmin as any)
        .from("doctors")
        .select("id,display_name,title,specialty,slug")
        .eq("id", prof.doctor_id)
        .maybeSingle();
      doctor = (d ?? null) as DoctorPublic | null;
    }

    // Solicitação pendente mais recente (se houver), com dados do médico.
    const { data: req } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .select("id,doctor_id,created_at")
      .eq("patient_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let pending: MyDoctorLink["pending"] = null;
    if (req?.doctor_id) {
      const { data: d } = await (supabaseAdmin as any)
        .from("doctors")
        .select("id,display_name,title,specialty,slug")
        .eq("id", req.doctor_id)
        .maybeSingle();
      if (d) pending = { id: req.id, doctor: d as DoctorPublic, created_at: req.created_at };
    }

    return { ok: true as const, link: { doctor, pending } as MyDoctorLink };
  });

/** A paciente cancela a própria solicitação pendente. */
export const cancelDoctorRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), requestId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .update({ status: "cancelled", decided_at: new Date().toISOString() })
      .eq("id", data.requestId)
      .eq("patient_id", user.id)
      .eq("status", "pending");
    return { ok: !error };
  });

/** Lista as solicitações pendentes destinadas ao médico logado. */
export const listPatientRequests = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, requests: [] as PatientRequest[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .select("id,patient_id,message,created_at")
      .eq("doctor_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

    const reqs = (rows ?? []) as Omit<PatientRequest, "patient_name">[];
    // Nomes das pacientes numa segunda query (sem FK para embed do PostgREST).
    const ids = [...new Set(reqs.map((r) => r.patient_id))];
    const nameById = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: profs } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("id,display_name")
        .in("id", ids);
      for (const p of (profs ?? []) as { id: string; display_name: string | null }[]) {
        nameById.set(p.id, p.display_name);
      }
    }

    const requests: PatientRequest[] = reqs.map((r) => ({
      ...r,
      patient_name: nameById.get(r.patient_id) ?? null,
    }));
    return { ok: true as const, requests };
  });

/** O médico aceita ou recusa uma solicitação. Ao aceitar, vincula a paciente. */
export const respondPatientRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        requestId: z.string().uuid(),
        accept: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Só solicitações pendentes destinadas a ESTE médico (anti-IDOR).
    const { data: req } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .select("id,patient_id,doctor_id,status")
      .eq("id", data.requestId)
      .eq("doctor_id", user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (!req) return { ok: false as const };

    const now = new Date().toISOString();

    /* A decisão é RECLAMADA antes de qualquer outra escrita.
    
       A ordem anterior era: vincular a paciente, depois marcar a solicitação
       como aceita. Se a segunda falhasse, a paciente ficava vinculada ao médico
       com a solicitação ainda "pending" — o cartão dela dizia "aguardando o
       médico aceitar" para sempre, enquanto ele já a via na lista de pacientes.
       Reclamar primeiro, com `.eq("status","pending")`, também fecha a corrida
       de dois cliques: o segundo encontra 0 linhas e desiste. */
    const { data: claimed } = await (supabaseAdmin as any)
      .from("patient_link_requests")
      .update({ status: data.accept ? "accepted" : "declined", decided_at: now })
      .eq("id", req.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) return { ok: false as const };

    /** Devolve a solicitação para pendente quando o passo seguinte falha. */
    const desfazer = async () =>
      await (supabaseAdmin as any)
        .from("patient_link_requests")
        .update({ status: "pending", decided_at: null })
        .eq("id", req.id);

    if (data.accept) {
      // Escada de planos: cada plano tem um teto de pacientes ativas por
      // médico (Free 5 → Starter 50 → Pro 150 → Elite 300 → Black/Clínica
      // 500). Ao atingir o teto, o aceite é bloqueado com o motivo — a
      // solicitação fica pendente e o médico faz upgrade para aceitar.
      const { getEntitlements } = await import("./entitlements.server");
      const ent = await getEntitlements(user);
      if (ent.maxPatients != null) {
        const { count, error: cntErr } = await (supabaseAdmin as any)
          .from("patient_profiles")
          .select("id", { count: "exact", head: true })
          .eq("doctor_id", user.id);
        // Falha fechada, igual ao aceite: erro de contagem não abre o teto.
        if (cntErr || (count ?? 0) >= ent.maxPatients) {
          // Teto do plano: a solicitação volta a pendente para ele aceitar
          // depois do upgrade, em vez de sumir.
          await desfazer();
          return {
            ok: false as const,
            reason: "limit" as const,
            limit: ent.maxPatients,
            plan: ent.label,
          };
        }
      }
      // Vincula a paciente ao médico (denormalizado em patient_profiles).
      const { error: linkErr } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .update({ doctor_id: user.id, updated_at: now })
        .eq("id", req.patient_id);
      if (linkErr) {
        await desfazer();
        return { ok: false as const };
      }
    }

    /* AVISA A PACIENTE da decisão.
       
       Antes o aceite era silencioso: o cartão dela dizia "aguardando o médico
       aceitar" e, na próxima vez que ela abrisse a aba, tinha mudado sozinho —
       sem nenhum momento em que alguém lhe dissesse "ele aceitou". E a recusa
       era pior: o cartão simplesmente voltava ao estado vazio, como se ela
       nunca tivesse pedido nada. Uma decisão que ninguém comunica é uma decisão
       que a pessoa vive como um bug.

       Aguardado (e não fire-and-forget) pelo mesmo motivo do pedido: em
       serverless não há garantia de que algo rode depois da resposta. */
    try {
      const { data: d } = await (supabaseAdmin as any)
        .from("doctors")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const medico = ((d?.display_name as string) || "Seu médico").trim();
      const { sendPushToUser } = await import("./push.server");
      await sendPushToUser(req.patient_id as string, {
        title: data.accept
          ? `${medico} aceitou te acompanhar 💛`
          : "Sua solicitação não foi aceita",
        body: data.accept
          ? "A partir de agora o app responde no estilo do consultório dele."
          : "Você pode escolher outro obstetra no app, em Meu médico.",
        url: "/minha-conta",
      });
    } catch {
      /* melhor esforço — a decisão já está gravada */
    }
    return { ok: true as const };
  });

/**
 * Encerra o acompanhamento de uma paciente.
 *
 * Não existia, e a falta custava dos dois lados. O médico chegava no teto do
 * plano com pacientes que já tiveram bebê ocupando vaga, e a única saída era
 * pagar mais — upgrade pelo motivo errado, que vira cancelamento no mês
 * seguinte. Do lado dela, ficava presa a um médico que não a acompanha mais e
 * sem conseguir escolher outro.
 *
 * O vínculo é desfeito, não apagado: o histórico dela continua inteiro no app
 * dela, e os acionamentos de SOS mantêm o `doctor_id` congelado de quando
 * aconteceram — quem era o responsável naquele dia não muda porque o
 * acompanhamento terminou depois.
 */
export const encerrarAcompanhamento = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ accessToken: z.string().min(10), pacienteId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    /* `doctor_id` no próprio WHERE: uma paciente de outro consultório não
       afeta linha nenhuma, sem checagem separada que abriria corrida. */
    const { data: mexeu, error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ doctor_id: null, updated_at: new Date().toISOString() })
      .eq("id", data.pacienteId)
      .eq("doctor_id", user.id)
      .select("id");
    if (error || !mexeu?.length) return { ok: false as const };

    /* A solicitação antiga volta a "declined" e não some: sem isso, o par
       ficaria com um pedido "accepted" de um vínculo que não existe mais, e ela
       não conseguiria pedir de novo. */
    try {
      await (supabaseAdmin as any)
        .from("patient_link_requests")
        .update({ status: "declined", decided_at: new Date().toISOString() })
        .eq("patient_id", data.pacienteId)
        .eq("doctor_id", user.id)
        .eq("status", "accepted");
    } catch {
      /* o vínculo já caiu, que é o que importa */
    }

    /* AVISA ELA. Descobrir sozinha que o médico sumiu do app é a pior forma de
       saber — e ela precisa saber para escolher outro. */
    try {
      const { data: d } = await (supabaseAdmin as any)
        .from("doctors")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      const medico = ((d?.display_name as string) || "Seu médico").trim();
      const { sendPushToUser } = await import("./push.server");
      await sendPushToUser(data.pacienteId, {
        title: "Acompanhamento encerrado",
        body: `${medico} encerrou o acompanhamento no app. Você pode escolher outro obstetra em Meu médico.`,
        url: "/minha-conta",
      });
    } catch {
      /* melhor esforço — o vínculo já foi desfeito */
    }
    return { ok: true as const };
  });

/** Lista as pacientes vinculadas ao médico logado. */
export const listMyPatients = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, patients: [] as LinkedPatient[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cascata de selects: colunas opcionais (quiz_premium, fetal_bpm) podem
    // ainda não existir no banco de produção (42703) — degrada sem quebrar.
    // lmp_date/reference_* alimentam a semana gestacional (espelho do bebê).
    const gestCols = "lmp_date,reference_date,reference_weeks,reference_days";
    const selects = [
      `id,display_name,baby_name,due_date,created_at,quiz_premium,fetal_bpm,fetal_bpm_at,baby_skin_tone,birth_date,${gestCols}`,
      `id,display_name,baby_name,due_date,created_at,quiz_premium,fetal_bpm,fetal_bpm_at,birth_date,${gestCols}`,
      `id,display_name,due_date,created_at,quiz_premium,fetal_bpm,fetal_bpm_at,${gestCols}`,
      `id,display_name,due_date,created_at,quiz_premium,${gestCols}`,
      `id,display_name,due_date,created_at,${gestCols}`,
      "id,display_name,due_date,created_at",
    ];
    let rows: any[] | null = null;
    for (const sel of selects) {
      const res = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select(sel)
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (!res.error) {
        rows = res.data;
        break;
      }
      if (res.error.code !== "42703") break; // erro real, não coluna ausente
    }

    // Semana gestacional por paciente (mesma função pura do app).
    const { computeGestation } = await import("./gestacao");
    const patients = (rows ?? []).map((r) => {
      const g = computeGestation({
        lmp: r.lmp_date,
        referenceDate: r.reference_date,
        referenceWeeks: r.reference_weeks,
        referenceDays: r.reference_days,
      });
      return {
        id: r.id,
        display_name: r.display_name ?? null,
        due_date: r.due_date ?? null,
        created_at: r.created_at ?? null,
        // O nome do bebê é como a paciente chama a gestação — e o médico não
        // via nem isso na lista.
        baby_name: r.baby_name ?? null,
        quiz_premium: r.quiz_premium ?? null,
        fetal_bpm: r.fetal_bpm ?? null,
        fetal_bpm_at: r.fetal_bpm_at ?? null,
        weeks: g && g.weeks >= 1 && g.weeks <= 44 ? g.weeks : null,
        /* Os DIAS, não só as semanas. Conduta em 36s0d não é conduta em 36s6d,
           e o espelho mostrava "36 semanas" para as duas. A tela da paciente
           sempre disse "36 semanas e 3d" — o painel é que arredondava. */
        days: g && g.weeks >= 1 && g.weeks <= 44 ? g.days : null,
        /* Pós-parto. Passando de 44 semanas o `weeks` virava null e o painel
           dizia "Sem data de gestação" para uma puérpera — enquanto a tela dela
           mostrava os dias de vida do bebê. `birth_date` nem era selecionado. */
        birth_date: r.birth_date ?? null,
        baby_skin_tone: r.baby_skin_tone ?? null,
      } as LinkedPatient;
    });

    return { ok: true as const, patients };
  });

/**
 * Liga/desliga o premium do quiz diário de UMA paciente do médico logado
 * (ativação manual após o PIX — o médico confirma o pagamento e libera).
 */
export const setPatientQuizPremium = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        patientId: z.string().uuid(),
        premium: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    /* DONA DA LINHA ANTES DE QUALQUER CONSULTA sobre ela.
    
       A checagem de assinatura abaixo rodava primeiro, com o `patientId` cru do
       pedido. O UPDATE no fim é escopado por `doctor_id`, então nunca houve
       escrita indevida — mas a resposta diferente ("esta paciente tem assinatura
       ativa") transformava este endpoint num oráculo: o médico A passava o id de
       uma paciente do médico B e descobria se ela paga assinatura. É dado de
       outra pessoa saindo por uma mensagem de erro. */
    const { data: minha, error: erroDona } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("id")
      .eq("id", data.patientId)
      .eq("doctor_id", user.id)
      .maybeSingle();
    /* Falha de leitura ≠ paciente inexistente. Descartar o erro fazia a tela
       dizer "paciente não encontrada" para um problema de rede — o médico
       procuraria a paciente, não a conexão. Fecha do mesmo jeito, mas dizendo a
       verdade sobre o motivo. */
    if (erroDona) {
      return { ok: false as const, error: "Não foi possível verificar a paciente agora." };
    }
    if (!minha) return { ok: false as const, error: "Paciente não encontrada." };

    // Proteção: o toggle manual NÃO pode revogar quem tem assinatura ativa
    // (Stripe) ou convite ativo — o acesso pago é gerido pelo webhook, não
    // pela mão do médico. (Se a tabela subscriptions ainda não existe, ignora.)
    if (!data.premium) {
      try {
        const { data: subs } = await (supabaseAdmin as any)
          .from("subscriptions")
          .select("source,status")
          .eq("user_id", data.patientId)
          .eq("product", "quiz_premium")
          .in("status", ["active", "trialing"]);
        const paga = (subs ?? []).some(
          // 'convite' = recompensa da paciente que convidou o médico (webhook)
          (s: any) =>
            s.source === "stripe" ||
            s.source === "doctor_invite" ||
            s.source === "convite" ||
            s.source === "cupom",
        );
        if (paga) {
          return {
            ok: false as const,
            error:
              "Esta paciente tem uma assinatura ativa — o acesso é gerido pelo pagamento (cancele pelo Stripe).",
          };
        }
      } catch {
        /* subscriptions ausente: sem estado pago a proteger */
      }
    }

    const { data: mexeu, error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ quiz_premium: data.premium })
      .eq("id", data.patientId)
      .eq("doctor_id", user.id) // tenancy: só as próprias pacientes
      .select("id"); // sem isto, zero linhas afetadas voltava como sucesso
    if (error?.code === "42703") {
      return {
        ok: false as const,
        error: "Aplique a migração quiz_premium no Supabase (APLICAR_PENDENTES.sql).",
      };
    }
    if (error) return { ok: false as const, error: error.message };
    // "Salvo ✓" sem ter salvado nada é pior do que um erro.
    if (!mexeu || mexeu.length === 0) {
      return { ok: false as const, error: "Nada foi alterado — recarregue a lista." };
    }
    return { ok: true as const, error: null };
  });

/**
 * Registra o BPM fetal medido na consulta ("Sentir o coração" v2, estilo
 * Trellis): o Painel do Papai e o app da paciente vibram no ritmo EXATO do
 * bebê. Fail-closed: o UPDATE só afeta a linha se a paciente pertence ao
 * médico logado (doctor_id no próprio WHERE) — sem checagem separada que
 * poderia abrir corrida. bpm null limpa o registro.
 */
export const setPatientFetalBpm = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        patientId: z.string().uuid(),
        bpm: z.number().int().min(60).max(220).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await requireDoctor(data.accessToken);
    if (!user) return { ok: false as const, error: "Sem permissão." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: updated, error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({
        fetal_bpm: data.bpm,
        fetal_bpm_at: data.bpm === null ? null : new Date().toISOString().slice(0, 10),
      })
      .eq("id", data.patientId)
      .eq("doctor_id", user.id)
      .select("id");

    if (error?.code === "42703") {
      return {
        ok: false as const,
        error: "Aplique a migração fetal_bpm no Supabase (APLICAR_PENDENTES.sql).",
      };
    }
    if (error) return { ok: false as const, error: error.message };
    if (!updated || updated.length === 0)
      return { ok: false as const, error: "Paciente não encontrada ou não é sua." };
    return { ok: true as const, error: null };
  });

/**
 * PIX do MÉDICO da paciente logada (para pagar consulta particular na chave
 * dele, não numa central). Resolve pelo doctor_id do perfil. Devolve null se a
 * paciente não escolheu médico ou ele não cadastrou chave PIX — aí a UI usa o
 * PIX central de fallback. A chave PIX é feita para ser mostrada à paciente
 * (é como ela paga), então não há PII sensível aqui.
 */
export const getMyDoctorPix = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const, pix: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!prof?.doctor_id) return { ok: true as const, pix: null };
    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("pix_key,display_name")
      .eq("id", prof.doctor_id)
      .maybeSingle();
    const pixKey = (doc?.pix_key as string | null)?.trim() || null;
    if (!pixKey) return { ok: true as const, pix: null };
    return {
      ok: true as const,
      pix: { key: pixKey, name: (doc?.display_name as string | null) ?? "" },
    };
  });

/**
 * Contato do médico DA PACIENTE — o que a Central de Emergência e a
 * carteirinha precisam saber.
 *
 * Existe porque `doctor.config.ts` é um arquivo fixo com o telefone do
 * Dr. Clóvis, e o app é multi-médico: uma paciente vinculada a outro médico
 * via com um SOS que liga para o médico errado, e sai do hospital com uma
 * carteirinha nomeando um profissional que não a acompanha. Numa emergência
 * isso não é um detalhe de cadastro.
 *
 * Devolve `null` — e quem chama cai no `doctor.config` — em três casos, todos
 * legítimos: a paciente ainda não tem médico vinculado, o médico não
 * preencheu o WhatsApp, ou a tabela `doctors` ainda não existe no banco (as
 * migrations multi-tenant são posteriores à instalação atual). Nenhum deles
 * pode derrubar a tela.
 */
export type DoctorContato = {
  nome: string;
  title: string;
  specialty: string;
  crm: string;
  /** Como o médico digitou. Quem exibe/normaliza é `lib/telefone`. */
  whatsapp: string;
};

export const getMyDoctorContact = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const vazio = { ok: true as const, doctor: null as DoctorContato | null };
    try {
      const user = await requireUser(data.accessToken);
      if (!user) return vazio;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prof } = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("doctor_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof?.doctor_id) return vazio;
      const { data: d } = await (supabaseAdmin as any)
        .from("doctors")
        .select("display_name,title,specialty,crm,whatsapp")
        .eq("id", prof.doctor_id)
        .maybeSingle();
      if (!d?.display_name) return vazio;
      return {
        ok: true as const,
        doctor: {
          nome: d.display_name as string,
          title: (d.title as string) ?? "",
          specialty: (d.specialty as string) ?? "",
          crm: (d.crm as string) ?? "",
          whatsapp: (d.whatsapp as string) ?? "",
        } satisfies DoctorContato,
      };
    } catch {
      // Tabela ausente, rede caída, token vencido: a tela usa o padrão.
      return vazio;
    }
  });

/* ══════════════════════════════════════════════════════════════════════
   Convite do médico pela PACIENTE: ela gera um link pessoal; o médico que
   se cadastrar por ele ganha +15% de desconto em qualquer plano (mostrado
   no checkout) e, quando ele assinar, ELA ganha o Premium do app.
   ══════════════════════════════════════════════════════════════════════ */

function randomInviteCode(): string {
  // 8 chars legíveis (sem 0/O/1/I) — suficiente p/ unicidade com retry.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Código/link pessoal da paciente para convidar o médico dela. */
export const getMyDoctorInvite = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: prof, error } = await sb
      .from("patient_profiles")
      .select("invite_code")
      .eq("id", user.id)
      .maybeSingle();
    if (error?.code === "42703") return { ok: false as const, missingColumn: true as const };
    if (error) return { ok: false as const };

    let code = (prof?.invite_code as string | null) ?? null;
    if (!code) {
      // Gera com retry por colisão (índice único parcial em invite_code).
      for (let attempt = 0; attempt < 4 && !code; attempt++) {
        const candidate = randomInviteCode();
        const { error: upErr } = await sb
          .from("patient_profiles")
          .update({ invite_code: candidate })
          .eq("id", user.id)
          .is("invite_code", null);
        if (!upErr) code = candidate;
      }
      // Corrida consigo mesma (duas abas): relê o que ficou gravado.
      if (!code) {
        const { data: again } = await sb
          .from("patient_profiles")
          .select("invite_code")
          .eq("id", user.id)
          .maybeSingle();
        code = (again?.invite_code as string | null) ?? null;
      }
    }
    if (!code) return { ok: false as const };

    const { DOCTOR } = await import("@/lib/doctor.config");
    const link = `${DOCTOR.siteUrl}/medicos?convite=${code}`;
    return { ok: true as const, code, link };
  });

/**
 * Resolve um código de convite de paciente → id dela (server-only; usado no
 * cadastro do médico). Código inválido → null, sem vazar nada.
 */
export async function resolvePatientInviteCode(code: string): Promise<string | null> {
  try {
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z2-9]{6,12}$/.test(clean)) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("id")
      .eq("invite_code", clean)
      .maybeSingle();
    return (data?.id as string) ?? null;
  } catch {
    return null;
  }
}
