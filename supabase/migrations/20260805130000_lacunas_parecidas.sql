-- Agrupar lacunas parecidas: vetor na lacuna + busca por semelhança.
--
-- Corrige a primeira versão desta migration, que tinha dois defeitos mudos:
-- índice `ivfflat` criado com a tabela vazia (centroides sem significado,
-- busca voltando vazia) e `SECURITY DEFINER` + `SET search_path = public`,
-- que escondia o operador `<=>` do pgvector dentro da função.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.brain_gaps
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- ════════════════════════════════════════════════════════════════════════════
-- DEFEITO 1 — o índice `ivfflat` nasceu numa tabela sem nenhum vetor
-- ════════════════════════════════════════════════════════════════════════════
--
-- `ivfflat` divide os vetores em `lists` grupos, e calcula os centroides desses
-- grupos NO MOMENTO EM QUE O ÍNDICE É CRIADO. Criado quando a coluna estava
-- inteira nula, ele nasceu com centroides sem significado — e como a busca
-- visita só um grupo por padrão (`ivfflat.probes = 1`), a consulta passava ao
-- largo das linhas que existiam.
--
-- O resultado era vazio SEM ERRO: uma busca que não acha nada é uma resposta
-- perfeitamente válida. Foi assim que o defeito sobreviveu a quatro rodadas de
-- teste.
--
-- `hnsw` não tem esse problema: ele se constrói a cada linha inserida, e não
-- depende de haver dados quando é criado. É o que `brain_entries` já usa — e é
-- a razão de a busca de CONHECIMENTO funcionar enquanto a de LACUNAS não.

DROP INDEX IF EXISTS public.idx_brain_gaps_embedding;

-- Tolerante a falha de propósito: se o HNSW não existir nesta versão do
-- pgvector, a busca continua CORRETA por varredura sequencial — que numa fila
-- de dezenas de lacunas é rápida e, ao contrário do ANN, é exata.
CREATE INDEX IF NOT EXISTS idx_brain_gaps_embedding
  ON public.brain_gaps USING hnsw (embedding vector_cosine_ops);

-- ════════════════════════════════════════════════════════════════════════════
-- DEFEITO 2 — `SECURITY DEFINER` + `SET search_path = public`
-- ════════════════════════════════════════════════════════════════════════════
--
-- No Supabase a extensão `vector` é instalada no schema `extensions`, não em
-- `public`. Fixar o `search_path` da função em `public` deixava o operador
-- `<=>` INVISÍVEL dentro do corpo dela: a função existia, era chamada, e
-- estourava em tempo de execução.
--
-- E o `SECURITY DEFINER` nunca foi necessário: quem chama é a chave de
-- serviço, que já passa por cima da RLS. Era proteção contra um problema
-- inexistente, paga com um problema real.
--
-- A forma abaixo é a MESMA de `match_brain_entries`, que funciona há meses.
-- Divergir do que já estava provado foi o erro.
--
-- Só as lacunas ABERTAS, de propósito: uma já respondida virou entrada do
-- cérebro e é achada pela busca normal; reabri-la por semelhança devolveria ao
-- médico algo que ele já resolveu.

DROP FUNCTION IF EXISTS public.match_brain_gaps(uuid, vector, int);

CREATE OR REPLACE FUNCTION public.match_brain_gaps(
  p_doctor_id uuid,
  p_embedding vector(768),
  p_limit int DEFAULT 3
)
RETURNS TABLE (id uuid, question text, hits integer, similarity double precision)
LANGUAGE sql
STABLE
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
  LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

REVOKE ALL ON FUNCTION public.match_brain_gaps(uuid, vector, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_brain_gaps(uuid, vector, int) FROM anon;
REVOKE ALL ON FUNCTION public.match_brain_gaps(uuid, vector, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_brain_gaps(uuid, vector, int) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- A chave única que impede a bola de neve
-- ════════════════════════════════════════════════════════════════════════════
--
-- Sem ela, uma única duplicata de `norm_question` faz o `.maybeSingle()` do
-- código devolver erro (PGRST116, "mais de uma linha") — e o código, sem achar
-- nada, INSERE mais uma. A partir daí aquela pergunta nunca mais junta, nem
-- quando repetida com o texto idêntico.

CREATE UNIQUE INDEX IF NOT EXISTS uq_brain_gaps_doctor_question
  ON public.brain_gaps (doctor_id, norm_question);
