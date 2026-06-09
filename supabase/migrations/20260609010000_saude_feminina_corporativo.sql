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
CREATE POLICY "Authenticated can read active accounts for validation"
  ON public.corporate_accounts FOR SELECT TO authenticated
  USING (status = 'ativo');
CREATE POLICY "Service manages corporate accounts"
  ON public.corporate_accounts FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT SELECT ON public.corporate_accounts TO authenticated;
GRANT ALL ON public.corporate_accounts TO service_role;

-- Link patients to corporate accounts
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS corporate_account_id uuid REFERENCES public.corporate_accounts(id);
