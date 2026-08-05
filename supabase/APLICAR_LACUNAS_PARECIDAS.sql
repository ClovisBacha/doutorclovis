-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE — agrupar lacunas parecidas
--
-- RODE DE NOVO mesmo que já tenha rodado antes. A primeira versão deste
-- arquivo tinha DOIS defeitos que faziam a busca por semelhança devolver
-- vazio sempre, sem erro nenhum. Os dois estão explicados abaixo.
--
-- Idempotente: pode rodar quantas vezes quiser.
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

-- O `search_path` DA SESSÃO, antes de tudo.
--
-- No Supabase a extensão `vector` vive no schema `extensions`, e
-- `CREATE EXTENSION IF NOT EXISTS vector` é NO-OP quando ela já existe lá — ele
-- não a move para `public`. Sem `extensions` no caminho, o `ADD COLUMN
-- embedding vector(768)` abaixo falha com "type vector does not exist" e, como
-- o editor roda tudo numa transação só, o arquivo INTEIRO reverte.
--
-- Uma linha aqui torna o arquivo independente de como a sessão foi aberta.
SET search_path = public, extensions;

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
-- Determinístico, e não "funciona por sorte": sem esta linha a função herda o
-- caminho de quem chama. Hoje o PostgREST do Supabase acrescenta `extensions`
-- (é por isso que `match_brain_entries` funciona sem declarar nada), mas o
-- padrão do PostgREST é só `public` — e aí o `<=>` sumiria de novo, calado.
SET search_path = public, extensions
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

-- Antes do índice, limpar o que já duplicou — senão o CREATE UNIQUE INDEX
-- falha e, no editor do Supabase, DESFAZ O ARQUIVO INTEIRO (é uma transação
-- só). O arquivo passaria a não conseguir mais consertar nada.
--
-- A sobrevivente é a MAIS ANTIGA: é ela que tem o histórico em
-- `brain_gap_askers`. As repetições somam os `hits` nela — o contador da fila
-- continua dizendo a verdade sobre quantas pacientes perguntaram.
WITH ranqueadas AS (
  SELECT id,
         doctor_id,
         norm_question,
         hits,
         row_number() OVER (
           PARTITION BY doctor_id, norm_question ORDER BY created_at
         ) AS posicao
  FROM public.brain_gaps
),
somas AS (
  SELECT doctor_id, norm_question, sum(hits) AS total
  FROM ranqueadas GROUP BY 1, 2 HAVING count(*) > 1
)
UPDATE public.brain_gaps g
   SET hits = s.total
  FROM ranqueadas r
  JOIN somas s
    ON s.doctor_id = r.doctor_id AND s.norm_question = r.norm_question
 WHERE g.id = r.id AND r.posicao = 1;

-- Quem perguntou não pode se perder junto com a linha duplicada: reaponta os
-- registros das repetições para a sobrevivente antes de apagá-las.
WITH ranqueadas AS (
  SELECT id, doctor_id, norm_question,
         row_number() OVER (
           PARTITION BY doctor_id, norm_question ORDER BY created_at
         ) AS posicao,
         first_value(id) OVER (
           PARTITION BY doctor_id, norm_question ORDER BY created_at
         ) AS sobrevivente
  FROM public.brain_gaps
)
UPDATE public.brain_gap_askers a
   SET gap_id = r.sobrevivente
  FROM ranqueadas r
 WHERE a.gap_id = r.id
   AND r.posicao > 1
   AND NOT EXISTS (
     SELECT 1 FROM public.brain_gap_askers b
      WHERE b.gap_id = r.sobrevivente AND b.user_id = a.user_id
   );

DELETE FROM public.brain_gaps g
 USING (
   SELECT id, row_number() OVER (
            PARTITION BY doctor_id, norm_question ORDER BY created_at
          ) AS posicao
     FROM public.brain_gaps
 ) r
 WHERE g.id = r.id AND r.posicao > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_brain_gaps_doctor_question
  ON public.brain_gaps (doctor_id, norm_question);

-- ════════════════════════════════════════════════════════════════════════════
-- Regerar os vetores existentes
-- ════════════════════════════════════════════════════════════════════════════
--
-- Os vetores gravados até agora vieram do texto CRU, antes de a limpeza de
-- saudação existir — "Olá, tudo bem? ..." entrava no vetor com o mesmo peso do
-- conteúdo. Comparar um vetor limpo (o novo) com vetores sujos (os antigos)
-- não mede o que se quer medir.
--
-- Zerar aqui é seguro: a cura (`curarLacunasSemVetor`) só enxerga linha com
-- vetor nulo, e roda sozinha quando o médico abre a aba do Cérebro.

-- SEM `WHERE status = 'aberta'`, de propósito. Uma lacuna `respondida` é
-- REABERTA quando o texto exato repete — e voltaria para a busca carregando o
-- vetor sujo, que a cura nunca mais alcança (ela só enxerga vetor NULO).
-- Vetor nulo é inerte; vetor sujo é ativo e errado.
UPDATE public.brain_gaps SET embedding = NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- CONFERIR — rode isto depois, é o que prova que os dois defeitos morreram
-- ════════════════════════════════════════════════════════════════════════════
--
-- 1) A função está na forma certa. Esperado: prosecdef = false E
--    proconfig = NULL. Se vier `{search_path=public}`, o SQL antigo ainda está
--    valendo e o `<=>` volta a sumir:
--
--   SELECT proname, prosecdef, proconfig FROM pg_proc
--   WHERE proname = 'match_brain_gaps';
--
-- 2) O índice é hnsw (esperado: a definição contém "hnsw"):
--
--   SELECT indexdef FROM pg_indexes
--   WHERE tablename = 'brain_gaps' AND indexname = 'idx_brain_gaps_embedding';
--
-- 3) Não há duplicata bloqueando o merge (esperado: nenhuma linha):
--
--   SELECT doctor_id, norm_question, count(*) FROM public.brain_gaps
--   GROUP BY 1, 2 HAVING count(*) > 1;
--
-- 4) Depois de abrir a aba Cérebro no painel, os vetores voltam:
--
--   SELECT count(*) FILTER (WHERE embedding IS NULL) AS sem_vetor,
--          count(*) FILTER (WHERE embedding IS NOT NULL) AS com_vetor
--   FROM public.brain_gaps WHERE status = 'aberta';
