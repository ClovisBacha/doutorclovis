-- ─────────────────────────────────────────────────────────────────────────────
-- Feature 6: Métricas de wearables em health_logs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.health_logs
  ADD COLUMN IF NOT EXISTS spo2          smallint,        -- SpO2 em %
  ADD COLUMN IF NOT EXISTS heart_rate_bpm smallint,       -- FC em bpm
  ADD COLUMN IF NOT EXISTS steps          int,            -- passos do dia
  ADD COLUMN IF NOT EXISTS sleep_hours    numeric(4,1);   -- horas de sono

-- ─────────────────────────────────────────────────────────────────────────────
-- Feature 9: Dados corporais em patient_profiles (curva IOM)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS height_cm                int,
  ADD COLUMN IF NOT EXISTS pre_pregnancy_weight_kg  numeric(5,1);

-- ─────────────────────────────────────────────────────────────────────────────
-- Feature 2: Notas de consulta (transcrição por IA)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultation_notes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        REFERENCES auth.users NOT NULL,
  recorded_at      timestamptz DEFAULT now(),
  title            text,
  raw_transcript   text,
  orientacoes      text,
  medicamentos     text,
  proximos_exames  text,
  proxima_consulta text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.consultation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own consultation_notes"
  ON public.consultation_notes FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.consultation_notes TO authenticated;
