/**
 * O desconto da paciente — o lado servidor.
 *
 * ─── A OFERTA DE BOAS-VINDAS FOI APOSENTADA (ago/2026) ─────────────────────
 *
 * Ela dava 62% no primeiro ano do anual, automaticamente, para quem nunca
 * tinha assinado. Saiu por decisão do dono, junto com a mudança do anual para
 * R$ 109,90: com o preço novo, ela entregava R$ 89,90 e o cupom do médico
 * entrega R$ 87,92 — praticamente a mesma coisa. Manter as duas faria o cupom
 * do médico não valer nada; empilhá-las levaria a assinatura a R$ 71,92.
 *
 * O desconto agora tem UM dono: o médico. É ele quem distribui, e é isso que
 * dá a ele um motivo concreto para fazê-lo.
 *
 * ─── QUEM DECIDE CONTINUA SENDO O SERVIDOR ─────────────────────────────────
 *
 * Este arquivo decide duas vezes: quando a tela pergunta, e de novo quando o
 * checkout é criado. Uma requisição forjada não compra com desconto. É a mesma
 * garantia que a oferta antiga tinha, e ela não podia se perder na troca.
 *
 * A conta (preços, porcentagens) mora em `promo.ts`, sem rede e testada.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  ANUAL_CENTAVOS,
  ANUAL_MENSAL_EQUIV_CENTAVOS,
  CUPOM_MEDICO_PCT,
  DESCONTO_ANUAL_COM_CUPOM_PCT,
  DESCONTO_ANUAL_PCT,
  ECONOMIA_ANUAL_CENTAVOS,
  MENSAL_CENTAVOS,
  PRECOS_PREMIUM,
  REFERENCIA_CENTAVOS,
} from "@/lib/promo";

export type PrecosDaPaciente = {
  /** Ela resgatou o código de um médico e tem 20% nos dois planos? */
  temCupom: boolean;
  /** De quem é o cupom — a tela credita o desconto a ELE, não à plataforma. */
  medicoDoCupom: string | null;

  /** Mensal cheio, em centavos. */
  mensalCentavos: number;
  /** Anual cheio, cobrado de uma vez, em centavos. */
  anualCentavos: number;
  /** Mensal com o cupom aplicado. Igual ao cheio quando não há cupom. */
  mensalFinalCentavos: number;
  /** Anual com o cupom aplicado. Igual ao cheio quando não há cupom. */
  anualFinalCentavos: number;

  /**
   * O preço RISCADO: um ano pagando mês a mês (R$ 19,90 × 12 = R$ 238,80).
   * É um preço REAL — por isso pode ser riscado, desde que a tela diga o que
   * ele é. Riscar um número que ninguém cobra é o "preço de referência" que o
   * CDC proíbe.
   */
  referenciaCentavos: number;
  /** Quanto o anual economiza contra pagar mês a mês. */
  economiaCentavos: number;
  /**
   * Equivalente mensal do anual — para a COMPARAÇÃO, nunca como preço.
   * "Equivalente" é literal: ×12 dá dois centavos a mais que o cobrado.
   */
  anualMensalEquivCentavos: number;

  /** Desconto do anual contra o mensal, em % inteira e arredondada para baixo. */
  descontoAnualPct: number;
  /** Desconto do anual COM o cupom, contra o mensal. */
  descontoAnualComCupomPct: number;
  /** O desconto que o médico dá, em % — o crédito que a tela dá a ele. */
  cupomPct: number;
};

const BASE = {
  mensalCentavos: MENSAL_CENTAVOS,
  anualCentavos: ANUAL_CENTAVOS,
  referenciaCentavos: REFERENCIA_CENTAVOS,
  economiaCentavos: ECONOMIA_ANUAL_CENTAVOS,
  anualMensalEquivCentavos: ANUAL_MENSAL_EQUIV_CENTAVOS,
  descontoAnualPct: DESCONTO_ANUAL_PCT,
  descontoAnualComCupomPct: DESCONTO_ANUAL_COM_CUPOM_PCT,
  cupomPct: CUPOM_MEDICO_PCT,
};

/** Sem cupom: os dois preços finais são os cheios. */
const SEM_CUPOM: PrecosDaPaciente = {
  ...BASE,
  temCupom: false,
  medicoDoCupom: null,
  mensalFinalCentavos: MENSAL_CENTAVOS,
  anualFinalCentavos: ANUAL_CENTAVOS,
};

/**
 * A paciente tem o cupom de algum médico?
 *
 * Exportada como função comum — e não só como server fn — porque o checkout
 * precisa chamá-la de DENTRO do servidor para decidir se aplica o desconto.
 * Era assim que a oferta antiga funcionava, e a propriedade que isso protege
 * (a tela nunca decide o preço) é a única que não podia se perder na troca.
 */
export async function lerPrecos(uid: string): Promise<PrecosDaPaciente> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;

  /* Já é Premium: não há o que vender, e mostrar desconto para quem já assinou
     é o que faz a paciente achar que pagou caro. */
  const { data: prof } = await sb
    .from("patient_profiles")
    .select("quiz_premium")
    .eq("id", uid)
    .maybeSingle();
  if (prof?.quiz_premium) return SEM_CUPOM;

  /* O cupom é o código do médico que ELA resgatou. `invite_codes.redeemed_by`
     já existia e já era marcado no resgate — o que mudou é o que ele concede:
     era Premium de graça, virou 20% de desconto. Nenhuma coluna nova. */
  const { data: convite } = await sb
    .from("invite_codes")
    .select("doctor_id")
    .eq("redeemed_by", uid)
    .limit(1)
    .maybeSingle();
  if (!convite) return SEM_CUPOM;

  /* O nome do médico é para a tela CREDITAR o desconto a ele. Falhar aqui não
     tira o cupom dela — só o nome sai da etiqueta. */
  let medicoDoCupom: string | null = null;
  try {
    const { data: doc } = await sb
      .from("doctors")
      .select("display_name")
      .eq("id", convite.doctor_id)
      .maybeSingle();
    medicoDoCupom = (doc?.display_name as string | null) ?? null;
  } catch {
    /* sem nome, o desconto vale igual */
  }

  return {
    ...BASE,
    temCupom: true,
    medicoDoCupom,
    mensalFinalCentavos: PRECOS_PREMIUM.mensalComCupom,
    anualFinalCentavos: PRECOS_PREMIUM.anualComCupom,
  };
}

/** O que a tela chama ao abrir a oferta. */
export const getPrecosDaPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return SEM_CUPOM;
      return await lerPrecos(u.user.id);
    } catch (e) {
      /* Falha de banco tira o desconto em vez de dar. Errar para o lado de não
         descontar é chato; errar para o outro é dar 20% a quem não tem. */
      console.error("[getPrecosDaPaciente]", e);
      return SEM_CUPOM;
    }
  });
