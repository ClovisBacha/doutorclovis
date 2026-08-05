-- Agrupar lacunas parecidas — ver supabase/APLICAR_LACUNAS_PARECIDAS.sql para
-- o porque.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.brain_gaps
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- `ivfflat` com `lists` pequeno: a fila de lacunas de um médico é da ordem de
-- dezenas ou centenas, não de milhões. Índice grande aqui custaria mais para
-- manter do que a varredura que ele evita.
CREATE INDEX IF NOT EXISTS idx_brain_gaps_embedding
  ON public.brain_gaps USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- ════════════════════════════════════════════════════════════════════════════
-- A busca: lacunas ABERTAS parecidas com uma pergunta
-- ════════════════════════════════════════════════════════════════════════════
--
-- Só as abertas, de propósito. Uma lacuna já respondida virou entrada do
-- cérebro e passa a ser encontrada pela busca normal; reabri-la por semelhança
-- devolveria ao médico algo que ele já resolveu.
--
-- `security definer` porque a tabela tem RLS e quem chama é a chave de serviço
-- no caminho do chat — o mesmo padrão de `match_brain_entries`.

CREATE OR REPLACE FUNCTION public.match_brain_gaps(
  p_doctor_id uuid,
  p_embedding vector(768),
  p_limit int DEFAULT 3
)
RETURNS TABLE (id uuid, question text, hits integer, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.question,
    g.hits,
    1 - (g.embedding <=> p_embedding) AS similarity
  FROM public.brain_gaps g
  WHERE g.doctor_id = p_doctor_id
    AND g.status = 'aberta'
    AND g.embedding IS NOT NULL
  ORDER BY g.embedding <=> p_embedding
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.match_brain_gaps(uuid, vector, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_brain_gaps(uuid, vector, int) TO service_role;

