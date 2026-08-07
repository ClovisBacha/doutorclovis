/**
 * A MESADA DE SEMENTINHAS DO MÉDICO.
 *
 * ─── A IDEIA ────────────────────────────────────────────────────────────────
 *
 * O médico ganha, todo mês, um bolso de Sementinhas para presentear as
 * pacientes dele. O tamanho do bolso é `mensagens contratadas × 3` — ver
 * `economia-sementinhas.ts` para por que essa razão se calibra sozinha.
 *
 * ─── O QUE ISSO SUBSTITUI ───────────────────────────────────────────────────
 *
 * O médico dava Premium DE GRAÇA para um punhado de pacientes por mês
 * (`premiumInvitesPerMonth`). Aquilo tinha dois problemas: dava a assinatura
 * inteira (a receita que a plataforma vive de vender) e não funcionava nos apps
 * de iOS e Android, porque desconto de assinatura ali é a loja quem dá.
 *
 * Sementinha não passa por Stripe, Apple nem Google — é uma linha no nosso
 * banco. Funciona igual nas três plataformas, e o custo para a plataforma é
 * **zero**: Sementinha compra conteúdo estático.
 *
 * ─── E ELA ACELERA A CONVERSÃO, NÃO A SUBSTITUI ─────────────────────────────
 *
 * Este é o ponto que faz o desenho valer. Quanto mais generoso o médico é, mais
 * rápido a paciente compra os 15 itens grátis e passa a acumular moeda sem ter
 * no que gastar — olhando 57 itens bloqueados que ela JÁ pode pagar. O presente
 * dele empurra a assinatura em vez de adiar.
 *
 * ─── O CICLO É O MESMO DA COTA DE IA ────────────────────────────────────────
 *
 * `inicioDoCiclo()`, o mesmo de `cota-ia.server`. Duas noções de "este mês" no
 * mesmo painel é como o placar do cérebro e o card de consumo passaram a
 * discordar — o comentário de lá conta a história inteira.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PRESENTE_SUGERIDO, mesadaDoMedico } from "@/lib/economia-sementinhas";

/**
 * O médico da sessão — cópia local, como fazem `secondbrain`, `clinical`,
 * `admin` e `dashboard`.
 *
 * Nenhum desses arquivos exporta a sua versão, e exportar uma agora criaria um
 * acoplamento novo entre módulos que hoje só compartilham o banco. Cinco cópias
 * de dez linhas é feio; um import cruzado entre cinco módulos de domínio é pior.
 */
async function medicoDaSessao(accessToken: string): Promise<{ id: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
  if (!u.user) return null;
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", u.user.id)
    .maybeSingle();
  return doc && doc.active !== false ? { id: u.user.id } : null;
}

/** A razão gravada no ledger — é por ela que a mesada é contada de volta. */
export const RAZAO_PRESENTE = "presente-do-medico";

export type EstadoDaMesada = {
  /** O bolso do mês, em Sementinhas. */
  total: number;
  /** Quanto já foi presenteado neste ciclo. */
  usado: number;
  /** O que sobra. */
  restante: number;
  /** O valor sugerido no botão de um clique. */
  sugerido: number;
};

/**
 * Quantas mensagens o médico contratou.
 *
 * A mesada é do TAMANHO DO PLANO, então ela precisa do mesmo número que a cota
 * de IA usa. Enquanto a coluna do Stripe não existir, cai no teto do plano —
 * e devolver 0 aqui seria pior que estimar: o médico veria "mesada zerada" sem
 * ter feito nada.
 */
async function mensagensContratadas(sb: any, doctorId: string): Promise<number> {
  const { getEntitlementsByDoctorId } = await import("@/lib/entitlements.server");
  const ent = await getEntitlementsByDoctorId(doctorId);
  /* `null` = ilimitado (contrato de Clínica). A mesada não pode ser infinita:
     ali o combinado é do contrato, e o teto entra pela mesma porta que o resto
     do acordo. Até lá, o topo do autoatendimento é o limite honesto. */
  if (ent.aiRepliesPerCycle === null) {
    const { TETO_AUTOATENDIMENTO } = await import("@/lib/planos-medico");
    return TETO_AUTOATENDIMENTO;
  }
  return ent.aiRepliesPerCycle ?? 0;
}

