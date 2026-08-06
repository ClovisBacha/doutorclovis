/**
 * Implementação da porta BrainStore para a OBSTÉTRICA (Supabase + entitlements).
 * É o adaptador concreto que o orquestrador do DoctorThink usa. Na Fase 3, um
 * serviço standalone traz outra implementação desta MESMA interface (banco
 * próprio) — o núcleo/orquestrador não mudam.
 *
 * A lógica aqui espelha exatamente a do getBrainContext da Obstétrica (mesmas
 * queries, mesmo timeout de embedding, mesmo corte de similaridade), agora
 * exposta pela porta para ser reutilizável (ex.: pela API do DoctorThink).
 */
import type { BrainStore, BrainProfile, BrainChannel } from "./contract";
import type { BrainEntry } from "./core";
import { logBrainGap } from "../secondbrain.server";

const MAX_ENTRIES_LOADED = 200;
/** Corte de cosseno da busca semântica (abaixo = irrelevante). Igual ao original. */
const SEMANTIC_MIN_SIMILARITY = 0.55;
/** Timeout curto do embedding no caminho crítico do chat (igual ao original). */
const EMBED_TIMEOUT_MS = 1800;

export function createObstetricaBrainStore(): BrainStore {
  return {
    async loadProfile(doctorId: string): Promise<BrainProfile> {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { getEntitlementsByDoctorId } = await import("../entitlements.server");
      const [settingsRes, ent] = await Promise.all([
        (supabaseAdmin as any)
          .from("brain_settings")
          .select("persona,sample_phrases,rules,enabled_app,enabled_whatsapp")
          .eq("doctor_id", doctorId)
          .maybeSingle(),
        getEntitlementsByDoctorId(doctorId),
      ]);
      const s = settingsRes.data ?? null;
      // Entitlement do plano MANDA sobre o toggle salvo. 'teste' ignora o toggle
      // (usa só a capacidade do plano), como no getBrainContext original.
      return {
        persona: (s?.persona ?? "").trim(),
        samplePhrases: (s?.sample_phrases ?? "").trim(),
        rules: (s?.rules ?? "").trim(),
        channels: {
          app: (s?.enabled_app ?? true) && ent.aiApp,
          whatsapp: (s?.enabled_whatsapp ?? true) && ent.aiWhatsapp,
          teste: ent.aiApp,
        },
      };
    },

    async loadApprovedEntries(doctorId: string, limit: number): Promise<BrainEntry[]> {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await (supabaseAdmin as any)
        .from("brain_entries")
        .select("question,answer")
        .eq("doctor_id", doctorId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(limit || MAX_ENTRIES_LOADED);
      return (data ?? []) as BrainEntry[];
    },

    async semanticSearch(
      doctorId: string,
      message: string,
      limit: number,
    ): Promise<BrainEntry[] | null> {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { embedText } = await import("../embeddings.server");
        const qvec = await embedText(message, EMBED_TIMEOUT_MS);
        if (!qvec) return null;
        const { data: matches, error } = await (supabaseAdmin as any).rpc("match_brain_entries", {
          p_doctor_id: doctorId,
          p_embedding: qvec,
          p_limit: limit,
        });
        if (error || !Array.isArray(matches)) return null;
        return (matches as { question: string; answer: string; similarity: number }[])
          .filter((m) => m.similarity >= SEMANTIC_MIN_SIMILARITY)
          .map((m) => ({ question: m.question, answer: m.answer }));
      } catch {
        return null; // RPC/extensão ausente ou falha de embedding → keyword assume
      }
    },

    logHit(doctorId: string, channel: BrainChannel): void {
      if (channel === "teste") return;
      /* DISPARA-E-ESQUECE AUTORIZADO: telemetria pura. Perder uma linha não muda
     nada para ninguém, e aguardar poria uma escrita no caminho da resposta. */
      void (async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as any).from("brain_hits").insert({ doctor_id: doctorId, channel });
        } catch {
          /* telemetria best-effort */
        }
      })();
    },

    logGap(doctorId: string, message: string, channel: BrainChannel): void {
      // Reaproveita a lógica da Obstétrica (dedup + e-mail de lacuna ≤1/dia).
      logBrainGap(doctorId, message, channel as "app" | "whatsapp" | "teste");
    },

    async addEntry(
      doctorId: string,
      question: string,
      answer: string,
    ): Promise<{ id: string } | null> {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // SEGURANÇA MÉDICA: conteúdo que NÃO vem da sessão autenticada do médico
      // (aqui: um app terceiro via API) entra como RASCUNHO (approved:false) —
      // o cérebro só usa depois que o médico aprovar no painel. Mesmo padrão
      // dos imports (source 'kit'/'consulta'). A IA nunca aprende sozinha.
      const { data: row, error } = await (supabaseAdmin as any)
        .from("brain_entries")
        .insert({ doctor_id: doctorId, question, answer, source: "api", approved: false })
        .select("id")
        .single();
      if (error || !row) return null;
      const { embedBrainEntry } = await import("../embeddings.server");
      // Aguardado: em serverless o que roda depois da resposta não roda.
      await embedBrainEntry(row.id, question, answer);
      return { id: row.id as string };
    },
  };
}
