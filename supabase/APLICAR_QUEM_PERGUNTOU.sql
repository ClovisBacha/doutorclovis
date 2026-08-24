-- ============================================================================
-- APLICAR NO SQL EDITOR DO SUPABASE — quem perguntou cada lacuna
-- ============================================================================
-- Idempotente. Depende de `brain_gaps` ja existir (APLICAR_PENDENTES).
--
-- Sem isto, a IA promete a paciente "registrei aqui para ele ver" e o produto
-- nao tem como cumprir: `brain_gaps` guarda a pergunta e o medico, e nao guarda
-- quem perguntou. O medico responde, vira conhecimento da IA, e ela nunca sabe.
-- ============================================================================

-- ============================================================================
-- QUEM PERGUNTOU — a promessa que a IA faz e o produto não cumpre
-- ============================================================================
--
-- Quando a paciente pergunta algo que o cérebro do médico não cobre, a IA
-- responde, textualmente: *"essa é uma dúvida que ele prefere responder
-- pessoalmente; registrei aqui para ele ver"*.
--
-- Isso é falso hoje, e não por bug: por schema. `brain_gaps` guarda a pergunta
-- e o médico, e **não guarda quem perguntou**. O médico responde no painel, a
-- resposta vira conhecimento da IA — e a paciente que perguntou nunca é
-- avisada. Ela esperou por uma resposta que o sistema não tem como entregar.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE UMA TABELA DE LIGAÇÃO, E NÃO `user_id` EM `brain_gaps`
--
-- A lacuna é deduplicada por `(doctor_id, norm_question)` — é isso que faz
-- cinquenta pacientes perguntando a mesma coisa virarem UM item na fila do
-- médico, com contador de repetições. Pôr `user_id` na própria linha destruiria
-- essa dedução: cinquenta linhas, cinquenta vezes o mesmo trabalho.
--
-- A ligação preserva as duas coisas: uma lacuna, N pessoas esperando. E quando
-- ele responde, todas recebem.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brain_gap_askers (
  gap_id     uuid        NOT NULL,
  user_id    uuid        NOT NULL,
  -- Quando ELA perguntou. Duas pacientes com a mesma dúvida em semanas
  -- diferentes é informação clínica, não ruído.
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Já foi avisada da resposta? Sem isto, reprocessar a entrega manda o mesmo
  -- aviso de novo — e um push repetido sobre uma dúvida antiga é o tipo de
  -- coisa que faz a paciente desligar as notificações.
  avisada_em timestamptz,
  PRIMARY KEY (gap_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gap_askers_gap
    ON public.brain_gap_askers (gap_id)
    WHERE avisada_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_gap_askers_user
    ON public.brain_gap_askers (user_id, created_at DESC);

-- FKs com CASCADE nos dois lados: lacuna apagada não deixa ligação órfã, e
-- conta apagada não deixa rastro de quem perguntou o quê.
DO $fks$
BEGIN
  IF to_regclass('public.brain_gaps') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.brain_gap_askers'::regclass
          AND conname = 'brain_gap_askers_gap_id_fkey'
     )
  THEN
    ALTER TABLE public.brain_gap_askers
      ADD CONSTRAINT brain_gap_askers_gap_id_fkey
      FOREIGN KEY (gap_id) REFERENCES public.brain_gaps(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.brain_gap_askers'::regclass
          AND conname = 'brain_gap_askers_user_id_fkey'
     )
  THEN
    ALTER TABLE public.brain_gap_askers
      ADD CONSTRAINT brain_gap_askers_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$fks$;

ALTER TABLE public.brain_gap_askers ENABLE ROW LEVEL SECURITY;

-- Só o servidor. A paciente não precisa desta tabela (ela vê a resposta na aba
-- Perguntas dela), e o médico a alcança pelas server functions do painel.
DROP POLICY IF EXISTS "servico gerencia quem perguntou" ON public.brain_gap_askers;
CREATE POLICY "servico gerencia quem perguntou" ON public.brain_gap_askers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.brain_gap_askers FROM anon, authenticated;
GRANT ALL ON public.brain_gap_askers TO service_role;

COMMENT ON TABLE public.brain_gap_askers IS
  'Quem perguntou cada lacuna. Existe para a IA poder cumprir o que promete a paciente ("registrei aqui para ele ver") — brain_gaps e deduplicada por pergunta e nao guarda quem perguntou.';
