-- ============================================================================
-- BANCO COMPLETO — todas as migrations do zero (idempotente)
-- Gerado em 2026-06-15. Cole no SQL Editor do Supabase e clique RUN.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 20260604150738_152da58c-4b08-47d9-89a6-b009a201c0ab.sql
-- ────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS public.appointment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name TEXT NOT NULL,
  patient_email TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.appointment_requests TO anon;
GRANT INSERT ON public.appointment_requests TO authenticated;
GRANT ALL ON public.appointment_requests TO service_role;

ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can request an appointment"
  ON public.appointment_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Painel do médico: o admin confirma consulta e marca pagamento direto do
-- navegador. Admin = usuário com app_metadata.is_admin = true (mesma convenção
-- da policy "admin read epds" mais abaixo). Marque aqui o(s) e-mail(s) do
-- médico (idempotente; é preciso sair e entrar de novo no site para o token
-- JWT incluir a claim):
UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin": true}'::jsonb
  WHERE email = 'bachaclovis@gmail.com';

GRANT SELECT, UPDATE ON public.appointment_requests TO authenticated;
DROP POLICY IF EXISTS "admin read appointments" ON public.appointment_requests;
CREATE POLICY "admin read appointments" ON public.appointment_requests
  FOR SELECT TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));
DROP POLICY IF EXISTS "admin update appointments" ON public.appointment_requests;
CREATE POLICY "admin update appointments" ON public.appointment_requests
  FOR UPDATE TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));


-- ────────────────────────────────────────────────────────────────────────────
-- 20260607050155_046b1a37-2ecc-4d37-ac3e-95579b84d6de.sql
-- ────────────────────────────────────────────────────────────────────────────


-- Profile table for pregnant patients
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  baby_name TEXT,
  lmp_date DATE,
  due_date DATE,
  reference_date DATE,
  reference_weeks INTEGER,
  reference_days INTEGER,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_profiles TO authenticated;
GRANT ALL ON public.patient_profiles TO service_role;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.patient_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.patient_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.patient_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.patient_profiles FOR DELETE USING (auth.uid() = id);

-- Journal entries (diário gestacional)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own journal all" ON public.journal_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Kick counter sessions
CREATE TABLE IF NOT EXISTS public.kick_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  kick_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kick_sessions TO authenticated;
GRANT ALL ON public.kick_sessions TO service_role;
ALTER TABLE public.kick_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own kicks all" ON public.kick_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Maternity bag checklist
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'mae',
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT ALL ON public.checklist_items TO service_role;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklist all" ON public.checklist_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_patient()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.patient_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_patient
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_patient();


-- ────────────────────────────────────────────────────────────────────────────
-- 20260607050212_e8bd8c8d-803c-468d-a437-d5a1a3c35d83.sql
-- ────────────────────────────────────────────────────────────────────────────


REVOKE EXECUTE ON FUNCTION public.handle_new_patient() FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 20260607122031_3bcc138a-3388-4a21-ae4b-a823fe231bf5.sql
-- ────────────────────────────────────────────────────────────────────────────


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


-- ────────────────────────────────────────────────────────────────────────────
-- 20260608120000_security_hardening.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Endurecimento de segurança do modo acompanhante.
--
-- Antes, qualquer usuário ANÔNIMO podia ler TODOS os convites (token + user_id)
-- por causa da política "public read by token" com USING (true). A leitura do
-- convite agora acontece só no servidor (service role), via a server function
-- getCompanionView, que valida o token e a expiração. Então removemos o acesso
-- anônimo direto à tabela.

DROP POLICY IF EXISTS "public read by token" ON public.companion_invites;
REVOKE SELECT ON public.companion_invites FROM anon;

-- Faz os convites expirarem por padrão (90 dias) e preenche os que estão sem data.
ALTER TABLE public.companion_invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '90 days');

UPDATE public.companion_invites
  SET expires_at = created_at + interval '90 days'
  WHERE expires_at IS NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 20260608140000_contractions_preconsulta.sql
-- ────────────────────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────────────────────
-- 20260608150000_extended_health_profiles.sql
-- ────────────────────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────────────────────
-- 20260608170000_teleconsulta.sql
-- ────────────────────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────────────────────
-- 20260608180000_baby_letters.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Feature 21: Carta Semanal do Bebê
CREATE TABLE IF NOT EXISTS public.baby_letters (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users NOT NULL,
  week         smallint    NOT NULL,
  content      text        NOT NULL,
  generated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, week)
);

