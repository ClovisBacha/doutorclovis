import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assessLevel, LEVEL_FALLBACK, ALL_SYMPTOMS } from "@/lib/triage";

const Schema = z.object({
  symptoms: z.array(z.string()).max(40),
  systolic: z.number().int().min(50).max(300).nullable().optional(),
  diastolic: z.number().int().min(30).max(200).nullable().optional(),
  note: z.string().max(500).optional(),
  weeks: z.number().int().min(0).max(45).nullable().optional(),
});

/**
 * Avalia sintomas e devolve nível de risco + orientação.
 * O nível vem SEMPRE das regras (src/lib/triage.ts). A IA só escreve a
 * explicação; se não houver chave do Gemini, usamos um texto fixo por nível.
 */
export const assessSymptoms = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data }) => {
    const { level, reasons } = assessLevel(data.symptoms, {
      systolic: data.systolic ?? null,
      diastolic: data.diastolic ?? null,
    });

    let message = LEVEL_FALLBACK[level];

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (key && reasons.length > 0) {
      try {
        const { generateText } = await import("ai");
        const { createChatProvider, DEFAULT_CHAT_MODEL } = await import("@/lib/ai-gateway.server");
        const google = createChatProvider(key);
        const labels = reasons.join(", ");
        const orient =
          level === "vermelho"
            ? "Oriente procurar atendimento IMEDIATO (192 / pronto-socorro / maternidade)."
            : level === "amarelo"
              ? "Oriente entrar em contato com o consultório ainda hoje."
              : "Tranquilize e oriente manter o pré-natal.";
        const { text, usage } = await generateText({
          model: google(process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL),
          system: `Você é um assistente de orientação de um consultório de obstetrícia especializado em gestação de alto risco.
Regras absolutas:
- NUNCA dê diagnóstico, nome de doença como certeza, nem prescrição.
- O nível de risco JÁ foi definido (${level}). NÃO contradiga nem minimize. ${orient}
- Português brasileiro, tom acolhedor e calmo, no máximo 4 frases.
- Sempre reforce que isto não substitui avaliação médica.`,
          prompt: `A gestante${data.weeks ? ` (${data.weeks} semanas)` : ""} relatou: ${labels}.${
            data.note ? ` Observação dela: "${data.note}".` : ""
          } Escreva uma orientação curta e acolhedora.`,
        });
        if (text?.trim()) message = text.trim();
        /* MEDIDO. Uma trava mecânica achou oito chamadas pagas de modelo que ninguém
     media — esta era uma delas. O consumo não existia em `ai_usage`: nem no
     card, nem na projeção do mês. Canal próprio, e a cota conta só `app`. */
        const { registrarUsoAgora } = await import("./uso-ia.server");
        await registrarUsoAgora({
          especie: "chat",
          modelo: process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL,
          /* OS TOKENS, que estavam na mao e nao eram passados: a linha era gravada
             com zero e a tabela media a RESPOSTA, nunca o custo. */
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          canal: "triagem",
        });
      } catch (e) {
        console.error("triage AI failed", e);
      }
    }

    return { level, reasons, message };
  });

/**
 * Grava a triagem na CONTA da paciente (triage_logs). Numa plataforma de alto
 * risco, um alerta vermelho/amarelo não pode viver só em useState: fica no
 * histórico da paciente e alimenta o dashboard do médico (triagens do mês).
 * Degrada com elegância: se a tabela ainda não foi aplicada, apenas ignora.
 */
export const saveTriageLog = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        level: z.enum(["vermelho", "amarelo", "verde"]),
        symptoms: z.array(z.string()).max(40),
        systolic: z.number().int().nullable().optional(),
        diastolic: z.number().int().nullable().optional(),
        note: z.string().max(500).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: authErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !u.user) return { ok: false as const };
    const { error } = await (supabaseAdmin as any).from("triage_logs").insert({
      user_id: u.user.id,
      level: data.level,
      symptoms: data.symptoms,
      systolic: data.systolic ?? null,
      diastolic: data.diastolic ?? null,
      note: data.note ?? null,
    });
    return { ok: !error };
  });