/** Lê a mesada do ciclo — exportada para o checkout do presente reusar. */
export async function lerMesada(sb: any, doctorId: string): Promise<EstadoDaMesada> {
  const total = mesadaDoMedico(await mensagensContratadas(sb, doctorId));
  const { inicioDoCiclo } = await import("@/lib/cota-ia.server");

  /* O gasto vem do LEDGER DA PACIENTE, filtrado pela razão que carrega o id do
     médico. É a mesma linha que creditou a paciente: uma fonte só, e nenhuma
     chance de o painel dizer um número e o extrato dela dizer outro. */
  const { data, error } = await sb
    .from("sementinhas_ledger")
    .select("amount")
    .eq("reason", RAZAO_PRESENTE)
    .like("dedupe_key", `presente:${doctorId}:%`)
    .gte("created_at", inicioDoCiclo().toISOString())
    .limit(5000);

  /* Falha de leitura → mesada ZERADA, não cheia. Errar para o lado de não
     presentear é chato; errar para o outro deixa o médico distribuir sem teto
     e some com a única trava que existe. */
  if (error) return { total, usado: total, restante: 0, sugerido: PRESENTE_SUGERIDO };

  const usado = ((data ?? []) as { amount: number }[]).reduce((s, l) => s + (l.amount ?? 0), 0);
  return {
    total,
    usado,
    restante: Math.max(0, total - usado),
    sugerido: PRESENTE_SUGERIDO,
  };
}

/** O que o painel chama para desenhar o card da mesada. */
export const getMesada = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { ok: true as const, mesada: await lerMesada(supabaseAdmin as any, user.id) };
  });

/**
 * Presenteia UMA paciente.
 *
 * As três travas, e cada uma fecha um buraco diferente:
 *
 *  1. **Vínculo ATUAL** — só paciente dele HOJE. `patient_profiles.doctor_id`,
 *     nunca um carimbo histórico. É a mesma régua que `responderPergunta` e
 *     `answerAndTrain` usam, e pelo mesmo motivo: presente é uma mensagem, e
 *     mandar mensagem para ex-paciente é o que a régua existe para impedir.
 *  2. **Teto da mesada** — conferido DEPOIS de gravar, e revertido se estourar.
 *     Conferir antes deixa uma janela em que dois cliques simultâneos passam
 *     dos dois lados do `if`. É a mesma correção que `platform_coupons` já tinha.
 *  3. **Um presente por paciente por ciclo** — a `dedupeKey` carrega o ciclo, e
 *     o índice único do ledger faz o resto. Sem isso, dez cliques dão dez
 *     presentes e a mesada some num minuto.
 */
export const presentearPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        patientId: z.string().uuid(),
        /* Quanto dar. O padrão é o sugerido; o médico pode mudar, mas não pode
           dar mais que a mesada nem um valor absurdo numa paciente só. */
        quantidade: z.number().int().min(1).max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const user = await medicoDaSessao(data.accessToken);
    if (!user) return { ok: false as const, error: "sem_permissao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const doctorId = user.id;
    const quanto = data.quantidade ?? PRESENTE_SUGERIDO;

    /* 1. VÍNCULO ATUAL. */
    const { data: dela } = await sb
      .from("patient_profiles")
      .select("id")
      .eq("id", data.patientId)
      .eq("doctor_id", doctorId)
      .maybeSingle();
    if (!dela) return { ok: false as const, error: "sem_vinculo" as const };

    const mesada = await lerMesada(sb, doctorId);
    if (quanto > mesada.restante) {
      return { ok: false as const, error: "mesada_esgotada" as const, mesada };
    }

    /* Modo Cuidado não recebe gamificação. Presentear quem acabou de perder a
       gestação com moedinhas de decoração é o oposto do cuidado. */
    const { isCareModeActive } = await import("@/lib/care-mode.functions");
    if (await isCareModeActive(supabaseAdmin as never, data.patientId)) {
      return { ok: false as const, error: "modo_cuidado" as const };
    }

    const { inicioDoCiclo } = await import("@/lib/cota-ia.server");
    const ciclo = inicioDoCiclo().toISOString().slice(0, 7);
    /* 3. UM POR PACIENTE POR CICLO — a chave carrega médico, paciente e ciclo,
          e o índice único de `sementinhas_ledger` recusa o segundo. */
    const dedupeKey = `presente:${doctorId}:${data.patientId}:${ciclo}`;

    const { grantSementinhas } = await import("@/lib/sementinhas.functions");
    const { typedDb } = await import("@/integrations/supabase/types.extended");
    await grantSementinhas(typedDb(supabaseAdmin as never), data.patientId, [
      { amount: quanto, reason: RAZAO_PRESENTE, dedupeKey },
    ]);

    /* 2. O TETO, CONFERIDO DEPOIS. Se dois cliques simultâneos passaram, o
          segundo desfaz o próprio presente — a mesma correção de TOCTOU que o
          resgate de cupom de plataforma já tinha. */
    const depois = await lerMesada(sb, doctorId);
    if (depois.usado > depois.total) {
      await sb
        .from("sementinhas_ledger")
        .delete()
        .eq("user_id", data.patientId)
        .eq("dedupe_key", dedupeKey);
      return { ok: false as const, error: "mesada_esgotada" as const, mesada: depois };
    }

    return { ok: true as const, mesada: depois, quantidade: quanto };
  });
