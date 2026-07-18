-- Crescimento: afiliados (influenciadores) + convite do médico pela paciente.
--
-- affiliates          — códigos de influenciador (permuta): quem assina o
--                       Premium vindo do link/código gera 50% de comissão.
-- affiliate_earnings  — livro-razão: 1 linha por FATURA PAGA no Stripe
--                       (recorrente de verdade; único por código+fatura).
-- patient_profiles    — ref_code (afiliado que trouxe a paciente) e
--                       invite_code (código pessoal para convidar o médico).
-- doctors             — invited_by_patient (paciente que convidou; dá +15% no
--                       checkout) e invited_reward_given (Premium da paciente
--                       liberado uma única vez, quando o médico assina).

CREATE TABLE IF NOT EXISTS public.affiliates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text NOT NULL UNIQUE,
  name           text NOT NULL,
  commission_pct int  NOT NULL DEFAULT 50,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_earnings (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_code         text NOT NULL,
  user_id                uuid,
  stripe_invoice_id      text NOT NULL,
  amount_paid_cents      int  NOT NULL DEFAULT 0,
  commission_cents       int  NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (affiliate_code, stripe_invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_aff_earnings_code ON public.affiliate_earnings(affiliate_code);

ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS ref_code text;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS invite_code text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_invite_code
  ON public.patient_profiles(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patient_ref_code ON public.patient_profiles(ref_code);

ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS invited_by_patient uuid;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS invited_reward_given boolean NOT NULL DEFAULT false;

-- Server-only (todo o fluxo passa por service_role no backend)
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_earnings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.affiliates FROM anon, authenticated;
REVOKE ALL ON public.affiliate_earnings FROM anon, authenticated;
GRANT ALL ON public.affiliates TO service_role;
GRANT ALL ON public.affiliate_earnings TO service_role;

-- Proteção: os campos de convite/atribuição não são graváveis pelo cliente
-- (mesmo padrão do protect_doctor_billing para clinic_id/clinic_role).
CREATE OR REPLACE FUNCTION public.protect_doctor_billing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan := 'trial';
      NEW.active := true;
      NEW.plan_expires_at := NULL;
      NEW.clinic_id := NULL;
      NEW.clinic_role := 'member';
      NEW.invited_by_patient := NULL;
      NEW.invited_reward_given := false;
    ELSE
      NEW.plan := OLD.plan;
      NEW.active := OLD.active;
      NEW.plan_expires_at := OLD.plan_expires_at;
      NEW.clinic_id := OLD.clinic_id;
      NEW.clinic_role := OLD.clinic_role;
      NEW.invited_by_patient := OLD.invited_by_patient;
      NEW.invited_reward_given := OLD.invited_reward_given;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_doctor_billing ON public.doctors;
CREATE TRIGGER trg_protect_doctor_billing
  BEFORE INSERT OR UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.protect_doctor_billing();
