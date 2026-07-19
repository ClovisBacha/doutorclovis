-- ════════════════════════════════════════════════════════════════════════
-- 20260719030000 — Lives e Consultas Pagas por médico (multi-inquilino)
-- ════════════════════════════════════════════════════════════════════════
-- Cada médico passa a ter SUAS lives (divulga para as pacientes dele) e SUAS
-- consultas particulares (recorte por doctor_id). O super-admin continua vendo
-- tudo pelo /admin (financeiro agregado por médico). "Lives da Obstétrica"
-- (globais) fica como conceito futuro: doctor_id NULL = live da plataforma.

ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS doctor_id uuid;

ALTER TABLE public.private_consultations
  ADD COLUMN IF NOT EXISTS doctor_id uuid;

-- Backfill: vincula cada consulta paga ao médico da paciente (patient_profiles).
UPDATE public.private_consultations pc
   SET doctor_id = pp.doctor_id
  FROM public.patient_profiles pp
 WHERE pp.id = pc.patient_user_id
   AND pc.doctor_id IS NULL
   AND pp.doctor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lives_doctor_id
  ON public.lives(doctor_id);
CREATE INDEX IF NOT EXISTS idx_private_consultations_doctor_id
  ON public.private_consultations(doctor_id);
