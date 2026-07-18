/**
 * Segundo Cérebro do médico — módulo server puro (sem createServerFn).
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
  /**
   * true = alguma orientação validada do médico casou com a pergunta.
   * false = sem cobertura (a lacuna já foi registrada) — o chat usa isso para
   * ESCALAR com honestidade ("registrei sua dúvida para o médico") em vez de
   * improvisar conduta.
   */
  hadCoverage: boolean;
};

/** Canal em que o cérebro foi usado (telemetria do dashboard do médico). */
export type BrainChannel = "app" | "whatsapp" | "teste";

/**
 * Registra (fire-and-forget) um "acerto" do cérebro em brain_hits, para o
 * dashboard do médico medir quantas vezes o cérebro respondeu no mês.
 * O teste do painel (channel 'teste') NÃO conta como uso real. A falha do
 * insert NUNCA pode quebrar o chat: tudo dentro de try/catch, sem await que
 * propague (void em IIFE — a promise não é aguardada por quem chama).
 */
function logBrainHit(doctorId: string, channel: BrainChannel): void {
  if (channel === "teste") return;
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("brain_hits").insert({ doctor_id: doctorId, channel });
    } catch {
      /* telemetria é best-effort — nunca afeta a resposta ao paciente */
    }
  })();
}

/** Normaliza a pergunta para deduplicar lacunas ("Posso tomar café?" ≈ "posso tomar cafe"). */
export function normalizeGapQuestion(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Registra (fire-and-forget) uma LACUNA: pergunta que o cérebro não cobriu.
 * Deduplicada por (doctor_id, norm_question): repetição incrementa `hits` —
 * a fila do painel ordena pelo que as pacientes mais perguntam. Best-effort:
 * tabela ausente (migração pendente) ou corrida no insert nunca quebram o chat.
 */
export function logBrainGap(doctorId: string, question: string, channel: BrainChannel): void {
  const clean = question.trim().slice(0, 300);
  const norm = normalizeGapQuestion(clean);
  if (norm.length < 8) return; // "oi", "ok" etc. não são lacunas
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;
      const { data: existing } = await sb
        .from("brain_gaps")
        .select("id,hits,status")
        .eq("doctor_id", doctorId)
        .eq("norm_question", norm)
        .maybeSingle();
      if (existing) {
        // Reaparecer conta como novo hit; lacuna ignorada não reabre sozinha.
        await sb
          .from("brain_gaps")
          .update({
            hits: (existing.hits ?? 1) + 1,
            updated_at: new Date().toISOString(),
            ...(existing.status === "respondida" ? { status: "aberta" } : {}),
          })
          .eq("id", existing.id);
      } else {
        await sb.from("brain_gaps").insert({
          doctor_id: doctorId,
          question: clean,
          norm_question: norm,
          channel,
        });
        // Fecha o ciclo em horas, não em dias: avisa o médico que a IA tem
        // pergunta sem resposta. No máximo 1 e-mail por dia por médico (o
        // primeiro gap do dia dispara; os demais só aparecem no painel).
        notifyDoctorOfGap(doctorId, sb);
      }
    } catch {
      /* best-effort — nunca afeta a resposta ao paciente */
    }
  })();
}

/**
 * E-mail "sua IA tem perguntas sem resposta" (fire-and-forget, ≤1/dia).
 * Sem RESEND_API_KEY vira no-op (o painel continua sendo a fonte).
 */
