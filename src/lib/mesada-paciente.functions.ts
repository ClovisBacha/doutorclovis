/**
 * A MESADA DA PACIENTE PREMIUM — presentear as amigas que ela trouxe.
 *
 * ─── A IDEIA ────────────────────────────────────────────────────────────────
 *
 * Quem assina ganha, todo mês, um bolso de Sementinhas para dar às amigas que
 * indicou. É o mesmo desenho da mesada do médico, do outro lado do app: quem
 * paga vira quem PRESENTEIA, e a comunidade cresce porque alguém de dentro
 * puxa alguém de fora.
 *
 * ─── POR QUE ISTO NÃO É "MAIS UM BÔNUS" ─────────────────────────────────────
 *
 * A indicação já dava 100 🌱 à indicadora quando a amiga cria a conta
 * (`referral.functions.ts`). Aquilo premia quem TRAZ. Isto é diferente: dá a
 * ela algo para DAR — e presentear é o que faz voltar para ver se a outra
 * recebeu.
 *
 * ─── SÓ PARA QUEM ASSINA, E ISSO É O PONTO ──────────────────────────────────
 *
 * O bolso é um benefício do Premium. Dar a todas tiraria a razão de assinar e
 * transformaria a economia num torneira aberta: a loja grátis é calibrada para
 * ser zerada em quinze dias, e Sementinha entrando de graça por fora derruba a
 * parede que faz a assinatura acontecer.
 *
 * ─── AS MESMAS QUATRO TRAVAS DA MESADA DO MÉDICO ────────────────────────────
 *
 * Não por simetria estética: cada uma fecha um buraco que já foi medido lá.
 *  1. só quem ela REALMENTE indicou (`referred_by`), nunca um id qualquer;
 *  2. teto do bolso conferido ANTES da escrita;
 *  3. uma amiga por ciclo, com o índice único do ledger fazendo o resto;
 *  4. Modo Cuidado não recebe gamificação — de nenhum lado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MESADA_DA_ASSINANTE, PRESENTE_ENTRE_AMIGAS } from "@/lib/economia-sementinhas";

/** A razão gravada no ledger — é por ela que o bolso é contado de volta. */
export const RAZAO_PRESENTE_AMIGA = "presente-de-amiga";

export type EstadoDaMesadaAmiga = {
  /** Ela assina? Sem Premium não há bolso, e a tela nem aparece. */
  assinante: boolean;
  total: number;
  usado: number;
  restante: number;
  sugerido: number;
};

const SEM_BOLSO: EstadoDaMesadaAmiga = {
  assinante: false,
  total: 0,
  usado: 0,
  restante: 0,
  sugerido: PRESENTE_ENTRE_AMIGAS,
};

async function pacienteDaSessao(accessToken: string): Promise<{ id: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.getUser(accessToken);
  return u.user ? { id: u.user.id } : null;
}

/** Lê o bolso do ciclo. Exportada para o presente reusar a mesma conta. */
export async function lerMesadaDaAmiga(sb: any, uid: string): Promise<EstadoDaMesadaAmiga> {
  const { data: prof, error: profErr } = await sb
    .from("patient_profiles")
    .select("quiz_premium")
    .eq("id", uid)
    .maybeSingle();

  /* Falha de leitura → SEM bolso. Errar para o lado de não presentear é chato;
     errar para o outro dá o benefício do Premium a quem não assinou. */
  if (profErr || !prof?.quiz_premium) return SEM_BOLSO;

  const { inicioDoCiclo } = await import("@/lib/cota-ia.server");
  const { data, error } = await sb
    .from("sementinhas_ledger")
    .select("amount")
    .eq("reason", RAZAO_PRESENTE_AMIGA)
    .like("dedupe_key", `amiga:${uid}:%`)
    .gte("created_at", inicioDoCiclo().toISOString())
    .limit(1000);

  if (error) {
    return {
      assinante: true,
      total: MESADA_DA_ASSINANTE,
      usado: MESADA_DA_ASSINANTE,
      restante: 0,
      sugerido: PRESENTE_ENTRE_AMIGAS,
    };
  }

  const usado = ((data ?? []) as { amount: number }[]).reduce((s, l) => s + (l.amount ?? 0), 0);
  return {
    assinante: true,
    total: MESADA_DA_ASSINANTE,
    usado,
    restante: Math.max(0, MESADA_DA_ASSINANTE - usado),
    sugerido: PRESENTE_ENTRE_AMIGAS,
  };
}

