import type { ItemPorFase } from "~/lib/jornada/loja-por-fase";
import type { CompraDoCantinho } from "~/servidor/cantinho";
import { supabase } from "~/servidor/supabase";

/**
 * A loja por fase no BANCO (`mobile/supabase/APLICAR_LOJA_POR_FASE.sql`): a tabela
 * com o que abre em cada semana e a função que vende. Não passa pelo servidor
 * do site — lá a compra de item Premium exige assinatura, e `src/` não muda.
 *
 * Antes de o dono rodar o SQL, a tabela não existe: a leitura devolve `null`
 * e a vitrine continua a de antes, sem nenhum botão que não funcionaria.
 */

export async function lerTabelaDaLojaPorFase(): Promise<Map<string, ItemPorFase> | null> {
  const { data, error } = await supabase
    .from("cantinho_por_fase")
    .select("item_id, preco, semana_minima");
  if (error || !data) return null;
  const fora = new Map<string, ItemPorFase>();
  for (const l of data as { item_id: string; preco: number; semana_minima: number }[]) {
    if (typeof l.item_id === "string" && l.preco > 0 && l.semana_minima >= 0)
      fora.set(l.item_id, { preco: l.preco, semana: l.semana_minima });
  }
  return fora;
}

/** As recusas da função, na língua dela. O código cru segue em `motivo`. */
const RECUSAS: Record<string, string> = {
  ja_possui: "Você já tem este item 💛",
  saldo_insuficiente: "Sementinhas insuficientes 🌱",
  ainda_nao_abriu: "Este ainda não abriu — ele chega com a próxima fase da gestação 🌱",
  fora_da_loja: "Este item saiu da lojinha 🌙",
  modo_cuidado: "A lojinha está em pausa enquanto você cuida de você 🤍",
  sem_sessao: "Sua sessão expirou — entre novamente.",
};

type Resposta =
  | { ok: true; balance: number; conjuntosNovos?: string[]; bonusNovo?: number }
  | { ok: false; error: string; balance?: number };

/** Compra um item da loja por fase. Lança em erro de rede (quem chama trata). */
export async function comprarNaLojaPorFase(itemId: string): Promise<CompraDoCantinho> {
  const { data, error } = await supabase.rpc("comprar_item_da_fase", { p_item: itemId });
  if (error) throw error;
  const r = data as Resposta;
  if (r.ok) {
    return {
      ok: true,
      balance: r.balance,
      itemId,
      conjuntosNovos: r.conjuntosNovos ?? [],
      bonusNovo: r.bonusNovo ?? 0,
    };
  }
  return {
    ok: false,
    error: RECUSAS[r.error] ?? `Não foi possível comprar (${r.error})`,
    motivo: r.error,
    balance: r.balance,
  };
}
