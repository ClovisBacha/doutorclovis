/**
 * Agente de IA para WhatsApp — Dr. Clóvis Bacha.
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
import { getBrainContext } from "./secondbrain.server";

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

const SYSTEM = `Você é a assistente virtual do consultório do ${DOCTOR.name}, ${DOCTOR.title} especialista em gestação de alto risco.

PERSONALIDADE: Acolhedora, empática, clara e profissional. Tom conversacional, sem jargões.
LÍNGUA: Português brasileiro coloquial mas educado.
REGRAS:
- NUNCA dê diagnóstico, prescrição ou conduta clínica.
- Para sintomas preocupantes → oriente urgência: SAMU 192 ou UPA.
- Para perguntas clínicas → responda com informação geral e sugira consulta.
- Seja CONCISA: máx 3 frases por mensagem no fluxo de agendamento.
- Não invente horários disponíveis: diga que a equipe confirmará em até 2h.

CONSULTÓRIO:
- Especialidade: Gestação de alto risco, pré-natal, hipertensão gestacional, diabetes gestacional, medicina fetal
- Agendamento: confirmado pela equipe após receber solicitação
- Horários: consulte a disponibilidade ao confirmar com a equipe
- PIX: ${DOCTOR.pixKey}
- Site: ${DOCTOR.siteUrl}`;

/* ------------------------------------------------------------------ */
/* Núcleo do agente                                                     */
/* ------------------------------------------------------------------ */

async function callAgent(conv: WaConversation, userMessage: string): Promise<AgentDecision> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY não configurado");

  const google = createChatProvider(key);
  const history = conv.context.history ?? [];

  // Segundo Cérebro: contexto adicional de estilo/conduta do médico.
  // getBrainContext é safe (falha vira block vazio) — nunca derruba o agente.
  // O block só influencia o TOM do campo "reply"; o formato JSON da resposta
  // e o fluxo de estados continuam regidos pelo prompt abaixo.
  const brain = await getBrainContext(userMessage);
  const system =
    brain.enabledWhatsapp && brain.block
      ? `${SYSTEM}\n\n${brain.block}\nO bloco acima orienta apenas o estilo e a conduta do texto enviado ao paciente. Continue seguindo o fluxo de estados e o formato de resposta em JSON exigidos na mensagem do usuário.`
      : SYSTEM;

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

async function getOrCreateConversation(phone: string): Promise<WaConversation> {
  const sb = supabaseAdmin;
  const { data } = await (sb as any)
    .from("whatsapp_conversations")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (data) return data as WaConversation;

  const { data: created } = await (sb as any)
    .from("whatsapp_conversations")
    .insert({ phone, state: "start", context: {} })
    .select()
    .single();

  return created as WaConversation;
}

async function saveConversation(
  phone: string,
  state: ConvState,
  context: ConvContext,
  patientName?: string | null,
): Promise<void> {
  const sb = supabaseAdmin;
  await (sb as any)
    .from("whatsapp_conversations")
    .update({
      state,
      context,
      patient_name: patientName ?? undefined,
      last_message_at: new Date().toISOString(),
    })
    .eq("phone", phone);
}

async function createAppointmentRequest(phone: string, context: ConvContext): Promise<void> {
  const sb = supabaseAdmin;
  await (sb as any).from("appointment_requests").insert({
    patient_name: context.name ?? "Paciente WhatsApp",
    patient_phone: phone,
    patient_email: context.email ?? "",
    preferred_date: new Date().toISOString().slice(0, 10), // será confirmado pela equipe
    preferred_time: context.preferred_time ?? "manhã",
    reason: context.reason ?? "Consulta (agendado via WhatsApp)",
    notes: `Preferência informada: ${context.preferred_date ?? "a definir"}. Agendado via agente WhatsApp.`,
    status: "pending",
  });
}

/* ------------------------------------------------------------------ */
/* Handler principal                                                    */
/* ------------------------------------------------------------------ */

export async function handleWhatsAppMessage(
  phone: string,
  messageText: string,
  messageId: string,
): Promise<void> {
  // Normaliza o telefone (remove + e espaços)
  const cleanPhone = phone.replace(/\D/g, "");

  const conv = await getOrCreateConversation(cleanPhone);

  // Detecta urgência por palavras-chave antes do agente para segurança
  const urgentWords =
    /sangr|convuls|desmaio|inconscient|dor intens|apago|pressão muito alta|bebê não mexe/i;
  const forceUrgent = urgentWords.test(messageText);

  // Chama o agente
  const decision = await callAgent(forceUrgent ? { ...conv, state: "urgent" } : conv, messageText);

  // Merge dos dados extraídos
  const newContext: ConvContext = {
    ...conv.context,
    ...Object.fromEntries(Object.entries(decision.extracted ?? {}).filter(([, v]) => v != null)),
    history: [
      ...(conv.context.history ?? []).slice(-10),
      { role: "user", content: messageText },
      { role: "assistant", content: decision.reply },
    ],
  };

  // Cria o agendamento se o agente decidiu
  if (decision.create_appointment) {
    await createAppointmentRequest(cleanPhone, newContext);
    newContext.appointment_id = "pending";
  }

  // Salva o estado atualizado
  await saveConversation(
    cleanPhone,
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
