/**
 * LÊ O QUE A NUTRICIONISTA PRECISA SABER, E CHAMA A RÉGUA.
 *
 * O adaptador entre o banco e `nutricao-perfil.ts`. Toda decisão de TEXTO está
 * lá (pura e testada); aqui só há leitura e a conversão de linhas em números.
 *
 * ⚠️ **FALHA CALADA, NUNCA ABERTA.** Se qualquer leitura falhar, o bloco sai
 * VAZIO e a nutricionista responde como sempre respondeu — informação
 * consolidada, sem personalização. O oposto (chutar um contexto a partir de
 * dado pela metade) faria a IA falar com autoridade sobre um perfil que ela
 * não leu. Um recurso a menos é sempre melhor que um fato inventado.
 *
 * ⚠️ E o `careMode` NÃO é decidido aqui: ele chega pronto de
 * `consultorioDaPaciente`, que já falha FECHADO (não sei = luto). Uma segunda
 * leitura do mesmo campo poderia discordar da primeira.
 */
import { blocoDaPaciente, type PerfilNutricional } from "./nutricao-perfil";
import { imcPreGestacional } from "./curva-de-ganho";

/** 30 dias: o suficiente para um padrão glicêmico, curto o bastante para ser o agora. */
const JANELA_DIAS = 30;

export async function blocoDaNutricao(
  patientId: string,
  careMode: boolean,
  agora = new Date(),
): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sinalGlicemia } = await import("./sinais-clinicos");
    const { computeGestation, trimesterForWeek } = await import("./gestacao");
    const desde = new Date(agora.getTime() - JANELA_DIAS * 86400000).toISOString().slice(0, 10);

    /* Duas leituras independentes, uma onda só. */
    const [perfilRes, logsRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("patient_profiles")
        .select(
          "allergies,medications,height_cm,pre_pregnancy_weight_kg,prior_gestational_diabetes," +
            "lmp_date,reference_date,reference_weeks,reference_days",
        )
        .eq("id", patientId)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("health_logs")
        .select("log_date,weight_kg,glucose_mg_dl")
        .eq("user_id", patientId)
        .gte("log_date", desde)
        .order("log_date", { ascending: false })
        .limit(60),
    ]);

    /* ⚠️ O perfil falhando cala TUDO: sem ele não há alergia, e um bloco sem a
       alergia é justamente o que faz este recurso existir. O histórico falhando
       cala só a parte de peso e glicemia. */
    if (perfilRes?.error) {
      console.error("[nutricao] perfil ilegível — respondendo sem contexto", perfilRes.error);
      return "";
    }
    const perfil = perfilRes?.data as Record<string, unknown> | null;
    if (!perfil) return "";

    const gest = careMode
      ? null
      : computeGestation({
          lmp: perfil.lmp_date as string | null,
          referenceDate: perfil.reference_date as string | null,
          referenceWeeks: perfil.reference_weeks as number | null,
          referenceDays: perfil.reference_days as number | null,
          today: agora,
        });

    const logs = (logsRes?.error ? [] : ((logsRes?.data ?? []) as Record<string, unknown>[])) as {
      log_date: string;
      weight_kg: number | null;
      glucose_mg_dl: number | null;
    }[];

    /* Peso: o mais recente da janela, contra o peso pré-gestacional. */
    const pesoAtual = logs.find((l) => l.weight_kg != null)?.weight_kg ?? null;
    const prePreg = perfil.pre_pregnancy_weight_kg as number | null;
    const altura = perfil.height_cm as number | null;
    const imc = prePreg != null && altura != null ? imcPreGestacional(prePreg, altura) : null;
    const ganhoKg = pesoAtual != null && prePreg != null ? pesoAtual - prePreg : null;

    /* Glicemia: a última, e quantas fora do alvo na janela. */
    const comGlicemia = logs.filter((l) => l.glucose_mg_dl != null);
    const ultima = comGlicemia[0] ?? null;
    const sinalDaUltima = ultima ? sinalGlicemia(ultima.glucose_mg_dl) : null;
    const alteradas = comGlicemia.filter((l) => {
      const s = sinalGlicemia(l.glucose_mg_dl);
      return s != null && s.gravidade !== "normal";
    }).length;

    const p: PerfilNutricional = {
      careMode,
      alergias: perfil.allergies as string | null,
      medicacoes: perfil.medications as string | null,
      semanas: gest?.weeks ?? null,
      trimestre: gest ? trimesterForWeek(gest.weeks) : null,
      imc,
      ganhoKg,
      glicemia:
        ultima && sinalDaUltima
          ? {
              valor: ultima.glucose_mg_dl as number,
              alterada: sinalDaUltima.gravidade !== "normal",
              quando: new Date(`${ultima.log_date}T12:00:00`).toLocaleDateString("pt-BR"),
            }
          : null,
      dmgAnterior: Boolean(perfil.prior_gestational_diabetes),
      glicemiasAlteradas: alteradas,
      hora: agora.getHours(),
    };
    return blocoDaPaciente(p);
  } catch (e) {
    console.error("[nutricao] contexto inacessível — respondendo sem ele", e);
    return "";
  }
}
