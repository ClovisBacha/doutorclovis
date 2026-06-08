import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createChatProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

const NUTRITION_SYSTEM = `Você é uma nutricionista especializada em gestação, vinculada ao consultório do Dr. Clóvis Bacha (obstetrícia, alto risco). Seu papel é orientar gestantes sobre alimentação saudável.

Regras absolutas:
- Responda em português brasileiro, tom acolhedor e prático.
- Seja concisa (3–6 frases), a não ser que a gestante peça mais detalhes.
- NUNCA prescreva dieta formal nem substitua a avaliação nutricional individual.
- NUNCA dê valores calóricos rígidos sem conhecer o perfil completo da paciente.
- Quando a paciente mencionar sintomas preocupantes (vômitos intensos, perda de peso, etc.), sempre oriente procurar o médico.
- Para dúvidas sobre suplementos específicos (ferro, cálcio, ácido fólico), informe os alimentos-fonte mas oriente que a dosagem deve ser prescrita pelo médico.
- Se a paciente informar sua semana gestacional, adapte as orientações ao trimestre.
- Mencione alimentos que devem ser EVITADOS quando relevante (peixes com mercúrio, queijos não pasteurizados, carnes cruas, álcool, embutidos em excesso).
- Valorize uma alimentação variada, colorida e baseada em alimentos in natura.`;

export const Route = createFileRoute("/api/nutrition")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";

        if (rateLimited(ip)) {
          return new Response("Muitas mensagens em pouco tempo. Aguarde.", { status: 429 });
        }

        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return new Response("Missing GOOGLE_GENERATIVE_AI_API_KEY", { status: 500 });

        const google = createChatProvider(key);
        const result = streamText({
          model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
          system: NUTRITION_SYSTEM,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});
