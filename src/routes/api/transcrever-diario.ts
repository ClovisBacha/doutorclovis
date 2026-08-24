/**
 * TRANSCREVER A VOZ DA PACIENTE PARA O DIÁRIO DELA.
 *
 * ─── POR QUE NÃO É O `/api/transcribe` QUE JÁ EXISTE ───────────────────────
 *
 * Aquele é o da CONSULTA, e reaproveitá-lo estaria errado em três frentes:
 *
 *  1. **O prompt é clínico.** Ele pede um JSON com orientações, medicamentos e
 *     próximos exames — "hoje o café estava gostoso" voltaria como ficha
 *     médica com três listas vazias.
 *  2. **O portão é do plano pago** (`aiApp`). A gratidão é atividade de
 *     bem-estar, aberta a todas: a maioria das pacientes receberia 402 ao
 *     tocar no microfone.
 *  3. **O teto é de 20 MB.** Lá é uma consulta inteira; aqui é uma frase. Vinte
 *     megabytes de áudio no Gemini custam ~32 tokens por segundo, ou seja
 *     centenas de milhares de tokens numa requisição — para um recado de um
 *     minuto.
 *
 * O que é reaproveitado é o que estava certo lá: a sessão conferida ANTES de
 * tudo, o limitador por IP, a chamada REST com `inline_data` (provada neste
 * repositório) e a MEDIÇÃO — aquele endpoint passou meses sendo o único de IA
 * sem `registrarUsoAgora`, e o dono só descobriria pela fatura do Google.
 *
 * ⚠️ O ÁUDIO NÃO É GUARDADO em lugar nenhum. Entra pelo corpo da requisição,
 * vira texto e some com a função. O que a paciente quer registrar é o texto.
 */

import { createFileRoute } from "@tanstack/react-router";
import { clientIp, makeRateLimiter } from "@/lib/rate-limit.server";
import { naoAutorizado, usuarioDaRequisicao } from "@/lib/api-auth.server";
import { LIMITE_BYTES, ehAudioAceito, tipoBase } from "@/lib/gravador";

/* Seis por minuto: o gesto é "falar uma frase e conferir o texto", e ninguém
   faz isso dez vezes em sessenta segundos. */
const rateLimited = makeRateLimiter(6, 60_000);

/**
 * ⚠️ O PROMPT NÃO INTERPRETA — ele transcreve.
 *
 * A tentação é pedir ao modelo que "organize" ou "melhore" a frase dela. Isso
 * faria o diário ganhar palavras que ela não disse, num texto que o médico lê
 * no prontuário. O modelo aqui é um teclado, não um redator.
 */
const PROMPT = [
  "Transcreva EXATAMENTE o que a pessoa falou neste áudio, em português do Brasil.",
  "Regras:",
  "- Devolva SOMENTE a transcrição, sem aspas, sem markdown, sem comentários.",
  "- Não resuma, não corrija, não complete e não reescreva o que foi dito.",
  "- Não acrescente saudação, conclusão nem interpretação.",
  "- Pontue de forma simples para a frase ficar legível.",
  "- Se o áudio estiver inaudível ou vazio, devolva uma linha vazia.",
].join("\n");

export const Route = createFileRoute("/api/transcrever-diario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (corpo: unknown, status = 200) =>
          new Response(JSON.stringify(corpo), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        /* SESSÃO ANTES DE QUALQUER COISA — um endpoint de transcrição aberto é
           a chave do consultório pagando o áudio de quem passar. */
        const usuario = await usuarioDaRequisicao(request);
        if (!usuario) return naoAutorizado();

        if (rateLimited(clientIp(request))) {
          return json({ ok: false, motivo: "muitas" }, 429);
        }

        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return json({ ok: false, motivo: "sem_ia" }, 503);

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return json({ ok: false, motivo: "invalido" }, 400);
        }

        const audio = formData.get("audio");
        if (!(audio instanceof File) || audio.size === 0) {
          return json({ ok: false, motivo: "sem_audio" }, 400);
        }
        if (audio.size > LIMITE_BYTES) return json({ ok: false, motivo: "grande" }, 413);
        /* O tipo é conferido no servidor porque o cliente pode mentir — e um
           tipo que o Gemini não entende volta como erro 400 opaco. */
        if (!ehAudioAceito(audio.type)) return json({ ok: false, motivo: "formato" }, 415);

        const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
        const modelo = process.env.CHAT_MODEL || "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`;

        let resposta: Response;
        try {
          resposta = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: PROMPT },
                    { inline_data: { mime_type: tipoBase(audio.type), data: base64 } },
                  ],
                },
              ],
              /* Transcrição é a tarefa em que criatividade é defeito. */
              generationConfig: { temperature: 0 },
            }),
          });
        } catch (e) {
          console.error("[diario] transcrição não saiu", e);
          return json({ ok: false, motivo: "falhou" }, 502);
        }

        if (!resposta.ok) {
          console.error("[diario] Gemini recusou", resposta.status, await resposta.text());
          return json({ ok: false, motivo: "falhou" }, 502);
        }

        const dados = (await resposta.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };

        /* MEDIR SEMPRE. O endpoint da consulta ficou meses sem isto e era o mais
           caro da base: não aparecia no card de consumo, nem na projeção do mês,
           nem em conta de margem nenhuma.
           `canal: "diario"` fica FORA de `CANAIS_DA_COTA` de propósito — isto não
           é resposta do cérebro do médico e não pode comer a franquia clínica
           dela; mas aparece no custo da plataforma, que é onde deve doer. */
        try {
          const uso = dados.usageMetadata ?? {};
          const { registrarUsoAgora } = await import("@/lib/uso-ia.server");
          await registrarUsoAgora({
            especie: "chat",
            modelo,
            inputTokens: uso.promptTokenCount,
            outputTokens: uso.candidatesTokenCount,
            canal: "diario",
            patientId: usuario.id,
          });
        } catch {
          /* medir é opcional; transcrever não pode falhar por causa da medição */
        }

        const texto = (dados.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
          .replace(/^```[a-z]*\n?|```$/g, "")
          .trim();
        /* Vazio não é erro: ela pode ter tocado sem querer, ou falado longe do
           microfone. A tela diz "não consegui ouvir" e o campo dela fica
           intocado — nunca apagado. */
        return json({ ok: true, texto });
      },
    },
  },
});
