-- Premium do quiz diário da paciente: grátis = só a aula do dia de hoje;
-- premium = revisitar/fazer qualquer aula já liberada quando quiser.
-- Ativação manual pelo médico no painel (pagamento via PIX, fluxo assistido).
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS quiz_premium boolean NOT NULL DEFAULT false;
