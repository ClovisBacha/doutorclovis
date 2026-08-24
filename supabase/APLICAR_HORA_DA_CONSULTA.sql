-- ============================================================================
--  A CONSULTA PARTICULAR GANHA DATA E HORA
--  Idempotente: pode rodar mais de uma vez.
-- ----------------------------------------------------------------------------
--  POR QUE
--
--  `private_consultations` guardava `preferred_dates` — as datas que a PACIENTE
--  preferiria — e nenhum campo para o horário que ficou combinado. Era a única
--  das três fontes da agenda que não sabia dizer QUANDO acontece.
--
--  O calendário do mês fazia o possível com isso: punha a consulta na primeira
--  preferência e a marcava como "sem hora combinada". Honesto, e insuficiente —
--  um calendário de verdade precisa de hora de verdade.
--
--  Decisão do dono (ago/2026): "sim, a consulta passa a ter data e hora no
--  banco. Como é que você funciona um calendário de verdade se não tem data e
--  hora?"
--
--  ── UMA COLUNA `timestamptz`, E NÃO DUAS DE TEXTO ──────────────────────────
--
--  `appointment_requests` guarda data e hora separadas (`confirmed_date` +
--  `confirmed_time` texto), e isso já custou caro: a hora aceitava "manhã", o
--  que quebra ordenação e comparação. Aqui nasce certo — um instante só, com
--  fuso, que o Postgres sabe ordenar e comparar.
-- ============================================================================

ALTER TABLE IF EXISTS public.private_consultations
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

COMMENT ON COLUMN public.private_consultations.scheduled_for IS
  'Quando a consulta particular FOI COMBINADA. NULL = ainda sem horário; a agenda mostra a primeira preferência de preferred_dates, marcada como preferência.';

-- A agenda do mês varre por intervalo de data, por médico. Sem índice, isso é
-- varredura completa a cada abertura do calendário.
CREATE INDEX IF NOT EXISTS idx_private_consult_agenda
  ON public.private_consultations (doctor_id, scheduled_for)
  WHERE scheduled_for IS NOT NULL;
