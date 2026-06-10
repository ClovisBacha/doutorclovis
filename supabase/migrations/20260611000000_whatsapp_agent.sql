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
