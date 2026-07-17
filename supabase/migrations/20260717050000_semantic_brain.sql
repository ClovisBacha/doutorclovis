-- Busca SEMÂNTICA do Segundo Cérebro (pgvector + embeddings Gemini 768d):
-- "tô enjoada demais" passa a encontrar "náuseas no 1º trimestre".
-- O ranking por palavras continua como fallback — sem chave de IA, sem
-- extensão ou sem embeddings, tudo segue funcionando como antes.
-- Idempotente.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.brain_entries
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- HNSW: busca aproximada rápida por cosseno (escala além do seq scan).
CREATE INDEX IF NOT EXISTS idx_brain_entries_embedding
  ON public.brain_entries USING hnsw (embedding vector_cosine_ops);

-- O PostgREST não expressa operadores de vetor — a similaridade roda no
-- banco via RPC. Só o servidor (service_role) executa.
CREATE OR REPLACE FUNCTION public.match_brain_entries(
  p_doctor_id uuid,
  p_embedding vector(768),
  p_limit int DEFAULT 6
)
RETURNS TABLE (question text, answer text, similarity double precision)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.question,
    e.answer,
    1 - (e.embedding <=> p_embedding) AS similarity
  FROM public.brain_entries e
  WHERE e.doctor_id = p_doctor_id
    AND e.approved = true
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> p_embedding
  LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

REVOKE ALL ON FUNCTION public.match_brain_entries(uuid, vector, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_brain_entries(uuid, vector, int) FROM anon;
REVOKE ALL ON FUNCTION public.match_brain_entries(uuid, vector, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_brain_entries(uuid, vector, int) TO service_role;
