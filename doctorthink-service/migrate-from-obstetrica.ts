/**
 * Migra o cérebro da OBSTÉTRICA (origem) para o banco do DoctorThink (destino).
 * Copia brain_settings, brain_entries (re-embeddando no destino) e brain_gaps.
 *
 * Uso:
 *   1. Preencha .env com SUPABASE_URL/KEY (destino) + SOURCE_SUPABASE_URL/KEY
 *      (origem = Supabase da Obstétrica) + GOOGLE_GENERATIVE_AI_API_KEY.
 *   2. bun run migrate-from-obstetrica.ts   (ou npm run migrate)
 *
 * Idempotente por upsert (roda de novo sem duplicar). doctor_id vira texto.
 */
import { createClient } from "@supabase/supabase-js";
import { embedText } from "./src/embeddings";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta env ${name}`);
  return v;
}

const src = createClient(need("SOURCE_SUPABASE_URL"), need("SOURCE_SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const dst = createClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

async function migrateSettings(): Promise<number> {
  const { data } = await src
    .from("brain_settings")
    .select("doctor_id,persona,sample_phrases,rules,enabled_app,enabled_whatsapp");
  const rows = (data ?? []).map((r: any) => ({
    doctor_id: String(r.doctor_id),
    persona: r.persona ?? null,
    sample_phrases: r.sample_phrases ?? null,
    rules: r.rules ?? null,
    enabled_app: r.enabled_app ?? true,
    enabled_whatsapp: r.enabled_whatsapp ?? true,
  }));
  if (rows.length) await dst.from("brain_settings").upsert(rows, { onConflict: "doctor_id" });
  return rows.length;
}

async function migrateEntries(): Promise<number> {
  const { data } = await src
    .from("brain_entries")
    .select("id,doctor_id,question,answer,category,source,approved,created_at")
    .eq("approved", true)
    .limit(100000);
  const entries = data ?? [];
  let done = 0;
  for (const e of entries as any[]) {
    const vec = await embedText(`${e.question}\n${e.answer}`).catch(() => null);
    await dst.from("brain_entries").upsert(
      {
        id: e.id,
        doctor_id: String(e.doctor_id),
        question: e.question,
        answer: e.answer,
        category: e.category ?? null,
        source: e.source ?? "import",
        approved: true,
        embedding: vec,
        created_at: e.created_at,
      },
      { onConflict: "id" },
    );
    done++;
    if (done % 25 === 0) console.log(`  entries: ${done}/${entries.length}`);
  }
  return done;
}

async function migrateGaps(): Promise<number> {
  const { data } = await src
    .from("brain_gaps")
    .select("doctor_id,question,norm_question,hits,status,channel,created_at,updated_at")
    .limit(100000);
  const rows = (data ?? []).map((r: any) => ({
    doctor_id: String(r.doctor_id),
    question: r.question,
    norm_question: r.norm_question,
    hits: r.hits ?? 1,
    status: r.status ?? "aberta",
    channel: r.channel ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at ?? r.created_at,
  }));
  if (rows.length)
    await dst.from("brain_gaps").upsert(rows, { onConflict: "doctor_id,norm_question" });
  return rows.length;
}

async function main() {
  console.log("Migrando cérebro Obstétrica → DoctorThink…");
  const s = await migrateSettings();
  console.log(`✓ settings: ${s}`);
  const e = await migrateEntries();
  console.log(`✓ entries: ${e}`);
  const g = await migrateGaps();
  console.log(`✓ gaps: ${g}`);
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
