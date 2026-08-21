import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assessLevel, LEVEL_FALLBACK, ALL_SYMPTOMS } from "@/lib/triage";
import { makeRateLimiter } from "./rate-limit.server";

const Schema = z.object({
  /**
   * A SESSÃO — e ela é OPCIONAL de propósito. Ver o cabeçalho de
   * `assessSymptoms`: sem sessão a triagem continua respondendo, só não gasta
   * modelo.
   */
  accessToken: z.string().min(10).optional(),
  symptoms: z.array(z.string()).max(40),
  systolic: z.number().int().min(50).max(300).nullable().optional(),
  diastolic: z.number().int().min(30).max(200).nullable().optional(),
  note: z.string().max(500).optional(),
  weeks: z.number().int().min(0).max(45).nullable().optional(),
});

/**
 * Teto por pessoa. Doze avaliações por hora é muito mais do que qualquer
 * gestante faz de verdade e pouco o bastante para não valer a pena abusar.
 */
const triagemLimitada = makeRateLimiter(12, 3_600_000);

/**
 * Avalia sintomas e devolve nível de risco + orientação.
 * O nível vem SEMPRE das regras (src/lib/triage.ts). A IA só escreve a
 * explicação; se não houver chave do Gemini, usamos um texto fixo por nível.
 */
export const assessSymptoms = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data }) => {
    const { level, reasons } = assessLevel(data.symptoms, {
      systolic: data.systolic ?? null,
      diastolic: data.diastolic ?? null,
    });

    let message = LEVEL_FALLBACK[level];

    /* ─── QUEM PODE GASTAR MODELO AQUI ───────────────────────────────────────
     *
     * Esta função não pedia sessão, não tinha limite de taxa e não olhava
     * plano — e chamava o Gemini. Uma server function é um endpoint HTTP como
     * outro qualquer: bastava repetir a chamada para queimar a nossa chave, sem
     * conta, sem login, sem rastro em `ai_usage` de ninguém.
     *
     * ─── POR QUE A SESSÃO É OPCIONAL, E NÃO OBRIGATÓRIA ─────────────────────
     *
     * Porque o que importa aqui é CLÍNICO, não comercial. O nível de risco sai
     * de `assessLevel` — regra pura, em `src/lib/triage.ts` — e a IA só escreve
     * a explicação. `LEVEL_FALLBACK` já existe para o caso de não haver chave.
     *
     * Então recusar a chamada inteira por falta de sessão trocaria um problema
     * de custo por um problema de segurança: uma gestante com sangramento
     * receberia um erro em vez de "procure a maternidade agora". Sem sessão ela
     * recebe a mesma orientação, escrita à mão em vez de gerada.
     *
     * O gasto é que fica trancado. */
    const podeGastarModelo = await (async () => {
      if (!data.accessToken) return false;
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
        if (!u?.user) return false;
        /* Teto por PESSOA, não por IP: o IP de uma operadora móvel é
           compartilhado por milhares de gestantes. */
        return !triagemLimitada(u.user.id);
      } catch {
        return false;
      }
    })();

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (key && podeGastarModelo && reasons.length > 0) {
      try {
        const { generateText } = await import("ai");
        const { createChatProvider, DEFAULT_CHAT_MODEL } = await import("@/lib/ai-gateway.server");
        const google = createChatProvider(key);
        const labels = reasons.join(", ");
        const orient =
          level === "vermelho"
            ? "Oriente procurar atendimento IMEDIATO (192 / pronto-socorro / maternidade)."
            : level === "amarelo"
              ? "Oriente entrar em contato com o consultório ainda hoje."
              : "Tranquilize e oriente manter o pré-natal.";
        const { text, usage } = await generateText({
          model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
          system: `Você é um assistente de orientação de um consultório de obstetrícia especializado em gestação de alto risco.
Regras absolutas:
- NUNCA dê diagnóstico, nome de doença como certeza, nem prescrição.
- O nível de risco JÁ foi definido (${level}). NÃO contradiga nem minimize. ${orient}
- Português brasileiro, tom acolhedor e calmo, no máximo 4 frases.
- Sempre reforce que isto não substitui avaliação médica.`,
          prompt: `A gestante${data.weeks ? ` (${data.weeks} semanas)` : ""} relatou: ${labels}.${
            data.note ? ` Observação dela: "${data.note}".` : ""
          } Escreva uma orientação curta e acolhedora.`,
        });
        if (text?.trim()) message = text.trim();
        /* MEDIDO. Uma trava mecânica achou oito chamadas pagas de modelo que ninguém
     media — esta era uma delas. O consumo não existia em `ai_usage`: nem no
     card, nem na projeção do mês. Canal próprio, e a cota conta só `app`. */
        const { registrarUsoAgora } = await import("./uso-ia.server");
        await registrarUsoAgora({
          especie: "chat",
          modelo: process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL,
          /* OS TOKENS, que estavam na mao e nao eram passados: a linha era gravada
             com zero e a tabela media a RESPOSTA, nunca o custo. */
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          canal: "triagem",
        });
      } catch (e) {
        console.error("triage AI failed", e);
      }
    }

    return { level, reasons, message };
  });

/**
 * Grava a triagem na CONTA da paciente (triage_logs). Numa plataforma de alto
 * risco, um alerta vermelho/amarelo não pode viver só em useState: fica no
 * histórico da paciente e alimenta o dashboard do médico (triagens do mês).
 * Degrada com elegância: se a tabela ainda não foi aplicada, apenas ignora.
 */
export const saveTriageLog = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        level: z.enum(["vermelho", "amarelo", "verde"]),
        symptoms: z.array(z.string()).max(40),
        systolic: z.number().int().nullable().optional(),
        diastolic: z.number().int().nullable().optional(),
        note: z.string().max(500).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await (supabaseAdmin as any).from("triage_logs").insert({
      user_id: u.user.id,
      level: data.level,
      symptoms: data.symptoms,
      systolic: data.systolic ?? null,
      diastolic: data.diastolic ?? null,
      note: data.note ?? null,
    });
    /* ⚠️ A falha existe no log do servidor mesmo quando a tela decide não
       incomodar a paciente. `assessSymptoms`, logo acima, já registra a falha
       da IA — a ESCRITA clínica estava calada onde a chamada de modelo não
       está. Sem isto, "a triagem dela não apareceu na minha fila" não tem onde
       ser investigado. */
    if (error) console.error("[triagem] não gravou em triage_logs", error);
    return { ok: !error };
  });

export { ALL_SYMPTOMS };

/* ─── `listarTriagens` SAIU (ago/2026) ──────────────────────────────────────
 *
 * Ela existia para consertar um buraco real — a triagem morria no INSERT e
 * ninguém do lado do médico lia. O buraco foi fechado por outro caminho:
 * `triage_logs` é uma das onze fontes da view `clinical_events`, e a triagem
 * vermelha/amarela chega à fila de trabalho do painel como episódio, por
 * `eventosQuePedemOlhar`.
 *
 * O que restou desta função foi pior que dead code: o painel a chamava a cada
 * abertura, guardava a lista em estado e NÃO a desenhava em lugar nenhum — só
 * o sinalizador de falha sobrevivia, avisando que "alertas de sintomas"
 * falharam sobre um dado que estava na tela pelo outro caminho.
 *
 * Se a triagem um dia merecer tela própria no painel, ela nasce de
 * `clinical_events` — o contrato único. Não deste segundo caminho.
 */
