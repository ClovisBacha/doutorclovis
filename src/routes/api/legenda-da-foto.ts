/**
 * TRÊS LEGENDAS PARA A FOTO QUE ELA ACABOU DE ESCOLHER.
 *
 * Pedido do dono (ideia 9): "escrever algo" é a tela onde mais gente desiste de
 * publicar, e o cérebro já está pago e já conhece a semana dela.
 *
 * ─── O QUE ESTE ENDPOINT COPIOU DE `/api/transcrever-diario` ───────────────
 *
 * A sessão conferida ANTES de tudo, o limitador por IP, a chamada REST com
 * `inline_data` e a MEDIÇÃO — aquele endpoint da consulta passou meses sendo o
 * único de IA sem `registrarUsoAgora`, e era o mais caro da base.
 *
 * ─── E O QUE ELE FAZ QUE NENHUM OUTRO FAZ ──────────────────────────────────
 *
 * ⚠️ **A RÉGUA CLÍNICA RODA ANTES DE SUGERIR.** `publicarPost` recusa texto
 * clínico; se a sugestão fosse oferecida sem passar pela mesma régua, o botão
 * entregaria uma frase bonita e o "Compartilhar" a recusaria depois — o app
 * escrevendo o que o app proíbe, com o dedo dela no meio. Cada legenda passa
 * por `triarTexto`, e o que não é `publicavel` simplesmente não é oferecido.
 *
 * ⚠️ **A FOTO NÃO É GUARDADA.** Entra pelo corpo, vai ao modelo e some com a
 * função. Ela já foi reduzida a 512px no navegador (`LADO_PARA_A_IA`) —
 * metade do que vai para o post, porque foto de gestação é o dado que menos
 * pode circular à toa.
 */

import { createFileRoute } from "@tanstack/react-router";
import { clientIp, makeRateLimiter } from "@/lib/rate-limit.server";
import { naoAutorizado, usuarioDaRequisicao } from "@/lib/api-auth.server";
import {
  contextoDaLegenda,
  LIMITE_DA_FOTO_BYTES,
  lerSugestoes,
  promptDaLegenda,
  type ContextoDaLegenda,
} from "@/lib/legenda-sugerida";
import { entradaDoSelo, hojeEmSaoPaulo } from "@/lib/selo-do-perfil";

/* Quatro por minuto: o gesto é "escolher a foto e pedir ideia", e ninguém faz
   isso dez vezes em sessenta segundos. Mais apertado que o do diário porque
   aqui cada chamada carrega uma IMAGEM. */
const rateLimited = makeRateLimiter(4, 60_000);

const TIPOS = new Set(["image/jpeg", "image/png", "image/webp"]);

