-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE — o conhecimento passa a ter idade
--
-- Idempotente: pode rodar quantas vezes quiser.
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUE ISTO EXISTE
--
-- `brain_entries` tinha `created_at` e mais nada. Quando o médico EDITA uma
-- entrada, o texto muda, o vetor é recalculado — e não sobra registro de
-- quando. Então uma orientação escrita há dois anos entra na resposta com
-- exatamente a mesma confiança da escrita ontem, e nem ele nem o painel
-- conseguem dizer qual é qual.
--
-- Em obstetrícia a conduta muda: profilaxia com AAS, rastreio de EGB,
-- critérios de indução, alvo pressórico. O Segundo Cérebro guarda o que ele
-- disse; sem data de revisão, ele não guarda QUANDO ele disse — e continua
-- respondendo em nome dele com a versão de dois anos atrás.
--
-- Isto não é sobre apagar conhecimento velho. É sobre o médico conseguir OLHAR
-- para o que está velho. Uma orientação de 2024 pode estar perfeita; o que não
-- pode é ninguém ter como saber que ela é de 2024.

SET search_path = public;

-- `DEFAULT now()` faz toda linha existente nascer com a data de hoje, o que é
-- honesto: não sabemos quando foram revisadas, e fingir uma data antiga seria
-- inventar um alarme. A partir daqui, cada edição carimba de verdade.
ALTER TABLE public.brain_entries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.brain_entries.updated_at IS
  'Ultima vez que o medico revisou este conhecimento. E a idade da CONDUTA, nao da linha.';

-- A base ordena "mais velhas primeiro" quando o médico vai revisar.
CREATE INDEX IF NOT EXISTS brain_entries_revisao_idx
  ON public.brain_entries (doctor_id, updated_at ASC)
  WHERE approved = true;

-- ════════════════════════════════════════════════════════════════════════════
-- CONFERIR
-- ════════════════════════════════════════════════════════════════════════════
--
--   -- o conhecimento mais antigo do consultório
--   SELECT question, updated_at,
--          date_part('day', now() - updated_at)::int AS dias_sem_revisao
--     FROM public.brain_entries
--    WHERE approved = true
--    ORDER BY updated_at ASC
--    LIMIT 20;
