-- ============================================================================
-- MIGRATIONS PENDENTES — aplicar no Supabase (SQL Editor)
-- ============================================================================
-- Gerado em 2026-06-12. Consolida todas as migrations de 2026-06-08 em diante,
-- que ainda não foram aplicadas no banco (28 tabelas faltando, verificadas via
-- REST: contraction_logs, preconsulta_forms, exam_files, consultation_notes,
-- baby_letters, family_album_posts, menstrual_cycles, ppd_screenings, etc).
--
-- COMO APLICAR:
--   1. Acesse o painel do Supabase → SQL Editor
--   2. Cole este arquivo inteiro e clique em RUN
--   3. Pode rodar mais de uma vez sem erro (idempotente)
-- ============================================================================


-- ───────────────────────────────────────────────────────────────────────────
-- 20260608120000_security_hardening.sql
-- ───────────────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────────────
-- 20260608140000_contractions_preconsulta.sql
-- ───────────────────────────────────────────────────────────────────────────

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

DROP POLICY IF EXISTS "Users manage own contraction_logs" ON public.contraction_logs;
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

DROP POLICY IF EXISTS "Users manage own preconsulta_forms" ON public.preconsulta_forms;
CREATE POLICY "Users manage own preconsulta_forms"
  ON public.preconsulta_forms FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.preconsulta_forms TO authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 20260608150000_extended_health_profiles.sql
-- ───────────────────────────────────────────────────────────────────────────

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

DROP POLICY IF EXISTS "Users manage own consultation_notes" ON public.consultation_notes;
CREATE POLICY "Users manage own consultation_notes"
  ON public.consultation_notes FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.consultation_notes TO authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 20260608170000_teleconsulta.sql
-- ───────────────────────────────────────────────────────────────────────────

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
DROP POLICY IF EXISTS "Patients read own teleconsultas" ON public.teleconsulta_sessions;
CREATE POLICY "Patients read own teleconsultas"
  ON public.teleconsulta_sessions FOR SELECT
  USING (auth.uid() = patient_user_id);

-- Patients can update only patient_notes on their own sessions
DROP POLICY IF EXISTS "Patients update own notes" ON public.teleconsulta_sessions;
CREATE POLICY "Patients update own notes"
  ON public.teleconsulta_sessions FOR UPDATE
  USING (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);

-- Service role manages all (for admin server functions)
GRANT ALL ON public.teleconsulta_sessions TO service_role;
GRANT SELECT, UPDATE ON public.teleconsulta_sessions TO authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 20260608180000_baby_letters.sql
-- ───────────────────────────────────────────────────────────────────────────

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

DROP POLICY IF EXISTS "Users manage own baby_letters" ON public.baby_letters;
CREATE POLICY "Users manage own baby_letters"
  ON public.baby_letters FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.baby_letters TO authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 20260608190000_family_features.sql
-- ───────────────────────────────────────────────────────────────────────────

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

DROP POLICY IF EXISTS "Patient manages own album" ON public.family_album_posts;
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

DROP POLICY IF EXISTS "Patient manages own name session" ON public.baby_name_sessions;
CREATE POLICY "Patient manages own name session"
  ON public.baby_name_sessions FOR ALL
  USING (auth.uid() = patient_user_id)
  WITH CHECK (auth.uid() = patient_user_id);

GRANT ALL ON public.baby_name_sessions TO authenticated;
GRANT ALL ON public.baby_name_sessions TO service_role;
GRANT ALL ON public.baby_name_entries  TO service_role;
GRANT ALL ON public.baby_name_votes    TO service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 20260608200000_escola_panico.sql
-- ───────────────────────────────────────────────────────────────────────────

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

DROP POLICY IF EXISTS "Patient manages own progress" ON public.course_progress;
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

DROP POLICY IF EXISTS "Patient manages own panic events" ON public.panic_events;
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


-- ───────────────────────────────────────────────────────────────────────────
-- 20260608210000_postpartum.sql
-- ───────────────────────────────────────────────────────────────────────────

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

