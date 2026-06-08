-- Feature 36: Escola do Bebê — progresso por módulo
CREATE TABLE IF NOT EXISTS public.course_progress (
  id            uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid      REFERENCES auth.users NOT NULL,
  module_week   smallint  NOT NULL,
  quiz_score    smallint  DEFAULT 0,
  completed_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, module_week)
);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own progress"
  ON public.course_progress FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.course_progress TO authenticated;
GRANT ALL ON public.course_progress TO service_role;

-- Feature 41: Botão do Pânico — eventos de emergência
CREATE TABLE IF NOT EXISTS public.panic_events (
  id         uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid       REFERENCES auth.users NOT NULL,
  latitude   double precision,
  longitude  double precision,
  address    text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.panic_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own panic events"
  ON public.panic_events FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Companion reads panic events via service_role only
GRANT ALL ON public.panic_events TO authenticated;
GRANT ALL ON public.panic_events TO service_role;

-- Feature 43: Medicamentos em uso na carteirinha
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS medications text;
