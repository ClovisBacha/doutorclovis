import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createChatProvider, DEFAULT_CHAT_MODEL } from "@/lib/ai-gateway.server";
import {
  getBrainContextResolved,
  isCortesia,
  isSuporteDoApp,
  normalizeGapQuestion,
} from "@/lib/secondbrain.server";
import { computeGestation } from "@/lib/gestacao";
import { clientIp, makeRateLimiter } from "@/lib/rate-limit.server";

// Rate limit simples por IP (janela fixa, em memória). Em ambiente serverless
// a memória não é compartilhada entre instâncias nem persiste entre cold starts,
// então é uma proteção básica contra abuso/varredura — não uma garantia rígida.
const rateLimited = makeRateLimiter(20, 60_000); // 20 mensagens/min

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
- Em dúvida CLÍNICA, responda SOMENTE seguindo o estilo e as condutas já validadas pelo médico (bloco abaixo, se houver). Se a dúvida clínica estiver fora do que o médico validou, NÃO improvise conduta: diga que vai encaminhar para o médico e oriente marcar/consultar.
- Não invente dados (telefone, endereço, valores, resultados de exame).

Você TAMBÉM é o suporte do app — e isso não passa pelo médico:
- Dúvida de COMO USAR o app ou o site (onde fica uma aba, registrar contração ou chute, marcar consulta, enviar exame, convidar acompanhante, teleconsulta, plano/assinatura, login, notificação) você responde direto, na hora.
- Nunca encaminhe uma dúvida dessas ao médico nem diga que "registrou para ele ver": ele responde conduta clínica, não suporte do aplicativo.
- Se a pergunta misturar as duas coisas, resolva a parte do app e trate a parte clínica pela regra acima.`;
}

/**
 * Resolve o médico da PACIENTE logada a partir do token do Supabase enviado no
 * header Authorization. Sem token (site público) → null. Devolve o doctor_id
 * (para injetar o cérebro DAQUELE médico) e o nome dele (para a persona).
 */
async function resolvePatientDoctor(request: Request): Promise<{
  patientId: string;
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
    if (first.error) {
      // QUALQUER falha nas colunas clínicas (42703, transitória) NUNCA pode
      // derrubar o vínculo com o médico — o cérebro do chat depende dele.
      // Re-consulta só o essencial; personalização é enriquecimento.
      console.error("[chat] clinical select failed, fallback to essentials", first.error);
      const fb = await (supabaseAdmin as any)
        .from("patient_profiles")
        .select("doctor_id,lmp_date,reference_date,reference_weeks,reference_days")
        .eq("id", data.user.id)
        .maybeSingle();
      prof = fb.data;
    }
    const clinicalBlock = buildClinicalBlock(prof ?? null);
    const doctorId = (prof?.doctor_id ?? null) as string | null;
    if (!doctorId)
      return { patientId: data.user.id, doctorId: null, doctorName: null, clinicalBlock };
    const { data: doc } = await (supabaseAdmin as any)
      .from("doctors")
      .select("display_name")
      .eq("id", doctorId)
      .maybeSingle();
    return {
      patientId: data.user.id,
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

/**
 * Bloco de MEDIDAS RECENTES.
 *
 * A IA sabia o histórico obstétrico de risco, a semana e o humor — e não sabia
 * nenhum número medido NESTA gestação. O efeito é específico e perverso: a
 * paciente com pré-eclâmpsia prévia escreve "estou com muita dor de cabeça", a
 * IA calibra certo pelo histórico e ignora que ela registrou 158/102 duas horas
 * antes. Responde bem pelo motivo certo e não vê o dado que decidiria a
 * conduta.
 *
 * E como a IA responde 24 horas por dia e o médico não, era ela que estava na
 * linha de frente do alto risco, cega.
 *
 * Três decisões que valem mais que o código:
 *
 * 1. **Só o que está fora de faixa, e só 14 dias.** Despejar a série inteira
 *    faria o modelo recitar números de volta. O que muda a resposta é "há algo
 *    alterado agora"; o resto é ruído que compete com a pergunta dela.
 * 2. **A régua é a mesma** de `sinais-clinicos.ts`. Se a IA achasse que 145/92
 *    é normal enquanto a tela dela diz "pressão elevada", a paciente receberia
 *    duas verdades do mesmo produto.
 * 3. **Isto é contexto, não autorização.** O portão de cobertura do cérebro do
 *    médico continua mandando na conduta: saber a pressão não faz a IA
 *    prescrever nada.
 */
async function buildMedidasBlock(patientId: string): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sinalGlicemia, sinalPressao } = await import("@/lib/sinais-clinicos");
    const desde = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    /* AS DUAS FONTES. O bloco lia só `health_logs`, e a paciente grava pressão
       em três lugares — o cenário descrito no docstring acima é justamente o da
       TRIAGEM: 23h, ela marca "dor de cabeça com visão turva", digita 175/115,
       o app manda procurar atendimento, e dez minutos depois abre o chat. Sem
       `triage_logs` aqui, a IA não recebia número nenhum exatamente no caso que
       motivou o bloco. */
    const [hl, tl] = await Promise.all([
      (supabaseAdmin as any)
        .from("health_logs")
        .select("log_date,systolic,diastolic,glucose_mg_dl")
        .eq("user_id", patientId)
        .gte("log_date", desde)
        .order("log_date", { ascending: false })
        .limit(30),
      (supabaseAdmin as any)
        .from("triage_logs")
        .select("created_at,systolic,diastolic")
        .eq("user_id", patientId)
        .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString())
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    const data = [
      ...((hl.data ?? []) as Record<string, unknown>[]),
      ...((tl.data ?? []) as Record<string, unknown>[]).map((t) => ({
        log_date: String(t.created_at).slice(0, 10),
        systolic: t.systolic,
        diastolic: t.diastolic,
        glucose_mg_dl: null,
      })),
    ].sort((a, b) => String(b.log_date).localeCompare(String(a.log_date)));
    if (!data.length) return "";

    const linhas: string[] = [];
    let ultimaPA: string | null = null;
    let ultimaGli: string | null = null;
    for (const l of data as Record<string, number | string | null>[]) {
      const dia = new Date(`${l.log_date}T12:00:00`).toLocaleDateString("pt-BR");
      const pa = sinalPressao(l.systolic as number, l.diastolic as number);
      if (pa && ultimaPA === null) {
        ultimaPA = `- Última pressão registrada por ela: ${l.systolic}/${l.diastolic} em ${dia}${
          pa.gravidade !== "normal" ? ` — ${pa.nota}` : " (dentro da faixa de referência)"
        }`;
      }
      const gl = sinalGlicemia(l.glucose_mg_dl as number);
      if (gl && ultimaGli === null) {
        ultimaGli = `- Última glicemia registrada por ela: ${l.glucose_mg_dl} mg/dL em ${dia}${
          gl.gravidade !== "normal" ? ` — ${gl.nota}` : " (dentro do alvo)"
        }`;
      }
      /* Alterados dos últimos 14 dias, no máximo três: uma lista longa vira
         recitação, e três já mostram que não é medida isolada. */
      /* Sem `else`: uma linha de `health_logs` carrega pressão E glicemia, e o
         `else if` fazia a glicemia de 210 sumir porque a pressão do mesmo dia
         também estava alterada. */
      if (linhas.length < 3 && pa && pa.gravidade !== "normal") {
        linhas.push(`- ${dia}: pressão ${l.systolic}/${l.diastolic} — ${pa.nota}`);
      }
      if (linhas.length < 3 && gl && gl.gravidade !== "normal") {
        linhas.push(`- ${dia}: glicemia ${l.glucose_mg_dl} mg/dL — ${gl.nota}`);
      }
    }

    const corpo = [ultimaPA, ultimaGli].filter(Boolean) as string[];
    if (linhas.length) {
      corpo.push("- Registros alterados nos últimos 14 dias:", ...linhas);
    }
    if (!corpo.length) return "";
    return [
      "## Medidas que ELA MESMA registrou no app (fonte: sistema — confiável)",
      ...corpo,
      "São medidas caseiras e auto-relatadas, não aferidas em consultório: trate como contexto, nunca como diagnóstico. Se houver valor alterado e a queixa dela tiver relação, reforce os sinais de alerta e o contato precoce com o médico. NÃO recite estes números de volta sem que ela pergunte.",
    ].join("\n");
  } catch {
    return "";
  }
}

/**
 * Bloco de CICLO + BEM-ESTAR da paciente para o system prompt. Lê os dados
 * DELA no banco (menstrual_cycles + humor recente do diário) — fonte confiável,
 * nunca do texto do cliente. Só o `mood` (rótulo curto) do diário entra, NUNCA
 * o conteúdo do diário (privacidade). É CONTEXTO pra acolher/contextualizar
 * (fase do ciclo, TPM, humor), não conduta: a regra de cobertura do cérebro do
 * médico continua mandando no que a IA pode afirmar. LGPD: é o dado da própria
 * paciente, na conversa dela com a IA do consultório dela.
 */
async function buildCycleMoodBlock(patientId: string): Promise<string> {
  const fmt = (ymd: string) => new Date(ymd + "T00:00:00").toLocaleDateString("pt-BR");
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const [cyclesRes, moodsRes] = await Promise.all([
      sb
        .from("menstrual_cycles")
        .select("start_date, end_date, symptoms")
        .eq("user_id", patientId)
        .order("start_date", { ascending: false })
        .limit(6),
      sb
        .from("journal_entries")
        .select("mood")
        .eq("user_id", patientId)
        .not("mood", "is", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    const lines: string[] = [];
    const cs = (cyclesRes.data ?? []) as {
      start_date: string;
      end_date: string | null;
      symptoms: string[] | null;
    }[];
    if (cs.length) {
      const last = cs[0];
      lines.push(
        `- Último período: início em ${fmt(last.start_date)}${last.end_date ? ` (fim ${fmt(last.end_date)})` : ""}.`,
      );
      if (cs.length >= 2) {
        const starts = cs
          .map((c) => new Date(c.start_date + "T00:00:00Z").getTime())
          .sort((a, b) => b - a);
        let sum = 0;
        let n = 0;
        for (let i = 0; i < starts.length - 1; i++) {
          const d = Math.round((starts[i] - starts[i + 1]) / 86400000);
          if (d >= 15 && d <= 60) {
            sum += d;
            n++;
          }
        }
        if (n) {
          const avg = Math.round(sum / n);
          const lastStartMs = new Date(last.start_date + "T00:00:00Z").getTime();
          const cycleDay = Math.floor((Date.now() - lastStartMs) / 86400000) + 1;
          const next = new Date(lastStartMs + avg * 86400000).toISOString().slice(0, 10);
          if (cycleDay >= 1 && cycleDay <= 60) {
            lines.push(
              `- Ciclo médio ~${avg} dias; hoje é ~dia ${cycleDay}. Próximo período previsto por volta de ${fmt(next)}.`,
            );
          }
        }
      }
      if (last.symptoms?.length) {
        lines.push(`- Sintomas do último ciclo: ${last.symptoms.slice(0, 8).join(", ")}.`);
      }
    }
    const moodList = ((moodsRes.data ?? []) as { mood: string | null }[])
      .map((m) => m.mood)
      .filter(Boolean);
    if (moodList.length) {
      lines.push(`- Humor recente (mais recente primeiro): ${moodList.join(", ")}.`);
    }
    if (!lines.length) return "";
    return [
      "## Ciclo e bem-estar da paciente (fonte: sistema — confiável)",
      ...lines,
      "Use com sensibilidade para acolher e contextualizar (fase do ciclo, TPM, como ela vem se sentindo). NÃO faça diagnóstico nem conduta a partir disto — siga a regra de cobertura do bloco do médico. Não recite os dados de volta sem necessidade.",
    ].join("\n");
  } catch {
    return "";
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
        const ip = clientIp(request);
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
          // + o contexto clínico DELA (semana/histórico, direto do banco)
          // + a MEMÓRIA dela (o que já contou/perguntou em conversas passadas).
          // getBrainContext/getChatMemory são safe (falha vira bloco vazio).
          const userText = lastUserText(messages);
          const { getChatMemory, memoryBlock } = await import("@/lib/chat-memory.server");
          const [brain, memorySummary, cicloBemEstar, medidas] = await Promise.all([
            // Fonte resolvida: local por padrão; DoctorThink remoto se ligado
            // (env + flag doctorthink_remote). Fallback local em qualquer falha.
            getBrainContextResolved(userText, patient.doctorId, "app", patient.patientId),
            getChatMemory(patient.patientId, patient.doctorId),
            // Ciclo + humor DELA (fonte confiável): a IA conversa com sensibilidade
            // à fase do ciclo e a como ela vem se sentindo.
            buildCycleMoodBlock(patient.patientId),
            buildMedidasBlock(patient.patientId),
          ]);
          const memoria = memoryBlock(memorySummary);
          const base = medicalSystemPrompt(patient.doctorName);
          const medico = patient.doctorName ? `o(a) ${patient.doctorName}` : "o seu médico";
          // Confiança visível: com cobertura, cite a fonte; sem cobertura,
          // escale. O claim "já registrei" só entra quando a lacuna FOI de
          // fato elegível a registro (mesma regra do logBrainGap: norm >= 8
          // chars) — a IA nunca afirma um registro que não aconteceu.
          // Espelha logBrainGap EXATAMENTE (tamanho + filtro de suporte): se a
          // pergunta não entrou na fila, a IA não pode dizer que entrou.
          const gapWasLogged =
            normalizeGapQuestion(userText).length >= 8 &&
            !isSuporteDoApp(userText) &&
            !isCortesia(userText);
          const confianca =
            brain.enabledApp && brain.hadCoverage
              ? `Ao usar as orientações do bloco do médico, deixe claro de forma natural que a orientação é do próprio médico (ex.: "${medico} orienta que...").`
              : brain.enabledApp
                ? gapWasLogged
                  ? `A dúvida atual NÃO está coberta pelas orientações que ${medico} validou. O sistema registrou a pergunta para ele responder no painel — diga isso com acolhimento (ex.: "essa é uma dúvida que ${medico} prefere responder pessoalmente; registrei aqui para ele ver"). Limite-se a informações gerais seguras e sinais de alerta, sem improvisar conduta específica.`
                  : `A dúvida atual NÃO está coberta pelas orientações que ${medico} validou. Peça com gentileza que ela detalhe a pergunta (assim você pode encaminhar ao médico) e limite-se a informações gerais seguras, sem improvisar conduta específica.`
                : "";
          system = [
            base,
            patient.clinicalBlock,
            /* As MEDIDAS logo depois do histórico e ANTES do humor: é a ordem
               em que elas se qualificam. "Pré-eclâmpsia anterior" muda o peso
               de "pressão 158/102 ontem", e as duas juntas mudam o peso de
               "estou com dor de cabeça". */
            medidas,
            cicloBemEstar,
            memoria,
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

        // Conversa individual por paciente: grava a pergunta agora e a resposta
        // no onFinish; depois atualiza a memória dela (tudo fire-and-forget —
        // tabela ausente ou falha nunca afeta a resposta).
        const persistFor = patient
          ? { patientId: patient.patientId, doctorId: patient.doctorId ?? null }
          : null;

        if (persistFor) {
          const { saveChatMessage } = await import("@/lib/chat-memory.server");
          saveChatMessage(
            persistFor.patientId,
            persistFor.doctorId,
            "user",
            lastUserText(messages),
          );
        }

        const google = createChatProvider(key);
        const result = streamText({
          model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
          system,
          messages: await convertToModelMessages(messages),
          onFinish: persistFor
            ? ({ text }) => {
                void (async () => {
                  try {
                    const { saveChatMessage, maybeUpdateChatMemory } =
                      await import("@/lib/chat-memory.server");
                    saveChatMessage(persistFor.patientId, persistFor.doctorId, "assistant", text);
                    maybeUpdateChatMemory(persistFor.patientId, persistFor.doctorId);
                  } catch {
                    /* best-effort */
                  }
                })();
              }
            : undefined,
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
        });
      },
    },
  },
});
