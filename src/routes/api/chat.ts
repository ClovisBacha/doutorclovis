import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createChatProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { getBrainContext } from "@/lib/secondbrain.server";

// Rate limit simples por IP (janela fixa, em memória). Em ambiente serverless
// a memória não é compartilhada entre instâncias nem persiste entre cold starts,
// então é uma proteção básica contra abuso/varredura — não uma garantia rígida.
const RATE_LIMIT = 20; // mensagens
const RATE_WINDOW_MS = 60_000; // por minuto
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

/** Extrai o texto da última mensagem de usuário (formato UIMessage com parts). */
function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== "user") continue;
    return (msg.parts ?? [])
      .map((p) => (p.type === "text" ? p.text : ""))
      .join(" ")
      .trim();
  }
  return "";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";
        if (rateLimited(ip)) {
          return new Response("Muitas mensagens em pouco tempo. Aguarde um instante.", {
            status: 429,
          });
        }

        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return new Response("Missing GOOGLE_GENERATIVE_AI_API_KEY", { status: 500 });

        // Segundo Cérebro: contexto de estilo/conduta do médico injetado no
        // system prompt. getBrainContext é safe (falha vira block vazio),
        // então nunca derruba o chat.
        const messages = body.messages as UIMessage[];
        const brain = await getBrainContext(lastUserText(messages));
        const system =
          brain.enabledApp && brain.block ? `${SYSTEM_PROMPT}\n\n${brain.block}` : SYSTEM_PROMPT;

        const google = createChatProvider(key);
        const result = streamText({
          model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
          system,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
        });
      },
    },
  },
});
