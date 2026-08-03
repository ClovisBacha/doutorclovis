/**
 * Oferta de boas-vindas — o lado servidor.
 *
 * O relógio nasce aqui, e é aqui que ele é conferido. O cliente pergunta
 * quanto falta; ele não escolhe, não estende e não reabre. Adiantar o relógio
 * do celular não muda nada, e limpar os dados do app também não — o instante
 * em que a janela abriu está no banco.
 *
 * A conta em si (preço, economia, quanto falta) mora em `promo.ts`, sem rede
 * e testada. Aqui fica só o que precisa de banco.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ANUAL_LISTA_CENTAVOS,
  DESCONTO_PCT,
  ECONOMIA_CENTAVOS,
  JANELA_MS,
  PROMO_CENTAVOS,
  PROMO_MENSAL_CENTAVOS,
  REFERENCIA_CENTAVOS,
  estaAberta,
  restanteMs,
} from "@/lib/promo";

export type OfertaBoasVindas = {
  /** A janela está aberta AGORA (medido no servidor)? */
  ativa: boolean;
  /** Quanto falta, em ms. 0 quando fechada. */
  restanteMs: number;
  descontoPct: number;
  /**
   * O preço RISCADO: um ano pagando mês a mês (R$ 19,90 × 12 = R$ 238,80).
   * É a base dos 61% e um preço REAL — por isso pode ser riscado, desde que a
   * tela diga o que ele é.
   */
  referenciaCentavos: number;
  /** O que ela paga no primeiro ano, em centavos. */
  promoCentavos: number;
  /** Quanto deixa de pagar, em centavos. */
  economiaCentavos: number;
  /**
   * Equivalente mensal do primeiro ano, em centavos.
   * "Equivalente" é literal: ×12 dá dois centavos a menos que o cobrado.
   */
  promoMensalCentavos: number;
  /**
   * Preço de lista do plano anual — para onde a renovação volta.
   * Vai junto para a tela nunca poder omitir esta terceira informação.
   */
  listaCentavos: number;
};

const FECHADA: OfertaBoasVindas = {
  ativa: false,
  restanteMs: 0,
  descontoPct: DESCONTO_PCT,
  referenciaCentavos: REFERENCIA_CENTAVOS,
  promoCentavos: PROMO_CENTAVOS,
  economiaCentavos: ECONOMIA_CENTAVOS,
  promoMensalCentavos: PROMO_MENSAL_CENTAVOS,
  listaCentavos: ANUAL_LISTA_CENTAVOS,
};

/**
 * Lê (e, na primeira vez, ABRE) a janela da paciente.
 *
 * Devolve sempre um objeto completo, mesmo fechada: a tela precisa dos preços
 * para mostrar o plano anual normal.
 *
 * Exportada como função comum — e não só como server fn — porque o checkout
 * precisa chamá-la de dentro do servidor para decidir se aplica o cupom. Se a
 * decisão morasse só no cliente, bastaria uma requisição forjada para comprar
 * com 61% depois de a promoção acabar.
 */
export async function lerOferta(uid: string): Promise<OfertaBoasVindas> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const agora = Date.now();

  const { data: prof, error } = await sb
    .from("patient_profiles")
    .select("promo_started_at, created_at, quiz_premium")
    .eq("id", uid)
    .maybeSingle();

  /* Já é Premium: não há o que oferecer, e mostrar contador para quem já
     assinou é o tipo de coisa que faz a paciente achar que pagou caro. */
  if (prof?.quiz_premium) return FECHADA;

  /* Coluna ausente (o APLICAR_PROMO.sql ainda não rodou): cai no nascimento da
     conta. Continua sendo um relógio de servidor, imutável e não-burlável —
     só alcança menos gente, porque quem se cadastrou ontem já passou da
     janela. Melhor isto do que fingir que a promoção não existe, e MUITO
     melhor do que guardar o relógio no aparelho. */
  const semColuna = error?.code === "42703" || (prof && !("promo_started_at" in prof));

  const registrado = !semColuna ? (prof?.promo_started_at as string | null | undefined) : null;
  if (registrado) {
    const abertaEm = new Date(registrado).getTime();
    return montar(abertaEm, agora);
  }

  if (semColuna) {
    const nascimento = prof?.created_at ? new Date(prof.created_at).getTime() : NaN;
    return montar(nascimento, agora);
  }

  /* Primeira vez que ela olha o preço: o relógio começa agora.
     `.is("promo_started_at", null)` fecha a corrida de dois aparelhos abrindo
     a oferta ao mesmo tempo — o segundo não reescreve o instante, senão
     bastaria abrir a tela de novo para ganhar mais 2h59. */
  const marcada = new Date(agora).toISOString();
  await sb
    .from("patient_profiles")
    .update({ promo_started_at: marcada })
    .eq("id", uid)
    .is("promo_started_at", null);

  /* Relê: se outro aparelho venceu a corrida, quem manda é o instante DELE. */
  const { data: depois } = await sb
    .from("patient_profiles")
    .select("promo_started_at")
    .eq("id", uid)
    .maybeSingle();
  const valeu = (depois?.promo_started_at as string | null) ?? marcada;
  return montar(new Date(valeu).getTime(), agora);
}

function montar(abertaEm: number, agora: number): OfertaBoasVindas {
  return {
    ...FECHADA,
    ativa: estaAberta(abertaEm, agora, JANELA_MS),
    restanteMs: restanteMs(abertaEm, agora, JANELA_MS),
  };
}

/** O que a tela chama ao abrir a oferta. */
export const getOfertaBoasVindas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return FECHADA;
      return await lerOferta(u.user.id);
    } catch (e) {
      /* Falha de banco fecha a promoção em vez de abri-la. Errar para o lado
         de não dar desconto é chato; errar para o outro é dar 61% a quem não
         tem direito, para sempre. */
      console.error("[getOfertaBoasVindas]", e);
      return FECHADA;
    }
  });
