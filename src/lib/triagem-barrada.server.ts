/**
 * Grava o rastro da triagem clínica. Só servidor.
 *
 * ⚠️ **MÓDULO PRÓPRIO, e não um helper dentro de `rede-social.functions.ts`.**
 * A triagem do comentário roda ANTES de qualquer cliente existir — é a trava
 * que manteve os comentários fora do produto por meses, e mover a régua para
 * depois do cliente seria o mesmo que não tê-la. Um módulo que abre o próprio
 * cliente deixa o rastro alcançável de qualquer ponto de barragem sem tocar na
 * ordem de nenhum deles.
 */
import { trechoParaFila, type OndeBarrou } from "./triagem-barrada";

/**
 * ⚠️ **NUNCA LANÇA E NUNCA DEVOLVE ERRO.** Isto é observação, não regra:
 * derrubar a publicação porque o registro não gravou seria trocar um sinal de
 * moderação por uma avaria certa na tela dela. E a tabela pode não existir
 * ainda — o dono roda o `APLICAR_` à mão, e o deploy chega antes.
 */
export async function anotarBarrada(
  quemId: string,
  onde: OndeBarrou,
  desfecho: string,
  texto: string,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("rede_triagem_barrada").insert({
      quem_id: quemId,
      onde,
      desfecho,
      trecho: trechoParaFila(texto),
    });
    if (error) console.warn("[rede] triagem sem fila — rode APLICAR_NOVE_DA_REDE.sql");
  } catch {
    /* Observação nunca derruba publicação. */
  }
}
