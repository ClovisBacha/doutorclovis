/**
 * Agente de IA para WhatsApp — consultório do médico associado.
 *
 * Fluxo de agendamento por mensagem:
 *   start → collecting_name → collecting_reason → collecting_date → confirming → done
 *
 * O agente usa Gemini para:
 *  1. Classificar a intenção do paciente (agendamento / FAQ / urgência)
 *  2. Extrair dados estruturados (nome, motivo, data, telefone)
 *  3. Gerar respostas empáticas e naturais em PT-BR
 *  4. Criar appointment_request no Supabase quando pronto
 */

import { generateText } from "ai";
import { createChatProvider, DEFAULT_CHAT_MODEL } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DOCTOR } from "./doctor.config";
import { waSendText, waSendButtons } from "./whatsapp.server";
import { getBrainContextResolved } from "./secondbrain.server";

/* ------------------------------------------------------------------ */
/* Tipos                                                                */
/* ------------------------------------------------------------------ */

export interface WaConversation {
  id: string;
  phone: string;
  patient_name: string | null;
  state: ConvState;
  context: ConvContext;
  last_message_at: string;
}

type ConvState =
  | "start"
  | "collecting_name"
  | "collecting_reason"
  | "collecting_date"
  | "confirming"
  | "done"
  | "faq"
  | "urgent";

interface ConvContext {
  name?: string;
  reason?: string;
  preferred_date?: string;
  preferred_time?: string;
  email?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  appointment_id?: string;
  // Médico da conversa (null = dono da instalação). A tabela é chaveada só
  // por telefone; se a MESMA paciente escrever para o número de OUTRO médico,
  // a conversa anterior não pode vazar — detectamos a troca e recomeçamos.
  doctor_id?: string | null;
}

interface AgentDecision {
  reply: string;
  next_state: ConvState;
  extracted?: Partial<ConvContext>;
  create_appointment?: boolean;
}

/* ------------------------------------------------------------------ */
/* Prompt do sistema                                                    */
/* ------------------------------------------------------------------ */

/**
 * Identidade do médico dono do número que recebeu a mensagem. Cada número de
 * WhatsApp mapeado (doctor_whatsapp_numbers) fala em nome do SEU médico —
 * nome, título e PIX próprios. DOCTOR.* só como fallback do dono da
 * instalação (número sem mapeamento).
 */
interface DoctorIdentity {
  name: string;
  title: string;
  pixKey: string;
}

async function resolveDoctorIdentity(doctorId?: string | null): Promise<DoctorIdentity> {
  const fallback: DoctorIdentity = {
    name: DOCTOR.name,
    title: DOCTOR.title,
    pixKey: DOCTOR.pixKey,
  };
  if (!doctorId) return fallback;
  try {
    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("display_name,title,pix_key")
      .eq("id", doctorId)
      .maybeSingle();
    if (!doc) return fallback;
    return {
      name: (doc.display_name as string)?.trim() || fallback.name,
      title: (doc.title as string)?.trim() || "ginecologista e obstetra",
      // PIX de OUTRO médico nunca cai no fallback do dono: sem pix_key, omite.
      pixKey: (doc.pix_key as string)?.trim() || "",
    };
  } catch {
    return fallback;
  }
}

