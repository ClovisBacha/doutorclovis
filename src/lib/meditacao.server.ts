/**
 * A VARREDURA DO LEMBRETE DE MEDITAÇÃO — em `lib/`, e não no arquivo da rota.
 *
 * ⚠️ **ESTE É O SEGUNDO CRON QUE NÃO ESTÁ AGENDADO.** `vercel.json` declara só
 * o `push-weekly-tick`; este depende de cron EXTERNO e, sem ele, o lembrete
 * diário nunca sai. Ganhou a mesma redundância da fila de espera e dos
 * lembretes de consulta: também roda preguiçosamente, na abertura do app.
 *
 * ⚠️ **O que impede o spam continua sendo o CARIMBO, não a varredura.** A régua
 * conta em HORAS (nunca em dias do calendário: um lembrete às 21h de São Paulo
 * é 00:00 UTC, e por dia ele sairia às 23:55 e de novo às 00:10), e o carimbo é
 * gravado ANTES do envio. Chamar dez vezes manda no máximo uma.
 *
 * ⚠️ **Fica em `lib/` porque export não-rota em arquivo de rota engorda a
 * árvore de rotas**, que toda página carrega — `rotas-sem-export-solto.test.ts`
 * cobra isso, e cobrou de mim na primeira tentativa deste conserto.
 */
export const INTERVALO_MINIMO_MS = 10 * 60 * 1000;

let ultimaVarredura = 0;

export type ResultadoDaMeditacao = {
  enviados: number;
  jaMeditaram: number;
  avaliados: number;
};

/** `forcar: true` é do CRON — a fonte proativa não é estrangulada pela oportunista. */
export async function varrerLembretesDeMeditacao(
  opts: { forcar?: boolean; agora?: number } = {},
): Promise<ResultadoDaMeditacao | null> {
  const agora = opts.agora ?? Date.now();
  if (!opts.forcar && agora - ultimaVarredura < INTERVALO_MINIMO_MS) return null;
  ultimaVarredura = agora;
  return await trabalho();
}

/** Só para teste. */
export function zerarEstranguladorDaMeditacao(): void {
  ultimaVarredura = 0;
}

async function trabalho(): Promise<ResultadoDaMeditacao> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { diaDela, estaNaHora, meditouEm, textoDoLembrete } =
    await import("@/lib/lembrete-de-meditacao");
  const { sequenciaAteODia } = await import("@/lib/sequencia");
  const { sendPushToUser } = await import("@/lib/push.server");

  const agora = new Date();

  /* Só quem pediu. O índice parcial do SQL existe para esta linha. */
  const { data: perfis, error } = await (supabaseAdmin as any)
    .from("patient_profiles")
    .select("id, med_reminder_utc_min, med_reminder_offset, med_reminder_sent_at, care_mode")
    .not("med_reminder_utc_min", "is", null);

  if (error) {
    /* Coluna ainda não criada no banco (o SQL não foi aplicado) responde
       aqui, e responder 200 é de propósito: um cron que recebe 500 de hora
       em hora vira alarme, e não há nada de errado em o recurso ainda não
       existir. */
    /* Sai como ZERO, não como exceção: quem chama de forma preguiçosa (a
       abertura do app) não pode quebrar porque o SQL do lembrete não foi
       aplicado. */
    return { enviados: 0, jaMeditaram: 0, avaliados: 0 };
  }

  type Perfil = {
    id: string;
    med_reminder_utc_min: number | null;
    med_reminder_offset: number | null;
    med_reminder_sent_at: string | null;
    care_mode: boolean | null;
  };

  const candidatas = ((perfis ?? []) as Perfil[]).filter((p) =>
    estaNaHora(
      {
        id: p.id,
        utcMin: p.med_reminder_utc_min,
        offset: p.med_reminder_offset ?? 0,
        enviadoEm: p.med_reminder_sent_at ? new Date(p.med_reminder_sent_at) : null,
        careMode: Boolean(p.care_mode),
      },
      agora,
    ),
  );

  if (!candidatas.length) return { enviados: 0, jaMeditaram: 0, avaliados: perfis?.length ?? 0 };

  /* Uma consulta para todas: uma por paciente seria N viagens por passada. */
  const { data: jornadas, error: erroJornada } = await (supabaseAdmin as any)
    .from("journey_state")
    .select("user_id, data")
    .in(
      "user_id",
      candidatas.map((p) => p.id),
    );

  if (erroJornada) {
    console.error("meditacao-tick: journey_state ilegível", erroJornada);
    return { enviados: 0, jaMeditaram: 0, avaliados: 0 };
  }

  const blobDe = new Map<string, unknown>(
    ((jornadas ?? []) as { user_id: string; data: unknown }[]).map((j) => [j.user_id, j.data]),
  );

  let enviados = 0;
  let jaMeditaram = 0;

  for (const p of candidatas) {
    const offset = p.med_reminder_offset ?? 0;
    const hoje = diaDela(agora, offset);
    const blob = blobDe.get(p.id) ?? null;

    if (meditouEm(blob, hoje)) {
      jaMeditaram++;
      continue;
    }

    /* ⚠️ REGISTRA ANTES DE MANDAR. Se o push falhar, ela perde UM lembrete;
       se o registro falhar depois de um push bem-sucedido, ela recebe um por
       hora até o fim do dia. */
    const { error: erroCarimbo } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .update({ med_reminder_sent_at: agora.toISOString() })
      .eq("id", p.id);
    if (erroCarimbo) {
      console.error("meditacao-tick: carimbo falhou, não mandei", erroCarimbo);
      continue;
    }

    const dias = ((blob as Record<string, { dias?: unknown }> | null)?.["dc-path-med-log"]?.dias ??
      []) as string[];
    /* A sequência é a DELA, no calendário DELA — ver `sequenciaAteODia`. */
    const seq = sequenciaAteODia(Array.isArray(dias) ? dias : [], hoje);
    const { title, body } = textoDoLembrete(seq);

    await sendPushToUser(p.id, { title, body, url: "/minha-conta?tab=Caminho" });
    enviados++;
  }

  return { enviados, jaMeditaram, avaliados: candidatas.length };
}
