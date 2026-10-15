import { ehBancada } from "~/lib/bancada";
import { supabase } from "~/servidor/supabase";

/**
 * Uma linha no diário dela (`journal_entries`), no MESMO formato do site:
 * "Meditação de 5 min · Mais calma" (com o emoji no humor) e "Exercício de
 * 5 min · Dor nas costas: melhorou". É assim que a resposta chega ao gráfico
 * de humor e ao histórico — e o médico vê "lombar: melhorou" oito vezes
 * seguidas, ou "não mudou" oito vezes, que é uma conversa completamente outra.
 *
 * Falha em silêncio, como no site: o fim de uma atividade que ela concluiu é o
 * pior lugar do app para uma mensagem vermelha, e o registro local já foi.
 */
export async function anotarNoDiario(
  uid: string | null | undefined,
  conteudo: string,
  humor?: string,
) {
  if (!uid || ehBancada()) return;
  try {
    await supabase
      .from("journal_entries")
      .insert({ user_id: uid, content: conteudo, ...(humor ? { mood: humor } : {}) });
  } catch {
    /* fica só o registro local */
  }
}
