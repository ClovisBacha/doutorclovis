-- ─────────────────────────────────────────────────────────────────────────────
-- Feature 13: Teleconsulta
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teleconsulta_sessions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id    uuid        REFERENCES auth.users NOT NULL,
  scheduled_for      timestamptz,
  room_name          text        NOT NULL DEFAULT gen_random_uuid()::text,
  status             text        NOT NULL DEFAULT 'agendada'
                                 CHECK (status IN ('agendada','sala_aberta','encerrada')),
  doctor_notes       text,
  patient_notes      text,
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE public.teleconsulta_sessions ENABLE ROW LEVEL SECURITY;

-- Patients can read their own sessions
CREATE POLICY "Patients read own teleconsultas"
  ON public.teleconsulta_sessions FOR SELECT
  USING (auth.uid() = patient_user_id);

-- Patients can update only patient_notes on their own sessions
CREATE POLICY "Patients update own notes"
  ON public.teleconsulta_sessions FOR UPDATE
  USING (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);

-- Service role manages all (for admin server functions)
GRANT ALL ON public.teleconsulta_sessions TO service_role;
GRANT SELECT, UPDATE ON public.teleconsulta_sessions TO authenticated;