DROP POLICY IF EXISTS "Patient manages own ppd" ON public.ppd_screenings;
CREATE POLICY "Patient manages own ppd"       ON public.ppd_screenings     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Patient manages own bf logs" ON public.breastfeeding_logs;
CREATE POLICY "Patient manages own bf logs"   ON public.breastfeeding_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Patient manages own milestones" ON public.baby_milestones;
CREATE POLICY "Patient manages own milestones" ON public.baby_milestones   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Patient manages own weights" ON public.baby_weights;
CREATE POLICY "Patient manages own weights"   ON public.baby_weights       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Patient manages own vaccines" ON public.baby_vaccines;
CREATE POLICY "Patient manages own vaccines"  ON public.baby_vaccines      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.ppd_screenings     TO authenticated, service_role;
GRANT ALL ON public.breastfeeding_logs TO authenticated, service_role;
GRANT ALL ON public.baby_milestones    TO authenticated, service_role;
GRANT ALL ON public.baby_weights       TO authenticated, service_role;
GRANT ALL ON public.baby_vaccines      TO authenticated, service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- 20260608220000_fix_rls_name_tables.sql
-- ───────────────────────────────────────────────────────────────────────────

-- Fix: RLS policies missing for baby_name_entries and baby_name_votes
-- These tables had RLS enabled but no policies, blocking all access

-- Allow service_role to manage entries and votes (for server functions)
-- Public can insert entries/votes if they know a valid session (controlled at app layer)
DROP POLICY IF EXISTS "Service manages name entries" ON public.baby_name_entries;
CREATE POLICY "Service manages name entries"
  ON public.baby_name_entries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service manages name votes" ON public.baby_name_votes;
CREATE POLICY "Service manages name votes"
  ON public.baby_name_votes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant authenticated read on entries and votes for potential future direct queries
GRANT SELECT ON public.baby_name_entries TO authenticated;
GRANT SELECT ON public.baby_name_votes    TO authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 20260609000000_features_shop_achievements_push_segunda.sql
-- ───────────────────────────────────────────────────────────────────────────

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
DROP POLICY IF EXISTS "Patient manages own private consultations" ON public.private_consultations;
CREATE POLICY "Patient manages own private consultations"
  ON public.private_consultations FOR ALL
  TO authenticated
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());
DROP POLICY IF EXISTS "Service manages private consultations" ON public.private_consultations;
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
DROP POLICY IF EXISTS "Patient manages own achievements" ON public.patient_achievements;
CREATE POLICY "Patient manages own achievements"
  ON public.patient_achievements FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Service manages achievements" ON public.patient_achievements;
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
DROP POLICY IF EXISTS "Patient manages own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Patient manages own subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Service manages subscriptions" ON public.push_subscriptions;
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


-- ───────────────────────────────────────────────────────────────────────────
-- 20260609010000_saude_feminina_corporativo.sql
-- ───────────────────────────────────────────────────────────────────────────

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
DROP POLICY IF EXISTS "Patient manages own cycles" ON public.menstrual_cycles;
CREATE POLICY "Patient manages own cycles"
  ON public.menstrual_cycles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Service manages cycles" ON public.menstrual_cycles;
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
DROP POLICY IF EXISTS "Patient manages own reminders" ON public.preventive_reminders;
CREATE POLICY "Patient manages own reminders"
  ON public.preventive_reminders FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Service manages reminders" ON public.preventive_reminders;
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
DROP POLICY IF EXISTS "Anyone can submit corporate lead" ON public.corporate_leads;
CREATE POLICY "Anyone can submit corporate lead"
  ON public.corporate_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
DROP POLICY IF EXISTS "Service manages corporate leads" ON public.corporate_leads;
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
DROP POLICY IF EXISTS "Service manages corporate accounts" ON public.corporate_accounts;
CREATE POLICY "Service manages corporate accounts"
  ON public.corporate_accounts FOR ALL TO service_role
  USING (true) WITH CHECK (true);
REVOKE SELECT ON public.corporate_accounts FROM authenticated;
GRANT ALL ON public.corporate_accounts TO service_role;

-- Link patients to corporate accounts
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS corporate_account_id uuid REFERENCES public.corporate_accounts(id);


