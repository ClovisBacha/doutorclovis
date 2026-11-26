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
import {
  perfilNutricionalDe,
  type DoAparelho,
  type LinhaDaTriagem,
  type LinhaDeSaude,
  type LinhaDoDiario,
  type LinhaDoPerfil,
} from "./nutricao-contexto";
import { colunaAusente } from "./postgrest";
import { lerFilhos } from "./filhos.functions";
import { aCaminho } from "./filhos";

/** 30 dias: o suficiente para um padrão glicêmico, curto o bastante para ser o agora. */
const JANELA_DIAS = 30;

/* ⚠️ `birth_date` (migration `20260608210000_postpartum`) e `food_preferences`
   (`APLICAR_MEMORIA_DA_NUTRICAO.sql`) nasceram DEPOIS da alergia. Num banco sem
   uma delas o select inteiro voltaria 42703 e a nutricionista perderia a
   ALERGIA por causa de uma coluna que ela nem precisava — daí a escada, UM
   degrau por coluna, do SQL mais novo para o mais velho, cada degrau derivado
   do de cima por remoção (duas listas à mão divergem no primeiro ajuste). */
const COLUNAS_DO_PERFIL =
  "allergies,medications,height_cm,pre_pregnancy_weight_kg,prior_gestational_diabetes," +
  "lmp_date,reference_date,reference_weeks,reference_days,birth_date,food_preferences";
export const DEGRAUS_DO_PERFIL: readonly string[] = [
  COLUNAS_DO_PERFIL,
  COLUNAS_DO_PERFIL.replace(",food_preferences", ""),
  COLUNAS_DO_PERFIL.replace(",food_preferences", "").replace(",birth_date", ""),
];

export async function blocoDaNutricao(
  patientId: string,
  careMode: boolean,
  agora = new Date(),
  /** O que a tela mandou (água e suplementos de hoje) — já saneado por `doAparelhoDe`. */
  doAparelho?: DoAparelho,
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

    /* Quatro leituras independentes, uma onda só.
       ⚠️ Do diário SÓ `mood`, e da triagem SÓ `level` e `symptoms`: o texto do
       diário (`content`) e a nota da triagem (`note`) são o que a paciente
       ESCREVEU, e não entram no prompt — a régua pura só conhece catálogo, e
       o que não é pedido ao banco não tem como vazar. */
    const [perfilCheio, logsRes, diarioRes, triagemRes, filhos, consultaRes] = await Promise.all([
      lerPerfil(DEGRAUS_DO_PERFIL[0]),
      /* ⚠️ **ESTE SELECT NÃO TEM ESCADA, e é seguro HOJE por um motivo que
         pode acabar:** as cinco colunas existem desde as primeiras migrations,
         então não há degrau a derivar — uma escada agora seria um recuo que
         nunca roda, código morto com cara de proteção (a mesma lição da guarda
         que saiu de `sinalPerdaDePeso`).
         ⚠️ **O que NÃO pode acontecer é alguém acrescentar uma coluna nova
         aqui sem degrau.** O 42703 derruba o select INTEIRO, e num golpe só a
         nutricionista perde peso, glicemia E pressão — sem erro na tela, sem
         nada quebrado: os três recursos simplesmente deixam de existir. Quem
         acrescentar coluna aqui deriva a escada por remoção, como
         `DEGRAUS_DO_PERFIL` acima. */
      (supabaseAdmin as any)
        .from("health_logs")
        .select("log_date,weight_kg,glucose_mg_dl,systolic,diastolic")
        .eq("user_id", patientId)
        .gte("log_date", desde)
        .order("log_date", { ascending: false })
        .limit(60),
      (supabaseAdmin as any)
        .from("journal_entries")
        .select("entry_date,mood")
        .eq("user_id", patientId)
        .gte("entry_date", desde)
        .not("mood", "is", null)
        .order("entry_date", { ascending: false })
        .limit(40),
      (supabaseAdmin as any)
        .from("triage_logs")
        .select("created_at,level,symptoms")
        .eq("user_id", patientId)
        .gte("created_at", `${desde}T00:00:00Z`)
        .order("created_at", { ascending: false })
        .limit(20),
      /* ⚠️ **Quinta leitura, na MESMA onda** — e ela existe porque a faixa de
         ganho de peso que o bloco desenha é de UM feto. `lerFilhos` é o leitor
         único de `patient_filhos` (nunca um `select` novo aqui) e devolve
         `null` em qualquer erro, inclusive tabela ausente: quem ainda não
         rodou `APLICAR_COMUNIDADE_VIVA.sql` continua exatamente como estava.
         ⚠️ **NÃO SABER VALE UM BEBÊ**, que é o estado de hoje — calar a faixa
         por dúvida a tiraria de toda paciente sempre que a tabela oscilasse. */
      lerFilhos(supabaseAdmin as any, patientId).catch(() => null),
      /* ⚠️ **O QUE O MÉDICO ESCREVEU PARA ELA na última consulta.** Este
         consultório é de gestação de ALTO RISCO, e a nutricionista não sabia
         nada do que foi diagnosticado nesta gestação: a paciente com diabetes
         gestacional confirmada recebia a mesma resposta de todo mundo.
         ⚠️ **SÓ `resumo_paciente`** — o campo rotulado "o que ela pode ver",
         escrito para ela. `achados` e `conduta` são o prontuário, escrito para
         outro médico, e nem são PEDIDOS aqui: o que não é lido não vaza. É a
         mesma linha que `minhasConsultas` e o export da LGPD já traçam.
         ⚠️ **UMA, a mais recente.** Um histórico de resumos seria o prontuário
         dela dentro do prompt por outro caminho.
         ⚠️ **NO MODO CUIDADO NEM É LIDA** — o resumo fala da gestação em
         curso, e um portão estrutural é melhor que um `if` no fim. */
      careMode
        ? Promise.resolve(null)
        : (supabaseAdmin as any)
            .from("consultations")
            .select("occurred_at,resumo_paciente")
            .eq("user_id", patientId)
            .not("resumo_paciente", "is", null)
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);
    /* Desce a escada enquanto a falta for de COLUNA; qualquer outro erro para. */
    let perfilRes = perfilCheio;
    for (let d = 1; d < DEGRAUS_DO_PERFIL.length && colunaAusente(perfilRes?.error); d++) {
      perfilRes = await lerPerfil(DEGRAUS_DO_PERFIL[d]);
    }

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

    /* A consulta falhando (inclusive tabela ausente) cala só a seção dela. */
    const consulta = consultaRes?.error ? null : (consultaRes?.data ?? null);
    const resumoDoMedico =
      consulta && typeof consulta.resumo_paciente === "string" && consulta.resumo_paciente.trim()
        ? {
            texto: consulta.resumo_paciente,
            quando: new Date(consulta.occurred_at).toLocaleDateString("pt-BR"),
          }
        : null;

    /* Diário e triagem falhando calam só a parte deles — como o histórico. */
    const diario = (diarioRes?.error ? [] : (diarioRes?.data ?? [])) as LinhaDoDiario[];
    const triagens = (triagemRes?.error ? [] : (triagemRes?.data ?? [])) as LinhaDaTriagem[];

    return blocoDaPaciente(
      perfilNutricionalDe({
        perfil,
        logs,
        careMode,
        agora,
        doAparelho,
        diario,
        triagens,
        gestacaoMultipla: filhos ? aCaminho(filhos).length >= 2 : false,
        resumoDoMedico,
      }),
    );
  } catch (e) {
    console.error("[nutricao] contexto inacessível — respondendo sem ele", e);
    return "";
  }
}
