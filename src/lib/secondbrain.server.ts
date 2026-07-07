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

/* ── Multi-perfil: cada médico tem o SEU cérebro ─────────────────────────────
   As tabelas são chaveadas por doctor_id (uid do médico no auth). Nesta
   instalação single-doctor, o "dono" é o primeiro e-mail de ADMIN_EMAILS —
   toda a equipe (ex.: secretária) treina o cérebro DO médico, e o chat/
   WhatsApp respondem com ele. Numa futura plataforma multi-médico, basta
   passar o doctorId da conversa para getBrainContext.                       */

let cachedOwnerId: string | null | undefined;

/** Resolve o uid do médico dono da instalação (1º e-mail de ADMIN_EMAILS). */
export async function resolveOwnerDoctorId(): Promise<string | null> {
  if (cachedOwnerId !== undefined) return cachedOwnerId;
  try {
    const ownerEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim().toLowerCase();
    if (!ownerEmail) {
      cachedOwnerId = null;
      return null;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let page = 1; page <= 5; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !data?.users?.length) break;
      const hit = data.users.find((u) => u.email?.toLowerCase() === ownerEmail);
      if (hit) {
        cachedOwnerId = hit.id;
        return hit.id;
      }
      if (data.users.length < 200) break;
    }
  } catch {
    /* segue sem dono resolvido */
  }
  cachedOwnerId = null;
  return null;
}

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
 * Carrega settings + entries DO MÉDICO e monta o bloco para o prompt.
 * `userMessage` serve SÓ para ranquear as entries — nunca entra no block.
 * `doctorId` opcional: sem ele, usa o médico dono da instalação.
 */
export async function getBrainContext(
  userMessage: string,
  doctorId?: string,
): Promise<BrainContext> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let target = doctorId ?? (await resolveOwnerDoctorId());
    if (!target) {
      // Fallback: o cérebro configurado mais recentemente (instalações onde
      // ADMIN_EMAILS não resolve para um usuário do auth)
      const { data: latest } = await (supabaseAdmin as any)
        .from("brain_settings")
        .select("doctor_id")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      target = latest?.doctor_id ?? null;
    }
    if (!target) return { block: "", enabledApp: true, enabledWhatsapp: true };

    const [settingsRes, entriesRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("brain_settings")
        .select("persona,sample_phrases,rules,enabled_app,enabled_whatsapp")
        .eq("doctor_id", target)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("brain_entries")
        .select("question,answer")
        .eq("doctor_id", target)
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
