import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assessLevel, LEVEL_FALLBACK, ALL_SYMPTOMS } from "@/lib/triage";

const Schema = z.object({
  symptoms: z.array(z.string()).max(40),
  systolic: z.number().int().min(50).max(300).nullable().optional(),
  diastolic: z.number().int().min(30).max(200).nullable().optional(),
  note: z.string().max(500).optional(),
  weeks: z.number().int().min(0).max(45).nullable().optional(),
});

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

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (key && reasons.length > 0) {
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
        const { text } = await generateText({
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
    return { ok: !error };
  });

export { ALL_SYMPTOMS };
