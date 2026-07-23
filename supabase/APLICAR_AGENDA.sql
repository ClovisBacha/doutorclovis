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
