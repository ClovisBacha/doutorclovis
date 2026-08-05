/**
 * Segundo Cérebro do médico — módulo server puro (sem createServerFn).
 *
 * Este arquivo é o ADAPTADOR da Obstétrica para o núcleo portável DoctorThink
 * (src/lib/doctorthink/). Toda a lógica de ranking e montagem do bloco vive no
 * núcleo (portável, sem acoplamento); aqui fica só o I/O específico da
 * Obstétrica (Supabase, entitlements do plano, e-mail de lacuna) + os rótulos
 * de domínio (OBSTETRICA_LABELS). Trocar os rótulos = trocar o domínio.
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

import {
  assembleBrainBlock,
  normalizeGapQuestion,
  rankEntriesByKeywords,
  type BrainBlockLabels,
  type BrainEntry,
} from "./doctorthink/core";

// Re-export para compatibilidade: chat.ts importa normalizeGapQuestion daqui.
export { normalizeGapQuestion };

/**
 * Rótulos de domínio da Obstétrica para o bloco do cérebro. É o único ponto
 * "médico/obstétrico" da montagem — outro app (DoctorThink para outra área)
 * fornece os seus. As strings são idênticas às originais (saída byte-a-byte).
 */
export const OBSTETRICA_LABELS: BrainBlockLabels = {
  header: "## Segundo Cérebro do médico",
  roleInstruction:
    "Você responde COMO O PRÓPRIO médico responderia, seguindo o estilo, as frases e as condutas registradas abaixo.",
  styleLabel: "### Estilo",
  phrasesLabel: "### Frases típicas",
  rulesLabel: "### Regras",
  referenceLabel:
    "### Respostas reais do médico (use como referência de conduta e tom; NUNCA invente conduta que não esteja aqui ou em conhecimento obstétrico consolidado; caso não coberto, oriente agendar consulta)",
};

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
  /**
   * Similaridade de cosseno do MELHOR acerto semântico (0 a 1), quando a busca
   * por vetor foi quem selecionou. `null` quando não houve busca semântica —
   * sem chave de IA, sem a extensão, ou quando o fallback por palavras assumiu.
   *
   * Existe para uma pergunta que hoje não tem resposta: **qual é a eficiência
   * real do cérebro?** O corte está em 0,55, que para este modelo de embedding
   * ainda aceita "vagamente relacionado" — e o erro daí é o mais perigoso num
   * app clínico: a IA acha que tem cobertura e responde "a sua médica orienta
   * que…" com uma entrada que não responde bem à pergunta.
   *
   * Guardando a similaridade de cada acerto, a decisão de mexer no corte passa
   * a ser tomada com a distribuição na mão em vez de por intuição.
   */
  melhorSimilaridade: number | null;
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

/**
 * Registra (fire-and-forget) uma LACUNA: pergunta que o cérebro não cobriu.
 * Deduplicada por (doctor_id, norm_question): repetição incrementa `hits` —
 * a fila do painel ordena pelo que as pacientes mais perguntam. Best-effort:
 * tabela ausente (migração pendente) ou corrida no insert nunca quebram o chat.
 */
/**
 * "Como envio meu exame pelo app?" não é lacuna do médico — é suporte, e a IA
 * já responde sozinha. Sem este filtro toda dúvida de uso caía na fila do
 * painel (nada casa no cérebro clínico), afogando as perguntas que realmente
 * pedem a palavra dele. Heurística de superfície de propósito: na dúvida
 * REGISTRA (perder uma lacuna clínica é pior que uma de suporte a mais).
 */
const TERMOS_SUPORTE = new RegExp(
  [
    // superfície do produto (nomeia a coisa na tela)
    "app|aplicativo|site|aba|tela|menu|bot(ã|a)o|(í|i)cone",
    // conta e cobrança
    "login|logar|senha|assinatura|assinar|premium|pagamento|cadastr|notifica(ç|c)",
    // falha técnica
    "instalar|atualiza(r|ç|c)|carregar|travand?o|travou|bug|sair da conta",
  ].join("|"),
  "i",
);
/* Fora de propósito: "plano" (plano de parto), "cartão" (cartão de pré-natal),
   "entrar" (entrar na piscina) e "erro" (erro no exame) são palavras clínicas
   no vocabulário da gestante — incluí-las derrubava lacunas de verdade. */