export const Route = createFileRoute("/api/legenda-da-foto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (corpo: unknown, status = 200) =>
          new Response(JSON.stringify(corpo), {
            status,
            headers: { "Content-Type": "application/json" },
          });

        /* SESSÃO ANTES DE QUALQUER COISA — um endpoint de visão aberto é a
           chave do consultório pagando a imagem de quem passar. */
        const usuario = await usuarioDaRequisicao(request);
        if (!usuario) return naoAutorizado();

        if (rateLimited(clientIp(request))) return json({ ok: false, motivo: "muitas" }, 429);

        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return json({ ok: false, motivo: "sem_ia" }, 503);

        let corpo: { foto?: string };
        try {
          corpo = (await request.json()) as { foto?: string };
        } catch {
          return json({ ok: false, motivo: "invalido" }, 400);
        }

        /* `data:image/jpeg;base64,...` — o mesmo formato que o compositor já
           usa para as fotos do post. */
        const casa = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=]+)$/.exec(corpo.foto ?? "");
        if (!casa) return json({ ok: false, motivo: "sem_foto" }, 400);
        const [, tipo, base64] = casa;
        if (!TIPOS.has(tipo)) return json({ ok: false, motivo: "formato" }, 415);
        /* O teto é conferido no SERVIDOR: a redução acontece no navegador, e um
           corpo montado à mão nem passa pela tela. */
        if (base64.length * 0.75 > LIMITE_DA_FOTO_BYTES) {
          return json({ ok: false, motivo: "grande" }, 413);
        }

        /* ─── O CONTEXTO SAI DO BANCO, NUNCA DO CLIENTE ───────────────────────
           A semana e as chaves do perfil decidem o que entra no prompt. Vindas
           do corpo da requisição, bastaria trocar um booleano para o modelo
           escrever a semana de quem a escondeu. */
        let ctx: ContextoDaLegenda = { semana: null, nomeDoBebe: null };
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const sb = supabaseAdmin as any;
          /* ⚠️ `birth_date` FAZ PARTE DA RÉGUA, e faltava. `computeGestation`
             conta para sempre a partir da DUM: sem esta coluna, duas semanas
             depois do parto o prompt dizia "a pessoa está com 41 semanas de
             gestação" e o modelo devolvia legendas na voz de uma grávida, sobre
             a foto do recém-nascido dela. */
          const BASE =
            "lmp_date, reference_date, reference_weeks, reference_days, birth_date, baby_name, care_mode";
          /* ⚠️ **`id`, e NUNCA `user_id`.** `patient_profiles` tem a chave
             primária `id`, que JÁ É o uuid de `auth.users` (a primeira
             migration: `id UUID PRIMARY KEY REFERENCES auth.users(id)`). A
             coluna `user_id` não existe — e como o recuo por coluna ausente
             tenta a segunda leitura com o MESMO filtro errado, as duas
             falhavam, `perfil` vinha `null` e o endpoint devolvia
             `sugestoes: []` para TODA paciente. O botão "✨ Sugerir legenda"
             nunca funcionou: ele dizia "não consegui pensar em nada" desde o
             primeiro dia, e o `try/catch` fazia isso em silêncio.
             `patient-profiles-por-id.test.ts` é a catraca. */
          const um = async (colunas: string) =>
            await sb.from("patient_profiles").select(colunas).eq("id", usuario.id).maybeSingle();

          /* ⚠️ RECUO POR COLUNA AUSENTE. `mostrar_semana`/`mostrar_bebe` nascem
             num `APLICAR_` que o dono roda À MÃO, depois do deploy — e o
             PostgREST recusa o SELECT INTEIRO por causa de uma coluna que não
             conhece. Sem o recuo, o botão não funcionaria para ninguém na
             janela entre o deploy e o SQL. As chaves ausentes valem `false`: a
             paciente não pode ter ligado o que o banco ainda não guarda, e é o
             lado seguro do erro. */
          let r = await um(`${BASE}, mostrar_semana, mostrar_bebe`);
          if (r.error) r = await um(BASE);
          const perfil = r.data as Record<string, unknown> | null;

          /* ⚠️ MODO CUIDADO FECHA A PORTA, e fecha aqui e não só na tela: quem
             perdeu a gestação não recebe do app uma legenda animada sobre a
             foto dela. Falha ao LER o perfil também fecha — errar para o lado
             de não sugerir é gratuito; errar para o outro, não.
             (O portão vive TAMBÉM dentro de `semanaPublica`; esta saída
             antecipada é o que impede a legenda genérica de sair no luto.) */
          if (!perfil || perfil.care_mode) return json({ ok: true, sugestoes: [] });

          const { computeGestation } = await import("@/lib/gestacao");
          const gest = computeGestation({
            lmp: perfil.lmp_date as string | null,
            referenceDate: perfil.reference_date as string | null,
            referenceWeeks: perfil.reference_weeks as number | null,
            referenceDays: perfil.reference_days as number | null,
            /* ⚠️ O dia é o de SÃO PAULO, não o do contêiner — a mesma linha que
               `seloDe` já tinha, e que faltava aqui: sem ela, das 21h à
               meia-noite a legenda falava de uma semana e o perfil de outra. */
            today: hojeEmSaoPaulo(),
          });
          /* ⚠️ A MESMA RÉGUA DO SELO, e não uma segunda leitura das chaves.
             Esta tela reescrevia metade dela (só a chave `mostrar_semana`) e
             deixava passar os dois silêncios que mais importam: já pariu, e
             acima de 42 semanas. */
          ctx = contextoDaLegenda(entradaDoSelo(perfil as any, gest ? gest.totalDays : null));
        } catch {
          /* Sem contexto o prompt continua válido: o modelo escreve sobre a
             foto e nada mais. Melhor uma legenda genérica que nenhuma. */
        }

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
                    { text: promptDaLegenda(ctx) },
                    { inline_data: { mime_type: tipo, data: base64 } },
                  ],
                },
              ],
              /* Aqui criatividade é o produto — ao contrário da transcrição,
                 que roda em 0. Mas não alta: três tons diferentes, não três
                 delírios. */
              generationConfig: { temperature: 0.8, maxOutputTokens: 300 },
            }),
          });
        } catch (e) {
          console.error("[legenda] não saiu", e);
          return json({ ok: false, motivo: "falhou" }, 502);
        }

        if (!resposta.ok) {
          console.error("[legenda] Gemini recusou", resposta.status, await resposta.text());
          return json({ ok: false, motivo: "falhou" }, 502);
        }

        const dados = (await resposta.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };

        /* MEDIR SEMPRE — ver o comentário gêmeo em `transcrever-diario`.
           `canal: "legenda"` fica FORA de `CANAIS_DA_COTA`: isto não é resposta
           do cérebro do médico e não pode comer a franquia clínica dela, mas
           aparece no custo da plataforma, que é onde deve doer. */
        try {
          const uso = dados.usageMetadata ?? {};
          const { registrarUsoAgora } = await import("@/lib/uso-ia.server");
          await registrarUsoAgora({
            especie: "chat",
            modelo,
            inputTokens: uso.promptTokenCount,
            outputTokens: uso.candidatesTokenCount,
            canal: "legenda",
            patientId: usuario.id,
          });
        } catch {
          /* medir é opcional; sugerir não pode falhar por causa da medição */
        }

        const bruto = dados.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

        /* ⚠️ A RÉGUA CLÍNICA, ANTES DE OFERECER. Ver o cabeçalho.
           `import()` dinâmico porque `pergunta-clinica.ts` tem `(?<!` nas
           fronteiras — a mesma razão pela qual a bancada o importa assim. */
        const { triarTexto } = await import("@/lib/pergunta-clinica");
        const sugestoes = lerSugestoes(bruto).filter((s) => triarTexto(s) === "publicavel");

        /* Lista vazia não é erro: pode ter sido uma foto que não rendeu, ou as
           três terem caído na régua. A tela diz "não consegui pensar em nada" e
           o campo dela fica intocado. */
        return json({ ok: true, sugestoes });
      },
    },
  },
});
