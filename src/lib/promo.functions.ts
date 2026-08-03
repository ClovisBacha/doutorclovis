/**
 * Oferta de boas-vindas — o lado servidor.
 *
 * Quem decide se há desconto é ESTE arquivo, e ele decide duas vezes: quando a
 * tela pergunta, e de novo quando o checkout é criado. Uma requisição forjada
 * não compra com desconto.
 *
 * A regra é uma só: **tem direito quem nunca assinou o Premium.** Não há
 * contador nem janela de horas — havia, e saiu, porque a paciente vai assinar
 * dentro do app e o molde que a loja oferece para isto é a oferta introdutória,
 * que vale para quem nunca assinou e não tem prazo por pessoa. Ver
 * `docs/plano-iap.md`.
 *
 * A conta (preços, economia) mora em `promo.ts`, sem rede e testada.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ANUAL_LISTA_CENTAVOS,
  DESCONTO_PCT,
  ECONOMIA_CENTAVOS,
  PROMO_CENTAVOS,
  PROMO_MENSAL_CENTAVOS,
  REFERENCIA_CENTAVOS,
} from "@/lib/promo";

export type OfertaBoasVindas = {
  /** Tem direito ao desconto (medido no servidor)? */
  ativa: boolean;
  descontoPct: number;
  /**
   * O preço RISCADO: um ano pagando mês a mês (R$ 19,90 × 12 = R$ 238,80).
   * É a base dos 62% e um preço REAL — por isso pode ser riscado, desde que a
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

const PRECOS = {
  descontoPct: DESCONTO_PCT,
  referenciaCentavos: REFERENCIA_CENTAVOS,
  promoCentavos: PROMO_CENTAVOS,
  economiaCentavos: ECONOMIA_CENTAVOS,
  promoMensalCentavos: PROMO_MENSAL_CENTAVOS,
  listaCentavos: ANUAL_LISTA_CENTAVOS,
};

const SEM_DIREITO: OfertaBoasVindas = { ativa: false, ...PRECOS };

/**
 * A paciente tem direito à oferta de boas-vindas?
 *
 * Exportada como função comum — e não só como server fn — porque o checkout
 * precisa chamá-la de dentro do servidor para decidir se aplica o cupom.
 */
export async function lerOferta(uid: string): Promise<OfertaBoasVindas> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  /* Já é Premium: não há o que oferecer, e mostrar desconto para quem já
     assinou é o que faz a paciente achar que pagou caro. */
  const { data: prof } = await sb
    .from("patient_profiles")
    .select("quiz_premium")
    .eq("id", uid)
    .maybeSingle();
  if (prof?.quiz_premium) return SEM_DIREITO;

  /* Já assinou alguma vez? `subscriptions` é o system of record e guarda o
     histórico — inclusive de quem cancelou. Quem já foi Premium um dia não é
     "boas-vindas" de novo, e é exatamente assim que a oferta introdutória da
     loja funciona: uma vez por pessoa, para sempre. */
  const { data: antiga } = await sb
    .from("subscriptions")
    .select("id")
    .eq("user_id", uid)
    .eq("product", "quiz_premium")
    .limit(1)
    .maybeSingle();
  if (antiga) return SEM_DIREITO;

  return { ativa: true, ...PRECOS };
}

/** O que a tela chama ao abrir a oferta. */
export const getOfertaBoasVindas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return SEM_DIREITO;
      return await lerOferta(u.user.id);
    } catch (e) {
      /* Falha de banco tira a promoção em vez de dar. Errar para o lado de não
         descontar é chato; errar para o outro é dar 62% a quem não tem
         direito. */
      console.error("[getOfertaBoasVindas]", e);
      return SEM_DIREITO;
    }
  });
