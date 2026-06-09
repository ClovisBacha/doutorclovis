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
