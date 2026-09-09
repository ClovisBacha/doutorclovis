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
import { blocoDaPaciente } from "./nutricao-perfil";
import { perfilNutricionalDe, type LinhaDeSaude, type LinhaDoPerfil } from "./nutricao-contexto";
import { colunaAusente } from "./postgrest";

/** 30 dias: o suficiente para um padrão glicêmico, curto o bastante para ser o agora. */
const JANELA_DIAS = 30;

/* ⚠️ `birth_date` nasceu numa migration posterior (`20260608210000_postpartum`).
   Num banco sem ela o select inteiro voltaria 42703 e a nutricionista perderia
   a ALERGIA por causa de uma coluna que ela nem precisava — daí o degrau. */
const COLUNAS_DO_PERFIL =
  "allergies,medications,height_cm,pre_pregnancy_weight_kg,prior_gestational_diabetes," +
  "lmp_date,reference_date,reference_weeks,reference_days,birth_date";

export async function blocoDaNutricao(
  patientId: string,
  careMode: boolean,
  agora = new Date(),
): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const desde = new Date(agora.getTime() - JANELA_DIAS * 86400000).toISOString().slice(0, 10);

    const lerPerfil = (colunas: string) =>
      (supabaseAdmin as any)
        .from("patient_profiles")
        .select(colunas)
        .eq("id", patientId)
        .maybeSingle();

    /* Duas leituras independentes, uma onda só. */
    const [perfilCheio, logsRes] = await Promise.all([
      lerPerfil(COLUNAS_DO_PERFIL),
      (supabaseAdmin as any)
        .from("health_logs")
        .select("log_date,weight_kg,glucose_mg_dl")
        .eq("user_id", patientId)
        .gte("log_date", desde)
        .order("log_date", { ascending: false })
        .limit(60),
    ]);
    const perfilRes = colunaAusente(perfilCheio?.error)
      ? await lerPerfil(COLUNAS_DO_PERFIL.replace(",birth_date", ""))
      : perfilCheio;

    /* ⚠️ O perfil falhando cala TUDO: sem ele não há alergia, e um bloco sem a
       alergia é justamente o que faz este recurso existir. O histórico falhando
       cala só a parte de peso e glicemia. */
    if (perfilRes?.error) {
      console.error("[nutricao] perfil ilegível — respondendo sem contexto", perfilRes.error);
      return "";
    }
    const perfil = perfilRes?.data as LinhaDoPerfil | null;
    if (!perfil) return "";

    const logs = (
      logsRes?.error ? [] : ((logsRes?.data ?? []) as LinhaDeSaude[])
    ) as LinhaDeSaude[];

    return blocoDaPaciente(perfilNutricionalDe({ perfil, logs, careMode, agora }));
  } catch (e) {
    console.error("[nutricao] contexto inacessível — respondendo sem ele", e);
    return "";
  }
}
