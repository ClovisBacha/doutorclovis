/**
 * Consultor de negócio (IA) — super-admin. Lê o RETRATO já agregado da
 * plataforma (as mesmas funções validadas: getPlatformInsights, getGrowthMetrics,
 * getChurnAlerts, getNpsReport — todas sobre TODOS os médicos) e pede ao Gemini
 * um diagnóstico + ações priorizadas. Saída estruturada (generateObject) para a
 * UI renderizar bonito. Nada é gravado; é análise sob demanda.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { TokenSchema, requireSuperAdmin } from "@/lib/platform-admin.server";
import { getPlatformInsights } from "@/lib/platform.functions";
import { getGrowthMetrics, getChurnAlerts } from "@/lib/insights.functions";
import { getNpsReport } from "@/lib/nps.functions";

export type AdviceAction = {
  titulo: string;
  porque: string;
  impacto: "alto" | "medio" | "baixo";
  esforco: "alto" | "medio" | "baixo";
};
export type BusinessAdvice = {
  diagnostico: string;
  saudeGeral: "forte" | "estavel" | "atencao" | "critico";
  pontosFortes: string[];
  riscos: string[];
  acoes: AdviceAction[];
};

const AdviceSchema = z.object({
  diagnostico: z.string().describe("2 a 4 frases: leitura honesta do momento do negócio."),
  saudeGeral: z.enum(["forte", "estavel", "atencao", "critico"]),
  pontosFortes: z.array(z.string()).max(6).describe("O que está indo bem, com base nos números."),
  riscos: z.array(z.string()).max(6).describe("Riscos concretos que os dados mostram."),
  acoes: z
    .array(
      z.object({
        titulo: z.string().describe("Ação objetiva e específica."),
        porque: z.string().describe("Por que essa ação, ligada a um número do retrato."),
        impacto: z.enum(["alto", "medio", "baixo"]),
        esforco: z.enum(["alto", "medio", "baixo"]),
      }),
    )
    .max(6)
    .describe("3 a 5 ações priorizadas por impacto para melhorar o negócio."),
});

const cents = (c: number) => Math.round((c ?? 0) / 100);

export const getBusinessAdvice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) return { ok: false as const, reason: "sem_ia" as const };

    const token = data.accessToken;
    const gathered = await Promise.all([
      getPlatformInsights({ data: { accessToken: token } }),
      getGrowthMetrics({ data: { accessToken: token } }),
      getChurnAlerts({ data: { accessToken: token } }),
      getNpsReport({ data: { accessToken: token } }),
    ]).catch(() => null);
    if (!gathered) return { ok: false as const, reason: "falha_ia" as const };
    const [ins, growth, churn, nps] = gathered;
    if (!ins.ok || !ins.insights) return { ok: false as const };

    const I = ins.insights;
    const G = growth.ok ? growth.metrics : null;
    const C = churn.ok ? churn.result : null;
    const N = nps.ok ? nps.report : null;

    // Retrato compacto em REAIS (o modelo raciocina melhor em reais que centavos).
    const snapshot = {
      receita_mensal_reais: {
        mrr_total: cents(I.revenue.totalMrrCents),
        mrr_medicos: cents(I.revenue.doctorMrrCents),
        mrr_pacientes_premium: cents(I.revenue.patientMrrCents),
        faturamento_consultas: cents(I.revenue.consultRevenueCents),
      },
      medicos: {
        total: I.perDoctor.length,
        pagando: I.subscriptions.doctorsPaying,
        em_teste: G ? G.funnel.doctors.registered - G.funnel.doctors.paying : null,
        retidos_1o_ciclo: G ? G.funnel.doctors.retained : null,
      },
      pacientes: {
        total: G ? G.funnel.patients.total : null,
        premium: I.subscriptions.patientsPremium,
        ativaram_pct: G
          ? Math.round((G.funnel.patients.activated / Math.max(1, G.funnel.patients.total)) * 100)
          : null,
      },
      planos_mais_vendidos: I.subscriptions.byPlan,
      consultas_pagas: I.transactions.paidConsultations,
      unit_economics_reais: G
        ? {
            arpu_medico: cents(G.unitEconomics.doctorArpuCents),
            ltv_medico: cents(G.unitEconomics.doctorLtvCents),
            canais_afiliados: G.unitEconomics.channels.map((c) => ({
              codigo: c.code,
              cadastros: c.signups,
              cac_reais: cents(c.cacCents),
            })),
          }
        : null,
      ia_mes: G
        ? {
            respostas: G.aiCost.hitsThisMonth,
            custo_reais: cents(G.aiCost.costThisMonthCents),
            margem_reais: cents(G.aiCost.marginThisMonthCents),
          }
        : null,
      previsao_mrr_reais: G
        ? G.forecast.months.map((m) => ({ mes: m.label, mrr: cents(m.projectedMrrCents) }))
        : null,
      alertas_churn: C ? C.counts : null,
      nps: N
        ? {
            geral: N.overall.nps,
            medicos: N.byRole.medico.nps,
            pacientes: N.byRole.paciente.nps,
            respostas: N.overall.responses,
          }
        : null,
      top_medicos_engajamento: G
        ? G.leaderboard
            .slice(0, 5)
            .map((d) => ({ nome: d.name, pacientes: d.patients, cerebro: d.brainEntries }))
        : null,
    };

    const [{ generateObject }, { createChatProvider, DEFAULT_CHAT_MODEL }] = await Promise.all([
      import("ai"),
      import("./ai-gateway.server"),
    ]);
    const provider = createChatProvider(key);

    const system = [
      "Você é um consultor de negócios sênior especializado em SaaS de saúde (health tech).",
      "O produto é a Obstétrica: um app de gestação para pacientes + painel para médicos obstetras, com um 'Segundo Cérebro' de IA treinado por cada médico. Receita: assinatura dos médicos (planos mensais/anuais), Premium das pacientes, consultas particulares e comissões de afiliados.",
      "Você recebe um RETRATO atual da plataforma (JSON, valores em reais). Analise como um sócio que quer crescer com saúde: seja direto, honesto e prático.",
      "Baseie CADA afirmação nos números do retrato — cite o número quando fizer sentido. Não invente dados que não estão lá.",
      "Priorize as ações por impacto no negócio (receita, retenção, ativação). Prefira ações concretas e executáveis a conselhos genéricos.",
      "Se a base ainda é pequena (poucos médicos/pacientes), foque em ativação e nos primeiros clientes — não superdimensione.",
      "Responda em português brasileiro.",
    ].join("\n");

    try {
      const { object, usage } = await generateObject({
        model: provider(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
        schema: AdviceSchema,
        system,
        prompt:
          "Retrato atual da plataforma (JSON, valores em reais):\n" +
          JSON.stringify(snapshot, null, 2),
      });
      /* MEDIDO. Uma trava mecânica achou oito chamadas pagas de modelo que
       ninguém media — esta era uma delas. Canal próprio: a cota conta só
       `app`, então isto aparece no consumo sem comer a franquia clínica. */
      const { registrarUsoAgora } = await import("./uso-ia.server");
      await registrarUsoAgora({
        especie: "chat",
        modelo: process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        canal: "conselheiro",
      });
      return {
        ok: true as const,
        advice: object as BusinessAdvice,
        snapshot,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      return { ok: false as const, reason: "falha_ia" as const };
    }
  });
