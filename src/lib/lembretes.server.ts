/**
 * A VARREDURA DOS LEMBRETES — em `lib/`, e não no arquivo da rota.
 *
 * ⚠️ **Ela nasceu dentro de `routes/api/lembretes-tick.ts` e a catraca pegou.**
 * `rotas-sem-export-solto.test.ts` existe porque um export não-rota num arquivo
 * de rota sai do pedaço DAQUELA rota e entra no da árvore de rotas — que é o
 * que toda página carrega antes de qualquer coisa aparecer. Foi assim que
 * `PainelDaEmbaixadora` custou 11 kB na entrada. A rota agora só importa.
 */
export const INTERVALO_MINIMO_MS = 10 * 60 * 1000;

let ultimaVarredura = 0;

export type ResultadoDaVarredura = { enviados: number; avaliados: number };

/**
 * Roda a varredura, respeitando o estrangulador.
 *
 * `forcar: true` é do CRON — ele é a fonte proativa e não deve ser estrangulado
 * por uma visita de paciente que aconteceu um minuto antes.
 */
export async function varrerLembretes(
  opts: { forcar?: boolean; agora?: number } = {},
): Promise<ResultadoDaVarredura | null> {
  const agora = opts.agora ?? Date.now();
  if (!opts.forcar && agora - ultimaVarredura < INTERVALO_MINIMO_MS) return null;
  ultimaVarredura = agora;
  return await trabalho();
}

/** Só para teste: devolve o estrangulador ao estado inicial. */
export function zerarEstrangulador(): void {
  ultimaVarredura = 0;
}

async function trabalho(): Promise<ResultadoDaVarredura> {
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
       leitura — e é o mesmo canal por onde chega a emergência.

       `preconsulta_forms`, e não `pre_consultation_forms`: escrevi o nome
       errado na primeira versão e o efeito era invisível — a leitura falhava,
       `preIndisponivel` virava true, e o pedido de pré-consulta NUNCA saía.
       Nenhum erro na tela, nenhum log, nenhum push. O teste ao lado deste
       arquivo agora confere cada `.from()` contra o schema. */
    (supabaseAdmin as any)
      .from("preconsulta_forms")
      .select("user_id")
      .gte("submitted_at", new Date(agora.getTime() - 20 * 86400_000).toISOString()),
  ]);

  /* Sem a tabela de registro, NÃO manda nada. Enviar sem poder registrar é
     exatamente o cenário de repetir de hora em hora. */
  if (enviados.error) {
    /* ⚠️ Sem a tabela de registro NÃO manda nada — enviar sem poder registrar é
       exatamente o cenário de repetir de hora em hora. Sai como ZERO enviados,
       não como exceção: quem chama de forma preguiçosa (a tela de consultas da
       paciente) não pode quebrar porque o SQL dos lembretes não foi aplicado. */
    const { faltaNoBanco } = await import("@/lib/postgrest");
    console.warn(
      faltaNoBanco(enviados.error)
        ? "lembretes: rode o APLICAR_LEMBRETES.sql no Supabase"
        : "lembretes: não consegui ler os já enviados",
      enviados.error,
    );
    return { enviados: 0, avaliados: 0 };
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
  if (vencidos.length === 0) return { enviados: 0, avaliados: compromissos.length };

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

  return { enviados: contados, avaliados: compromissos.length };
}