export function isSuporteDoApp(question: string): boolean {
  return TERMOS_SUPORTE.test(question);
}

/**
 * Vocabulário CLÍNICO — o sinal que impede o caminho enxuto de roubar contexto.
 *
 * `isSuporteDoApp` é heurística de superfície e erra para o lado seguro numa
 * decisão barata (registrar uma lacuna a mais). Para DESLIGAR o cérebro numa
 * conversa, o mesmo erro fica caro na direção oposta: "estou com dor de cabeça,
 * é normal? aliás o app travou" casa com "app" e perderia toda a orientação do
 * médico — a paciente receberia suporte técnico para uma queixa clínica.
 *
 * Por isso o caminho enxuto exige DOIS sinais: fala de app E não fala de corpo.
 * Na dúvida, é clínica.
 */
const TERMOS_CLINICOS = new RegExp(
  [
    "dor|sangr|c(ó|o)lica|contra(ç|c)|enjo|n(á|a)usea|v(ô|o)mit|tontur",
    "press(ã|a)o|glicem|diabet|incha|edema|febre|corrim|secre(ç|c)",
    "beb(ê|e)|feto|mexer|mexeu|chute|movimento|barriga|(ú|u)tero|placenta|l(í|i)quido",
    "exame|ultrassom|ultrasso|resultado|hemogram|urina|parto|ces(á|a)re|amamenta",
    "rem(é|e)dio|medicament|comprimido|dose|tomar|s(í|i)ntoma|sinto|senti|semana",
  ].join("|"),
  "i",
);

/**
 * É pergunta de suporte PURA — cabe à plataforma, não ao médico.
 *
 * Quando é, a conversa não precisa do Segundo Cérebro dele, nem da memória
 * clínica dela, nem das medidas: "como troco minha senha" não melhora com o
 * histórico de pressão arterial da paciente. Injetar tudo isso gasta os créditos
 * do médico e ainda produz a resposta longa que mistura dois assuntos.
 */
export function ehSoSuporte(question: string): boolean {
  return isSuporteDoApp(question) && !TERMOS_CLINICOS.test(question);
}

/**
 * Cortesia — agradecimento, despedida, confirmação.
 *
 * "obrigada!!" normaliza para "obrigada": oito caracteres, passa o piso de
 * tamanho e virava lacuna na fila do médico. Isso já era ruído; virou defeito
 * de verdade quando a lacuna passou a registrar QUEM perguntou — a paciente
 * ficava esperando resposta para um "obrigada", e ganharia um push quando ele
 * "respondesse".
 *
 * Comparação EXATA depois de normalizar, nunca substring: "obrigada, mas posso
 * tomar dipirona?" é uma pergunta clínica de verdade e não pode cair aqui.
 */
const CORTESIAS = new Set([
  "obrigada",
  "obrigado",
  "muito obrigada",
  "muito obrigado",
  "brigada",
  "brigado",
  "valeu",
  "ta bom",
  "tudo bem",
  "entendi",
  "entendido",
  "certo",
  "beleza",
  "perfeito",
  "otimo",
  "ate mais",
  "tchau",
  "bom dia",
  "boa tarde",
  "boa noite",
]);

export function isCortesia(question: string): boolean {
  return CORTESIAS.has(normalizeGapQuestion(question));
}

/**
 * Corte para JUNTAR duas lacunas.
 *
 * Muito mais alto que o 0,55 da leitura, e de propósito: são erros de custo
 * diferente. Ler uma entrada meio relacionada dá uma resposta mais fraca;
 * JUNTAR duas perguntas diferentes numa só faz o médico responder uma e achar
 * que respondeu a outra — e a paciente da segunda recebe uma orientação que não
 * era para ela.
 *
 * 0,86 é "a mesma pergunta com outras palavras". Abaixo disso, duas linhas na
 * fila é o resultado seguro.
 */