function buildSystem(identity: DoctorIdentity): string {
  return `Você é a assistente virtual do consultório do ${identity.name}, ${identity.title} especialista em gestação de alto risco.

PERSONALIDADE: Acolhedora, empática, clara e profissional. Tom conversacional, sem jargões.
LÍNGUA: Português brasileiro coloquial mas educado.
REGRAS:
- Você é uma INTELIGÊNCIA ARTIFICIAL de apoio — NÃO é o médico e NÃO substitui a consulta. Se a paciente tratar você como médica, esclareça com gentileza.
- NUNCA dê diagnóstico, prescrição, dose de medicamento ou conduta clínica.
- Responda SOMENTE dentro do que o médico já validou (bloco de estilo/conduta, se houver). Fora disso, NÃO improvise: diga que vai encaminhar ao médico e sugira consulta.
- Para sintomas preocupantes → oriente urgência: SAMU 192 ou UPA/pronto-socorro AGORA.
- Para perguntas clínicas → informação geral acolhedora e sugira consulta com o médico.
- Seja CONCISA: máx 3 frases por mensagem no fluxo de agendamento.
- Não invente horários disponíveis: diga que a equipe confirmará em até 2h.

CONSULTÓRIO:
- Especialidade: Gestação de alto risco, pré-natal, hipertensão gestacional, diabetes gestacional, medicina fetal
- Agendamento: confirmado pela equipe após receber solicitação
- Horários: consulte a disponibilidade ao confirmar com a equipe${identity.pixKey ? `\n- PIX: ${identity.pixKey}` : ""}
- Site: ${DOCTOR.siteUrl}`;
}

/* ------------------------------------------------------------------ */
/* Núcleo do agente                                                     */
/* ------------------------------------------------------------------ */

