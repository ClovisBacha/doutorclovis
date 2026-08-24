-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE — "ignorar" vira "não agora", não "nunca"
--
-- Idempotente: pode rodar quantas vezes quiser.
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUE ISTO EXISTE
--
-- A busca que encontra uma lacuna já existente casa por texto normalizado SEM
-- filtrar status (`secondbrain.server.ts`, `.eq("norm_question", norm)`). Então
-- uma lacuna IGNORADA continua sendo encontrada, e o contador `hits` continua
-- subindo a cada paciente que faz a mesma pergunta.
--
-- Só que a volta para `aberta` acontece apenas quando o status era
-- `respondida`. E a fila do painel lê `status = 'aberta'`.
--
-- Resultado: o médico ignora "posso pintar o cabelo?" quando UMA paciente
-- perguntou. Duzentas depois, o contador diz 201 e ele nunca mais vê aquilo.
-- Cada uma das 200 ouviu da IA "registrei aqui para ele ver" — uma promessa que
-- se tornou impossível de cumprir no instante em que ele clicou em ignorar.
--
-- O conserto não é reabrir sozinha (isso desfaria a decisão dele na cara dura).
-- É saber QUANTAS pessoas perguntaram DEPOIS — e para isso é preciso guardar o
-- contador no momento em que ele ignorou. Sem essa marca, "12 pacientes" e
-- "ignorei quando já eram 12" são indistinguíveis.

SET search_path = public;

-- NULL = ignorada antes desta coluna existir. O código trata como 0, que é o
-- lado seguro: uma lacuna antiga com muitos hits reaparece uma vez, e ignorar
-- de novo já grava a marca.
ALTER TABLE public.brain_gaps
  ADD COLUMN IF NOT EXISTS hits_ao_ignorar integer;

COMMENT ON COLUMN public.brain_gaps.hits_ao_ignorar IS
  'Valor de hits no instante em que o medico ignorou. hits - este valor = quantas pacientes perguntaram DEPOIS.';

-- A fila lê ignoradas do médico ordenando por repetição; sem índice isso é um
-- scan por consultório a cada abertura do painel.
CREATE INDEX IF NOT EXISTS brain_gaps_ignoradas_idx
  ON public.brain_gaps (doctor_id, hits DESC)
  WHERE status = 'ignorada';

-- ════════════════════════════════════════════════════════════════════════════
-- CONFERIR
-- ════════════════════════════════════════════════════════════════════════════
--
--   -- quais lacunas ignoradas continuaram sendo perguntadas
--   SELECT question, hits, hits_ao_ignorar,
--          hits - COALESCE(hits_ao_ignorar, 0) AS perguntaram_depois
--     FROM public.brain_gaps
--    WHERE status = 'ignorada'
--    ORDER BY perguntaram_depois DESC;
