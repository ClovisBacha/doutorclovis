-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE — agrupar lacunas parecidas
--
-- Idempotente: pode rodar mais de uma vez.
-- ════════════════════════════════════════════════════════════════════════════
--
-- O PROBLEMA
--
-- A lacuna é deduplicada por TEXTO normalizado (minúsculas, sem acento, sem
-- pontuação). Então estas três:
--
--   "é normal sentir enjoo?"
--   "enjoo é normal na gravidez?"
--   "sinto muito enjoo, isso é normal?"
--
-- viram TRÊS itens na fila do médico, e ele responde três vezes a mesma coisa.
-- É esse caminho que faz o Segundo Cérebro parecer trabalhoso: não é que ele
-- receba muita pergunta diferente — é que a mesma pergunta chega repetida.
--
-- A LEITURA já entende sinônimos (busca por vetor nas entradas aprovadas). A
-- ESCRITA da lacuna, não. Esta migration dá à lacuna o mesmo vetor.
--
-- CUSTO ZERO DE EMBEDDING
--
-- O vetor da pergunta já é calculado alguns milissegundos antes, para procurar
-- cobertura nas entradas do médico. Quando não há cobertura, é esse mesmo vetor
-- que passa a ser gravado aqui — nenhuma chamada nova ao modelo.

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

-- ════════════════════════════════════════════════════════════════════════════
-- Conferir depois de rodar
-- ════════════════════════════════════════════════════════════════════════════
--
-- Quantas lacunas abertas ainda estão sem vetor (as antigas nascem sem — elas
-- continuam funcionando pelo texto, só não agrupam):
--
--   SELECT count(*) FILTER (WHERE embedding IS NULL) AS sem_vetor,
--          count(*) FILTER (WHERE embedding IS NOT NULL) AS com_vetor
--   FROM public.brain_gaps WHERE status = 'aberta';
