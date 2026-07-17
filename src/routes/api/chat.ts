import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createChatProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import { getBrainContext } from "@/lib/secondbrain.server";
import { computeGestation } from "@/lib/gestacao";

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
async function resolvePatientDoctor(request: Request): Promise<{
  doctorId: string | null;
  doctorName: string | null;
  clinicalBlock: string;
} | null> {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return null; // site público (anônimo)
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    // Prontuário resumido DIRETO do banco (fonte confiável — nunca do texto
    // que o cliente envia): é o que permite personalizar a resposta ("dor de
    // cabeça" numa paciente com histórico de pressão alta NÃO é a mesma
    // resposta de uma sem histórico).
    const first = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select(
        "doctor_id,lmp_date,reference_date,reference_weeks,reference_days,pregnancy_number,prior_bp_elevated,prior_bp_week,prior_gestational_diabetes,prior_preterm,prior_cesarean",
      )
      .eq("id", data.user.id)
      .maybeSingle();
    let prof = first.data;
    if (first.error?.code === "42703") {
      // Colunas clínicas ainda não migradas: NUNCA derrubar o vínculo com o
      // médico (o cérebro do chat depende dele) — segue só com o essencial.
      const fb = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("doctor_id,lmp_date,reference_date,reference_weeks,reference_days")
        .eq("id", data.user.id)
        .maybeSingle();
      prof = fb.data;
    }
    const clinicalBlock = buildClinicalBlock(prof ?? null);
    const doctorId = (prof?.doctor_id ?? null) as string | null;
    if (!doctorId) return { doctorId: null, doctorName: null, clinicalBlock };
    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("display_name")
      .eq("id", doctorId)
      .maybeSingle();
    return {
      doctorId,
      doctorName: (doc?.display_name || null) as string | null,
      clinicalBlock,
    };
  } catch {
    return null;
  }
}

/**
 * Monta o bloco de contexto clínico para o system prompt. Só entra o que
 * existe no perfil; sem nome (privacidade no prompt) e com instrução de uso.
 */
function buildClinicalBlock(
  prof: {
    lmp_date?: string | null;
    reference_date?: string | null;
    reference_weeks?: number | null;
    reference_days?: number | null;
    pregnancy_number?: number | null;
    prior_bp_elevated?: boolean | null;
    prior_bp_week?: number | null;
    prior_gestational_diabetes?: boolean | null;
    prior_preterm?: boolean | null;
    prior_cesarean?: boolean | null;
  } | null,
): string {
  if (!prof) return "";
  const lines: string[] = [];
  try {
    // Semana calculada NO SERVIDOR a partir do perfil (não confia no cliente).
    // computeGestation é pura (sem browser APIs) — segura no server.
    const gest = computeGestation({
      lmp: prof.lmp_date,
      referenceDate: prof.reference_date,
      referenceWeeks: prof.reference_weeks,
      referenceDays: prof.reference_days,
    });
    if (gest && gest.weeks >= 1 && gest.weeks <= 44) {
      const tri = gest.weeks < 14 ? "1º" : gest.weeks < 28 ? "2º" : "3º";
      lines.push(`- Semana gestacional: ${gest.weeks} (${tri} trimestre)`);
    }
  } catch {
    /* sem semana calculável */
  }
  if ((prof.pregnancy_number ?? 1) >= 2) {
    const prior: string[] = [];
    if (prof.prior_bp_elevated)
      prior.push(
        `pressão elevada na gestação anterior${prof.prior_bp_week ? ` (a partir da semana ${prof.prior_bp_week})` : ""}`,
      );
    if (prof.prior_gestational_diabetes) prior.push("diabetes gestacional anterior");
    if (prof.prior_preterm) prior.push("parto prematuro anterior");
    if (prof.prior_cesarean) prior.push("cesariana anterior");
    lines.push(
      `- ${prof.pregnancy_number}ª gestação${prior.length ? `; histórico: ${prior.join(", ")}` : ""}`,
    );
  }
  if (lines.length === 0) return "";
  return [
    "## Contexto clínico da paciente (fonte: sistema — confiável)",
    ...lines,
    "Use este contexto para calibrar a resposta (ex.: histórico de pressão alta muda a orientação sobre dor de cabeça/inchaço — reforce sinais de alerta e contato precoce). Não recite estes dados de volta sem necessidade.",
  ].join("\n");
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
          // App: injeta o Segundo Cérebro DAQUELE médico (respeitando o plano)
          // + o contexto clínico DELA (semana/histórico, direto do banco).
          // getBrainContext é safe (falha vira block vazio), nunca derruba o chat.
          const brain = await getBrainContext(lastUserText(messages), patient.doctorId, "app");
          const base = medicalSystemPrompt(patient.doctorName);
          const medico = patient.doctorName ? `o(a) ${patient.doctorName}` : "o seu médico";
          // Confiança visível: com cobertura, cite a fonte; sem cobertura,
          // escale com honestidade (a lacuna JÁ foi registrada pelo sistema).
          const confianca =
            brain.enabledApp && brain.hadCoverage
              ? `Ao usar as orientações do bloco do médico, deixe claro de forma natural que a orientação é do próprio médico (ex.: "${medico} orienta que...").`
              : brain.enabledApp
                ? `A dúvida atual NÃO está coberta pelas orientações que ${medico} validou. O sistema JÁ registrou a pergunta para ele responder no painel — diga isso com acolhimento (ex.: "essa é uma dúvida que ${medico} prefere responder pessoalmente; já registrei aqui para ele ver"). Limite-se a informações gerais seguras e sinais de alerta, sem improvisar conduta específica.`
                : "";
          system = [
            base,
            patient.clinicalBlock,
            brain.enabledApp && brain.block ? brain.block : "",
            confianca,
          ]
            .filter(Boolean)
            .join("\n\n");
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