export { ALL_SYMPTOMS };

/**
 * Triagens das pacientes DESTE médico — o outro lado do que já era gravado.
 *
 * O comentário de `saveTriageLog` diz que a triagem "alimenta o dashboard do
 * médico". Não alimentava: `triage_logs` não era lida por arquivo nenhum do
 * lado dele. A avaliação já estava calculada por regra determinística, já
 * gravada, e morria no INSERT.
 *
 * O caso concreto: 34 semanas, sábado à noite, ela marca "dor de cabeça forte
 * com visão turva" e "inchaço súbito no rosto", digita 175/115. A tela dela diz
 * "procure atendimento agora". O médico não ficava sabendo — nem naquela noite,
 * nem na consulta de terça.
 */
export const listarTriagens = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        accessToken: z.string().min(10),
        /** Só as que ainda pedem olhar: vermelho e amarelo. */
        apenasAlerta: z.boolean().default(true),
        dias: z.number().int().min(1).max(90).default(14),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    type Triagem = {
      id: string;
      created_at: string;
      user_id: string;
      paciente: string | null;
      level: string;
      symptoms: string[];
      systolic: number | null;
      diastolic: number | null;
    };
    const vazio = { ok: true as const, triagens: [] as Triagem[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (!u.user) return { ok: false as const, triagens: [] as Triagem[] };
    const sb = supabaseAdmin as any;
    const { data: doc } = await sb
      .from("doctors")
      .select("id,active")
      .eq("id", u.user.id)
      .maybeSingle();
    if (!doc || doc.active === false) return { ok: false as const, triagens: [] as Triagem[] };

    try {
      /* Recorte pelo vínculo ATUAL, e não por um `doctor_id` carimbado na
         linha: quem deixou de ser paciente dele deixa de aparecer aqui no
         mesmo instante. */
      const { data: perfis } = await sb
        .from("patient_profiles")
        .select("id,display_name")
        .eq("doctor_id", u.user.id);
      const ids = ((perfis ?? []) as { id: string }[]).map((p) => p.id);
      if (ids.length === 0) return vazio;
      const nomes = new Map<string, string>(
        ((perfis ?? []) as { id: string; display_name: string | null }[]).map((p) => [
          p.id,
          p.display_name ?? "",
        ]),
      );

      const desde = new Date(Date.now() - data.dias * 86400000).toISOString();
      const linhas: Triagem[] = [];
      /* Lotes de 100: `.in()` viaja na URL e uma lista longa estoura o buffer
         do proxy, devolvendo 414 — que aqui viraria "nenhuma triagem". */
      for (let i = 0; i < ids.length; i += 100) {
        let q = sb
          .from("triage_logs")
          .select("id,created_at,user_id,level,symptoms,systolic,diastolic")
          .in("user_id", ids.slice(i, i + 100))
          .gte("created_at", desde)
          .order("created_at", { ascending: false })
          .limit(100);
        if (data.apenasAlerta) q = q.in("level", ["vermelho", "amarelo"]);
        const { data: rows, error } = await q;
        // Migração pendente: sem a aba, não sem o painel.
        if (error) return vazio;
        for (const r of (rows ?? []) as Record<string, unknown>[]) {
          linhas.push({
            id: String(r.id),
            created_at: String(r.created_at),
            user_id: String(r.user_id),
            paciente: nomes.get(String(r.user_id)) || null,
            level: String(r.level),
            symptoms: (r.symptoms as string[]) ?? [],
            systolic: (r.systolic as number) ?? null,
            diastolic: (r.diastolic as number) ?? null,
          });
        }
      }
      linhas.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return { ok: true as const, triagens: linhas };
    } catch {
      return vazio;
    }
  });
