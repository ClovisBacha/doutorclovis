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

        /* ⚠️ NÃO `instanceof File`: o global `File` existe ou não conforme o
           runtime, e um ReferenceError aqui virava 500 sem motivo nenhum. O
           que importa é a FORMA — tem bytes, tem tipo, tem tamanho. */
        const foto = formData.get("foto") as Blob | string | null;
        if (
          !foto ||
          typeof foto === "string" ||
          typeof (foto as Blob).arrayBuffer !== "function" ||
          foto.size === 0
        ) {
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
            /* ⚠️ TETO DE TEMPO abaixo do da função (30 s): sem ele, uma leitura
               lenta morre com a função e a paciente recebe um 504 sem motivo.
               Com ele, ela recebe "demorou" e a instrução de tentar de novo. */
            signal: AbortSignal.timeout(22_000),
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
              generationConfig: {
                /* Ler um rótulo é a tarefa em que inventar é o defeito. */
                temperature: 0.2,
                /* ⚠️ A MESMA DECISÃO DA CONVERSA (`/api/nutrition`): o
                   raciocínio do modelo sai do mesmo orçamento e do mesmo
                   relógio da resposta. Aqui ele NÃO estava desligado, e numa
                   imagem ele é o que separa três segundos de vinte. */
                thinkingConfig: { thinkingBudget: 0 },
                maxOutputTokens: 700,
              },
              /* O filtro padrão do Gemini é mal calibrado para comida de
                 verdade — um prato com carne crua ou um rótulo de vinho sem
                 álcool já disparam. O MESMO limiar da conversa. */
              safetySettings: [
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
              ],
            }),
          });
        } catch (e) {
          /* ⚠️ Cada falha tem NOME. Antes, tudo isto era "falhou" e virava uma
             frase só na tela — e o log da Vercel era o único lugar onde a
             causa existia. */
          const demorou = (e as { name?: string })?.name === "TimeoutError";
          console.error("[prato] a leitura da foto não saiu", demorou ? "tempo esgotado" : e);
          return json({ ok: false, motivo: demorou ? "demorou" : "rede" }, 502);
        }

        if (!resposta.ok) {
          console.error("[prato] Gemini recusou", resposta.status, await resposta.text());
          return json({ ok: false, motivo: `gemini_${resposta.status}` }, 502);
        }

        const dados = (await resposta.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
          promptFeedback?: { blockReason?: string };
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

        /* ⚠️ BLOQUEADA é outra coisa que VAZIA. "Tente com mais luz" para uma
           foto que o filtro recusou por ter gente nela manda a paciente repetir
           o que não vai funcionar; o recado certo é enquadrar só a comida. */
        const bloqueada =
          !!dados.promptFeedback?.blockReason || dados.candidates?.[0]?.finishReason === "SAFETY";
        if (bloqueada) {
          console.error(
            "[prato] bloqueada pelo filtro",
            dados.promptFeedback?.blockReason ?? "SAFETY",
          );
          return json({ ok: false, motivo: "bloqueada" }, 502);
        }
        /* ⚠️ TODAS as partes de texto, e não `parts[0]`: o modelo pode dividir a
           resposta, e ficar com a primeira entregava metade e chamava de tudo. */
        const texto = (dados.candidates?.[0]?.content?.parts ?? [])
          .map((p) => p.text ?? "")
          .join("")
          .replace(/^```[a-z]*\n?|```$/g, "")
          .trim();
        /* Vazio não é sucesso mudo: a tela precisa distinguir "não consegui
           ler" de uma resposta que chegou. Sem isto, a bolha renderiza "…"
           para sempre — o defeito que a conversa já pagou aqui. */
        if (!texto) return json({ ok: false, motivo: "vazio" }, 502);
        /* ASSINADA como a conversa: é o que deixa "o que eu poderia
           acrescentar?" logo depois da foto funcionar — sem a assinatura, a
           descrição do prato cairia do histórico e a pergunta seguinte
           perderia o assunto. Ver `turno-assinado.server.ts`. */
        const { assinarTurno, chaveDeAssinatura } = await import("@/lib/turno-assinado.server");
        const chave = chaveDeAssinatura(process.env.SUPABASE_SERVICE_ROLE_KEY);
        const assinatura = chave ? assinarTurno(chave, usuario.id, texto) : undefined;
        return json({ ok: true, texto, assinatura });
      },
    },
  },
});
