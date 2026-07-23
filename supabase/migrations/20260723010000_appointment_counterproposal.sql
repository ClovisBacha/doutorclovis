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

-- Backstop contra double-booking: dois pedidos não podem ficar 'confirmed' no
-- MESMO horário do MESMO médico. Parcial (só 'confirmed'); NULLS NOT DISTINCT
-- (PG15+) faz o índice valer também para a instalação única (doctor_id NULL).
-- Se a criação falhar por já existir duplicata em produção, remova/ajuste as
-- confirmações conflitantes e rode de novo.
CREATE UNIQUE INDEX IF NOT EXISTS appt_confirmed_slot
  ON public.appointment_requests (doctor_id, confirmed_date, confirmed_time)
  NULLS NOT DISTINCT
  WHERE status = 'confirmed';
