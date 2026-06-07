
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS blood_type text,
  ADD COLUMN IF NOT EXISTS allergies text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS emergency_phone text;

CREATE TABLE IF NOT EXISTS public.health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  log_date date not null default CURRENT_DATE,
  weight_kg numeric(5,2),
  systolic integer,
  diastolic integer,
  notes text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_logs TO authenticated;
GRANT ALL ON public.health_logs TO service_role;
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own health logs" ON public.health_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.doctor_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  question text not null,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_questions TO authenticated;
GRANT ALL ON public.doctor_questions TO service_role;
ALTER TABLE public.doctor_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own questions" ON public.doctor_questions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.companion_invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token text not null unique,
  companion_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_invites TO authenticated;
GRANT SELECT ON public.companion_invites TO anon;
GRANT ALL ON public.companion_invites TO service_role;
ALTER TABLE public.companion_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invites manage" ON public.companion_invites FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public read by token" ON public.companion_invites FOR SELECT TO anon USING (true);