function notifyDoctorOfGap(doctorId: string, sb: any): void {
  void (async () => {
    try {
      if (!process.env.RESEND_API_KEY) return;
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const { count, error } = await sb
        .from("brain_gaps")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .gte("created_at", dayStart.toISOString());
      // Só o PRIMEIRO gap novo do dia notifica (throttle sem coluna extra).
      if (error || (count ?? 0) !== 1) return;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(doctorId);
      const email = u?.user?.email;
      if (!email) return;

      const { sendEmail, emailLayout } = await import("./email.server");
      const { DOCTOR } = await import("./doctor.config");
      await sendEmail({
        to: email,
        subject: "🧠 Sua IA recebeu uma pergunta que não soube responder",
        html: emailLayout(
          "Sua paciente perguntou — a IA registrou para você",
          `<p style="margin:0 0 12px;line-height:1.6">Uma paciente fez uma pergunta que ainda não está coberta pelo seu Segundo Cérebro. Ela foi avisada com acolhimento e a pergunta ficou registrada para você.</p>
           <p style="margin:0 0 16px;line-height:1.6">Responda no painel (leva menos de 1 minuto com o rascunho da IA) e o cérebro aprende na hora — a próxima paciente com a mesma dúvida já recebe a SUA orientação.</p>
           <p style="margin:0"><a href="${DOCTOR.siteUrl}/painel" style="display:inline-block;background:#a85a44;color:#fff;text-decoration:none;border-radius:999px;padding:10px 22px;font-size:14px">Responder no painel</a></p>
           <p style="margin:16px 0 0;font-size:12px;color:#9b8178">Você recebe no máximo 1 aviso destes por dia.</p>`,
        ),
      });
    } catch {
      /* best-effort */
    }
  })();
}

/* ── Multi-perfil: cada médico tem o SEU cérebro ─────────────────────────────
   As tabelas são chaveadas por doctor_id (uid do médico no auth). Nesta
   instalação single-doctor, o "dono" é o primeiro e-mail de ADMIN_EMAILS —
   toda a equipe (ex.: secretária) treina o cérebro DO médico, e o chat/
   WhatsApp respondem com ele. Numa futura plataforma multi-médico, basta
   passar o doctorId da conversa para getBrainContext.                       */

let cachedOwnerId: string | null | undefined;

/**
 * Resolve o uid do médico dono da instalação (1º e-mail de ADMIN_EMAILS).
 * Via RPC get_user_id_by_email (não varre listUsers, que inclui as pacientes).
 * O cache de módulo só guarda SUCESSO — ou null determinístico (ADMIN_EMAILS
 * vazio); falha transitória de rede não é cacheada, para a próxima chamada
 * tentar de novo (em serverless o módulo vive horas).
 */
