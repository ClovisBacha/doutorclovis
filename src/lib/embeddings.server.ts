/**
 * Embeddings do Segundo Cérebro — Gemini text-embedding-004 (768 dims) via
 * REST (mesmo padrão do transcritor; sem dependência nova).
 *
 * Filosofia: embeddings são ENRIQUECIMENTO, nunca dependência. Toda função
 * aqui é best-effort e devolve null/false em falha — o chamador segue com o
 * ranking por palavras. Nada de IA no caminho crítico sem rede de segurança.
 */

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-004";
const EMBEDDING_DIMS = 768;
/** Entrada truncada: perguntas/respostas longas não precisam de mais que isso. */
const MAX_INPUT_CHARS = 2000;

/**
 * Gera o vetor de um texto. null em qualquer falha (sem chave, rede, cota).
 * `timeoutMs`: no caminho de ESCRITA/backfill o padrão de 6s é ok; no caminho
 * de LEITURA do chat use um valor curto — a paciente está esperando a
 * resposta, e um Gemini lento não pode congelar o chat até o fallback.
 */
export async function embedText(text: string, timeoutMs = 6000): Promise<number[] | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const clean = text.trim().slice(0, MAX_INPUT_CHARS);
  if (!apiKey || clean.length < 2) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text: clean }] } }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    const values = data.embedding?.values;
    if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) return null;
    return values;
  } catch {
    return null;
  }
}

/**
 * Calcula e grava o embedding de UMA entrada do cérebro. O texto indexado é
 * pergunta+resposta — é assim que "enjoo" encontra uma entrada cuja pergunta
 * diz "náuseas".
 *
 * É `async` DE PROPÓSITO, e quem chama decide se aguarda.
 *
 * Antes era `void (async () => {…})()` com retorno `void`: uma função que
 * dispara e devolve na hora. Quem tentasse `await embedBrainEntry(...)` estaria
 * aguardando `undefined` — resolve no microtask seguinte e a função de servidor
 * retorna antes da chamada de embedding acontecer. Em serverless o processo
 * morre com a resposta, então o texto novo ficava com o vetor velho e a busca
 * continuava achando a versão antiga. O `await` parecia certo e não era.
 *
 * Nunca lança: erro aqui é enriquecimento perdido, não escrita perdida.
 */
export async function embedBrainEntry(
  entryId: string,
  question: string,
  answer: string,
): Promise<void> {
  try {
    const vec = await embedText(`${question}\n${answer}`);
    if (!vec) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Coluna embedding ausente (migração pendente): o supabase-js devolve
    // {error} sem lançar — o update vira no-op silencioso, que é o desejado.
    await (supabaseAdmin as any).from("brain_entries").update({ embedding: vec }).eq("id", entryId);
  } catch {
    /* enriquecimento é best-effort — o backfill cobre depois */
  }
}

/**
 * Backfill oportunista: embeda até `limit` entradas sem vetor do médico.
 * Disparado (fire-and-forget) quando o médico abre a base de conhecimento —
 * visitar o painel "cura" o cérebro dele, incluindo o kit de partida e
 * entradas criadas quando a chave de IA estava indisponível.
 */
export function backfillBrainEmbeddings(doctorId: string, limit = 40): void {
  void (async () => {
    try {
      if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sb = supabaseAdmin as any;
      const { data: rows, error } = await sb
        .from("brain_entries")
        .select("id,question,answer")
        .eq("doctor_id", doctorId)
        .is("embedding", null)
        .limit(Math.min(limit, 60));
      if (error || !rows?.length) return; // 42703/42P01: migração pendente → nada a fazer
      // Sequencial de propósito: evita estourar rate limit da API de embeddings.
      for (const row of rows as { id: string; question: string; answer: string }[]) {
        const vec = await embedText(`${row.question}\n${row.answer}`);
        if (!vec) return; // falhou uma → para o lote (cota/chave); tenta na próxima visita
        await sb.from("brain_entries").update({ embedding: vec }).eq("id", row.id);
      }
    } catch {
      /* best-effort */
    }
  })();
}
