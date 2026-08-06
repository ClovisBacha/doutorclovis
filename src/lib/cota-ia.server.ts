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

/** Uma paciente na lista de quem mais consome. */
export type ConsumoDaPaciente = {
  patientId: string;
  nome: string;
  respostas: number;
  /** Fatia do consumo TOTAL do médico no ciclo, de 0 a 1. */
  fatia: number;
};

/**
 * Quem está consumindo o plano do médico.
 *
 * O total já aparece no painel; isto responde a pergunta seguinte, que é a que
 * ele realmente faz: *quem*. Numa fila de cinquenta gestantes, três costumam
 * responder por metade das conversas — e saber quais são muda o que ele faz.
 * Pode ser uma paciente ansiosa que precisa de uma consulta, ou uma dúvida
 * recorrente que vale virar entrada do cérebro.
 *
 * Nome vem de `patient_profiles`; sem nome, um rótulo neutro. O que NÃO se faz
 * aqui é mostrar o conteúdo das conversas: o médico vê quanto, não o quê.
 */
export async function consumoPorPaciente(
  doctorId: string,
  agora = new Date(),
  limite = 6,
): Promise<{ total: number; pacientes: ConsumoDaPaciente[] }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data, error } = await sb
      .from("ai_usage")
      .select("patient_id")
      .eq("doctor_id", doctorId)
      .eq("especie", "chat")
      .gte("created_at", inicioDoCiclo(agora).toISOString())
      /* Teto de leitura: a agregação acontece aqui, não no banco, porque o
         PostgREST não faz GROUP BY. Com milhares de linhas isto viraria uma
         view materializada — mas otimizar antes de existir o problema é
         inventar complexidade. */
      .limit(5000);
    if (error || !Array.isArray(data)) return { total: 0, pacientes: [] };

    const porPaciente = new Map<string, number>();
    for (const linha of data as { patient_id: string | null }[]) {
      if (!linha.patient_id) continue;
      porPaciente.set(linha.patient_id, (porPaciente.get(linha.patient_id) ?? 0) + 1);
    }
    const total = data.length;
    if (!porPaciente.size) return { total, pacientes: [] };

    const topo = [...porPaciente.entries()].sort((a, b) => b[1] - a[1]).slice(0, limite);
    const { data: perfis } = await sb
      .from("patient_profiles")
      .select("id,display_name")
      .in(
        "id",
        topo.map(([id]) => id),
      );
    const nomes = new Map<string, string>(
      ((perfis ?? []) as { id: string; display_name: string | null }[]).map((p) => [
        p.id,
        p.display_name ?? "",
      ]),
    );

    return {
      total,
      pacientes: topo.map(([id, respostas]) => ({
        patientId: id,
        nome: nomes.get(id)?.trim() || "Paciente",
        respostas,
        fatia: total > 0 ? respostas / total : 0,
      })),
    };
  } catch {
    return { total: 0, pacientes: [] };
  }
}