export async function resolveOwnerDoctorId(): Promise<string | null> {
  if (cachedOwnerId !== undefined) return cachedOwnerId;
  const ownerEmail = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim().toLowerCase();
  if (!ownerEmail) {
    cachedOwnerId = null; // determinístico: sem dono configurado
    return null;
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("get_user_id_by_email", {
      p_email: ownerEmail,
    });
    if (!error && data) {
      cachedOwnerId = data as string;
      return cachedOwnerId;
    }
    // Fallback (RPC ainda não aplicada no banco): varre as primeiras páginas
    for (let page = 1; page <= 5; page++) {
      const { data: pg, error: e } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (e || !pg?.users?.length) break;
      const hit = pg.users.find((u) => u.email?.toLowerCase() === ownerEmail);
      if (hit) {
        cachedOwnerId = hit.id;
        return hit.id;
      }
      if (pg.users.length < 200) break;
    }
  } catch {
    /* falha transitória: NÃO cachear — tenta de novo na próxima chamada */
  }
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
/** Corte de similaridade de cosseno da busca semântica (abaixo = irrelevante). */
const SEMANTIC_MIN_SIMILARITY = 0.55;

/**
 * Carrega settings + entries DO MÉDICO e monta o bloco para o prompt.
 * `userMessage` serve SÓ para ranquear as entries — nunca entra no block.
 * `doctorId` opcional: sem ele, usa o médico dono da instalação.
 */
export async function getBrainContext(
  userMessage: string,
  doctorId?: string,
  channel: BrainChannel = "app",
): Promise<BrainContext> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // P3: SEM fallback para "settings mais recente" — agora que qualquer
    // usuário pode criar brain_settings via cadastro de médico, esse fallback
    // permitiria sequestrar a persona do chat público. Dono não resolvido →
    // chat segue sem cérebro.
    const ownerId = await resolveOwnerDoctorId();
    const target = doctorId ?? ownerId;
    if (!target) return { block: "", enabledApp: true, enabledWhatsapp: true, hadCoverage: false };
    // A conta dona da instalação (ADMIN_EMAILS) tem acesso total; um assinante
    // usa as capacidades do próprio plano.
    const isOwner = !!ownerId && target === ownerId;

    const { getEntitlementsByDoctorId } = await import("./entitlements.server");
    const [settingsRes, entriesRes, ent] = await Promise.all([
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
      getEntitlementsByDoctorId(target, isOwner),
    ]);

    const settings = (settingsRes.data ?? null) as BrainSettingsRow | null;
    const entries = (entriesRes.data ?? []) as BrainEntryRow[];

    const persona = (settings?.persona ?? "").trim();
    const samplePhrases = (settings?.sample_phrases ?? "").trim();
    const rules = (settings?.rules ?? "").trim();
    // Entitlement do plano MANDA sobre o toggle salvo: mesmo com enabled_*=true,
    // se o plano não cobre o canal, o cérebro nunca é injetado nele. É isto que
    // faz "quem pagou o plano X ter exatamente o acesso do plano X".
    const enabledApp = (settings?.enabled_app ?? true) && ent.aiApp;
    const enabledWhatsapp = (settings?.enabled_whatsapp ?? true) && ent.aiWhatsapp;

    // Canal não coberto pelo plano → bloco vazio (nada do cérebro vaza).
    if (channel === "app" && !enabledApp)
      return { block: "", enabledApp, enabledWhatsapp, hadCoverage: false };
    if (channel === "whatsapp" && !enabledWhatsapp) {
      return { block: "", enabledApp, enabledWhatsapp, hadCoverage: false };
    }
    if (channel === "teste" && !ent.aiApp)
      return { block: "", enabledApp, enabledWhatsapp, hadCoverage: false };

    // ── Seleção em 2 camadas ─────────────────────────────────────────────
    // 1ª) SEMÂNTICA (pgvector + embedding da pergunta): entende sinônimos —
    //     "tô enjoada" encontra "náuseas no 1º trimestre". Busca em TODAS as
    //     entradas aprovadas com vetor (sem o teto de 200 do fallback).
    // 2ª) PALAVRAS (fallback): sem chave de IA, sem extensão/migração ou
    //     nenhum match acima do corte → o ranking clássico assume.
    // A mensagem da paciente vira só o VETOR de consulta — segue nunca
    // entrando no texto do bloco (anti prompt-injection preservado).
    let selected: BrainEntryRow[] = [];
    if (entries.length > 0) {
      try {
        const { embedText } = await import("./embeddings.server");
        // Timeout CURTO: estamos no caminho crítico do chat — se o embedding
        // não chegar em 1,8s, o fallback por palavras responde na hora.
        const qvec = await embedText(userMessage, 1800);
        if (qvec) {
          const { data: matches, error } = await (supabaseAdmin as any).rpc("match_brain_entries", {
            p_doctor_id: target,
            p_embedding: qvec,
            p_limit: MAX_ENTRIES_SCORED,
          });
          if (!error && Array.isArray(matches)) {
            selected = (matches as { question: string; answer: string; similarity: number }[])
              .filter((m) => m.similarity >= SEMANTIC_MIN_SIMILARITY)
              .map((m) => ({ question: m.question, answer: m.answer }));
          }
        }
      } catch {
        /* RPC/extensão ausente ou falha de embedding → fallback por palavras */
      }
    }

    if (selected.length === 0) {
      // Pontua cada entry pelas palavras da mensagem presentes em pergunta+resposta.
      const words = significantWords(userMessage);
      const scored = entries.map((entry) => {
        const haystack = normalize(`${entry.question} ${entry.answer}`);
        let score = 0;
        for (const w of words) if (haystack.includes(w)) score += 1;
        return { entry, score };
      });

      // Top 6 com score > 0. SEM fallback de "mais recentes": injetar entradas
      // aleatórias quando nada casa é ruído no prompt — em vez disso o miss vira
      // uma LACUNA registrada para o médico responder no painel (autoaprendizado
      // com o médico no loop).
      selected = scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score) // sort estável: empates mantêm as mais recentes primeiro
        .slice(0, MAX_ENTRIES_SCORED)
        .map((s) => s.entry);
    }

    if (selected.length === 0 && channel !== "teste") {
      logBrainGap(target, userMessage, channel);
    }

    // Sem settings nem entries → sem bloco.
    if (!persona && !samplePhrases && !rules && selected.length === 0) {
      return { block: "", enabledApp, enabledWhatsapp, hadCoverage: false };
    }

    const parts: string[] = [
      "## Segundo Cérebro do médico",
      "Você responde COMO O PRÓPRIO médico responderia, seguindo o estilo, as frases e as condutas registradas abaixo.",
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

    // Bloco não-vazio realmente montado → o cérebro vai ser usado: registra o
    // hit (fire-and-forget; 'teste' é ignorado dentro de logBrainHit).
    logBrainHit(target, channel);

    return {
      block: parts.join("\n") + "\n",
      enabledApp,
      enabledWhatsapp,
      hadCoverage: selected.length > 0,
    };
  } catch {
    // Falha de banco não pode derrubar o chat: segue sem o segundo cérebro.
    return { block: "", enabledApp: true, enabledWhatsapp: true, hadCoverage: false };
  }
}

