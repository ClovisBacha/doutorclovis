import { createFileRoute } from "@tanstack/react-router";
import { paraLike } from "@/lib/like-seguro";
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

    /* ─── E A GRATIDÃO, QUE NUNCA PUXOU NINGUÉM DE VOLTA ──────────────────
     *
     * A aba tinha releitura, contador, carta para o bebê — e nenhum gancho
     * de retorno. O lembrete "de verdade" (por horário, todo dia) depende de
     * SQL que só o dono roda; este não depende de nada novo, porque usa o
     * MESMO cron que já está em produção e já está protegido.
     *
     * Aproveitado, e não duplicado: mesmo dia de disparo do resumo dentro do
     * app (domingo), e stateless pela mesma razão das lacunas do médico — sem
     * tabela de "já mandei", o controle é o dia da semana.
     */
    const gratidaoAvisadas = await nudgeGratidaoDaSemana();

    /* ─── E A CRIADORA, QUE SÓ SABIA ABRINDO A TELA ────────────────────────
     *
     * Nada — nem cron, nem e-mail, nem push — tocava em `affiliates` (o único
     * chamador era o webhook da Stripe). O que faz uma criadora postar de novo
     * não é o extrato: é saber que o link funcionou esta semana.
     *
     * Mesmo cron, mesmo padrão stateless dos dois trabalhos acima. Segunda, e
     * não domingo: domingo é o dia do resumo da PACIENTE.
     */
    const criadorasAvisadas = await resumoSemanalDasCriadoras();

    /* ─── E A REDE, QUE ANDAVA SEM NINGUÉM SABER ──────────────────────────
     *
     * A rede social manda UM push, e um só: o pedido para seguir. É deliberado
     * — reação não empurra ninguém, porque este é o mesmo canal do aviso de
     * emergência. O que faltava não era mais push: era UM, semanal, dizendo
     * que a rede dela andou. Sem ele, quem publica uma vez e não volta nunca
     * descobre que três amigas publicaram na quarta.
     *
     * Mesmo cron, mesmo padrão stateless, e MESMO DIA do resumo da Gratidão:
     * dois pushes do mesmo app em dias diferentes ensinam que ele fala demais.
     */
    const redeAvisadas = await resumoDaComunidade();

    return new Response(
      JSON.stringify({
        ok: true,
        notified,
        medicosAvisados,
        gratidaoAvisadas,
        criadorasAvisadas,
        redeAvisadas,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
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

/**
 * "N coisas boas esta semana" — o gancho de retorno que a Gratidão não tinha.
 *
 * ⚠️ SÓ AOS DOMINGOS, e pela MESMA razão do resumo dentro do app (que também
 * só existe aos domingos, com pelo menos duas gratidões da semana): domingo à
 * noite é quando ela ainda pode reler antes de a semana virar página, e é o
 * mesmo dia em que a tela dela já para pra olhar para trás.
 *
 * Stateless, como `cobrarLacunasParadas`: sem tabela de "já mandei", o
 * controle é o dia da semana — cada paciente recebe no máximo um push por
 * semana, porque o cron só entra nesta função uma vez por semana.
 */
async function nudgeGratidaoDaSemana(): Promise<number> {
  /* Fuso de Brasília, e não do processo — é o mesmo defeito de três horas que
     `cobrarLacunasParadas` já evita. */
  const hojeBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  if (hojeBR.getDay() !== 0) return 0;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPushToUser } = await import("@/lib/push.server");
  const { PREFIXO_GRATIDAO } = await import("@/lib/gratidao");
  const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: rows, error } = await (supabaseAdmin as any)
    .from("journal_entries")
    .select("user_id")
    .ilike("content", `${paraLike(PREFIXO_GRATIDAO)}%`)
    .gte("created_at", desde)
    .limit(5000);
  if (error) {
    console.error("[gratidão da semana] não consegui contar", error);
    return 0;
  }

  const porPaciente = new Map<string, number>();
  for (const r of (rows ?? []) as { user_id: string | null }[]) {
    if (!r.user_id) continue;
    porPaciente.set(r.user_id, (porPaciente.get(r.user_id) ?? 0) + 1);
  }
  if (!porPaciente.size) return 0;

  /* ⚠️ NUNCA EM MODO CUIDADO — mesma régua de `celebrate.ts`: celebração é
     alegria, e um push comemorando "coisas boas" não pode chegar a quem
     perdeu a gestação. Consultada DEPOIS de somar, contra só quem escreveu:
     ler `care_mode` de todo mundo seria varrer a base à toa. */
  const { data: emLuto, error: erroDoLuto } = await (supabaseAdmin as any)
    .from("patient_profiles")
    .select("id")
    .in("id", [...porPaciente.keys()])
    .eq("care_mode", true);
  /* ⚠️ **NÃO CONSEGUIU LER? NÃO MANDA NADA** — ver o mesmo bloco no resumo da
     Comunidade. O `error` era descartado e `data` vem `null` na falha, então o
     portão virava no-op e o push comemorando "coisas boas" chegava a quem
     perdeu a gestação. */
  if (erroDoLuto) {
    console.warn("[push-weekly] resumo da Gratidão pulado: não deu para ler o Modo Cuidado");
    return 0;
  }
  for (const p of (emLuto ?? []) as { id: string }[]) porPaciente.delete(p.id);

  let notificadas = 0;
  for (const [userId, n] of porPaciente) {
    const res = await sendPushToUser(userId, {
      title: n === 1 ? "1 coisa boa esta semana 💛" : `${n} coisas boas esta semana 💛`,
      body: "Quer reler o que você guardou?",
      url: "/minha-conta?tab=Caminho",
    });
    if (res.sent > 0) notificadas++;
  }
  return notificadas;
}

export const Route = createFileRoute("/api/push-weekly-tick")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

/**
 * O RESUMO SEMANAL DA CRIADORA — por e-mail, às segundas.
 *
 * A régua (o que pode ser dito, quando não mandar, o dia) mora em
 * `src/lib/resumo-da-criadora.ts`. Aqui é a leitura e o envio.
 *
 * ⚠️ **E-MAIL, e não push.** Ela pode não ter o app instalado — é parceira, não
 * paciente —, e o push deste app é o canal do aviso de EMERGÊNCIA. Ver o
 * cabeçalho da régua.
 *
 * ⚠️ **Sem `RESEND_API_KEY`, `sendEmail` é no-op silencioso.** O trabalho roda,
 * conta zero e não quebra nada — o mesmo comportamento de todo o resto do app.
 *
 * Stateless, como os dois trabalhos acima: sem tabela de "já mandei", o
 * controle é o dia da semana. O cron entra aqui uma vez por semana.
 */
async function resumoSemanalDasCriadoras(): Promise<number> {
  /* Fuso de Brasília, e não do processo — o mesmo defeito de três horas que os
     dois trabalhos acima evitam. */
  const hojeBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const { DIA_DO_RESUMO, assuntoDoResumo, corpoDoResumo, valeMandarResumo } =
    await import("@/lib/resumo-da-criadora");
  if (hojeBR.getDay() !== DIA_DO_RESUMO) return 0;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  /* ⚠️ Só afiliada ATIVA e COM e-mail: um código desligado não atribui nada, e
     sem e-mail não há para onde mandar. */
  const { data: afiliadas, error } = await sb
    .from("affiliates")
    .select("code, name, email, active")
    .eq("active", true)
    .not("email", "is", null)
    .limit(500);
  if (error) {
    console.error("[resumo da criadora] não consegui listar", error);
    return 0;
  }

  const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { sendEmail } = await import("@/lib/email.server");
  let mandados = 0;

  for (const a of (afiliadas ?? []) as {
    code: string;
    name: string | null;
    email: string | null;
  }[]) {
    if (!a.email) continue;
    try {
      /* ⚠️ **`head: true` e `count`, e nunca a LISTA.** O resumo diz quantas;
         trazer as linhas seria carregar para a memória do servidor exatamente
         os nomes que o e-mail não pode conter. */
      const [{ count: novas }, { count: total }] = await Promise.all([
        sb
          .from("patient_profiles")
          .select("id", { count: "exact", head: true })
          .eq("ref_code", a.code)
          .gte("created_at", desde),
        sb
          .from("patient_profiles")
          .select("id", { count: "exact", head: true })
          .eq("ref_code", a.code),
      ]);

      /* ⚠️ **`commission_cents`, e NUNCA `amount_cents`.** A coluna se chama
         assim (`APLICAR_PENDENTES.sql`: `commission_cents int`), e é a mesma
         que `meuPainelDeInfluenciadora` lê. Escrito errado, o PostgREST devolve
         `42703`, o `try/catch` engole, e a linha da comissão simplesmente nunca
         apareceria no e-mail — sem erro e sem log. É o mesmo mecanismo do
         `user_id` que deixou a legenda sugerida muda por semanas. */
      const { data: ganhos } = await sb
        .from("affiliate_earnings")
        .select("commission_cents")
        .eq("affiliate_code", a.code)
        .limit(1000);
      const centavos = ((ganhos ?? []) as { commission_cents: number | null }[]).reduce(
        (s, g) => s + (g.commission_cents ?? 0),
        0,
      );

      const numeros = { novas: novas ?? 0, total: total ?? 0, centavos };
      if (!valeMandarResumo(numeros)) continue;

      const { primeiroNome } = await import("@/lib/quem-convidou");
      /* ⚠️ `sendEmail` só aceita `html` — o corpo é texto puro e vira HTML
         aqui, com escape. Sem escapar, um nome com `<` viraria marcação no
         cliente de e-mail dela. */
      await sendEmail({
        to: a.email,
        subject: assuntoDoResumo(numeros),
        html: comoHtml(corpoDoResumo(numeros, primeiroNome(a.name))),
      });
      mandados += 1;
    } catch (e) {
      /* Uma criadora que falha não pode derrubar o resumo das outras. */
      console.error("[resumo da criadora] falhou para", a.code, e);
    }
  }
  return mandados;
}

/**
 * Texto puro vira HTML simples.
 *
 * ⚠️ **Escapa antes de trocar as quebras.** O único trecho variável é o nome
 * dela (`affiliates.name`, escrito pelo dono) e os números — mas um `<` num
 * nome viraria marcação, e a regra vale para todo texto que atravessa um
 * cliente de e-mail.
 */
function comoHtml(texto: string): string {
  const escapado = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6">${escapado.replace(/\n/g, "<br/>")}</div>`;
}

/**
 * O RESUMO SEMANAL DA COMUNIDADE — por push, aos domingos.
 *
 * A régua (o mínimo, o texto, o dia) mora em `src/lib/resumo-da-comunidade.ts`.
 * Aqui é a leitura e o envio.
 *
 * ⚠️ **DUAS CONSULTAS PARA A BASE INTEIRA, e nunca uma por paciente.** Um laço
 * "para cada paciente, conte os posts de quem ela segue" custaria uma ida ao
 * banco por conta — num cron semanal isso é o tipo de coisa que funciona com
 * cinquenta pacientes e derruba o trabalho com quinhentas. Lê-se o grafo de
 * seguir e os posts da semana, e cruza-se em memória.
 *
 * ⚠️ **Só a camada `publico`.** As camadas `seguidores` e `amigas` exigiriam
 * rodar `podeVerPost` para cada par — e um push que anunciasse uma publicação
 * que ela não pode abrir seria pior que nenhum push.
 *
 * ⚠️ **Nem `arquivado_em`.** Arquivar é tirar do ar; anunciar o que a autora
 * tirou é o app entregando o que ela recolheu.
 */
async function resumoDaComunidade(): Promise<number> {
  const { DIA_DO_RESUMO, textoDoResumo, valeResumoDaComunidade } =
    await import("@/lib/resumo-da-comunidade");
  /* Fuso de Brasília, e não do processo — o mesmo defeito de três horas que os
     outros trabalhos deste arquivo já evitam. */
  const hojeBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  if (hojeBR.getDay() !== DIA_DO_RESUMO) return 0;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPushToUser } = await import("@/lib/push.server");
  const sb = supabaseAdmin as any;
  const desde = new Date(Date.now() - 7 * 86_400_000).toISOString();

  /* Os posts da semana e o grafo de seguir, em paralelo: duas leituras
     independentes, e em série a segunda só sairia depois da primeira. */
  const [posts, laços] = await Promise.all([
    sb
      .from("rede_posts")
      .select("id, autor_id")
      .eq("visibilidade", "publico")
      .is("arquivado_em", null)
      .gte("criado_em", desde)
      .limit(5000),
    sb.from("rede_seguidores").select("seguidor_id, seguido_id").eq("estado", "ativo").limit(20000),
  ]);
  if (posts.error || laços.error) {
    console.error("[resumo da comunidade] não consegui ler", posts.error ?? laços.error);
    return 0;
  }

  /* Quantos posts cada AUTORA fez nesta semana. */
  const porAutora = new Map<string, number>();
  for (const p of (posts.data ?? []) as { autor_id: string }[]) {
    porAutora.set(p.autor_id, (porAutora.get(p.autor_id) ?? 0) + 1);
  }
  if (porAutora.size === 0) return 0;

  /* E o que isso vira para cada seguidora. */
  const daPaciente = new Map<string, { publicacoes: number; pessoas: number }>();
  for (const l of (laços.data ?? []) as { seguidor_id: string; seguido_id: string }[]) {
    const n = porAutora.get(l.seguido_id);
    if (!n) continue;
    /* ⚠️ Ela não conta a si mesma: seguir a si é impossível hoje, mas um
       resumo que somasse os posts DELA diria "3 pessoas publicaram" sobre a
       própria semana dela. */
    if (l.seguidor_id === l.seguido_id) continue;
    const atual = daPaciente.get(l.seguidor_id) ?? { publicacoes: 0, pessoas: 0 };
    atual.publicacoes += n;
    atual.pessoas += 1;
    daPaciente.set(l.seguidor_id, atual);
  }
  if (daPaciente.size === 0) return 0;

  /* ⚠️ MODO CUIDADO, consultado DEPOIS de somar e só contra quem tem resumo:
     ler `care_mode` de toda a base seria varrê-la à toa. É o mesmo recorte do
     resumo da Gratidão. */
  const { data: emLuto, error: erroDoLuto } = await sb
    .from("patient_profiles")
    .select("id")
    .in("id", [...daPaciente.keys()])
    .eq("care_mode", true);
  /* ⚠️ **NÃO CONSEGUIU LER? NÃO MANDA NADA.**
     O `error` era descartado, e `data` vem `null` quando a consulta falha — o
     conjunto saía VAZIO e o portão do luto virava um no-op: TODA paciente em
     Modo Cuidado recebia o resumo da Comunidade. É o Modo Cuidado falhando
     ABERTO, no canal do aviso de emergência, para quem acabou de perder a
     gestação.
     Este resumo é um agrado, não uma necessidade: não mandar por uma noite não
     custa nada, e mandar para a pessoa errada custa o que não se desfaz. */
  if (erroDoLuto) {
    console.warn("[push-weekly] resumo da Comunidade pulado: não deu para ler o Modo Cuidado");
    return 0;
  }
  const luto = new Set(((emLuto ?? []) as { id: string }[]).map((p) => p.id));

  let notificadas = 0;
  for (const [userId, fatos] of daPaciente) {
    const f = { ...fatos, emCuidado: luto.has(userId) };
    if (!valeResumoDaComunidade(f)) continue;
    const { titulo, corpo } = textoDoResumo(f);
    const res = await sendPushToUser(userId, {
      title: titulo,
      body: corpo,
      /* O rótulo EXATO de `TABS` — `minha-conta` ignora em silêncio o que não
         bate, e um deep-link errado leva ao lugar de sempre sem erro nenhum. */
      url: "/minha-conta?tab=Feed",
    });
    if (res.sent > 0) notificadas++;
  }
  return notificadas;
}