/** O que a tela chama para desenhar o cartão. */
export const getMesadaDaAmiga = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const me = await pacienteDaSessao(data.accessToken);
    if (!me) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const mesada = await lerMesadaDaAmiga(sb, me.id);

    /* As amigas que ela trouxe — a lista de quem pode receber. Vem daqui e não
       da tela porque `referred_by` é a única prova de que a indicação existiu:
       aceitar um id vindo do cliente deixaria presentear qualquer pessoa. */
    const { data: amigas } = await sb
      .from("patient_profiles")
      .select("id,display_name")
      .eq("referred_by", me.id)
      .limit(100);

    return {
      ok: true as const,
      mesada,
      amigas: ((amigas ?? []) as { id: string; display_name: string | null }[]).map((a) => ({
        id: a.id,
        nome: (a.display_name ?? "").trim() || "Amiga",
      })),
    };
  });

/** Presenteia UMA amiga. */
export const presentearAmiga = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        amigaId: z.string().uuid(),
        quantidade: z.number().int().min(1).max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const me = await pacienteDaSessao(data.accessToken);
    if (!me) return { ok: false as const, error: "sem_permissao" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const uid = me.id;
    const quanto = data.quantidade ?? PRESENTE_ENTRE_AMIGAS;

    /* Presentear a si mesma seria uma torneira: o bolso do Premium viraria
       saldo próprio todo mês. */
    if (data.amigaId === uid) return { ok: false as const, error: "voce_mesma" as const };

    /* 1. ELA INDICOU MESMO. `referred_by` é fixado uma vez e nunca reescrito
          (ver `attributeReferral`), então não há como forjar a relação depois. */
    const { data: amiga } = await sb
      .from("patient_profiles")
      .select("id")
      .eq("id", data.amigaId)
      .eq("referred_by", uid)
      .maybeSingle();
    if (!amiga) return { ok: false as const, error: "nao_indicada" as const };

    /* 2. TETO, antes de escrever. */
    const mesada = await lerMesadaDaAmiga(sb, uid);
    if (!mesada.assinante) return { ok: false as const, error: "sem_premium" as const };
    if (quanto > mesada.restante) {
      return { ok: false as const, error: "mesada_esgotada" as const, mesada };
    }

    /* 3. Modo Cuidado — de quem RECEBE. */
    const { isCareModeActive } = await import("@/lib/care-mode.functions");
    if (await isCareModeActive(supabaseAdmin as never, data.amigaId)) {
      return { ok: false as const, error: "modo_cuidado" as const };
    }

    const { inicioDoCiclo } = await import("@/lib/cota-ia.server");
    const ciclo = inicioDoCiclo().toISOString().slice(0, 7);
    /* 4. UMA POR CICLO. A chave carrega quem dá, quem recebe e o mês. */
    const dedupeKey = `amiga:${uid}:${data.amigaId}:${ciclo}`;

    /* ─── "ENVIADO" SÓ SE FOI MESMO — E A VERSÃO ANTERIOR MENTIA ──────────
     *
     * `grantSementinhas` usa `ignoreDuplicates: true`: um segundo presente à
     * mesma pessoa no mesmo ciclo é DO NOTHING, sem erro.
     *
     * A conferência anterior relia a linha e só acusava repetição quando o
     * valor gravado DIFERIA do novo — ou seja, ela pegava "mandei 50 e agora
     * 300", e deixava passar o caso mais comum de todos: **mandar o mesmo valor
     * duas vezes**. Dois toques no mesmo botão devolviam `ok: true` nas duas, a
     * tela dizia "enviado" duas vezes, e a segunda não escreveu nada.
     *
     * Um verificador adversarial achou isso nos DOIS lados, com o comentário
     * acima dele afirmando o contrário. A régua certa é a EXISTÊNCIA da linha
     * antes da escrita, não o valor dela depois.
     */
    const { data: jaExistia } = await sb
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", data.amigaId)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    if (jaExistia) {
      return { ok: false as const, error: "ja_presenteada" as const, mesada };
    }

    const { grantSementinhas } = await import("@/lib/sementinhas.functions");
    const { typedDb } = await import("@/integrations/supabase/types.extended");
    await grantSementinhas(typedDb(supabaseAdmin as never), data.amigaId, [
      { amount: quanto, reason: RAZAO_PRESENTE_AMIGA, dedupeKey },
    ]);

    /* E confere que a escrita aconteceu: entre a leitura acima e esta linha
       cabe um clique simultâneo, e o índice único do ledger recusa o segundo.
       Quem perder a corrida ouve "já presenteada", que é a verdade. */
    const { data: gravou } = await sb
      .from("sementinhas_ledger")
      .select("amount")
      .eq("user_id", data.amigaId)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    const depois = await lerMesadaDaAmiga(sb, uid);
    if (!gravou) return { ok: false as const, error: "nao_gravou" as const, mesada: depois };

    return { ok: true as const, mesada: depois, quantidade: quanto };
  });
