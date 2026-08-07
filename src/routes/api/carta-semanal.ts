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

        /* ─── OS DOIS TETOS QUE FALTAVAM ────────────────────────────────────
           O comentário do topo deste arquivo já dizia: "é a pior das três nesse
           aspecto: `babyDesc` não tem teto de tamanho (não há zod aqui, só um
           cast) e entra cru no prompt". Metade do conserto foi feita nos outros
           endpoints e este ficou: qualquer pessoa logada mandava um `babyDesc`
           de um megabyte e ele ia inteiro para o modelo, na nossa chave.
           Os dois campos são DESCRITIVOS — nome de bebê e uma frase sobre a
           semana. Estes tetos não cortam nada que o app mande de verdade. */
        const babyName = (body.babyName?.trim() || "").slice(0, 60) || null;
        const babyDesc = (body.babyDesc?.trim() || "").slice(0, 600);

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
        const { text, usage } = await generateText({
          model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
          prompt,
          /* E O TETO DE SAÍDA. O prompt pede "máximo 180 palavras", mas isso é
             pedido, não limite: um modelo que entra em laço gera até o teto do
             provedor e a conta é nossa. 180 palavras cabem folgadamente aqui. */
          maxOutputTokens: 800,
        });

        /* MEDIDO. Uma trava mecânica achou oito chamadas pagas de modelo que
       ninguém media — esta era uma delas. Canal próprio: a cota conta só
       `app`, então isto aparece no consumo sem comer a franquia clínica. */
        const { registrarUsoAgora } = await import("@/lib/uso-ia.server");
        await registrarUsoAgora({
          especie: "chat",
          modelo: process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL,
          /* OS TOKENS, que estavam na mao e nao eram passados: a linha era gravada
             com zero e a tabela media a RESPOSTA, nunca o custo. */
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          canal: "carta-semanal",
        });
        return new Response(JSON.stringify({ ok: true, letter: text.trim() }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
