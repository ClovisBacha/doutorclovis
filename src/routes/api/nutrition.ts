import { createFileRoute } from "@tanstack/react-router";
import { clientIp, makeRateLimiter } from "@/lib/rate-limit.server";
import { naoAutorizado, usuarioDaRequisicao } from "@/lib/api-auth.server";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createChatProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";

const rateLimited = makeRateLimiter(20, 60_000); // 20 req/min

const NUTRITION_SYSTEM = `Você é uma nutricionista especializada em gestação, vinculada ao consultório de um obstetra especialista em gestação de alto risco. Seu papel é orientar gestantes sobre alimentação saudável.

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
        /* SESSÃO ANTES DE QUALQUER COISA. Sem isto, este endpoint era um proxy
           aberto para o Gemini na chave do consultório: qualquer um mandava o
           array de mensagens que quisesse e a fatura era do dono. */
        const usuario = await usuarioDaRequisicao(request);
        if (!usuario) return naoAutorizado();

        const ip = clientIp(request);
        if (rateLimited(ip)) {
          return new Response("Muitas mensagens em pouco tempo. Aguarde.", { status: 429 });
        }

        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages required", { status: 400 });
        }

        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return new Response("Missing GOOGLE_GENERATIVE_AI_API_KEY", { status: 500 });

        /* ─── AS MESMAS QUATRO PROTEÇÕES DO `/api/chat` ────────────────────
           Este endpoint tinha ZERO delas, e é o mesmo modelo respondendo sobre
           "vômitos intensos", "carnes cruas" e "queijos não pasteurizados" —
           ou seja, a causa-raiz da bolha vazia estava intacta aqui enquanto o
           chat principal a consertava.

           Só TEXTO chega ao modelo, e mensagem vazia não passa: uma parte
           `file` abriria o caminho de visão que o produto fechou de propósito,
           e assistente sem texto no histórico faz o Gemini recusar a chamada
           seguinte — a falha vira permanente. */
        const paraOModelo = (body.messages as UIMessage[])
          .filter((m) => m.parts?.some((p) => p.type === "text" && p.text.trim()))
          .map((m) =>
            m.parts?.every((p) => p.type === "text")
              ? m
              : ({ ...m, parts: m.parts.filter((p) => p.type === "text") } as UIMessage),
          );

        const google = createChatProvider(key);
        const result = streamText({
          model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
          system: NUTRITION_SYSTEM,
          messages: await convertToModelMessages(paraOModelo),
          providerOptions: {
            google: {
              /* O raciocínio sai do MESMO orçamento da resposta: sem isto, ele
                 consome tudo e a bolha chega vazia. */
              thinkingConfig: { thinkingBudget: 0 },
              /* O filtro padrão do Gemini é mal calibrado para conversa de
                 pré-natal — e aqui o vocabulário é justamente alimento cru,
                 vômito e perda de peso. */
              safetySettings: [
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
              ],
            },
          },
          maxOutputTokens: 900,
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
          /* Falha DEPOIS de o stream abrir não pode mais virar código HTTP: o
             200 já saiu. Sem este texto, a SDK manda "An error occurred." e a
             paciente vê uma bolha praticamente vazia. */
          onError: (erro) => {
            const e = erro as any;
            const causa = e?.lastError ?? e?.cause ?? e;
            const status = Number(causa?.statusCode ?? causa?.status ?? 0);
            console.error(`[nutrition] stream falhou — HTTP ${status || "?"}`);
            return status === 429
              ? "Estou recebendo muitas perguntas neste momento. Tente de novo em instantes 💛"
              : "Não consegui responder agora. Pode tentar de novo?";
          },
        });
      },
    },
  },
});
