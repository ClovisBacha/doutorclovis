-- ─────────────────────────────────────────────────────────────────────────────
-- Feature 10: Diário de Contrações
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contraction_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  intensity   smallint    DEFAULT 2 CHECK (intensity BETWEEN 1 AND 3),
  notes       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.contraction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own contraction_logs"
  ON public.contraction_logs FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.contraction_logs TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Feature 11: Pré-consulta Inteligente
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.preconsulta_forms (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        REFERENCES auth.users NOT NULL,
  submitted_at        timestamptz DEFAULT now(),
  weeks_at_submission int,
  current_weight      numeric(5,1),
  systolic            int,
  diastolic           int,
  symptoms            text[]      DEFAULT '{}',
  medications         text,
  questions           text,
  emotional_state     text,
  other_notes         text,
  seen_by_doctor      boolean     DEFAULT false
);

ALTER TABLE public.preconsulta_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preconsulta_forms"
  ON public.preconsulta_forms FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.preconsulta_forms TO authenticated;