-- ───────────────────────────────────────────────────────────────────────────
-- 20260609020000_performance_indexes.sql
-- ───────────────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────────────
-- 20260610000000_glucose_exams_birthplan.sql
-- ───────────────────────────────────────────────────────────────────────────

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
DROP POLICY IF EXISTS "own exam_files" ON public.exam_files;
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
DROP POLICY IF EXISTS "own birth_plans" ON public.birth_plans;
CREATE POLICY "own birth_plans" ON public.birth_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.birth_plans TO authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS idx_birth_plans_user ON public.birth_plans(user_id);


-- ───────────────────────────────────────────────────────────────────────────
-- 20260610010000_doctor_scheduling.sql
-- ───────────────────────────────────────────────────────────────────────────

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
DROP POLICY IF EXISTS "public_read_availability" ON public.doctor_availability;
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
DROP POLICY IF EXISTS "public_read_blocked" ON public.blocked_dates;
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

-- 4. Painel do médico: permitir que o admin confirme consulta e marque
--    pagamento direto do navegador. Admin = usuário com app_metadata.is_admin
--    = true (mesma convenção da policy "admin read epds" mais abaixo).
--    Marque aqui o(s) e-mail(s) do médico (idempotente; é preciso sair e
--    entrar de novo no site para o token JWT incluir a claim):
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


-- ───────────────────────────────────────────────────────────────────────────
-- 20260611000000_whatsapp_agent.sql
-- ───────────────────────────────────────────────────────────────────────────

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
DROP POLICY IF EXISTS "own_doctor_account" ON public.doctor_accounts;
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
DROP POLICY IF EXISTS "insert_lead" ON public.doctor_leads;
CREATE POLICY "insert_lead" ON public.doctor_leads FOR INSERT WITH CHECK (true);


-- ───────────────────────────────────────────────────────────────────────────
-- 20260611020000_clinical_tools.sql
-- ───────────────────────────────────────────────────────────────────────────

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
DROP POLICY IF EXISTS "users own epds" ON epds_screenings;
CREATE POLICY "users own epds" ON epds_screenings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Doctors (admin) can read all
DROP POLICY IF EXISTS "admin read epds" ON epds_screenings;
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
DROP POLICY IF EXISTS "users own glucose_diary" ON glucose_diary;
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
DROP POLICY IF EXISTS "users own biometry_logs" ON biometry_logs;
CREATE POLICY "users own biometry_logs" ON biometry_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index for quick retrieval per user
CREATE INDEX IF NOT EXISTS idx_epds_user ON epds_screenings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_glucose_user ON glucose_diary(user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_biometry_user ON biometry_logs(user_id, exam_date DESC);


-- ───────────────────────────────────────────────────────────────────────────
-- 20260611030000_teleconsulta_notes.sql
-- ───────────────────────────────────────────────────────────────────────────

-- Add clinical_note column to teleconsulta_sessions
ALTER TABLE teleconsulta_sessions
  ADD COLUMN IF NOT EXISTS clinical_note TEXT;

-- Index for quick admin retrieval of sessions with notes
CREATE INDEX IF NOT EXISTS idx_teleconsulta_status
  ON teleconsulta_sessions(status, scheduled_for DESC);


-- ───────────────────────────────────────────────────────────────────────────
-- 20260611040000_teleconsulta_meet_url.sql
-- ───────────────────────────────────────────────────────────────────────────

-- Store the Google Meet (or Jitsi fallback) URL for each teleconsulta session
ALTER TABLE teleconsulta_sessions
  ADD COLUMN IF NOT EXISTS meet_url TEXT;


-- ───────────────────────────────────────────────────────────────────────────
-- 20260611050000_pix_payments.sql
-- ───────────────────────────────────────────────────────────────────────────

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


-- ───────────────────────────────────────────────────────────────────────────
-- 20260707180000_second_brain.sql
-- ───────────────────────────────────────────────────────────────────────────

-- Segundo Cérebro — POR PERFIL DE MÉDICO (doctor_id = uid do médico no auth)
-- Cada médico tem o SEU cérebro (estilo + Q&A). Acesso só via service_role.
-- Transformação do shape antigo (linha única id=1), se houver de uma aplicação
-- anterior desta mesma migration — feature nunca lançada, sem dados a preservar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brain_settings' AND column_name = 'id'
  ) THEN
    DROP TABLE public.brain_settings;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brain_entries'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brain_entries' AND column_name = 'doctor_id'
  ) THEN
    DROP TABLE public.brain_entries;
  END IF;
