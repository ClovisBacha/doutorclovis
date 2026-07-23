-- ════════════════════════════════════════════════════════════════════
-- APLICAR no Supabase da Obstétrica (SQL Editor). Idempotente: pode rodar
-- mais de uma vez. Liga o fluxo novo de AGENDA: contraproposta de horário
-- e fila de espera.
-- ════════════════════════════════════════════════════════════════════

-- ── Contraproposta: o médico sugere outro horário e a paciente aprova ──────
ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS proposed_date date;

ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS proposed_time text;

-- Backstop contra double-booking (parcial, só 'confirmed'; NULLS NOT DISTINCT
-- cobre a instalação única com doctor_id NULL). Se falhar por duplicata já
-- existente em produção, ajuste as confirmações conflitantes e rode de novo.
CREATE UNIQUE INDEX IF NOT EXISTS appt_confirmed_slot
  ON public.appointment_requests (doctor_id, confirmed_date, confirmed_time)
  NULLS NOT DISTINCT
  WHERE status = 'confirmed';
