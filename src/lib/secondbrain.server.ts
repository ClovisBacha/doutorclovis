/**
 * Segundo Cérebro do Dr. Clóvis — módulo server puro (sem createServerFn).
 *
 * Monta o bloco de contexto injetado no system prompt do chatbot do site
 * (api/chat.ts) e do agente WhatsApp (whatsapp-agent.server.ts), a partir de:
 *   - brain_settings (persona, frases típicas, regras, chaves liga/desliga)
 *   - brain_entries aprovadas (Q&A reais do médico), selecionadas por
 *     relevância em relação à mensagem da paciente.
 *
 * SEGURANÇA (anti prompt-injection): o conteúdo das entries vem do médico
 * (confiável); a mensagem da paciente NÃO é confiável — ela é usada apenas
 * para pontuar a relevância das entries e NUNCA é interpolada no block.
 *
 * Falha de banco NUNCA quebra o chat: qualquer erro resulta em block vazio
 * com os recursos habilitados (enabled true).
 */

export type BrainContext = {
  block: string;
  enabledApp: boolean;
  enabledWhatsapp: boolean;
};

type BrainSettingsRow = {
  persona: string | null;
  sample_phrases: string | null;
  rules: string | null;
  enabled_app: boolean | null;
  enabled_whatsapp: boolean | null;
};

type BrainEntryRow = { question: string; answer: string };

/** Normaliza texto para comparação: minúsculas e sem acentos. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Palavras significativas (mais de 3 letras) da mensagem, normalizadas. */
function significantWords(message: string): string[] {
  return [
    ...new Set(
      normalize(message)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3),
    ),
  ];
}

const MAX_ENTRIES_LOADED = 200;
const MAX_ENTRIES_SCORED = 6;
const MAX_ENTRIES_FALLBACK = 3;

/**
 * Carrega settings + entries e monta o bloco do Segundo Cérebro para o prompt.
 * `userMessage` serve SÓ para ranquear as entries — nunca entra no block.
 */
export async function getBrainContext(userMessage: string): Promise<BrainContext> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [settingsRes, entriesRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("brain_settings")
        .select("persona,sample_phrases,rules,enabled_app,enabled_whatsapp")
        .eq("id", 1)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("brain_entries")
        .select("question,answer")
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(MAX_ENTRIES_LOADED),
    ]);

    const settings = (settingsRes.data ?? null) as BrainSettingsRow | null;
    const entries = (entriesRes.data ?? []) as BrainEntryRow[];

    const persona = (settings?.persona ?? "").trim();
    const samplePhrases = (settings?.sample_phrases ?? "").trim();
    const rules = (settings?.rules ?? "").trim();
    const enabledApp = settings?.enabled_app ?? true;
    const enabledWhatsapp = settings?.enabled_whatsapp ?? true;

    // Pontua cada entry pelas palavras da mensagem presentes em pergunta+resposta.
    const words = significantWords(userMessage);
    const scored = entries.map((entry) => {
      const haystack = normalize(`${entry.question} ${entry.answer}`);
      let score = 0;
      for (const w of words) if (haystack.includes(w)) score += 1;
      return { entry, score };
    });

    // Top 6 com score > 0; se nada casar, cai nas 3 mais recentes.
    let selected = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score) // sort estável: empates mantêm as mais recentes primeiro
      .slice(0, MAX_ENTRIES_SCORED)
      .map((s) => s.entry);
    if (selected.length === 0) selected = entries.slice(0, MAX_ENTRIES_FALLBACK);

    // Sem settings nem entries → sem bloco.
    if (!persona && !samplePhrases && !rules && selected.length === 0) {
      return { block: "", enabledApp, enabledWhatsapp };
    }

    const parts: string[] = [
      "## Segundo Cérebro do Dr. Clóvis",
      "Você responde COMO O PRÓPRIO Dr. Clóvis responderia, seguindo o estilo, as frases e as condutas registradas abaixo.",
    ];
    if (persona) parts.push("### Estilo", persona);
    if (samplePhrases) parts.push("### Frases típicas", samplePhrases);
    if (rules) parts.push("### Regras", rules);
    if (selected.length > 0) {
      parts.push(
        "### Respostas reais do médico (use como referência de conduta e tom; NUNCA invente conduta que não esteja aqui ou em conhecimento obstétrico consolidado; caso não coberto, oriente agendar consulta)",
        ...selected.map((e) => `P: ${e.question}\nR: ${e.answer}`),
      );
    }

    return { block: parts.join("\n") + "\n", enabledApp, enabledWhatsapp };
  } catch {
    // Falha de banco não pode derrubar o chat: segue sem o segundo cérebro.
    return { block: "", enabledApp: true, enabledWhatsapp: true };
  }
}