const GAP_MERGE_MIN_SIMILARITY = 0.86;

export function logBrainGap(
  doctorId: string,
  question: string,
  channel: BrainChannel,
  /**
   * Quem perguntou.
   *
   * Opcional porque o painel também gera lacuna ao TESTAR a IA (canal
   * "teste"), e ali não há paciente esperando resposta. Quando existe, é o que
   * permite a IA cumprir o que ela promete a ela — "registrei aqui para ele
   * ver" — em vez de a resposta morrer no treinamento.
   */
  patientId?: string,
  /**
   * O vetor da pergunta, quando já existe.
   *
   * Ele acabou de ser calculado — alguns milissegundos antes, para procurar
   * cobertura nas entradas do médico. Reaproveitá-lo aqui é o que faz o
   * agrupamento custar ZERO embedding a mais no caminho do chat, que é o
   * volume.
   *
   * Omitir é permitido: quem não tem um à mão (o polegar para baixo no app, a
   * API do DoctorThink) deixa a função calcular. Sem chave de IA, a lacuna
   * nasce sem vetor e a deduplicação segue sendo a por texto — o comportamento
   * de antes, nunca pior.
   */
  embedding?: number[] | null,
): void {
  const clean = question.trim().slice(0, 300);
  const norm = normalizeGapQuestion(clean);
  if (norm.length < 8) return; // "oi", "ok" etc. não são lacunas
  if (isSuporteDoApp(clean)) return; // suporte do app não vira fila do médico
  if (isCortesia(clean)) return; // "obrigada" não é dúvida esperando resposta
  void (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;
      /* Primeiro pelo texto exato (barato e certeiro), depois por semelhança. */
      let { data: existing } = await sb
        .from("brain_gaps")
        .select("id,hits,status")
        .eq("doctor_id", doctorId)
        .eq("norm_question", norm)
        .maybeSingle();

      /* O vetor, quando quem chamou não tinha um.
         Só DEPOIS da busca por texto, de propósito: se o texto exato já bateu,
         não há nada para agrupar e o embedding seria dinheiro no lixo.
         Quem chega aqui sem vetor são os caminhos raros — o polegar para baixo
         no app e a API do DoctorThink, que não têm um calculado à mão. O chat,
         que é o volume, sempre passa o dele. Timeout folgado porque isto roda
         solto: ninguém está esperando esta resposta. */
      let vetor = embedding ?? null;
      if (!existing && !vetor) {
        try {
          const { embedText } = await import("./embeddings.server");
          vetor = await embedText(clean, 4000);
        } catch {
          vetor = null; // sem chave de IA → segue a deduplicação por texto
        }
      }

      /* Não achou pelo texto: procura uma lacuna ABERTA que seja a mesma
         pergunta escrita de outro jeito. É isto que impede o médico de
         responder "é normal sentir enjoo?" três vezes. */
      if (!existing && vetor) {
        const { data: parecidas } = await sb.rpc("match_brain_gaps", {
          p_doctor_id: doctorId,
          p_embedding: vetor,
          p_limit: 1,
        });
        const perto = (parecidas ?? [])[0] as
          | { id: string; hits: number; similarity: number }
          | undefined;
        if (perto && perto.similarity >= GAP_MERGE_MIN_SIMILARITY) {
          existing = { id: perto.id, hits: perto.hits, status: "aberta" };
        }
      }
      /* Registra quem está esperando. Tabela separada de propósito: a lacuna é
         deduplicada por `(médico, pergunta)` — é isso que faz cinquenta
         pacientes com a mesma dúvida virarem UM item na fila dele. */
      const anotaQuemPerguntou = async (gapId: string) => {
        if (!patientId || !gapId) return;
        await sb
          .from("brain_gap_askers")
          .upsert({ gap_id: gapId, user_id: patientId }, { onConflict: "gap_id,user_id" });
      };

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
        await anotaQuemPerguntou(existing.id);
      } else {
        const { data: nova } = await sb
          .from("brain_gaps")
          .insert({
            doctor_id: doctorId,
            question: clean,
            norm_question: norm,
            channel,
            /* Sem vetor a lacuna funciona igual — só não agrupa. Melhor nascer
               sem que não nascer. */
            ...(vetor ? { embedding: vetor } : {}),
          })
          .select("id")
          .maybeSingle();
        await anotaQuemPerguntou(nova?.id);
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

/* ── Multi-inquilino: cada médico tem o SEU cérebro ──────────────────────────
   Todas as tabelas são chaveadas por doctor_id (uid do médico no auth). Não
   existe mais "dono da instalação": o chat/WhatsApp usam o cérebro do médico
   DAQUELA paciente (doctorId passado a getBrainContext); sem médico → genérico.
   O admin da plataforma não é médico e não opera cérebro (ver /admin).       */

type BrainSettingsRow = {
  persona: string | null;
  sample_phrases: string | null;
  rules: string | null;
  enabled_app: boolean | null;
  enabled_whatsapp: boolean | null;
};

type BrainEntryRow = { question: string; answer: string };

const MAX_ENTRIES_LOADED = 200;
const MAX_ENTRIES_SCORED = 6;

/**
 * Teto de CARACTERES das entradas que entram no prompt.
 *
 * Seis entradas era um limite de contagem, não de tamanho — e o tamanho é do
 * médico. Um que escreve orientações longas e detalhadas produz um bloco de
 * ~1.500 tokens; um que escreve em duas linhas, ~300. Cinco vezes de diferença
 * na maior parcela variável do prompt, e ela se paga em TODA mensagem.
 *
 * Isso importa por dois motivos que se somam:
 *
 *  · O custo cresce junto com a QUALIDADE do uso — o médico caprichoso, que é o
 *    melhor cliente, é o mais caro de servir.
 *  · Se um dia a plataforma cobrar por mensagem, "1 mensagem = 1 unidade" só é
 *    honesto se a mensagem custar mais ou menos o mesmo. Sem este teto, não
 *    custa.
 *
 * 4.000 caracteres ≈ 1.000 tokens: cabe folgado o caso comum (6 entradas de
 * ~300 caracteres) e corta só a cauda.
 */
const MAX_BLOCK_CHARS = 4000;

/**
 * Corta as entradas até caber no teto — sempre INTEIRAS, e nunca até zero.
 *
 * Duas regras que parecem detalhe e não são:
 *
 *  · **Nunca corta uma entrada pela metade.** O texto é orientação clínica
 *    escrita pelo médico; meia frase pode inverter o sentido ("não use X em
 *    caso de…" cortado no "não use X"). Entrada que não cabe inteira não entra.
 *
 *  · **Nunca devolve lista vazia se havia alguma.** `selected.length > 0` é o
 *    que define `hadCoverage`, e `hadCoverage` muda o que a IA DIZ: sem
 *    cobertura ela responde "essa dúvida o seu médico prefere responder
 *    pessoalmente" e registra uma lacuna. Zerar aqui transformaria uma
 *    otimização de custo numa mudança de comportamento clínico — e ninguém
 *    entenderia por quê. Se a primeira entrada sozinha estoura o teto, ela
 *    passa: pagar caro uma vez é melhor que mentir sobre cobertura.
 */
export function limitarPorCaracteres(
  selected: BrainEntry[],
  maxChars = MAX_BLOCK_CHARS,
): BrainEntry[] {
  const out: BrainEntry[] = [];
  let usado = 0;
  for (const e of selected) {
    const custo = (e.question?.length ?? 0) + (e.answer?.length ?? 0) + 8; /* "P: \nR: \n" */
    if (out.length > 0 && usado + custo > maxChars) break;
    out.push(e);
    usado += custo;
  }
  return out;
}
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
  /** Quem está perguntando — vai junto para a lacuna saber quem espera. */
  patientId?: string,
): Promise<BrainContext> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Multi-inquilino puro: o cérebro é o do médico DAQUELA paciente. Sem
    // médico vinculado (doctorId undefined) → chat genérico, sem cérebro.
    // Não existe mais fallback para "o dono da instalação".
    const target = doctorId ?? null;
    if (!target)
      return {
        block: "",
        enabledApp: true,
        enabledWhatsapp: true,
        hadCoverage: false,
        melhorSimilaridade: null,
      };

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
      getEntitlementsByDoctorId(target),
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
      return {
        block: "",
        enabledApp,
        enabledWhatsapp,
        hadCoverage: false,
        melhorSimilaridade: null,
      };
    if (channel === "whatsapp" && !enabledWhatsapp) {
      return {
        block: "",
        enabledApp,
        enabledWhatsapp,
        hadCoverage: false,
        melhorSimilaridade: null,
      };
    }
    if (channel === "teste" && !ent.aiApp)
      return {
        block: "",
        enabledApp,
        enabledWhatsapp,
        hadCoverage: false,
        melhorSimilaridade: null,
      };

    // ── Seleção em 2 camadas ─────────────────────────────────────────────
    // 1ª) SEMÂNTICA (pgvector + embedding da pergunta): entende sinônimos —
    //     "tô enjoada" encontra "náuseas no 1º trimestre". Busca em TODAS as
    //     entradas aprovadas com vetor (sem o teto de 200 do fallback).
    // 2ª) PALAVRAS (fallback): sem chave de IA, sem extensão/migração ou
    //     nenhum match acima do corte → o ranking clássico assume.
    // A mensagem da paciente vira só o VETOR de consulta — segue nunca
    // entrando no texto do bloco (anti prompt-injection preservado).
    let selected: BrainEntryRow[] = [];
    /* A similaridade do MELHOR acerto, antes do corte — inclusive quando ela
       fica ABAIXO dele. Guardar só os aprovados esconderia metade da
       informação: saber que a melhor entrada deu 0,52 é o que revela um corte
       apertado demais, e isso some se a gente só olhar o que passou. */
    let melhorSimilaridade: number | null = null;
    /* Declarado AQUI, fora do `try`, porque quem precisa dele é a lacuna — e a
       lacuna é registrada lá embaixo, depois que o `try` já fechou. Dentro do
       bloco, o vetor morreria no escopo alguns milissegundos antes de ser
       usado, e o agrupamento nunca aconteceria: as lacunas nasceriam todas sem
       vetor, silenciosamente, exatamente como antes desta mudança. */
    let vetorDaPergunta: number[] | null = null;
    if (entries.length > 0) {
      try {
        const { embedText } = await import("./embeddings.server");
        // Timeout CURTO: estamos no caminho crítico do chat — se o embedding
        // não chegar em 1,8s, o fallback por palavras responde na hora.
        const qvec = await embedText(userMessage, 1800);
        vetorDaPergunta = qvec ?? null;
        if (qvec) {
          const { data: matches, error } = await (supabaseAdmin as any).rpc("match_brain_entries", {
            p_doctor_id: target,
            p_embedding: qvec,
            p_limit: MAX_ENTRIES_SCORED,
          });
          if (!error && Array.isArray(matches)) {
            const achados = matches as { question: string; answer: string; similarity: number }[];
            if (achados.length > 0) {
              melhorSimilaridade = Math.max(...achados.map((m) => m.similarity));
            }
            selected = achados
              .filter((m) => m.similarity >= SEMANTIC_MIN_SIMILARITY)
              .map((m) => ({ question: m.question, answer: m.answer }));
          }
        }
      } catch {
        /* RPC/extensão ausente ou falha de embedding → fallback por palavras */
      }
    }

    if (selected.length === 0) {
      // Fallback por palavras (núcleo DoctorThink). SEM "mais recentes":
      // injetar entradas aleatórias quando nada casa é ruído no prompt — em vez
      // disso o miss vira uma LACUNA para o médico responder no painel.
      selected = rankEntriesByKeywords(userMessage, entries, MAX_ENTRIES_SCORED);
    }

    if (selected.length === 0 && channel !== "teste") {
      /* É o MESMO vetor usado para procurar cobertura, calculado logo acima.
         Passar adiante custa zero e é o que permite agrupar. */
      logBrainGap(target, userMessage, channel, patientId, vetorDaPergunta);
    }

    // Montagem do bloco pelo núcleo DoctorThink (rótulos de domínio da
    // Obstétrica). Retorna "" quando não há persona/regras nem entries.
    const block = assembleBrainBlock(
      { persona, samplePhrases, rules },
      /* O teto de caracteres entra aqui, e não dentro do `assembleBrainBlock`:
         a persona e as regras são a VOZ do médico e valem para toda pergunta —
         cortá-las mudaria como ele soa. O que se corta é a lista de referência,
         que é longa, variável e específica daquela pergunta. */
      limitarPorCaracteres(selected),
      OBSTETRICA_LABELS,
    );
    if (!block) {
      return {
        block: "",
        enabledApp,
        enabledWhatsapp,
        hadCoverage: false,
        melhorSimilaridade: null,
      };
    }

    // Bloco não-vazio realmente montado → o cérebro vai ser usado: registra o
    // hit (fire-and-forget; 'teste' é ignorado dentro de logBrainHit).
    logBrainHit(target, channel);

    return {
      block,
      enabledApp,
      enabledWhatsapp,
      hadCoverage: selected.length > 0,
      melhorSimilaridade,
    };
  } catch {
    // Falha de banco não pode derrubar o chat: segue sem o segundo cérebro.
    return {
      block: "",
      enabledApp: true,
      enabledWhatsapp: true,
      hadCoverage: false,
      melhorSimilaridade: null,
    };
  }
}

