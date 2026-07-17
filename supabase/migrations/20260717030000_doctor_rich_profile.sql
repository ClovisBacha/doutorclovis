-- Perfil rico do médico: o que as pacientes mais querem saber na hora de
-- escolher (convênios, maternidades, formação completa, abordagem, preço,
-- teleconsulta, Instagram). Alimenta o "Meu Perfil" do painel, os cards do
-- /encontrar-medico e a busca com IA. Idempotente.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS rqe text,
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS hospitals text,
  ADD COLUMN IF NOT EXISTS insurances text,
  ADD COLUMN IF NOT EXISTS languages text,
  ADD COLUMN IF NOT EXISTS approach text,
  ADD COLUMN IF NOT EXISTS consultation_price_brl integer,
  ADD COLUMN IF NOT EXISTS offers_telehealth boolean NOT NULL DEFAULT false;
