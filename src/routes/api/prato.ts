/**
 * A FOTO DA NUTRIÇÃO — o prato e o rótulo.
 *
 * ─── POR QUE NÃO É O `/api/nutrition` QUE JÁ EXISTE ────────────────────────
 *
 * Aquele endpoint FILTRA as partes não-texto de propósito, e o comentário dele
 * diz por quê: "uma parte `file` abriria o caminho de visão que o produto
 * fechou". A decisão continua valendo para a CONVERSA — o que muda aqui é que
 * a foto entra por uma porta com teto próprio, tipo conferido, limitador mais
 * apertado e medição própria, em vez de dentro de um array de mensagens que o
 * cliente monta.
 *
 * ⚠️ A FOTO NÃO É GUARDADA em lugar nenhum: nem balde, nem coluna, nem URL.
 * Entra pelo corpo da requisição, vira texto e some com a função. É a mesma
 * decisão do áudio do diário — e aqui ela pesa mais, porque uma foto de prato
 * carrega a cozinha dela e uma de rótulo pode carregar o supermercado.
 *
 * ⚠️ E O LIMITADOR É MUITO MAIS APERTADO QUE O DA CONVERSA (4 em 5 minutos
 * contra 20 por minuto): imagem custa uma ordem de grandeza mais em tokens que
 * texto, e o gesto real é "fotografar a refeição", que acontece de três em
 * três horas — nunca dez vezes por minuto.
 */

import { createFileRoute } from "@tanstack/react-router";
import { clientIp, makeRateLimiter } from "@/lib/rate-limit.server";
import { naoAutorizado, usuarioDaRequisicao } from "@/lib/api-auth.server";
import { consultorioDaPaciente } from "@/lib/consultorio-da-paciente.server";
import {
  FOTO_BYTES_MAX,
  ehImagemAceita,
  promptDaFoto,
  type AssuntoDaFoto,
} from "@/lib/foto-da-nutricao";

const rateLimited = makeRateLimiter(4, 5 * 60_000);

export const Route = createFileRoute("/api/prato")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (corpo: unknown, status = 200) =>
          new Response(JSON.stringify(corpo), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        /* SESSÃO ANTES DE QUALQUER COISA — um endpoint de visão aberto é a
           chave do consultório pagando a imagem de quem passar, e imagem é a
           chamada mais cara que este app faz. */
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

        const foto = formData.get("foto");
        if (!(foto instanceof File) || foto.size === 0) {
          return json({ ok: false, motivo: "sem_foto" }, 400);
        }
        if (foto.size > FOTO_BYTES_MAX) return json({ ok: false, motivo: "grande" }, 413);
        /* O tipo é conferido no SERVIDOR porque o cliente pode mentir — e um
           tipo que o Gemini não entende volta como 400 opaco. */
        if (!ehImagemAceita(foto.type)) return json({ ok: false, motivo: "formato" }, 415);

        /* ⚠️ Assunto desconhecido cai em "prato", que é o prompt que NÃO lê
           números: um valor forjado no corpo do pedido não pode escolher o
           caminho que fala em sódio e açúcar de um rótulo. */
        const bruto = String(formData.get("assunto") ?? "");
        const assunto: AssuntoDaFoto = bruto === "rotulo" ? "rotulo" : "prato";

        /* ⚠️ O MESMO `consultorioDaPaciente` da conversa, e não uma segunda
           leitura: é ele que falha FECHADO no Modo Cuidado. Uma cópia aqui
           faria a resposta da foto falar da gestação de quem a perdeu. */
        const { patientId, careMode } = await consultorioDaPaciente(usuario.id);

        /* ⚠️ E o MESMO bloco da paciente da conversa: é dele que sai a alergia,
           que é a única coisa nesta tela que pode fazer mal de verdade. Ele já
           falha em silêncio (bloco vazio) em vez de falhar aberto. */
        let blocoDaPaciente = "";
        try {
          const { blocoDaNutricao } = await import("@/lib/nutricao-contexto.server");
          blocoDaPaciente = await blocoDaNutricao(patientId, careMode);
        } catch (e) {
          console.error("[prato] contexto da paciente não veio", e);
        }

        const base64 = Buffer.from(await foto.arrayBuffer()).toString("base64");
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
                    { text: promptDaFoto(assunto) + blocoDaPaciente },
                    {
                      inline_data: {
                        mime_type: foto.type.split(";")[0].trim().toLowerCase(),
                        data: base64,
                      },
                    },
                  ],
                },
              ],
              /* Ler um rótulo é a tarefa em que inventar é o defeito. */
              generationConfig: { temperature: 0.2 },
            }),
          });
        } catch (e) {
          console.error("[prato] a leitura da foto não saiu", e);
          return json({ ok: false, motivo: "falhou" }, 502);
        }

        if (!resposta.ok) {
          console.error("[prato] Gemini recusou", resposta.status, await resposta.text());
          return json({ ok: false, motivo: "falhou" }, 502);
        }

        const dados = (await resposta.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };

        /* ─── MEDIR SEMPRE, E FORA DA COTA ────────────────────────────────
           Esta é a chamada mais cara do app, e é justamente por isso que ela
           NÃO pode cobrar da franquia clínica dela.

           ⚠️ A primeira versão usava `canal: "nutricao"` com o argumento de
           que "é a mesma nutricionista, e separar partiria o custo em dois
           lugares". `travas-do-servidor.test.ts` reprovou, e estava certa: os
           canais de `CANAIS_DA_COTA` são a franquia de DÚVIDA CLÍNICA da
           gestante, e visão custa uma ordem de grandeza mais que texto. Três
           fotos de prato podiam consumir a cota de que ela precisa para
           perguntar sobre dor de cabeça com vista embaçada — que é exatamente
           o estrago que aquela trava existe para impedir.

           `canal: "prato"` fica FORA da cota, como `canal: "diario"` da
           transcrição: aparece no custo da plataforma, que é onde deve doer, e
           não come nada dela. */
        try {
          const uso = dados.usageMetadata ?? {};
          const { registrarUsoAgora } = await import("@/lib/uso-ia.server");
          await registrarUsoAgora({
            especie: "chat",
            modelo,
            inputTokens: uso.promptTokenCount,
            outputTokens: uso.candidatesTokenCount,
            canal: "prato",
            patientId,
          });
        } catch {
          /* medir é opcional; responder não pode falhar por causa da medição */
        }

        const texto = (dados.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
          .replace(/^```[a-z]*\n?|```$/g, "")
          .trim();
        /* Vazio não é sucesso mudo: a tela precisa distinguir "não consegui
           ler" de uma resposta que chegou. Sem isto, a bolha renderiza "…"
           para sempre — o defeito que a conversa já pagou aqui. */
        if (!texto) return json({ ok: false, motivo: "vazio" }, 502);
        return json({ ok: true, texto });
      },
    },
  },
});
