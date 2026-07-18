-- Plano Clínica: a clínica tem conta própria e controla o cérebro de cada
-- médico dela DE FORMA INDIVIDUAL (cada médico segue com o próprio cérebro,
-- chaveado por doctor_id — a clínica só ganha o direito de operá-los).
--
-- Modelo:
--   clinics       — a clínica (dona = owner_user_id, a conta que assina).
--   doctors       — ganha clinic_id (a que clínica pertence) e clinic_role
--                   ('admin' gerencia a clínica; 'member' só participa).
-- Membro de clínica ativa herda as capacidades do plano Clínica (assento).

CREATE TABLE IF NOT EXISTS public.clinics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  owner_user_id uuid NOT NULL UNIQUE,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS clinic_id uuid;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS clinic_role text NOT NULL DEFAULT 'member';

CREATE INDEX IF NOT EXISTS idx_doctors_clinic ON public.doctors(clinic_id);

-- Acesso apenas via service_role (todo o isolamento é feito no servidor).
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clinics FROM anon, authenticated;
GRANT ALL ON public.clinics TO service_role;