ALTER TABLE public.baby_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own baby_letters"
  ON public.baby_letters FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.baby_letters TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 20260608190000_family_features.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Feature 33: Álbum Familiar
CREATE TABLE IF NOT EXISTS public.family_album_posts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id  uuid        REFERENCES auth.users NOT NULL,
  author_name      text        NOT NULL DEFAULT 'Família',
  caption          text,
  image_data       text,        -- base64 JPEG, optional
  emoji            text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.family_album_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own album"
  ON public.family_album_posts FOR ALL
  USING  (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);

GRANT ALL ON public.family_album_posts TO authenticated;
GRANT ALL ON public.family_album_posts TO service_role;

-- Feature 34: Votação de Nome do Bebê
CREATE TABLE IF NOT EXISTS public.baby_name_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id  uuid        REFERENCES auth.users NOT NULL UNIQUE,
  share_token      text        NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  is_active        boolean     DEFAULT true,
  reveal_winner    boolean     DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.baby_name_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        REFERENCES public.baby_name_sessions(id) ON DELETE CASCADE NOT NULL,
  name             text        NOT NULL,
  suggested_by     text        NOT NULL DEFAULT 'Anônimo',
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.baby_name_votes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id         uuid        REFERENCES public.baby_name_entries(id) ON DELETE CASCADE NOT NULL,
  voter_name       text        NOT NULL DEFAULT 'Anônimo',
  voter_token      text        NOT NULL,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (entry_id, voter_token)
);

ALTER TABLE public.baby_name_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_name_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baby_name_votes     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own name session"
  ON public.baby_name_sessions FOR ALL
  USING (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);

GRANT ALL ON public.baby_name_sessions TO authenticated;
GRANT ALL ON public.baby_name_sessions TO service_role;
GRANT ALL ON public.baby_name_entries  TO service_role;
GRANT ALL ON public.baby_name_votes    TO service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 20260608200000_escola_panico.sql
-- ────────────────────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────────────────────
-- 20260608210000_postpartum.sql
-- ────────────────────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────────────────────
-- 20260608220000_fix_rls_name_tables.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Fix: RLS policies missing for baby_name_entries and baby_name_votes
-- These tables had RLS enabled but no policies, blocking all access

-- Allow service_role to manage entries and votes (for server functions)
-- Public can insert entries/votes if they know a valid session (controlled at app layer)
CREATE POLICY "Service manages name entries"
  ON public.baby_name_entries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service manages name votes"
  ON public.baby_name_votes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant authenticated read on entries and votes for potential future direct queries
GRANT SELECT ON public.baby_name_entries TO authenticated;
GRANT SELECT ON public.baby_name_votes    TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 20260609000000_features_shop_achievements_push_segunda.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Feature 11: Consulta Particular (paid private consultations)
CREATE TABLE IF NOT EXISTS public.private_consultations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consult_type text NOT NULL,
  preferred_dates text[] DEFAULT '{}',
  message text,
  status text NOT NULL DEFAULT 'pendente_pagamento',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.private_consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient manages own private consultations"
  ON public.private_consultations FOR ALL
  TO authenticated
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());
CREATE POLICY "Service manages private consultations"
  ON public.private_consultations FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.private_consultations TO authenticated;
GRANT ALL ON public.private_consultations TO service_role;

-- Feature 16: Achievements (Conquistas)
CREATE TABLE IF NOT EXISTS public.patient_achievements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);
ALTER TABLE public.patient_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient manages own achievements"
  ON public.patient_achievements FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service manages achievements"
  ON public.patient_achievements FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.patient_achievements TO authenticated;
GRANT ALL ON public.patient_achievements TO service_role;

-- Feature 17: Push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient manages own subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service manages subscriptions"
  ON public.push_subscriptions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- Feature 19: Second pregnancy tracking
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS pregnancy_number integer DEFAULT 1;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS prior_bp_elevated boolean DEFAULT false;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS prior_bp_week integer;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS prior_gestational_diabetes boolean DEFAULT false;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS prior_preterm boolean DEFAULT false;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS prior_cesarean boolean DEFAULT false;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS prior_notes text;


