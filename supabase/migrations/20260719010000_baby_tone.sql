-- Tom de pele do bebê nas ilustrações (0 = arte original clara → 4 = retinta).
-- Escolhido pela paciente no cadastro/perfil e refletido em todas as telas
-- (app, jornada do bebê e espelho no painel do médico). Editável pela própria
-- paciente (RLS own-profile já cobre o UPDATE).
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS baby_skin_tone smallint NOT NULL DEFAULT 0;
