import { createFileRoute } from "@tanstack/react-router";
import { clientIp, makeRateLimiter } from "@/lib/rate-limit.server";
import { createChatProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { generateText } from "ai";

const rateLimited = makeRateLimiter(10, 60_000); // 10 req/min

export const Route = createFileRoute("/api/carta-semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        /* O TERCEIRO PROXY ABERTO.
           `api-auth.server.ts` foi criado para fechar `nutrition` e
           `transcribe`, e o cabeçalho dele diz "estes dois ficaram para trás" —
           mas eram TRÊS. Esta rota chamava o Gemini na chave do consultório para
           qualquer POST da internet, e é a pior das três nesse aspecto:
           `babyDesc` não tem teto de tamanho (não há zod aqui, só um cast) e
           entra cru no prompt.

           O limitador de taxa em memória não conta: na Vercel cada instância
           tem o próprio Map, então N invocações concorrentes valem N × o
           limite. É o que o próprio `api-auth.server.ts` já explica. */
        const { naoAutorizado, usuarioDaRequisicao } = await import("@/lib/api-auth.server");
        if (!(await usuarioDaRequisicao(request))) return naoAutorizado();

        const ip = clientIp(request);

        if (rateLimited(ip)) {
          return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde." }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }

        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "IA não configurada." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const body = (await request.json()) as {
          week?: number;
          babyName?: string;
          babyDesc?: string;
        };
        const week = body.week;
        if (!week || week < 4 || week > 42) {
          return new Response(JSON.stringify({ error: "Semana inválida." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const babyName = body.babyName?.trim() || null;
        const babyDesc = body.babyDesc?.trim() || "";

        const addressee = babyName ? `Mamãe ${babyName}` : "Mamãe";

        const prompt = `Escreva uma carta emocionante e poética na perspectiva de um bebê na ${week}ª semana gestacional para sua mãe.

Informações sobre o bebê nessa semana: ${babyDesc || `semana ${week} de gestação`}

Regras:
- Tom: carinhoso, poético, emocionante, levemente lúdico
- Use a perspectiva de primeira pessoa do bebê
- Mencione ESPECIFICAMENTE o que o bebê está desenvolvendo/sentindo nessa semana (tamanho, órgãos, sentidos)
- Expresse amor e gratidão pela mãe
- Máximo 180 palavras
- Escreva em português brasileiro
- Comece com "Querida ${addressee},"
- Assine como "Com todo o meu amor, seu bebê 💙"
- NÃO use formatação markdown, apenas texto simples com quebras de linha`;

        const google = createChatProvider(key);
        const { text } = await generateText({
          model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
          prompt,
        });

        return new Response(JSON.stringify({ ok: true, letter: text.trim() }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
