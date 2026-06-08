import { createFileRoute } from "@tanstack/react-router";
import { createChatProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { generateText } from "ai";

const RATE_LIMIT = 10;
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

export const Route = createFileRoute("/api/carta-semanal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";

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

        const body = (await request.json()) as { week?: number; babyName?: string; babyDesc?: string };
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
