/**
 * QUANTAS PERGUNTAS ELA JÁ FEZ — lido de `ai_usage`, no servidor.
 *
 * ⚠️ **A CONTAGEM NÃO PODE VIVER NA TELA.** "Cadeado que só existe na tela é
 * decoração" está escrito no CLAUDE.md desde o troféu das cinco estrelas, e
 * aqui vale dobrado: um contador em `localStorage` se zera trocando de
 * aparelho, abrindo uma aba anônima ou limpando o app. Quem decide é a mesma
 * tabela que já registra o CUSTO de cada chamada — ou seja, a contagem e a
 * conta do dinheiro nunca podem divergir, porque são a mesma linha.
 *
 * ⚠️ **UMA LEITURA SÓ PARA OS DOIS NÚMEROS.** A janela de sete dias é buscada
 * inteira e o dia de hoje é contado em memória. Duas consultas (uma do dia,
 * outra da semana) custariam duas idas ao banco no caminho de TODA pergunta —
 * e a segunda diria a mesma coisa que a primeira já sabia.
 */

import { JANELA_DA_AMOSTRA_DIAS } from "./nutricao-premium";

/** Os dois canais que a assinatura da paciente paga. */
export const CANAIS_DA_NUTRICIONISTA = ["nutricao", "prato"] as const;

/**
 * A meia-noite de hoje em São Paulo, como instante UTC.
 *
 * ⚠️ **O SERVIDOR RODA EM UTC**, e o Brasil está três horas atrás. Contando
 * por `getDate()` do processo, o teto diário viraria às 21h de Brasília: a
 * paciente que perguntou às 22h gastaria a cota de AMANHÃ, e às 21h01 ganharia
 * dez perguntas novas. É o mesmo erro de três horas que a agenda e o ciclo da
 * cota do médico já pagaram neste repositório.
 */
export function inicioDoDiaEmSP(agora = new Date()): Date {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  /* Meia-noite de Brasília é 03:00 UTC (UTC−3). O Brasil não tem horário de
     verão desde 2019; se voltar, esta conta precisa do offset real do dia. */
  return new Date(Date.UTC(n("year"), n("month") - 1, n("day"), 3, 0, 0));
}

export type UsoDaNutricionista = {
  /** Perguntas de hoje, ou `null` quando a leitura falhou. */
  hoje: number | null;
  /** Perguntas dos últimos sete dias, ou `null`. */
  semana: number | null;
};

/**
 * ⚠️ **FALHA ABERTA, E ISSO É UMA ESCOLHA COM PREÇO.**
 *
 * Leitura que falha devolve `null`, e `decidirAcesso` trata `null` como "não
 * sei" e ATENDE. Ou seja: uma indisponibilidade de `ai_usage` custa dinheiro
 * em modelo até voltar.
 *
 * O outro lado seria bloquear todas as pacientes — inclusive as assinantes —
 * por um defeito nosso, e "a paciente NUNCA bate numa parede" é a régua que a
 * cota do médico já declarou. O prejuízo é limitado pela duração da falha e
 * aparece no painel de Custo; a parede apareceria na mão de quem pagou.
 *
 * Por isso a falha é REGISTRADA alto: um número que some do painel sem log é o
 * que faz alguém concluir, meses depois, que ninguém usa o recurso.
 */
export async function usoDaNutricionista(
  patientId: string,
  agora = new Date(),
): Promise<UsoDaNutricionista> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const inicioDaSemana = new Date(
      agora.getTime() - JANELA_DA_AMOSTRA_DIAS * 86_400_000,
    ).toISOString();

    const { data, error } = await (supabaseAdmin as any)
      .from("ai_usage")
      .select("created_at")
      .eq("patient_id", patientId)
      .eq("especie", "chat")
      .in("canal", CANAIS_DA_NUTRICIONISTA)
      .gte("created_at", inicioDaSemana)
      /* Teto de linhas muito acima do possível (10/dia × 7 = 70). Se ele for
         alcançado, o portão está furado em algum lugar — e é melhor a conta
         saturar que a consulta arrastar a resposta dela. */
      .limit(500);

    if (error) {
      console.error("[nutricao] uso ilegível — liberando e registrando", error);
      return { hoje: null, semana: null };
    }

    const linhas = (data ?? []) as { created_at: string }[];
    const corte = inicioDoDiaEmSP(agora).getTime();
    let hoje = 0;
    for (const l of linhas) {
      const t = Date.parse(l.created_at);
      if (Number.isFinite(t) && t >= corte) hoje++;
    }
    return { hoje, semana: linhas.length };
  } catch (e) {
    console.error("[nutricao] uso inacessível — liberando e registrando", e);
    return { hoje: null, semana: null };
  }
}
