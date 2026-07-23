-- ════════════════════════════════════════════════════════════════════════
-- Contraproposta de horário: o médico sugere outro horário e a paciente aprova
-- ════════════════════════════════════════════════════════════════════════
-- Fluxo: paciente pede horário → se não der, o médico SUGERE outro (status
-- 'counter_proposed' + proposed_date/proposed_time) → a paciente recebe e
-- APROVA (vira 'confirmed') ou RECUSA ('declined'). Tudo pelas server functions
-- (service role); a paciente nunca escreve direto nesta tabela.

ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS proposed_date date;

ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS proposed_time text;
