/**
 * Segundo Cérebro do médico — server functions do painel do médico.
 *
 * CRUD de brain_settings/brain_entries, treino a partir das perguntas das
 * pacientes (doctor_questions) e teste do cérebro com o mesmo modelo do chat.
 * Todas as funções exigem admin (ADMIN_EMAILS), como em admin.functions.ts.
 */

import { DOCTOR } from "@/lib/doctor.config";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Quem é "o médico": e-mails autorizados, separados por vírgula em ADMIN_EMAILS.
function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user?.email) return null;
  // Equipe da instalação (ADMIN_EMAILS) OU médico assinante ativo (doctors)
  if (adminEmails().includes(data.user.email.toLowerCase())) return data.user;
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id,active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (doc?.active) return data.user;
  return null;
}

/**
 * Cada perfil de médico tem o SEU cérebro (tabelas chaveadas por doctor_id).
 * Regra de identidade:
 *   - Médico assinante (linha em doctors) → treina/usa o PRÓPRIO cérebro.
 *   - Equipe da instalação (ADMIN_EMAILS, ex.: secretária) sem linha em
 *     doctors → treina o cérebro do médico DONO (1º e-mail de ADMIN_EMAILS).
 */
async function ownerDoctorId(user: { id: string; email?: string | null }): Promise<string> {
  // Equipe da instalação (ADMIN_EMAILS) SEMPRE opera o cérebro do dono —
  // mesmo que algum membro tenha criado uma linha própria em doctors
  // (senão a secretária passaria a treinar um cérebro fantasma).
  if (user.email && adminEmails().includes(user.email.toLowerCase())) {
    const { resolveOwnerDoctorId } = await import("./secondbrain.server");
    return (await resolveOwnerDoctorId()) ?? user.id;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: doc } = await (supabaseAdmin as any)
    .from("doctors")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (doc?.id) return doc.id as string;
  // Assinante sem linha resolvida (ex.: erro transitório no maybeSingle, que
  // devolve data:null sem lançar): usa o PRÓPRIO uid — `doctors.id` é sempre o
  // auth uid. NUNCA cair em resolveOwnerDoctorId() aqui, senão o assinante
  // leria/gravaria o cérebro (persona, regras, Q&A) do médico DONO da
  // instalação — vazamento e contaminação cruzada de perfis.
  return user.id;
}

/** Só a equipe da instalação (ADMIN_EMAILS) — NÃO médicos assinantes. */
function isPlatformTeam(user: { email?: string | null }): boolean {
  return !!user.email && adminEmails().includes(user.email.toLowerCase());
}

/**
 * O Segundo Cérebro (IA) é do plano Starter+ (Free organiza o consultório mas
 * NÃO tem IA). Gate por entitlement: treinar/usar o cérebro exige `aiApp`.
 * Retorna true se o médico pode operar o cérebro no plano atual.
 */
async function canUseBrain(user: { id: string; email?: string | null }): Promise<boolean> {
  const { getEntitlements } = await import("./entitlements.server");
  return (await getEntitlements(user)).aiApp;
}

export type BrainEntry = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  source: string;
  approved: boolean;
  created_at: string;
};

export type BrainSettings = {
  persona: string;
  sample_phrases: string;
  rules: string;
  enabled_app: boolean;
  enabled_whatsapp: boolean;
};

const DEFAULT_SETTINGS: BrainSettings = {
  persona: "",
  sample_phrases: "",
  rules: "",
  enabled_app: true,
  enabled_whatsapp: true,
};

const TokenSchema = z.object({ accessToken: z.string().min(10) });

/** Carrega as configurações do segundo cérebro (defaults se ainda não salvas). */
export const getBrainSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const doctorId = await ownerDoctorId(user);
    const { data: row, error } = await (supabaseAdmin as any)
      .from("brain_settings")
      .select("persona,sample_phrases,rules,enabled_app,enabled_whatsapp")
      .eq("doctor_id", doctorId)
      .maybeSingle();
    if (error) return { ok: false as const };

    // Cérebro deste médico ainda não configurado → defaults sem criar.
    const settings: BrainSettings = row ?? DEFAULT_SETTINGS;
    return { ok: true as const, settings };
  });