/**
 * Resolve o contexto do cérebro escolhendo a FONTE: DoctorThink remoto (produto
 * standalone) OU o cérebro local. Opt-in explícito por env
 * (DOCTORTHINK_API_URL + DOCTORTHINK_API_KEY) + kill switch/rollout pela flag
 * `doctorthink_remote`. Sem env (padrão) → SEMPRE local, comportamento provado.
 * Qualquer falha do remoto (timeout/rede/erro) → cai no local. É o mesmo shape
 * de retorno do getBrainContext, então os chamadores não mudam.
 */
export async function getBrainContextResolved(
  userMessage: string,
  doctorId?: string,
  channel: BrainChannel = "app",
  patientId?: string,
): Promise<BrainContext> {
  const url = process.env.DOCTORTHINK_API_URL;
  const apiKey = process.env.DOCTORTHINK_API_KEY;
  if (url && apiKey && doctorId) {
    try {
      // Duplo opt-in: além do env, a flag precisa estar EXPLICITAMENTE ligada
      // (ausência = desligado) — evita ligar o remoto em 100% por acidente ao
      // só setar as envs.
      const { isFlagExplicitlyEnabled } = await import("./platform-flags.server");
      if (await isFlagExplicitlyEnabled("doctorthink_remote", doctorId)) {
        const { askBrainRemote } = await import("./doctorthink/client");
        const remote = await askBrainRemote(url, apiKey, {
          doctorId,
          message: userMessage,
          channel,
        });
        if (remote) {
          return {
            block: remote.block,
            enabledApp: remote.enabledChannels.app ?? true,
            enabledWhatsapp: remote.enabledChannels.whatsapp ?? true,
            hadCoverage: remote.hadCoverage,
            /* O cérebro remoto não devolve similaridade: `null` é honesto. */
            melhorSimilaridade: null,
          };
        }
      }
    } catch {
      /* qualquer problema → cai no cérebro local */
    }
  }
  return getBrainContext(userMessage, doctorId, channel, patientId);
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
