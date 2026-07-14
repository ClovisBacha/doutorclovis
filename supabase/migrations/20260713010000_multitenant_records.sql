-- ════════════════════════════════════════════════════════════════════════
-- Multi-tenant: carimba cada registro com o médico da paciente (doctor_id)
-- ════════════════════════════════════════════════════════════════════════
-- Até aqui agendamentos, perguntas, pré-consultas e teleconsultas não sabiam
-- de qual médico eram — tudo caía no dono da instalação. Agora cada registro
-- guarda o doctor_id (vindo do vínculo da paciente), para o médico assinante
-- ver e atender as SUAS pacientes. Colunas nullable: registros antigos e sem
-- vínculo continuam válidos (aparecem para a equipe/dono).

ALTER TABLE public.appointment_requests  ADD COLUMN IF NOT EXISTS doctor_id uuid;
ALTER TABLE public.doctor_questions       ADD COLUMN IF NOT EXISTS doctor_id uuid;
ALTER TABLE public.preconsulta_forms      ADD COLUMN IF NOT EXISTS doctor_id uuid;
ALTER TABLE public.teleconsulta_sessions  ADD COLUMN IF NOT EXISTS doctor_id uuid;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointment_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_questions_doctor     ON public.doctor_questions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_preconsulta_doctor   ON public.preconsulta_forms(doctor_id);
CREATE INDEX IF NOT EXISTS idx_teleconsulta_doctor  ON public.teleconsulta_sessions(doctor_id);
