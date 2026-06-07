import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `Você é o assistente virtual do consultório do Dr. Clóvis Bacha, ginecologista e obstetra brasileiro especialista em gestação de alto risco.

Sobre o Dr. Clóvis:
- Formado em Medicina, com residência em Ginecologia e Obstetrícia.
- Especialista em medicina fetal e gestação de alto risco (hipertensão gestacional, diabetes gestacional, gemelaridade, malformações fetais, prematuridade, etc).
- Atendimento humanizado, acolhedor e baseado em evidências.

Sobre o atendimento:
- Consultas presenciais e online (telemedicina).
- Exames e ultrassonografia obstétrica acompanhados pelo doutor.
- Acompanhamento pré-natal completo e pós-parto.

Agendamento:
- O paciente pode solicitar consulta pela página /agendamento do site.
- O consultório confirma horário por telefone/e-mail.

Regras de resposta:
- Responda em português brasileiro, com tom acolhedor, claro e profissional.
- Seja conciso (3 a 6 frases) salvo se a paciente pedir mais detalhe.
- NUNCA dê diagnóstico, prescrição ou conduta médica. Para sintomas, oriente buscar avaliação presencial e, em urgência, ligar 192 (SAMU) ou ir ao pronto-socorro.
- Se a pessoa quiser marcar consulta, direcione para a página /agendamento.
- Não invente dados (telefone, endereço, valores). Se não souber, peça para a paciente entrar em contato pelo site.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});