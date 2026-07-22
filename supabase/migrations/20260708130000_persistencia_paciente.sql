-- ─────────────────────────────────────────────────────────────────────────────
-- Persistência da paciente na CONTA (não no aparelho).
-- Corrige gaps do auditor em que dados/preferências viviam só em useState ou
-- localStorage e sumiam ao trocar de dispositivo.
--
-- 1. triage_logs — cada triagem de sintomas (Alertas) vira registro na conta.
--    Numa plataforma de ALTO RISCO, um alerta vermelho/amarelo (sangramento,
--    PA alta) PRECISA ficar gravado — para a paciente e para o médico enxergar
--    no dashboard (contagem de triagens do mês).
-- 2. patient_profiles.checklist_seeded — tira a flag de "já semeei o checklist"
--    do localStorage e coloca na conta, pra não re-semear itens num aparelho
--    novo de quem apagou tudo de propósito.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Triagem de sintomas (Alertas) — histórico na conta
CREATE TABLE IF NOT EXISTS public.triage_logs (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level      text        NOT NULL,               -- vermelho | amarelo | verde
  symptoms   text[]      NOT NULL DEFAULT '{}',
  systolic   integer,
  diastolic  integer,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_triage_logs_user_created
  ON public.triage_logs(user_id, created_at DESC);
ALTER TABLE public.triage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Patient manages own triage logs" ON public.triage_logs;
CREATE POLICY "Patient manages own triage logs"
  ON public.triage_logs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Service manages triage logs" ON public.triage_logs;
CREATE POLICY "Service manages triage logs"
  ON public.triage_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.triage_logs TO authenticated, service_role;

-- 2. Flag de seed do checklist na conta (em vez de localStorage)
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS checklist_seeded boolean NOT NULL DEFAULT false;
