-- ════════════════════════════════════════════════════════════════════════
-- Diretório de médicos — campos de perfil para a busca da paciente
-- ════════════════════════════════════════════════════════════════════════
-- A paciente sem médico pode procurar por critérios (subárea, cidade,
-- experiência, mestrado/doutorado). O ranking prioriza planos melhores
-- (feito no servidor, ver doctors.functions.ts searchDoctors).

ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS subspecialty text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS years_experience integer;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS has_masters boolean DEFAULT false;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS has_doctorate boolean DEFAULT false;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS accepting_patients boolean DEFAULT true;

-- Índice para os filtros mais comuns.
CREATE INDEX IF NOT EXISTS idx_doctors_directory
  ON public.doctors(active, accepting_patients, state);
