-- Clinical tools: EPDS screenings, glucose diary, biometry logs

-- EPDS screening results (linked to patient via user_id)
CREATE TABLE IF NOT EXISTS epds_screenings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  period      TEXT NOT NULL CHECK (period IN ('prenatal', 'postpartum')),
  answers     INTEGER[] NOT NULL, -- 10 scores, one per question
  total_score INTEGER NOT NULL,
  q10_score   INTEGER NOT NULL DEFAULT 0,
  level       TEXT NOT NULL CHECK (level IN ('baixo', 'moderado', 'alto', 'urgente')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE epds_screenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own epds" ON epds_screenings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Doctors (admin) can read all
CREATE POLICY "admin read epds" ON epds_screenings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_app_meta_data->>'is_admin')::boolean = true
    )
  );

-- Glucose diary for gestational diabetes monitoring
CREATE TABLE IF NOT EXISTS glucose_diary (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  moment        TEXT NOT NULL CHECK (moment IN ('fasting', 'post_breakfast_1h', 'post_breakfast_2h', 'post_lunch_1h', 'post_lunch_2h', 'post_dinner_1h', 'post_dinner_2h', 'bedtime')),
  value_mgdl    INTEGER NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE glucose_diary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own glucose_diary" ON glucose_diary
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fetal biometry logs (for reference, linked to appointment or session)
CREATE TABLE IF NOT EXISTS biometry_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  gestational_week INTEGER,
  bpd_cm          NUMERIC(5,2),
  hc_cm           NUMERIC(5,2),
  ac_cm           NUMERIC(5,2),
  fl_cm           NUMERIC(5,2),
  efw_grams       INTEGER,
  efw_percentile  TEXT,
  formula         TEXT DEFAULT 'hadlock',
  notes           TEXT,
  exam_date       DATE DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE biometry_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own biometry_logs" ON biometry_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index for quick retrieval per user
CREATE INDEX IF NOT EXISTS idx_epds_user ON epds_screenings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_glucose_user ON glucose_diary(user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_biometry_user ON biometry_logs(user_id, exam_date DESC);
