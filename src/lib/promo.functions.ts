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
  DESCONTO_ANUAL_PCT,
  ECONOMIA_ANUAL_CENTAVOS,
  MENSAL_CENTAVOS,
  REFERENCIA_CENTAVOS,
} from "@/lib/promo";

export type PrecosDaPaciente = {
  /** Mensal, em centavos. */
  mensalCentavos: number;
  /** Anual, cobrado de uma vez, em centavos. */
  anualCentavos: number;

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
};

/**
 * OS PREÇOS — um conjunto só, igual para todas.
 *
 * Havia dois: `SEM_CUPOM` e a variante com os 20% do médico. O cupom foi
 * aposentado (ver o cabeçalho de `promo.ts`), e com ele some a classe inteira
 * de defeito de "duas paciente, dois preços" — que era o que exigia a leitura
 * de `invite_codes` a cada abertura da oferta.
 */
const PRECOS: PrecosDaPaciente = {
  mensalCentavos: MENSAL_CENTAVOS,
  anualCentavos: ANUAL_CENTAVOS,
  referenciaCentavos: REFERENCIA_CENTAVOS,
  economiaCentavos: ECONOMIA_ANUAL_CENTAVOS,
  anualMensalEquivCentavos: ANUAL_MENSAL_EQUIV_CENTAVOS,
  descontoAnualPct: DESCONTO_ANUAL_PCT,
};

/**
 * A paciente tem o cupom de algum médico?
 *
 * Exportada como função comum — e não só como server fn — porque o checkout
 * precisa chamá-la de DENTRO do servidor para decidir se aplica o desconto.
 * Era assim que a oferta antiga funcionava, e a propriedade que isso protege
 * (a tela nunca decide o preço) é a única que não podia se perder na troca.
 */
/**
 * Os preços da paciente.
 *
 * Ela lia `patient_profiles` e `invite_codes` para descobrir se havia cupom.
 * Sem cupom não há o que descobrir: o preço é o mesmo para todas, e a leitura
 * virou ruído — duas consultas por abertura da tela de oferta.
 *
 * A assinatura continua `async` e continua recebendo o `uid` de propósito: os
 * dois chamadores esperam uma Promise, e a porta fica aberta para um preço
 * regional ou uma campanha por coorte sem mexer em quem chama.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function lerPrecos(_uid: string): Promise<PrecosDaPaciente> {
  return PRECOS;
}

/** O que a tela chama ao abrir a oferta. */
export const getPrecosDaPaciente = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ accessToken: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (!u.user) return PRECOS;
      return await lerPrecos(u.user.id);
    } catch (e) {
      console.error("[getPrecosDaPaciente]", e);
      return PRECOS;
    }
  });