async function callAgent(
  conv: WaConversation,
  userMessage: string,
  doctorId?: string | null,
): Promise<AgentDecision> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY não configurado");

  const google = createChatProvider(key);
  const history = conv.context.history ?? [];

  // Segundo Cérebro: contexto adicional de estilo/conduta do médico.
  // getBrainContext é safe (falha vira block vazio) — nunca derruba o agente.
  // O block só influencia o TOM do campo "reply"; o formato JSON da resposta
  // e o fluxo de estados continuam regidos pelo prompt abaixo.
  const [brain, identity] = await Promise.all([
    getBrainContextResolved(userMessage, doctorId ?? undefined, "whatsapp"),
    resolveDoctorIdentity(doctorId),
  ]);
  const baseSystem = buildSystem(identity);
  const system =
    brain.enabledWhatsapp && brain.block
      ? `${baseSystem}\n\n${brain.block}\nO bloco acima orienta apenas o estilo e a conduta do texto enviado ao paciente. Continue seguindo o fluxo de estados e o formato de resposta em JSON exigidos na mensagem do usuário.`
      : baseSystem;

  const stateInstructions: Record<ConvState, string> = {
    start: `O paciente acabou de mandar a primeira mensagem. Cumprimenta-o pelo nome se disponível, apresente-se brevemente e pergunte como pode ajudar. Se a intenção for agendamento, mova para collecting_name.`,
    collecting_name: `Você precisa do nome completo do paciente. Se já foi fornecido no histórico, use-o. Extraia o nome e mova para collecting_reason.`,
    collecting_reason: `Você tem o nome do paciente. Peça de forma gentil qual o motivo da consulta (em poucas palavras). Extraia e mova para collecting_date.`,
    collecting_date: `Você tem nome e motivo. Pergunte a preferência de data e período (manhã/tarde). Aceite datas aproximadas. Extraia e mova para confirming.`,
    confirming: `Você tem todos os dados. Resuma o pedido (nome, motivo, data/período) e peça confirmação com 'Sim' ou 'Não'.`,
    done: `O agendamento foi registrado. Informe que a equipe confirmará por WhatsApp em até 2h e que o paciente receberá o horário definitivo. Agradeça.`,
    faq: `Responda a pergunta geral do paciente sobre o consultório, gestação ou obstetrícia. Ofereça agendar consulta ao final.`,
    urgent: `O paciente relatou sintoma de urgência (sangramento intenso, dor severa, desmaio, etc). Oriente IMEDIATAMENTE a ligar 192 (SAMU) ou ir ao pronto-socorro mais próximo. Seja firme mas acolhedora.`,
  };

  const prompt = `
ESTADO ATUAL: ${conv.state}
INSTRUÇÃO DO ESTADO: ${stateInstructions[conv.state]}

DADOS JÁ COLETADOS:
- Nome: ${conv.context.name ?? "não informado"}
- Motivo: ${conv.context.reason ?? "não informado"}
- Data preferida: ${conv.context.preferred_date ?? "não informada"}

HISTÓRICO (últimas ${history.length} mensagens):
${history
  .slice(-6)
  .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
  .join("\n")}

MENSAGEM ATUAL DO PACIENTE: "${userMessage}"

Responda OBRIGATORIAMENTE em JSON válido com este formato exato:
{
  "reply": "<texto para enviar ao paciente>",
  "intent": "agendamento|faq|urgência|outro",
  "next_state": "<start|collecting_name|collecting_reason|collecting_date|confirming|done|faq|urgent>",
  "extracted": {
    "name": "<nome se identificado, senão null>",
    "reason": "<motivo se identificado, senão null>",
    "preferred_date": "<data preferida em texto livre, senão null>",
    "preferred_time": "<manhã|tarde|noite|null>"
  },
  "create_appointment": <true se next_state é "done" E paciente confirmou, senão false>
}`;

  const result = await generateText({
    model: google(process.env.CHAT_MODEL ?? DEFAULT_CHAT_MODEL),
    system,
    prompt,
    maxOutputTokens: 512, // AI SDK v5+ renomeou maxTokens → maxOutputTokens
  });

  try {
    const raw = result.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const json = JSON.parse(raw) as AgentDecision & {
      intent?: string;
      extracted?: Partial<ConvContext>;
    };
    return {
      reply: json.reply,
      next_state: json.next_state ?? conv.state,
      extracted: json.extracted,
      create_appointment: json.create_appointment ?? false,
    };
  } catch {
    // fallback se o JSON falhar
    return {
      reply: result.text.slice(0, 500),
      next_state: conv.state,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Persistência (Supabase service_role)                                 */
/* ------------------------------------------------------------------ */

/**
 * Conversa por (telefone, médico): a MESMA paciente falando com números de
 * médicos diferentes tem conversas separadas no banco. Banco sem a coluna
 * doctor_id (migração pendente) → comportamento antigo por telefone (o reset
 * por contexto em handleWhatsAppMessage segue garantindo o isolamento).
 */
async function getOrCreateConversation(
  phone: string,
  doctorId?: string | null,
): Promise<WaConversation> {
  const sb = supabaseAdmin as any;
  let query = sb.from("whatsapp_conversations").select("*").eq("phone", phone);
  query = doctorId ? query.eq("doctor_id", doctorId) : query.is("doctor_id", null);
  const first = await query.maybeSingle();
  let data = first.data;
  if (first.error?.code === "42703") {
    ({ data } = await sb
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone", phone)
      .maybeSingle());
  }
  if (data) return data as WaConversation;

  const { data: created, error: insErr } = await sb
    .from("whatsapp_conversations")
    .insert({ phone, state: "start", context: {}, doctor_id: doctorId ?? null })
    .select()
    .single();
  if (created) return created as WaConversation;
  if (insErr) {
    // 42703 (coluna ausente) ou 23505 (UNIQUE(phone) legado com outra conversa
    // do mesmo telefone): reaproveita/cria a linha por telefone — o reset por
    // contexto impede vazamento entre médicos.
    const { data: legacy } = await sb
      .from("whatsapp_conversations")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();
    if (legacy) return legacy as WaConversation;
    const { data: legacyCreated } = await sb
      .from("whatsapp_conversations")
      .insert({ phone, state: "start", context: {} })
      .select()
      .single();
    return legacyCreated as WaConversation;
  }
  return created as WaConversation;
}

async function saveConversation(
  conv: WaConversation,
  state: ConvState,
  context: ConvContext,
  patientName?: string | null,
): Promise<void> {
  const sb = supabaseAdmin;
  // Por id: nunca atualiza a conversa do mesmo telefone com OUTRO médico.
  await (sb as any)
    .from("whatsapp_conversations")
    .update({
      state,
      context,
      patient_name: patientName ?? undefined,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conv.id);
}

async function createAppointmentRequest(
  phone: string,
  context: ConvContext,
  doctorId?: string | null,
): Promise<void> {
  const sb = supabaseAdmin;
  // Atribuição por médico: o número que recebeu → doctor_id. Número sem
  // mapeamento fica sem médico (doctor_id null) — não existe mais "dono da
  // instalação" para onde cair.
  const targetDoctor = doctorId ?? null;
  const row = {
    patient_name: context.name ?? "Paciente WhatsApp",
    patient_phone: phone,
    patient_email: context.email ?? "",
    preferred_date: new Date().toISOString().slice(0, 10), // será confirmado pela equipe
    preferred_time: context.preferred_time ?? "manhã",
    reason: context.reason ?? "Consulta (agendado via WhatsApp)",
    notes: `Preferência informada: ${context.preferred_date ?? "a definir"}. Agendado via agente WhatsApp.`,
    status: "pending",
  };
  const { error } = await (sb as any)
    .from("appointment_requests")
    .insert(targetDoctor ? { ...row, doctor_id: targetDoctor } : row);
  if (error?.code === "42703" && targetDoctor) {
    // Coluna doctor_id ainda não migrada: registra sem atribuição.
    await (sb as any).from("appointment_requests").insert(row);
  }
}

/* ------------------------------------------------------------------ */
/* Handler principal                                                    */
/* ------------------------------------------------------------------ */

export async function handleWhatsAppMessage(
  phone: string,
  messageText: string,
  messageId: string,
  phoneNumberId?: string | null,
): Promise<void> {
  // Normaliza o telefone (remove + e espaços)
  const cleanPhone = phone.replace(/\D/g, "");

  // WhatsApp por médico: o número que recebeu → doctor_id (null = cérebro do dono).
  const { resolveDoctorIdByWhatsappNumber } = await import("./whatsapp.server");
  const doctorId = await resolveDoctorIdByWhatsappNumber(phoneNumberId);

  let conv = await getOrCreateConversation(cleanPhone, doctorId);

  // Isolamento por médico (defesa em profundidade p/ banco sem doctor_id):
  // se a conversa existente pertence a OUTRO médico, recomeça do zero —
  // histórico, nome e motivo de um consultório nunca vazam para outro.
  const targetDoctor = doctorId ?? null;
  if (conv.context.doctor_id !== undefined && conv.context.doctor_id !== targetDoctor) {
    conv = { ...conv, state: "start", context: {} };
  }

  // Detecta urgência por palavras-chave antes do agente para segurança
  const urgentWords =
    /sangr|convuls|desmaio|inconscient|dor intens|apago|pressão muito alta|bebê não mexe/i;
  const forceUrgent = urgentWords.test(messageText);

  // Chama o agente
  const decision = await callAgent(
    forceUrgent ? { ...conv, state: "urgent" } : conv,
    messageText,
    doctorId,
  );

  // Merge dos dados extraídos
  const newContext: ConvContext = {
    ...conv.context,
    ...Object.fromEntries(Object.entries(decision.extracted ?? {}).filter(([, v]) => v != null)),
    doctor_id: targetDoctor,
    history: [
      ...(conv.context.history ?? []).slice(-10),
      { role: "user", content: messageText },
      { role: "assistant", content: decision.reply },
    ],
  };

  // Cria o agendamento se o agente decidiu
  if (decision.create_appointment) {
    await createAppointmentRequest(cleanPhone, newContext, doctorId);
    newContext.appointment_id = "pending";
  }

  // Salva o estado atualizado
  await saveConversation(
    conv,
    forceUrgent ? "urgent" : decision.next_state,
    newContext,
    newContext.name,
  );

  // Envia a resposta ao paciente
  if (decision.next_state === "confirming") {
    await waSendButtons(cleanPhone, decision.reply, [
      { id: "confirm_yes", title: "✅ Confirmar" },
      { id: "confirm_no", title: "❌ Cancelar" },
    ]);
  } else {
    await waSendText(cleanPhone, decision.reply);
  }
}
