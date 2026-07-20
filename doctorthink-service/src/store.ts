/**
 * Implementação da porta BrainStore para o DoctorThink STANDALONE (banco
 * próprio). Espelha o fluxo do adaptador da Obstétrica — mesmas queries, mesmo
 * corte de similaridade — mas SEM entitlements (o controle de acesso por plano
 * é responsabilidade do app cliente; aqui os canais vêm só dos toggles).
 */
import type { BrainStore, BrainProfile, BrainChannel } from "./contract";
import { normalizeGapQuestion, type BrainEntry } from "./core";
import { db } from "./db";
import { embedText } from "./embeddings";

const SEMANTIC_MIN_SIMILARITY = 0.55;
const EMBED_TIMEOUT_MS = 1800;

export function createBrainStore(): BrainStore {
  return {
    async loadProfile(doctorId: string): Promise<BrainProfile> {
      const { data: s } = await db
        .from("brain_settings")
        .select("persona,sample_phrases,rules,enabled_app,enabled_whatsapp")
        .eq("doctor_id", doctorId)
        .maybeSingle();
      return {
        persona: (s?.persona ?? "").trim(),
        samplePhrases: (s?.sample_phrases ?? "").trim(),
        rules: (s?.rules ?? "").trim(),
        channels: {
          app: s?.enabled_app ?? true,
          whatsapp: s?.enabled_whatsapp ?? true,
          teste: true,
        },
      };
    },

    async loadApprovedEntries(doctorId: string, limit: number): Promise<BrainEntry[]> {
      const { data } = await db
        .from("brain_entries")
        .select("question,answer")
        .eq("doctor_id", doctorId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(limit || 200);
      return (data ?? []) as BrainEntry[];
    },

    async semanticSearch(
      doctorId: string,
      message: string,
      limit: number,
    ): Promise<BrainEntry[] | null> {
      try {
        const qvec = await embedText(message, EMBED_TIMEOUT_MS);
        if (!qvec) return null;
        const { data: matches, error } = await db.rpc("match_brain_entries", {
          p_doctor_id: doctorId,
          p_embedding: qvec,
          p_limit: limit,
        });
        if (error || !Array.isArray(matches)) return null;
        return (matches as { question: string; answer: string; similarity: number }[])
          .filter((m) => m.similarity >= SEMANTIC_MIN_SIMILARITY)
          .map((m) => ({ question: m.question, answer: m.answer }));
      } catch {
        return null;
      }
    },

    logHit(doctorId: string, channel: BrainChannel): void {
      if (channel === "teste") return;
      db.from("brain_hits")
        .insert({ doctor_id: doctorId, channel })
        .then(
          () => {},
          () => {},
        );
    },

    logGap(doctorId: string, message: string, channel: BrainChannel): void {
      const clean = message.trim().slice(0, 300);
      const norm = normalizeGapQuestion(clean);
      if (norm.length < 8) return;
      void (async () => {
        try {
          const { data: existing } = await db
            .from("brain_gaps")
            .select("id,hits,status")
            .eq("doctor_id", doctorId)
            .eq("norm_question", norm)
            .maybeSingle();
          if (existing) {
            await db
              .from("brain_gaps")
              .update({
                hits: (existing.hits ?? 1) + 1,
                updated_at: new Date().toISOString(),
                ...(existing.status === "respondida" ? { status: "aberta" } : {}),
              })
              .eq("id", existing.id);
          } else {
            await db
              .from("brain_gaps")
              .insert({ doctor_id: doctorId, question: clean, norm_question: norm, channel });
          }
        } catch {
          /* best-effort */
        }
      })();
    },

    async addEntry(
      doctorId: string,
      question: string,
      answer: string,
    ): Promise<{ id: string } | null> {
      // approved:true — no standalone, o app cliente é o dono do conteúdo e da
      // sua própria aprovação. (Na Obstétrica, /train entra como rascunho porque
      // vem de terceiro; aqui é o próprio dono da chave.)
      const { data: row, error } = await db
        .from("brain_entries")
        .insert({ doctor_id: doctorId, question, answer, source: "api", approved: true })
        .select("id")
        .single();
      if (error || !row) return null;
      void (async () => {
        try {
          const vec = await embedText(`${question}\n${answer}`);
          if (vec) await db.from("brain_entries").update({ embedding: vec }).eq("id", row.id);
        } catch {
          /* embedding best-effort; a entrada ainda casa por keyword */
        }
      })();
      return { id: row.id as string };
    },
  };
}
