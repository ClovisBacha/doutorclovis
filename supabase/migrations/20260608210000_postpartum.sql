-- Feature 50: Portal Pós-parto

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS birth_date date;

CREATE TABLE IF NOT EXISTS public.ppd_screenings (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid      REFERENCES auth.users NOT NULL,
  score       smallint  NOT NULL,
  answers     jsonb     NOT NULL DEFAULT '[]',
  screened_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.breastfeeding_logs (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid      REFERENCES auth.users NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  side        text      NOT NULL DEFAULT 'ambos',
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.baby_milestones (
  id            uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid      REFERENCES auth.users NOT NULL,
  milestone_key text      NOT NULL,
  custom_label  text,
  achieved_at   date      NOT NULL,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, milestone_key)
);

CREATE TABLE IF NOT EXISTS public.baby_weights (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid      REFERENCES auth.users NOT NULL,
  measured_at date      NOT NULL,
  weight_g    int       NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.baby_vaccines (
  id              uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid      REFERENCES auth.users NOT NULL,
  vaccine_key     text      NOT NULL,
  administered_at date      NOT NULL,
  batch           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, vaccine_key)
);

ALTER TABLE public.ppd_screenings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breastfeeding_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_milestones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_weights       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_vaccines      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own ppd"       ON public.ppd_screenings     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Patient manages own bf logs"   ON public.breastfeeding_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Patient manages own milestones" ON public.baby_milestones   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Patient manages own weights"   ON public.baby_weights       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Patient manages own vaccines"  ON public.baby_vaccines      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.ppd_screenings     TO authenticated, service_role;
GRANT ALL ON public.breastfeeding_logs TO authenticated, service_role;
GRANT ALL ON public.baby_milestones    TO authenticated, service_role;
GRANT ALL ON public.baby_weights       TO authenticated, service_role;
GRANT ALL ON public.baby_vaccines      TO authenticated, service_role;