END $$;

-- Configurações do cérebro de cada médico (uma linha por médico)
CREATE TABLE IF NOT EXISTS public.brain_settings (
  doctor_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Entradas de conhecimento (pergunta + resposta na voz do médico dono)
CREATE TABLE IF NOT EXISTS public.brain_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question   text        NOT NULL,
  answer     text        NOT NULL,
  category   text,
  source     text        NOT NULL DEFAULT 'manual',  -- manual | pergunta | import...
  approved   boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_entries_doctor_created
  ON public.brain_entries(doctor_id, created_at DESC);

ALTER TABLE public.brain_entries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_entries TO service_role;
REVOKE ALL ON public.brain_entries FROM anon, authenticated;

-- brain_hits — telemetria do cérebro (quantas vezes foi usado) para o dashboard.
-- Acesso EXCLUSIVO via service_role (logging server-side).
CREATE TABLE IF NOT EXISTS public.brain_hits (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  uuid,
  channel    text        NOT NULL,  -- app | whatsapp | teste
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brain_hits_doctor_created
  ON public.brain_hits(doctor_id, created_at DESC);
ALTER TABLE public.brain_hits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_hits TO service_role;
REVOKE ALL ON public.brain_hits FROM anon, authenticated;

-- triage_logs — cada triagem de sintomas (Alertas) vira registro na conta.
-- Alto risco: alerta vermelho/amarelo PRECISA ficar gravado (paciente + médico).
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

-- Flag de seed do checklist na conta (em vez de localStorage) — não re-semeia
-- itens num aparelho novo de quem apagou tudo de propósito.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS checklist_seeded boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- NÚCLEO MULTI-TENANT — o app é uma plataforma para QUALQUER médico assinante
-- (não mais exclusivo do Dr. Clóvis). Três peças:
--   1. doctors            — o perfil de cada médico assinante
--   2. patient_profiles.doctor_id — cada paciente pertence a um médico
--   3. journey_state      — a jornada/gamificação da gestação salva NO PERFIL
--      da paciente (não mais só no localStorage do aparelho)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Perfil do médico assinante (id = uid no auth)
CREATE TABLE IF NOT EXISTS public.doctors (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   text        NOT NULL DEFAULT '',
  title          text        NOT NULL DEFAULT '',      -- ex.: "Ginecologista e Obstetra"
  specialty      text        NOT NULL DEFAULT '',      -- ex.: "Gestação de alto risco"
  crm            text        NOT NULL DEFAULT '',
  whatsapp       text        NOT NULL DEFAULT '',
  pix_key        text        NOT NULL DEFAULT '',
  slug           text        UNIQUE,                   -- ex.: "clovis-bacha" (URLs futuras)
  plan           text        NOT NULL DEFAULT 'trial', -- trial | pro | ...
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
-- O médico lê/edita o próprio perfil; escrita administrativa via service_role
DROP POLICY IF EXISTS "doctor reads own profile" ON public.doctors;
CREATE POLICY "doctor reads own profile" ON public.doctors
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "doctor updates own profile" ON public.doctors;
CREATE POLICY "doctor updates own profile" ON public.doctors
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
GRANT SELECT, UPDATE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;

-- 2. Cada paciente pertence a um médico (null = médico dono da instalação,
--    para compatibilidade com as contas existentes)
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patient_profiles_doctor
  ON public.patient_profiles(doctor_id);

-- 3. Jornada/gamificação da gestação POR PERFIL (blob versionado por updated_at;
--    o localStorage do aparelho vira apenas cache offline)
CREATE TABLE IF NOT EXISTS public.journey_state (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own journey" ON public.journey_state;
CREATE POLICY "own journey" ON public.journey_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_state TO authenticated;
GRANT ALL ON public.journey_state TO service_role;

-- updated_at SEMPRE do relógio do SERVIDOR: o last-write-wins entre aparelhos
-- não pode depender do relógio (possivelmente errado) de cada celular
CREATE OR REPLACE FUNCTION public.touch_journey_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_journey_touch ON public.journey_state;
CREATE TRIGGER trg_journey_touch
  BEFORE INSERT OR UPDATE ON public.journey_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_journey_updated_at();

-- 4. Resolução robusta de uid por e-mail (para achar o médico dono sem varrer
--    listUsers, que inclui todas as pacientes). SECURITY DEFINER, exposta só
--    ao service_role — as server functions chamam via supabaseAdmin.rpc.
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260707180000_second_brain.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- Segundo Cérebro — POR PERFIL DE MÉDICO
-- Base de conhecimento de cada médico (persona + Q&A reais) usada pela IA do
-- chatbot do site e do agente WhatsApp para responder como o próprio doutor.
-- Tabelas chaveadas por doctor_id (uid do médico no auth): cada perfil de
-- médico tem o SEU cérebro, com estilo e respostas próprios.
-- Acesso EXCLUSIVO via service_role (server functions com gate de admin) —
-- nenhuma policy para anon/authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

-- Transformação do shape antigo (linha única id=1), se houver de uma aplicação
-- anterior desta mesma migration — feature nunca lançada, sem dados a preservar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brain_settings' AND column_name = 'id'
  ) THEN
    DROP TABLE public.brain_settings;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brain_entries'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brain_entries' AND column_name = 'doctor_id'
  ) THEN
    DROP TABLE public.brain_entries;
  END IF;
END $$;

-- Configurações do cérebro de cada médico (uma linha por médico)
CREATE TABLE IF NOT EXISTS public.brain_settings (
  doctor_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Entradas de conhecimento (pergunta + resposta na voz do médico dono)
CREATE TABLE IF NOT EXISTS public.brain_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question   text        NOT NULL,
  answer     text        NOT NULL,
  category   text,
  source     text        NOT NULL DEFAULT 'manual',  -- manual | pergunta | import...
  approved   boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_entries_doctor_created
  ON public.brain_entries(doctor_id, created_at DESC);

ALTER TABLE public.brain_entries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_entries TO service_role;
REVOKE ALL ON public.brain_entries FROM anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260707200000_multi_tenant_core.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- NÚCLEO MULTI-TENANT — o app é uma plataforma para QUALQUER médico assinante
-- (não mais exclusivo do Dr. Clóvis). Três peças:
--   1. doctors            — o perfil de cada médico assinante
--   2. patient_profiles.doctor_id — cada paciente pertence a um médico
--   3. journey_state      — a jornada/gamificação da gestação salva NO PERFIL
--      da paciente (não mais só no localStorage do aparelho)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Perfil do médico assinante (id = uid no auth)
CREATE TABLE IF NOT EXISTS public.doctors (
  id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name   text        NOT NULL DEFAULT '',
  title          text        NOT NULL DEFAULT '',      -- ex.: "Ginecologista e Obstetra"
  specialty      text        NOT NULL DEFAULT '',      -- ex.: "Gestação de alto risco"
  crm            text        NOT NULL DEFAULT '',
  whatsapp       text        NOT NULL DEFAULT '',
  pix_key        text        NOT NULL DEFAULT '',
  slug           text        UNIQUE,                   -- ex.: "clovis-bacha" (URLs futuras)
  plan           text        NOT NULL DEFAULT 'trial', -- trial | pro | ...
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
-- O médico lê/edita o próprio perfil; escrita administrativa via service_role
DROP POLICY IF EXISTS "doctor reads own profile" ON public.doctors;
CREATE POLICY "doctor reads own profile" ON public.doctors
  FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "doctor updates own profile" ON public.doctors;
CREATE POLICY "doctor updates own profile" ON public.doctors
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
GRANT SELECT, UPDATE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;

-- 2. Cada paciente pertence a um médico (null = médico dono da instalação,
--    para compatibilidade com as contas existentes)
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_patient_profiles_doctor
  ON public.patient_profiles(doctor_id);

-- 3. Jornada/gamificação da gestação POR PERFIL (blob versionado por updated_at;
--    o localStorage do aparelho vira apenas cache offline)
CREATE TABLE IF NOT EXISTS public.journey_state (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own journey" ON public.journey_state;
CREATE POLICY "own journey" ON public.journey_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_state TO authenticated;
GRANT ALL ON public.journey_state TO service_role;

-- updated_at SEMPRE do relógio do SERVIDOR: o last-write-wins entre aparelhos
-- não pode depender do relógio (possivelmente errado) de cada celular
CREATE OR REPLACE FUNCTION public.touch_journey_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_journey_touch ON public.journey_state;
CREATE TRIGGER trg_journey_touch
  BEFORE INSERT OR UPDATE ON public.journey_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_journey_updated_at();

-- 4. Resolução robusta de uid por e-mail (para achar o médico dono sem varrer
--    listUsers, que inclui todas as pacientes). SECURITY DEFINER, exposta só
--    ao service_role — as server functions chamam via supabaseAdmin.rpc.
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260708120000_dashboard_brain_hits.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- brain_hits — telemetria do Segundo Cérebro para o dashboard do médico.
-- Cada linha registra um "acerto": um momento em que o cérebro do médico foi
-- realmente montado e injetado no prompt (chat do app ou agente WhatsApp).
-- Serve para o dashboard mostrar o VALOR do cérebro (quantas vezes ele
-- respondeu no mês). Acesso EXCLUSIVO via service_role (logging server-side) —
-- nenhuma policy para anon/authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brain_hits (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  uuid,
  channel    text        NOT NULL,  -- app | whatsapp | teste
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_hits_doctor_created
  ON public.brain_hits(doctor_id, created_at DESC);

ALTER TABLE public.brain_hits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_hits TO service_role;
REVOKE ALL ON public.brain_hits FROM anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260708130000_persistencia_paciente.sql
-- ═══════════════════════════════════════════════════════════════════════════
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
CREATE POLICY "Patient manages own triage logs"
  ON public.triage_logs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service manages triage logs"
  ON public.triage_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT ALL ON public.triage_logs TO authenticated, service_role;

-- 2. Flag de seed do checklist na conta (em vez de localStorage)
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS checklist_seeded boolean NOT NULL DEFAULT false;


-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: 20260709000000_patient_doctor_link.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- VÍNCULO PACIENTE ↔ MÉDICO (individual por conta)
--
-- Modelo: a paciente BUSCA o médico e ENVIA uma solicitação; o médico ACEITA,
-- e só então a paciente passa a pertencer a ele (patient_profiles.doctor_id).
-- Assim cada conta é individual: o chat/cérebro que a paciente usa no app é o
-- do SEU médico, e o médico só enxerga as pacientes que ele aceitou.
-- ─────────────────────────────────────────────────────────────────────────────

-- O médico pode se ocultar da busca (ex.: agenda cheia) sem ficar inativo.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS accepting_patients boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.patient_link_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  doctor_id   uuid        NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending',  -- pending | accepted | declined | cancelled
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  decided_at  timestamptz
);

-- No máximo UMA solicitação pendente por (paciente, médico).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_link_pending
  ON public.patient_link_requests(patient_id, doctor_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_link_doctor_pending
  ON public.patient_link_requests(doctor_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_link_patient
  ON public.patient_link_requests(patient_id);

ALTER TABLE public.patient_link_requests ENABLE ROW LEVEL SECURITY;

-- A paciente gerencia as próprias solicitações (criar, ver, cancelar).
DROP POLICY IF EXISTS "patient manages own requests" ON public.patient_link_requests;
CREATE POLICY "patient manages own requests" ON public.patient_link_requests
  FOR ALL USING (auth.uid() = patient_id) WITH CHECK (auth.uid() = patient_id);

-- O médico vê e responde as solicitações destinadas a ele.
DROP POLICY IF EXISTS "doctor reads incoming requests" ON public.patient_link_requests;
CREATE POLICY "doctor reads incoming requests" ON public.patient_link_requests
  FOR SELECT USING (auth.uid() = doctor_id);
DROP POLICY IF EXISTS "doctor updates incoming requests" ON public.patient_link_requests;
CREATE POLICY "doctor updates incoming requests" ON public.patient_link_requests
  FOR UPDATE USING (auth.uid() = doctor_id) WITH CHECK (auth.uid() = doctor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_link_requests TO authenticated;
GRANT ALL ON public.patient_link_requests TO service_role;

-- Busca de médicos pela paciente (nome/especialidade), sem expor toda a tabela
-- via RLS. SECURITY DEFINER, só campos públicos, só médicos ativos e visíveis.
CREATE OR REPLACE FUNCTION public.search_doctors(p_query text)
RETURNS TABLE (
  id           uuid,
  display_name text,
  title        text,
  specialty    text,
  slug         text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.display_name, d.title, d.specialty, d.slug
  FROM public.doctors d
  WHERE d.active = true
    AND d.accepting_patients = true
    AND d.display_name <> ''
    AND (
      p_query = ''
      OR d.display_name ILIKE '%' || p_query || '%'
      OR d.specialty   ILIKE '%' || p_query || '%'
      OR d.title       ILIKE '%' || p_query || '%'
    )
  ORDER BY d.display_name
  LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.search_doctors(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_doctors(text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLINDAGEM DO VÍNCULO: só o service_role (as server functions, após o médico
-- ACEITAR) pode gravar patient_profiles.doctor_id. A paciente edita o próprio
-- perfil pelo navegador (role `authenticated`, RLS "own profile update"), então
-- sem esta trava ela poderia se autovincular a QUALQUER médico via update direto
-- no Supabase — furando o fluxo de aprovação e puxando o cérebro pago dele.
--
-- IMPORTANTE: SECURITY INVOKER (padrão) — o gatilho precisa enxergar o papel
-- REAL de quem escreve (current_user). SECURITY DEFINER quebraria a checagem.
CREATE OR REPLACE FUNCTION public.protect_patient_doctor_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      -- A paciente nunca se vincula sozinha ao criar o perfil.
      NEW.doctor_id := NULL;
    ELSIF NEW.doctor_id IS DISTINCT FROM OLD.doctor_id THEN
      -- Nem troca/define o médico depois: mantém o valor definido pelo servidor.
      NEW.doctor_id := OLD.doctor_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_doctor_id ON public.patient_profiles;
CREATE TRIGGER trg_protect_doctor_id
  BEFORE INSERT OR UPDATE ON public.patient_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_patient_doctor_id();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-07-10 · Premium do quiz diário (aulas da professora)
-- Premium do quiz diário da paciente: grátis = só a aula do dia de hoje;
-- premium = revisitar/fazer qualquer aula já liberada quando quiser.
-- Ativação manual pelo médico no painel (pagamento via PIX, fluxo assistido).
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS quiz_premium boolean NOT NULL DEFAULT false;

-- SEGURANÇA: a paciente tem UPDATE no próprio perfil (RLS), então sem esta
-- proteção ela poderia se dar premium pelo console do navegador. Mesmo padrão
-- do doctor_id: colunas sensíveis só mudam via service role (servidor).
CREATE OR REPLACE FUNCTION public.protect_patient_doctor_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      -- A paciente nunca se vincula sozinha nem nasce premium.
      NEW.doctor_id := NULL;
      NEW.quiz_premium := false;
    ELSE
      IF NEW.doctor_id IS DISTINCT FROM OLD.doctor_id THEN
        NEW.doctor_id := OLD.doctor_id;
      END IF;
      IF NEW.quiz_premium IS DISTINCT FROM OLD.quiz_premium THEN
        NEW.quiz_premium := OLD.quiz_premium;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_doctor_id ON public.patient_profiles;
CREATE TRIGGER trg_protect_doctor_id
  BEFORE INSERT OR UPDATE ON public.patient_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_patient_doctor_id();

-- ════════════════════════════════════════════════════════════════════════
-- Assinaturas (Stripe) — pagou → acesso na hora (paciente premium + médico)
-- Idempotente; ver migração 20260711000000_subscriptions.sql
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL,
  product                text NOT NULL,
  plan                   text,
  source                 text NOT NULL DEFAULT 'stripe',
  status                 text NOT NULL DEFAULT 'incomplete',
  stripe_customer_id     text,
  stripe_subscription_id text UNIQUE,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON public.subscriptions(stripe_customer_id);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own subscriptions read" ON public.subscriptions;
CREATE POLICY "own subscriptions read" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
GRANT SELECT ON public.subscriptions TO authenticated;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
CREATE OR REPLACE FUNCTION public.touch_subscription_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_touch_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_touch_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- Diretório de médicos (busca) — ver 20260711020000_doctor_directory.sql
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS subspecialty text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS years_experience integer;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS has_masters boolean DEFAULT false;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS has_doctorate boolean DEFAULT false;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS accepting_patients boolean DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_doctors_directory
  ON public.doctors(active, accepting_patients, state);

-- ════════════════════════════════════════════════════════════════════════
-- Códigos de convite gerados na hora (uso único) — ver 20260711030000
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  doctor_id    uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  redeemed_by  uuid,
  redeemed_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_invite_codes_doctor_month
  ON public.invite_codes(doctor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doctor reads own codes" ON public.invite_codes;
CREATE POLICY "doctor reads own codes" ON public.invite_codes
  FOR SELECT USING (auth.uid() = doctor_id);
GRANT SELECT ON public.invite_codes TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Segurança: protege plan/active do médico (ver 20260713000000)
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.protect_doctor_billing()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan := 'trial';
      NEW.active := true;
      NEW.plan_expires_at := NULL;
    ELSE
      NEW.plan := OLD.plan;
      NEW.active := OLD.active;
      NEW.plan_expires_at := OLD.plan_expires_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_doctor_billing ON public.doctors;
CREATE TRIGGER trg_protect_doctor_billing
  BEFORE INSERT OR UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.protect_doctor_billing();

-- ════════════════════════════════════════════════════════════════════════
-- Multi-tenant: doctor_id nos registros (ver 20260713010000)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.appointment_requests  ADD COLUMN IF NOT EXISTS doctor_id uuid;
ALTER TABLE public.doctor_questions       ADD COLUMN IF NOT EXISTS doctor_id uuid;
ALTER TABLE public.preconsulta_forms      ADD COLUMN IF NOT EXISTS doctor_id uuid;
ALTER TABLE public.teleconsulta_sessions  ADD COLUMN IF NOT EXISTS doctor_id uuid;
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON public.appointment_requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_questions_doctor     ON public.doctor_questions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_preconsulta_doctor   ON public.preconsulta_forms(doctor_id);
CREATE INDEX IF NOT EXISTS idx_teleconsulta_doctor  ON public.teleconsulta_sessions(doctor_id);

-- ════════════════════════════════════════════════════════════════════════
-- Diretório seguro: médico verificado (ver 20260713020000)
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;

-- ════════════════════════════════════════════════════════════════════════
-- Busca de médicos (minha-conta) também respeita o selo (ver 20260713030000)
-- Re-define search_doctors AQUI, depois da coluna verified existir.
-- ════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.search_doctors(p_query text)
RETURNS TABLE (
  id           uuid,
  display_name text,
  title        text,
  specialty    text,
  slug         text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.display_name, d.title, d.specialty, d.slug
  FROM public.doctors d
  WHERE d.active = true
    AND d.accepting_patients = true
    AND d.verified = true
    AND d.display_name <> ''
    AND (
      p_query = ''
      OR d.display_name ILIKE '%' || p_query || '%'
      OR d.specialty   ILIKE '%' || p_query || '%'
      OR d.title       ILIKE '%' || p_query || '%'
    )
  ORDER BY d.display_name
  LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.search_doctors(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_doctors(text) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════
-- Google Agenda por médico (nível 2) — token seguro (ver 20260713040000)
-- Refresh token é segredo: RLS ligada + zero policies = só service_role.
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.doctor_google_tokens (
  user_id       uuid PRIMARY KEY,
  refresh_token text NOT NULL,
  google_email  text,
  connected_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.doctor_google_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.doctor_google_tokens FROM anon, authenticated;
