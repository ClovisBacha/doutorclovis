import { createFileRoute } from "@tanstack/react-router";
import { clientIp, makeRateLimiter } from "@/lib/rate-limit.server";

// Rate limit: 10 transcrições por minuto por IP
const rateLimited = makeRateLimiter(10, 60_000); // 10 req/min

const TRANSCRIBE_PROMPT = `Você é um assistente médico especializado em obstetrícia. Analise a gravação de áudio desta consulta médica e retorne APENAS um JSON válido (sem markdown) com os seguintes campos:

{
  "transcript": "transcrição completa da consulta",
  "titulo": "título resumido da consulta (máx 60 chars)",
  "orientacoes": ["orientação 1", "orientação 2"],
  "medicamentos": ["medicamento com dose se mencionado"],
  "proximos_exames": ["exame solicitado 1"],
  "proxima_consulta": "quando retornar (ou null se não mencionado)"
}

Se o áudio estiver inaudível ou sem conteúdo médico relevante, retorne transcript com o que foi captado e arrays vazios.`;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return new Response(JSON.stringify({ error: "Dados inválidos." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const audio = formData.get("audio") as File | null;
        if (!audio || audio.size === 0) {
          return new Response(JSON.stringify({ error: "Áudio não recebido." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 20 MB limit for inline data
        if (audio.size > 20 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "Áudio muito grande (máx 20 MB)." }), {
            status: 413,
            headers: { "Content-Type": "application/json" },
          });
        }

        const buffer = await audio.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const mimeType = audio.type || "audio/webm";

        // Gemini REST API — inline audio data
        const model = process.env.CHAT_MODEL || "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

        const geminiBody = {
          contents: [
            {
              parts: [
                { text: TRANSCRIBE_PROMPT },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        };

        const geminiRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          console.error("Gemini transcribe error:", errText);
          return new Response(JSON.stringify({ error: "Erro ao transcrever. Tente novamente." }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }

        const geminiData = (await geminiRes.json()) as any;
        const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        try {
          const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return new Response(JSON.stringify({ ok: true, ...parsed }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response(
            JSON.stringify({
              ok: true,
              transcript: raw,
              titulo: "Consulta",
              orientacoes: [],
              medicamentos: [],
              proximos_exames: [],
              proxima_consulta: null,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