/**
 * Placar de qualidade do cérebro de UM médico (mês corrente) — usado no card
 * do painel e no relatório por médico da aba Clínica. null = tabelas do
 * autoaprendizado ainda não migradas / erro (o chamador esconde o placar).
 */
export async function computeBrainQualityStats(doctorId: string): Promise<{
  hitsMonth: number;
  gapsOpen: number;
  gapHitsMonth: number;
  coveragePct: number | null;
  satisfactionPct: number | null;
  feedbackCount: number;
} | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const since = monthStart.toISOString();

    const [hitsRes, gapsOpenRes, gapRowsRes, fbRes] = await Promise.all([
      sb
        .from("brain_hits")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .gte("created_at", since),
      sb
        .from("brain_gaps")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", doctorId)
        .eq("status", "aberta"),
      sb
        .from("brain_gaps")
        .select("hits,created_at")
        .eq("doctor_id", doctorId)
        .gte("updated_at", since)
        .limit(500),
      sb
        .from("brain_feedback")
        .select("helpful")
        .eq("doctor_id", doctorId)
        .gte("created_at", since)
        .limit(1000),
    ]);
    if (hitsRes.error || gapsOpenRes.error || gapRowsRes.error || fbRes.error) return null;

    const hitsMonth = hitsRes.count ?? 0;
    const gapsOpen = gapsOpenRes.count ?? 0;
    // Misses SÓ do mês: lacuna criada no mês → todos os hits dela são do mês;
    // lacuna antiga tocada no mês → conta 1 (não arrasta o histórico).
    const gapHitsMonth = ((gapRowsRes.data ?? []) as { hits: number; created_at: string }[]).reduce(
      (s, g) => s + (g.created_at >= since ? (g.hits ?? 1) : 1),
      0,
    );
    const fb = (fbRes.data ?? []) as { helpful: boolean }[];
    const fbPos = fb.filter((f) => f.helpful).length;
    const denomCov = hitsMonth + gapHitsMonth;
    return {
      hitsMonth,
      gapsOpen,
      gapHitsMonth,
      coveragePct: denomCov > 0 ? Math.round((hitsMonth / denomCov) * 100) : null,
      satisfactionPct: fb.length > 0 ? Math.round((fbPos / fb.length) * 100) : null,
      feedbackCount: fb.length,
    };
  } catch {
    return null;
  }
}