const SettingsSchema = z.object({
  accessToken: z.string().min(10),
  settings: z.object({
    persona: z.string(),
    sample_phrases: z.string(),
    rules: z.string(),
    enabled_app: z.boolean(),
    enabled_whatsapp: z.boolean(),
  }),
});

/** Salva as configurações do cérebro DO médico (upsert por doctor_id). */
export const saveBrainSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SettingsSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    // Free não tem IA: não pode configurar o cérebro.
    if (!(await canUseBrain(user))) return { ok: false as const, reason: "plan" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const doctorId = await ownerDoctorId(user);
    const { error } = await (supabaseAdmin as any)
      .from("brain_settings")
      .upsert({ doctor_id: doctorId, ...data.settings, updated_at: new Date().toISOString() });
    return { ok: !error };
  });

const ListSchema = z.object({
  accessToken: z.string().min(10),
  search: z.string().optional(),
});

/** Lista as entradas do cérebro (busca opcional em pergunta/resposta). */
export const listBrainEntries = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ListSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const doctorId = await ownerDoctorId(user);
    let query = (supabaseAdmin as any)
      .from("brain_entries")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("created_at", { ascending: false })
      .limit(200);

    // Remove caracteres que quebram a sintaxe do .or()/ilike do PostgREST.
    const search = (data.search ?? "").replace(/[%,()]/g, " ").trim();
    if (search) {
      query = query.or(`question.ilike.%${search}%,answer.ilike.%${search}%`);
    }

    const { data: rows, error } = await query;
    if (error) return { ok: false as const };
    return { ok: true as const, entries: (rows ?? []) as BrainEntry[] };
  });

const AddSchema = z.object({
  accessToken: z.string().min(10),
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().nullable().optional(),
  source: z.string().optional(),
});

/** Adiciona uma entrada de conhecimento (pergunta + resposta do médico). */
export const addBrainEntry = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AddSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    // Free não tem IA: não pode treinar o cérebro.
    if (!(await canUseBrain(user))) return { ok: false as const, reason: "plan" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const doctorId = await ownerDoctorId(user);
    const { data: row, error } = await (supabaseAdmin as any)
      .from("brain_entries")
      .insert({
        doctor_id: doctorId,
        question: data.question,
        answer: data.answer,
        category: data.category ?? null,
        source: data.source ?? "manual",
        approved: true,
      })
      .select()
      .single();
    if (error) return { ok: false as const };
    return { ok: true as const, entry: row as BrainEntry };
  });

const UpdateSchema = z.object({
  accessToken: z.string().min(10),
  id: z.string().uuid(),
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().nullable().optional(),
  approved: z.boolean(),
});

/** Atualiza uma entrada de conhecimento. */
export const updateBrainEntry = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => UpdateSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("brain_entries")
      .update({
        question: data.question,
        answer: data.answer,
        category: data.category ?? null,
        approved: data.approved,
      })
      .eq("id", data.id)
      .eq("doctor_id", await ownerDoctorId(user));
    return { ok: !error };
  });

const DeleteSchema = z.object({ accessToken: z.string().min(10), id: z.string().uuid() });

/** Remove uma entrada de conhecimento. */
export const deleteBrainEntry = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => DeleteSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("brain_entries")
      .delete()
      .eq("id", data.id)
      .eq("doctor_id", await ownerDoctorId(user));
    return { ok: !error };
  });

