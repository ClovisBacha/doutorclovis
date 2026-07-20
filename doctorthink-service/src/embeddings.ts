/**
 * Embeddings via Google Generative AI (text-embedding-004, 768 dims) por REST.
 * Sem SDK — só fetch. Retorna null em qualquer falha (o cérebro cai no keyword).
 */
const MODEL = "text-embedding-004";

export async function embedText(text: string, timeoutMs = 4000): Promise<number[] | null> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 8000) }] } }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    const values = data?.embedding?.values;
    return Array.isArray(values) ? values : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
