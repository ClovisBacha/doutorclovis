import { funcaoDoServidor } from "~/servidor/ponte";

/**
 * As outras formas de ganhar sementinhas — o "Ganhe mais Sementinhas" do Meu
 * Cantinho. Contratos de src/lib/referral.functions.ts,
 * src/lib/testimonials.functions.ts e src/lib/influenciadora.functions.ts.
 *
 * ⚠️ A AVALIAÇÃO NA LOJA NÃO ENTRA (o `RatingRewardCard` do site): a Apple
 * proíbe pagar pela nota do app (diretriz 5.6.1). E o Instagram fica de fora
 * enquanto a integração com a Meta estiver desligada no servidor — no site o
 * cartão já se esconde sozinho nesse estado.
 */

/** O código de indicação dela (criado na primeira leitura) e quantas amigas entraram por ele. */
export const lerIndicacao = funcaoDoServidor<
  Record<string, never>,
  { ok: true; code: string | null; count: number } | { ok: false; error: string }
>("src/lib/referral.functions.ts", "getReferral");

export type StatusDoDepoimento = "pending" | "approved" | "rejected";

export const lerMeuDepoimento = funcaoDoServidor<
  Record<string, never>,
  | {
      ok: true;
      testimonial: { body: string; displayName: string | null; status: StatusDoDepoimento } | null;
    }
  | { ok: false; error: string }
>("src/lib/testimonials.functions.ts", "getMyTestimonial");

/** Envia (ou reenvia) o depoimento: volta para a análise do médico. */
export const enviarDepoimento = funcaoDoServidor<
  { body: string; displayName?: string },
  { ok: true; status: StatusDoDepoimento } | { ok: false; error: string }
>("src/lib/testimonials.functions.ts", "submitTestimonial");

/** O código da médica ou da embaixadora que a trouxe — fixado uma vez só. */
export const aplicarCodigoDeQuemIndicou = funcaoDoServidor<
  { codigo: string },
  | { ok: true; atribuido: true; bonus: number; codigo: string }
  | { ok: true; atribuido: false; invalido?: true; jaTinha?: true; repetir?: true }
  | { ok: false; error: string }
>("src/lib/influenciadora.functions.ts", "atribuirInfluenciadora");
