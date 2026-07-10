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
