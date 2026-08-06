/**
 * A cota de respostas da IA por médico.
 *
 * ─── DOIS LIVROS-CAIXA QUE NUNCA SE TOCAM ───────────────────────────────────
 *
 * O do Google é UM, da plataforma inteira, medido em TOKENS, e quem paga é a
 * Obstétrica. Ele não sabe que existem médicos: a chave da API é uma só, e
 * qualquer limite lá seria global — quando estourasse, cortaria todos ao mesmo
 * tempo, inclusive quem nem usou. O papel do Google é teto de catástrofe (um
 * alerta de orçamento contra laço infinito ou abuso), nunca controle de plano.
 *
 * O do plano é POR MÉDICO, medido em MENSAGENS, e quem paga é ele.
 *
 * A ponte entre os dois é `ai_usage`: toda chamada grava `doctor_id` E os
 * tokens. É de lá que sai a conversão de "340 respostas" para "R$ tanto", e é
 * ela que revela a margem real de cada plano.
 *
 * ─── O QUE ACONTECE AO ESTOURAR ─────────────────────────────────────────────
 *
 * A paciente NUNCA bate numa parede. O que ela perde é o Segundo Cérebro do
 * médico — a parte cara e diferenciada — e continua recebendo informação
 * obstétrica consolidada, com a dúvida indo para a fila dele do mesmo jeito.
 *
 * Bloquear a resposta seria transferir para a gestante a consequência de um
 * limite que não é dela e que ela não pode resolver.
 */

/** Onde a régua muda de cor. 80% é aviso; 100% desliga o cérebro do médico. */
export const AVISO_EM = 0.8;

export type SituacaoDaCota = {
  usadas: number;
  /** `null` = ilimitado (contrato sob medida). */
  teto: number | null;
  /** 0 a 1+; `0` quando o teto é ilimitado (não há fração de infinito). */
  fracao: number;
  estado: "ok" | "aviso" | "estourada";
};

/**
 * Início do ciclo atual.
 *
 * Mês-calendário, e isso é uma escolha com trade-off honesto: quem assina dia
 * 20 ganha um primeiro ciclo curto. O certo seria ancorar no aniversário da
 * assinatura, e é para lá que isto vai quando a cobrança recorrente estiver
 * fechada — mas amarrar agora numa data que ainda não existe no banco seria
 * inventar complexidade antes do problema.
 */
export function inicioDoCiclo(agora = new Date()): Date {
  return new Date(agora.getFullYear(), agora.getMonth(), 1);
}

/**
 * Quantas RESPOSTAS a IA deu para as pacientes deste médico no ciclo.
 *
 * Conta `especie = 'chat'` — não `memoria` nem `embedding`. As três custam
 * dinheiro e as três estão medidas, mas o que se VENDE é a resposta: cobrar do
 * médico um resumo de memória que ele não pediu e não vê seria vender uma
 * unidade que ele não consegue conferir.
 *
 * `head: true` traz só o número, sem as linhas — isto roda a cada mensagem.
 */
export async function respostasNoCiclo(doctorId: string, agora = new Date()): Promise<number> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await (supabaseAdmin as any)
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", doctorId)
      .eq("especie", "chat")
      .gte("created_at", inicioDoCiclo(agora).toISOString());
    /* Tabela ausente ou falha de rede → 0, ou seja, NÃO estoura.
       Na dúvida o médico é atendido: uma cota que se fecha sozinha por um
       soluço de banco tiraria o cérebro dele do ar sem ele ter feito nada. */
    if (error) return 0;
    return typeof count === "number" ? count : 0;
  } catch {
    return 0;
  }
}

/** Junta consumo e teto numa decisão. Puro — o teste não precisa de banco. */
export function situacaoDaCota(usadas: number, teto: number | null): SituacaoDaCota {
  if (teto === null) return { usadas, teto, fracao: 0, estado: "ok" };
  /* Teto zero é plano SEM IA, e aí não há o que estourar: quem barra é o
     entitlement (`aiApp`), muito antes daqui. Tratar como "estourada" faria a
     mensagem errada aparecer no painel de quem nunca teve o recurso. */
  if (teto <= 0) return { usadas, teto, fracao: 0, estado: "ok" };
  const fracao = usadas / teto;
  return {
    usadas,
    teto,
    fracao,
    estado: usadas >= teto ? "estourada" : fracao >= AVISO_EM ? "aviso" : "ok",
  };
}

/** Consulta o consumo e devolve a situação. Nunca lança. */
export async function cotaDoMedico(
  doctorId: string,
  teto: number | null,
  agora = new Date(),
): Promise<SituacaoDaCota> {
  if (teto === null || teto <= 0) return situacaoDaCota(0, teto);
  return situacaoDaCota(await respostasNoCiclo(doctorId, agora), teto);
}