/** Lista as perguntas das pacientes ainda sem resposta (para treinar o cérebro). */
export const listUnansweredQuestions = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    // P1: doctor_questions ainda não tem doctor_id (etapa 2) — as perguntas
    // são das pacientes da INSTALAÇÃO. Médico assinante recebe lista vazia.
    if (!isPlatformTeam(user)) {
      return {
        ok: true as const,
        questions: [] as { id: string; question: string; created_at: string }[],
      };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await (supabaseAdmin as any)
      .from("doctor_questions")
      .select("id,question,created_at")
      .eq("answered", false)
      .order("created_at", { ascending: true })
      .limit(50);

    return {
      ok: true as const,
      questions: (rows ?? []) as { id: string; question: string; created_at: string }[],
    };
  });

const AnswerTrainSchema = z.object({
  accessToken: z.string().min(10),
  questionId: z.string().uuid(),
  answer: z.string().min(1),
});

/**
 * Responde uma pergunta de paciente e treina o cérebro com ela: cria uma
 * brain_entry (source='pergunta') com a pergunta original + resposta e marca
 * a doctor_question como respondida (transação lógica: só marca se treinou).
 */
export const answerAndTrain = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AnswerTrainSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    // P1: responder perguntas de pacientes da instalação é exclusivo da equipe
    if (!user || !isPlatformTeam(user)) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Só perguntas ainda não respondidas: evita entrada duplicada em
    // duplo clique/duas abas respondendo a mesma pergunta.
    const { data: question } = await (supabaseAdmin as any)
      .from("doctor_questions")
      .select("id,question")
      .eq("id", data.questionId)
      .eq("answered", false)
      .maybeSingle();
    if (!question) return { ok: false as const };

    const { data: entry, error: insertError } = await (supabaseAdmin as any)
      .from("brain_entries")
      .insert({
        doctor_id: await ownerDoctorId(user),
        question: question.question,
        answer: data.answer,
        source: "pergunta",
        approved: true,
      })
      .select("id")
      .single();
    if (insertError || !entry) return { ok: false as const };

    const { error: updateError } = await (supabaseAdmin as any)
      .from("doctor_questions")
      .update({ answered: true })
      .eq("id", data.questionId);
    if (updateError) {
      // Compensação: desfaz a entry recém-criada para o retry não duplicar.
      await (supabaseAdmin as any).from("brain_entries").delete().eq("id", entry.id);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

const TestSchema = z.object({
  accessToken: z.string().min(10),
  question: z.string().min(1).max(500),
});

/** Testa o segundo cérebro: responde uma pergunta com o mesmo modelo do chat. */
export const testBrain = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TestSchema.parse(i))
  .handler(async ({ data }) => {
    const user = await requireAdmin(data.accessToken);
    if (!user) return { ok: false as const };
    // Free não tem IA: não pode testar o cérebro.
    if (!(await canUseBrain(user)))
      return {
        ok: false as const,
        answer: "O Segundo Cérebro está disponível a partir do plano Starter.",
      };

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key)
      return { ok: false as const, answer: "GOOGLE_GENERATIVE_AI_API_KEY não configurada." };

    const [{ getBrainContext }, { generateText }, { createChatProvider, DEFAULT_CHAT_MODEL }] =
      await Promise.all([
        import("./secondbrain.server"),
        import("ai"),
        import("./ai-gateway.server"),
      ]);

    const brain = await getBrainContext(data.question, await ownerDoctorId(user), "teste");
    const system = [
      `Você é o assistente virtual do consultório de ${DOCTOR.name}, ginecologista e obstetra especialista em gestação de alto risco.`,
      "Responda em português brasileiro, com tom acolhedor, claro e profissional. Seja conciso (3 a 6 frases).",
      "NUNCA dê diagnóstico ou prescrição. Em urgência, oriente ligar 192 (SAMU) ou ir ao pronto-socorro.",
      brain.block,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const google = createChatProvider(key);
      const result = await generateText({
        model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
        system,
        prompt: data.question,
      });
      return { ok: true as const, answer: result.text };
    } catch {
      return { ok: false as const, answer: "Falha ao consultar o modelo. Tente novamente." };
    }
  });
