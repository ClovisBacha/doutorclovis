-- 1. Glicemia em health_logs
ALTER TABLE public.health_logs ADD COLUMN IF NOT EXISTS glucose_mg_dl INTEGER;

-- 2. Laudos e exames (fotos de documentos)
CREATE TABLE IF NOT EXISTS public.exam_files (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'outros',
  week        INTEGER,
  notes       TEXT,
  image_data  TEXT,                          -- base64 JPEG
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exam_files" ON public.exam_files
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, DELETE ON public.exam_files TO authenticated;
CREATE INDEX IF NOT EXISTS idx_exam_files_user ON public.exam_files(user_id, created_at DESC);

-- 3. Plano de parto
CREATE TABLE IF NOT EXISTS public.birth_plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_type      TEXT,
  pain_relief     TEXT[],
  who_present     TEXT,
  cord_cutting    TEXT,
  skin_to_skin    BOOLEAN     DEFAULT true,
  breastfeeding   TEXT,
  lighting        TEXT,
  music           TEXT,
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.birth_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own birth_plans" ON public.birth_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.birth_plans TO authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS idx_birth_plans_user ON public.birth_plans(user_id);
