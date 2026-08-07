import { createFileRoute } from "@tanstack/react-router";
import { clientIp, makeRateLimiter } from "@/lib/rate-limit.server";
import { naoAutorizado, usuarioDaRequisicao } from "@/lib/api-auth.server";

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
        /* SESSÃO ANTES DE QUALQUER COISA. Este endpoint aceitava 20 MB de áudio
           por requisição, de qualquer um, e transcrevia na chave do
           consultório. */
        const usuario = await usuarioDaRequisicao(request);
        if (!usuario) return naoAutorizado();

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

        /* ─── ESTA CHAMADA NÃO ERA MEDIDA. NEM UMA VEZ. ──────────────────────
         *
         * Uma auditoria achou: era o ÚNICO endpoint de IA da base sem
         * `registrarUsoAgora`. E é o mais caro de todos — aceita 20 MB de áudio,
         * e áudio no Gemini custa ~32 tokens por segundo: 20 MB de webm/opus dá
         * mais de cem minutos, ou seja centenas de milhares de tokens EM UMA
         * REQUISIÇÃO.
         *
         * O efeito de não medir é pior que o custo em si: como não entrava em
         * `ai_usage`, isso não aparecia no card de consumo, nem na projeção do
         * mês, nem em nenhuma conta de margem. O dono descobriria pela fatura do
         * Google, sem ter como saber de onde veio.
         *
         * Medido no canal próprio: transcrição é ferramenta do consultório, não
         * resposta à paciente, então fica FORA de `CANAIS_DA_COTA` — não come a
         * franquia clínica dela. Mas aparece no custo, que é o ponto.
         *
         * `usageMetadata` é o campo da API REST (o SDK chama de `usage`); os
         * nomes são outros e por isso não dá para copiar do resto da base. */
        try {
          const uso = geminiData?.usageMetadata ?? {};
          const { registrarUsoAgora } = await import("@/lib/uso-ia.server");
          await registrarUsoAgora({
            especie: "chat",
            modelo: model,
            inputTokens: uso.promptTokenCount,
            outputTokens: uso.candidatesTokenCount,
            canal: "transcricao",
            doctorId: usuario.id,
          });
        } catch {
          /* medir é opcional; transcrever não pode falhar por causa da medição */
        }

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
