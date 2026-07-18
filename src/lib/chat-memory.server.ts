/**
 * Memória por paciente no chat do app.
 *
 * Cada conversa é individual: as mensagens são gravadas por paciente + médico
 * (chat_messages) e um RESUMO do que a paciente já contou/perguntou/sentiu
 * (chat_memory) é injetado no chat DELA — e só dela — para a IA dar
 * continuidade real ("você tinha comentado da azia...") e adequar a resposta.
 *
 * Tudo é best-effort e fire-and-forget: tabela ausente (migração pendente) ou
 * falha de rede NUNCA afeta a resposta ao paciente.
 */

const MAX_SAVED_CHARS = 4000; // mensagens gigantes não explodem a tabela
const SUMMARY_EVERY = 6; // regenera o resumo a cada N mensagens novas
const SUMMARY_SOURCE_LIMIT = 40; // últimas mensagens usadas no resumo

/** Grava uma mensagem do chat (fire-and-forget). */
export function saveChatMessage(
  patientId: string,
  doctorId: string | null,
  role: "user" | "assistant",
  content: string,
): void {
  const text = content.trim().slice(0, MAX_SAVED_CHARS);
  if (!text) return;
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any)
        .from("chat_messages")
        .insert({ patient_id: patientId, doctor_id: doctorId, role, content: text });
    } catch {
      /* best-effort */
    }
  })();
}

/** Resumo salvo da paciente (null se não houver / tabela ausente). */
export async function getChatMemory(patientId: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("chat_memory")
      .select("summary")
      .eq("patient_id", patientId)
      .maybeSingle();
    const s = (data?.summary as string | undefined)?.trim();
    return s || null;
  } catch {
    return null;
  }
}

/** Bloco de memória para o system prompt (string vazia se não houver). */
export function memoryBlock(summary: string | null): string {
  if (!summary) return "";
  return [
    "## Memória da paciente (conversas anteriores — fonte: sistema)",
    summary,
    "Use esta memória para dar continuidade natural e adequar a resposta ao que ela já contou (ex.: retome um sintoma citado antes com cuidado genuíno). NÃO recite a lista de volta, NÃO trate a memória como diagnóstico e, se algo soar desatualizado, pergunte como está agora.",
  ].join("\n");
}

/**
 * Atualiza o resumo da paciente quando acumulou mensagens novas suficientes
 * (fire-and-forget). Usa o mesmo modelo do chat; sem chave de IA vira no-op.
 */
export function maybeUpdateChatMemory(patientId: string, doctorId: string | null): void {
  void (async () => {
    try {
      const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!key) return;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;

      const { data: mem } = await sb
        .from("chat_memory")
        .select("summary,updated_at")
        .eq("patient_id", patientId)
        .maybeSingle();

      // Quantas mensagens chegaram desde o último resumo?
      let sinceQuery = sb
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patientId);
      if (mem?.updated_at) sinceQuery = sinceQuery.gt("created_at", mem.updated_at);
      const { count, error: cntErr } = await sinceQuery;
      if (cntErr) return; // tabela ausente etc.
      const fresh = count ?? 0;
      if (fresh < SUMMARY_EVERY && (mem?.summary || fresh < 2)) return;

      const { data: msgs } = await sb
        .from("chat_messages")
        .select("role,content,created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(SUMMARY_SOURCE_LIMIT);
      const history = ((msgs ?? []) as { role: string; content: string }[])
        .reverse()
        .map((m) => `[${m.role === "user" ? "PACIENTE" : "IA"}] ${m.content}`)
        .join("\n");
      if (!history) return;

      const [{ generateText }, { createChatProvider, DEFAULT_CHAT_MODEL }] = await Promise.all([
        import("ai"),
        import("./ai-gateway.server"),
      ]);
      const google = createChatProvider(key);
      const result = await generateText({
        model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
        system: [
          "Você mantém a MEMÓRIA de uma paciente gestante para o assistente do obstetra dela.",
          "A partir do histórico (e do resumo anterior, se houver), produza um resumo ATUALIZADO do que a paciente relatou: sintomas e quando, preocupações recorrentes, o que já foi perguntado e orientado, preferências de comunicação.",
          "REGRAS: use SOMENTE o que está no histórico (nada inventado); sem diagnósticos; máximo 10 linhas curtas, uma informação por linha, começando com '- '; escreva em português.",
        ].join("\n"),
        prompt: [
          mem?.summary ? `RESUMO ANTERIOR:\n${mem.summary}` : "",
          `HISTÓRICO RECENTE:\n${history}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        maxOutputTokens: 500,
      });
      const summary = result.text.trim().slice(0, 2400);
      if (!summary) return;

      await sb.from("chat_memory").upsert({
        patient_id: patientId,
        doctor_id: doctorId,
        summary,
        updated_at: new Date().toISOString(),
      });
    } catch {
      /* best-effort */
    }
  })();
}
