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
-- ATENCAO: UPDATE nao e mais concedido na tabela inteira.
--
-- Um `GRANT UPDATE ON public.doctors` sem lista de colunas deixa o proprio
-- medico escrever `plan`, `plan_expires_at`, `verified` e `active` — as colunas
-- que `entitlements.server.ts` le como fonte de verdade do que ele pagou. Com
-- uma linha no console do navegador ele viraria plano Black e ganharia o selo da
-- plataforma. O gatilho `protect_doctor_billing` cobre plan/active/expires, mas
-- NAO cobre `verified`; o grant por coluna cobre os quatro.
--
-- Concedido em bloco tolerante porque, neste ponto do arquivo, algumas colunas
-- do perfil podem ainda nao existir — a lista real e filtrada pelo catalogo.
GRANT SELECT ON public.doctors TO authenticated;
DO $grant_doctors$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'doctors'
     AND column_name IN (
       'display_name','title','specialty','crm','whatsapp','personal_phone','pix_key',
       'bio','subspecialty','years_experience','has_masters','has_doctorate',
       'city','state','accepting_patients',
       'instagram','rqe','education','hospitals','insurances','languages','approach',
       'consultation_price_brl','offers_telehealth',
       'accepts_insurance','accepts_private','updated_at'
     );
  EXECUTE 'REVOKE UPDATE ON public.doctors FROM authenticated';
  IF cols IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.doctors TO authenticated', cols);
  END IF;
END
$grant_doctors$;
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
