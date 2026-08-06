-- Fila de REVISAO: o 👎 da paciente sobre uma resposta que a IA SABIA dar.
--
-- Antes, todo 👎 virava lacuna — inclusive quando a resposta veio de uma
-- entrada aprovada. O medico entao criava uma SEGUNDA entrada com a mesma
-- pergunta, e a primeira, errada, continuava aprovada e competindo.

SET search_path = public, extensions;

ALTER TABLE public.brain_feedback
  -- A RESPOSTA que levou o 👎. Sem ela o médico revisa no escuro: vê a
  -- pergunta e a entrada, e tem que adivinhar o que a paciente leu.
  ADD COLUMN IF NOT EXISTS answer text,
  -- Qual entrada do cérebro produziu aquilo. É o alvo da correção.
  -- `ON DELETE SET NULL`: apagar a entrada não pode apagar o registro de que
  -- alguém reclamou dela.
  ADD COLUMN IF NOT EXISTS entry_id uuid REFERENCES public.brain_entries(id) ON DELETE SET NULL,
  -- `aberta` enquanto pede olhar dele; `resolvida` depois que ele editou ou
  -- confirmou. Nunca se apaga: o histórico de reclamação é o que mostra se
  -- uma entrada é problema recorrente.
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aberta',
  -- Quem reclamou, para receber a correção quando ela sair.
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- A fila de revisão é sempre lida assim: deste médico, negativa, ainda aberta,
-- e com entrada identificada (sem entrada não há o que corrigir — aquilo é
-- lacuna, e mora na outra fila).
CREATE INDEX IF NOT EXISTS idx_brain_feedback_revisao
  ON public.brain_feedback (doctor_id, status, created_at DESC)
  WHERE helpful = false;

-- ════════════════════════════════════════════════════════════════════════════
-- A busca que devolve o ID da entrada
-- ════════════════════════════════════════════════════════════════════════════
--
-- `match_brain_entries` devolve pergunta, resposta e similaridade — tudo que o
-- chat precisa para montar o bloco, e nada que sirva para CORRIGIR. Para
-- revisar é preciso saber qual linha produziu aquilo.
--
-- Função separada em vez de mexer na que já existe: aquela é chamada em todo
-- turno de conversa de todas as pacientes, e mudar a forma de retorno dela
-- para atender um caminho raro é trocar risco por conveniência.
--
-- Mesma forma da irmã (sem SECURITY DEFINER, com search_path declarado) — o
-- dia em que divergi disso custou uma noite inteira.

CREATE OR REPLACE FUNCTION public.match_brain_entries_id(
  p_doctor_id uuid,
  p_embedding vector(768),
  p_limit int DEFAULT 1
)
RETURNS TABLE (id uuid, similarity double precision)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    e.id,
    1 - (e.embedding <=> p_embedding) AS similarity
  FROM public.brain_entries e
  WHERE e.doctor_id = p_doctor_id
    AND e.approved = true
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> p_embedding
  LIMIT LEAST(GREATEST(p_limit, 1), 20);
$$;

REVOKE ALL ON FUNCTION public.match_brain_entries_id(uuid, vector, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_brain_entries_id(uuid, vector, int) FROM anon;
REVOKE ALL ON FUNCTION public.match_brain_entries_id(uuid, vector, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_brain_entries_id(uuid, vector, int) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- Um voto por resposta
-- ════════════════════════════════════════════════════════════════════════════
--
-- O voto vivia só no estado da tela. Recarregar a conversa permitia votar de
-- novo na MESMA resposta — e cada 👎 repetido incrementava o contador da fila,
-- fazendo uma reclamação parecer dez.
--
-- A chave é (paciente, pergunta): a mesma pessoa reclamando da mesma pergunta
-- é um voto, por mais vezes que ela toque no botão.

DELETE FROM public.brain_feedback a
 USING public.brain_feedback b
 WHERE a.user_id = b.user_id
   AND a.question IS NOT DISTINCT FROM b.question
   AND a.helpful = b.helpful
   AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_brain_feedback_voto
  ON public.brain_feedback (user_id, question, helpful);