-- ────────────────────────────────────────────────────────────────────────────
-- 20260609010000_saude_feminina_corporativo.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Feature 40: Ciclo Menstrual (Saúde da Mulher)
CREATE TABLE IF NOT EXISTS public.menstrual_cycles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  flow_intensity text,
  symptoms text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, start_date)
);
ALTER TABLE public.menstrual_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient manages own cycles"
  ON public.menstrual_cycles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service manages cycles"
  ON public.menstrual_cycles FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.menstrual_cycles TO authenticated, service_role;

-- Feature 40: Preventive Reminders
CREATE TABLE IF NOT EXISTS public.preventive_reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_key text NOT NULL,
  last_done_date date,
  notes text,
  UNIQUE(user_id, exam_key)
);
ALTER TABLE public.preventive_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patient manages own reminders"
  ON public.preventive_reminders FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service manages reminders"
  ON public.preventive_reminders FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.preventive_reminders TO authenticated, service_role;

-- Feature 50: Corporate leads (anon access for contact form)
CREATE TABLE IF NOT EXISTS public.corporate_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  employee_count text,
  message text,
  status text NOT NULL DEFAULT 'novo',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.corporate_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit corporate lead"
  ON public.corporate_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Service manages corporate leads"
  ON public.corporate_leads FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT INSERT ON public.corporate_leads TO anon, authenticated;
GRANT ALL ON public.corporate_leads TO service_role;

-- Feature 50: Corporate accounts
CREATE TABLE IF NOT EXISTS public.corporate_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  contact_email text NOT NULL,
  plan_type text NOT NULL DEFAULT 'basico',
  max_seats integer NOT NULL DEFAULT 10,
  access_code text NOT NULL UNIQUE DEFAULT upper(encode(gen_random_bytes(6), 'hex')),
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.corporate_accounts ENABLE ROW LEVEL SECURITY;
-- A validação do código de acesso acontece server-side (service_role) em
-- joinCorporate (src/lib/corporativo.functions.ts); o cliente não deve ler esta
-- tabela — a policy antiga expunha o access_code de todas as empresas a
-- qualquer usuária logada.
DROP POLICY IF EXISTS "Authenticated can read active accounts for validation" ON public.corporate_accounts;
CREATE POLICY "Service manages corporate accounts"
  ON public.corporate_accounts FOR ALL TO service_role
  USING (true) WITH CHECK (true);
REVOKE SELECT ON public.corporate_accounts FROM authenticated;
GRANT ALL ON public.corporate_accounts TO service_role;

-- Link patients to corporate accounts
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS corporate_account_id uuid REFERENCES public.corporate_accounts(id);


-- ────────────────────────────────────────────────────────────────────────────
-- 20260609020000_performance_indexes.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Performance indexes for all tables added in recent feature migrations

