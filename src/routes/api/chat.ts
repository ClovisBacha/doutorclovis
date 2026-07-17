import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createChatProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { getBrainContext } from "@/lib/secondbrain.server";

// Rate limit simples por IP (janela fixa, em memória). Em ambiente serverless
// a memória não é compartilhada entre instâncias nem persiste entre cold starts,
// então é uma proteção básica contra abuso/varredura — não uma garantia rígida.
const RATE_LIMIT = 20; // mensagens
const RATE_WINDOW_MS = 60_000; // por minuto
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

// Chat do SITE PÚBLICO: assistente geral da plataforma (dúvidas do app e do
// site, suporte). NÃO fala como um médico específico e NÃO dá conduta clínica.
const SUPPORT_SYSTEM_PROMPT = `Você é o assistente da plataforma Obstétrica — um app de acompanhamento de gestação para pacientes e um painel para obstetras.

O que você faz:
- Explica como usar o app (perfil, cálculo de idade gestacional, contrações, exames, chat com o obstetra, teleconsulta, etc).
- Orienta a paciente a se vincular ao próprio obstetra: ela busca o médico no app e envia uma solicitação; ao ser aceita, passa a conversar com a IA do consultório dela.
- Tira dúvidas gerais sobre a plataforma e encaminha para o suporte quando necessário.

Regras de resposta:
- Responda em português brasileiro, com tom acolhedor, claro e conciso (3 a 6 frases).
- NÃO dê diagnóstico, prescrição ou conduta médica. Para dúvidas clínicas, oriente falar com o obstetra pelo app; em urgência, ligar 192 (SAMU) ou ir ao pronto-socorro.
- Não invente dados (telefone, endereço, valores). Se não souber, encaminhe para o suporte.`;

/** Assistente médico do consultório de UM médico (usado no app da paciente). */
function medicalSystemPrompt(doctorName?: string | null): string {
  const consultorio = doctorName ? `do consultório do(a) ${doctorName}` : "do seu obstetra";
  return `Você é o assistente virtual ${consultorio}, no app de acompanhamento de gestação da paciente.

Regras de resposta:
- Responda em português brasileiro, com tom acolhedor, claro e profissional.
- Você é uma INTELIGÊNCIA ARTIFICIAL de apoio — não é o médico e NÃO substitui a consulta. Se a paciente tratar você como médica, esclareça isso com gentileza.
- Seja conciso (3 a 6 frases) salvo se a paciente pedir mais detalhe.
- NUNCA dê diagnóstico, prescrição, dose de medicamento ou conduta médica. Para qualquer sintoma ou decisão clínica, oriente falar com o obstetra pelo app; em urgência (sangramento, dor intensa, redução dos movimentos do bebê, pressão muito alta), ligar 192 (SAMU) ou ir ao pronto-socorro AGORA.
- Responda SOMENTE seguindo o estilo e as condutas já validadas pelo médico (bloco abaixo, se houver). Se a dúvida estiver fora do que o médico validou, NÃO improvise conduta: diga que vai encaminhar para o médico e oriente marcar/consultar.
- Não invente dados (telefone, endereço, valores, resultados de exame).`;
}

/**
 * Resolve o médico da PACIENTE logada a partir do token do Supabase enviado no
 * header Authorization. Sem token (site público) → null. Devolve o doctor_id
 * (para injetar o cérebro DAQUELE médico) e o nome dele (para a persona).
 */
async function resolvePatientDoctor(
  request: Request,
): Promise<{ doctorId: string | null; doctorName: string | null } | null> {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return null; // site público (anônimo)
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    const { data: prof } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("doctor_id")
      .eq("id", data.user.id)
      .maybeSingle();
    const doctorId = (prof?.doctor_id ?? null) as string | null;
    if (!doctorId) return { doctorId: null, doctorName: null };
    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("display_name")
      .eq("id", doctorId)
      .maybeSingle();
    return { doctorId, doctorName: (doc?.display_name || null) as string | null };
  } catch {
    return null;
  }
}

/** Extrai o texto da última mensagem de usuário (formato UIMessage com parts). */
function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== "user") continue;
    const raw = (msg.parts ?? [])
      .map((p) => (p.type === "text" ? p.text : ""))
      .join(" ")
      .trim();
    // A 1ª mensagem do app vem prefixada com "[Contexto: Meu nome é X...
    // semana N...]" (buildPatientContext no cliente). Esse prefixo NÃO pode
    // entrar no cérebro: contamina o ranking (palavras como "semana" casam
    // com qualquer entrada e engolem lacunas legítimas), vaza o nome da
    // paciente para brain_gaps/painel e quebra a dedup por pergunta.
    return raw.replace(/^\s*\[contexto:[\s\S]*?\]\s*/i, "").trim();
  }
  return "";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown";
        if (rateLimited(ip)) {
          return new Response("Muitas mensagens em pouco tempo. Aguarde um instante.", {
            status: 429,
          });
        }

        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) return new Response("Missing GOOGLE_GENERATIVE_AI_API_KEY", { status: 500 });

        const messages = body.messages as UIMessage[];

        // Quem está falando? Paciente logada (token no Authorization) fala com a
        // IA do PRÓPRIO médico; site público (anônimo) fala com o assistente
        // geral da plataforma. Assim cada conta é individual.
        const patient = await resolvePatientDoctor(request);

        let system: string;
        if (patient && patient.doctorId) {
          // App: injeta o Segundo Cérebro DAQUELE médico (respeitando o plano).
          // getBrainContext é safe (falha vira block vazio), nunca derruba o chat.
          const brain = await getBrainContext(lastUserText(messages), patient.doctorId, "app");
          const base = medicalSystemPrompt(patient.doctorName);
          system = brain.enabledApp && brain.block ? `${base}\n\n${brain.block}` : base;
        } else if (patient) {
          // App, mas a paciente ainda não se vinculou a um médico → sem cérebro.
          system =
            medicalSystemPrompt() +
            "\n\nA paciente ainda não está vinculada a um obstetra. Se fizer sentido, convide-a a buscar o médico dela no app e enviar uma solicitação de vínculo.";
        } else {
          // Site público (anônimo): assistente geral / suporte da plataforma.
          system = SUPPORT_SYSTEM_PROMPT;
        }

        const google = createChatProvider(key);
        const result = streamText({
          model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
          system,
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
        });
      },
    },
  },
});