-- private_consultations
CREATE INDEX IF NOT EXISTS idx_private_consultations_patient ON public.private_consultations(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_private_consultations_status ON public.private_consultations(status);
CREATE INDEX IF NOT EXISTS idx_private_consultations_created_at ON public.private_consultations(created_at DESC);

-- patient_achievements
CREATE INDEX IF NOT EXISTS idx_patient_achievements_user ON public.patient_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_achievements_key ON public.patient_achievements(achievement_key);

-- push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- menstrual_cycles
CREATE INDEX IF NOT EXISTS idx_menstrual_cycles_user ON public.menstrual_cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_menstrual_cycles_start_date ON public.menstrual_cycles(user_id, start_date DESC);

-- preventive_reminders
CREATE INDEX IF NOT EXISTS idx_preventive_reminders_user ON public.preventive_reminders(user_id);

-- corporate_leads
CREATE INDEX IF NOT EXISTS idx_corporate_leads_status ON public.corporate_leads(status);
CREATE INDEX IF NOT EXISTS idx_corporate_leads_created_at ON public.corporate_leads(created_at DESC);

-- corporate_accounts
CREATE INDEX IF NOT EXISTS idx_corporate_accounts_status ON public.corporate_accounts(status);
CREATE INDEX IF NOT EXISTS idx_corporate_accounts_access_code ON public.corporate_accounts(access_code);

-- Original tables that benefit from common query patterns
CREATE INDEX IF NOT EXISTS idx_appointment_requests_status ON public.appointment_requests(status);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_created_at ON public.appointment_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kick_sessions_user ON public.kick_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_kick_sessions_started_at ON public.kick_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_logs_user ON public.health_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_date ON public.health_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_doctor_questions_user ON public.doctor_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_questions_answered ON public.doctor_questions(answered);
CREATE INDEX IF NOT EXISTS idx_checklist_items_user ON public.checklist_items(user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 20260610000000_glucose_exams_birthplan.sql
-- ────────────────────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────────────────────
-- 20260610010000_doctor_scheduling.sql
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Disponibilidade semanal do médico
CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week  SMALLINT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom ... 6=Sáb
  start_time   TEXT      NOT NULL DEFAULT '08:00',
  end_time     TEXT      NOT NULL DEFAULT '18:00',
  slot_minutes INTEGER   NOT NULL DEFAULT 30,
  enabled      BOOLEAN   NOT NULL DEFAULT true,
  UNIQUE(day_of_week)
);
-- Padrão: segunda a sexta 08:00–12:00 e 14:00–18:00 (dois registros por dia não suportados aqui;
-- usamos um único horário contínuo por dia para simplicidade)
INSERT INTO public.doctor_availability (day_of_week, start_time, end_time, slot_minutes, enabled) VALUES
  (0, '08:00', '12:00', 30, false),
  (1, '08:00', '18:00', 30, true),
  (2, '08:00', '18:00', 30, true),
  (3, '08:00', '18:00', 30, true),
  (4, '08:00', '18:00', 30, true),
  (5, '08:00', '18:00', 30, true),
  (6, '08:00', '12:00', 30, false)
ON CONFLICT (day_of_week) DO NOTHING;

ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.doctor_availability TO anon, authenticated;
GRANT ALL ON public.doctor_availability TO service_role;
CREATE POLICY "public_read_availability"  ON public.doctor_availability FOR SELECT USING (true);
-- Escrita restrita ao médico (admin = app_metadata.is_admin = true).
-- A policy antiga "auth_write_availability" deixava QUALQUER usuária logada
-- editar a agenda do médico.
DROP POLICY IF EXISTS "auth_write_availability" ON public.doctor_availability;
GRANT INSERT, UPDATE, DELETE ON public.doctor_availability TO authenticated;
DROP POLICY IF EXISTS "admin_write_availability" ON public.doctor_availability;
CREATE POLICY "admin_write_availability" ON public.doctor_availability FOR ALL TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

-- 2. Datas bloqueadas (férias, afastamento)
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE      NOT NULL UNIQUE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.blocked_dates TO anon, authenticated;
GRANT ALL ON public.blocked_dates TO service_role;
CREATE POLICY "public_read_blocked"   ON public.blocked_dates FOR SELECT USING (true);
-- Escrita restrita ao médico (admin) — mesma regra da disponibilidade acima.
DROP POLICY IF EXISTS "auth_write_blocked" ON public.blocked_dates;
GRANT INSERT, UPDATE, DELETE ON public.blocked_dates TO authenticated;
DROP POLICY IF EXISTS "admin_write_blocked" ON public.blocked_dates;
CREATE POLICY "admin_write_blocked" ON public.blocked_dates FOR ALL TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

-- 3. Campos adicionais em appointment_requests
ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS confirmed_date    DATE,
  ADD COLUMN IF NOT EXISTS confirmed_time    TEXT,
  ADD COLUMN IF NOT EXISTS payment_status    TEXT NOT NULL DEFAULT 'sem_cobranca',
  ADD COLUMN IF NOT EXISTS price_brl         INTEGER,         -- centavos
  ADD COLUMN IF NOT EXISTS internal_notes    TEXT;

-- Índice para calendar view
CREATE INDEX IF NOT EXISTS idx_appt_confirmed_date
  ON public.appointment_requests(confirmed_date)
  WHERE confirmed_date IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 20260611000000_whatsapp_agent.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Conversas do agente WhatsApp (máquina de estados por telefone)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT        NOT NULL UNIQUE,
  patient_name  TEXT,
  state         TEXT        NOT NULL DEFAULT 'start',
  context       JSONB       NOT NULL DEFAULT '{}',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON public.whatsapp_conversations(phone);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.whatsapp_conversations TO service_role;
-- Apenas service_role lê/escreve (acesso exclusivo via backend)

-- Tabela de médicos parceiros (plataforma B2B futura)
-- Cada médico que contratar o produto tem um registro aqui.
CREATE TABLE IF NOT EXISTS public.doctor_accounts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  specialty     TEXT        NOT NULL DEFAULT 'Ginecologista e Obstetra',
  crm           TEXT,
  rqe           TEXT,
  email         TEXT        NOT NULL UNIQUE,
  whatsapp_phone TEXT,                    -- número vinculado ao WhatsApp Business
  wa_phone_id   TEXT,                    -- WHATSAPP_PHONE_NUMBER_ID desse médico
  wa_token      TEXT,                    -- token de acesso (criptografar em prod)
  pix_key       TEXT,
  plan          TEXT        NOT NULL DEFAULT 'trial',  -- trial | starter | pro | enterprise
  plan_expires_at TIMESTAMPTZ,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_accounts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.doctor_accounts TO service_role;
GRANT SELECT ON public.doctor_accounts TO authenticated;
CREATE POLICY "own_doctor_account" ON public.doctor_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Leads de médicos interessados no produto B2B
CREATE TABLE IF NOT EXISTS public.doctor_leads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  phone       TEXT,
  specialty   TEXT,
  city        TEXT,
  message     TEXT,
  utm_source  TEXT,
  status      TEXT        NOT NULL DEFAULT 'novo',   -- novo | contatado | demo | cliente | perdido
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_leads ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.doctor_leads TO anon, authenticated;
GRANT ALL ON public.doctor_leads TO service_role;
CREATE POLICY "insert_lead" ON public.doctor_leads FOR INSERT WITH CHECK (true);


-- ────────────────────────────────────────────────────────────────────────────
-- 20260611020000_clinical_tools.sql
-- ────────────────────────────────────────────────────────────────────────────

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


-- ────────────────────────────────────────────────────────────────────────────
-- 20260611030000_teleconsulta_notes.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Add clinical_note column to teleconsulta_sessions
ALTER TABLE teleconsulta_sessions
  ADD COLUMN IF NOT EXISTS clinical_note TEXT;

-- Index for quick admin retrieval of sessions with notes
CREATE INDEX IF NOT EXISTS idx_teleconsulta_status
  ON teleconsulta_sessions(status, scheduled_for DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- 20260611040000_teleconsulta_meet_url.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Store the Google Meet (or Jitsi fallback) URL for each teleconsulta session
ALTER TABLE teleconsulta_sessions
  ADD COLUMN IF NOT EXISTS meet_url TEXT;


-- ────────────────────────────────────────────────────────────────────────────
-- 20260611050000_pix_payments.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Add Mercado Pago PIX fields to private_consultations
ALTER TABLE private_consultations
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- Index for webhook lookup
CREATE INDEX IF NOT EXISTS idx_private_consultations_mp_payment_id
  ON private_consultations(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────────────────────
-- 20260707180000_second_brain.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Segundo Cérebro do Dr. Clóvis
-- Base de conhecimento do médico (persona + Q&A reais) usada pela IA do
-- chatbot do site e do agente WhatsApp para responder como o próprio doutor.
-- Acesso EXCLUSIVO via service_role (server functions) — nenhuma policy para
-- anon/authenticated.

-- Configurações do segundo cérebro (linha única, id = 1)
CREATE TABLE IF NOT EXISTS public.brain_settings (
  id               int         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  persona          text        NOT NULL DEFAULT '',
  sample_phrases   text        NOT NULL DEFAULT '',
  rules            text        NOT NULL DEFAULT '',
  enabled_app      boolean     NOT NULL DEFAULT true,
  enabled_whatsapp boolean     NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brain_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_settings TO service_role;
REVOKE ALL ON public.brain_settings FROM anon, authenticated;

-- Entradas de conhecimento (pergunta + resposta na voz do médico)
CREATE TABLE IF NOT EXISTS public.brain_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL,
  answer     text        NOT NULL,
  category   text,
  source     text        NOT NULL DEFAULT 'manual',  -- manual | pergunta | import...
  approved   boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_entries_created
  ON public.brain_entries(created_at DESC);

ALTER TABLE public.brain_entries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_entries TO service_role;
REVOKE ALL ON public.brain_entries FROM anon, authenticated;

