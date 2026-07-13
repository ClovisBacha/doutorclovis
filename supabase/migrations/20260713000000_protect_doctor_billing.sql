-- ════════════════════════════════════════════════════════════════════════
-- Segurança: protege os campos de cobrança do médico contra auto-promoção
-- ════════════════════════════════════════════════════════════════════════
-- A tabela doctors tem RLS UPDATE do próprio dono + GRANT UPDATE a
-- authenticated. Sem isto, qualquer médico logado poderia, pelo console do
-- navegador, dar UPDATE em `plan`/`active` e virar Black de graça, contornando
-- todo o pagamento. Espelha a proteção que já existe para patient_profiles:
-- só o service_role (webhook do Stripe, registerDoctor, admin) muda esses
-- campos; o cliente authenticated nunca.

CREATE OR REPLACE FUNCTION public.protect_doctor_billing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      -- Ninguém nasce pago: novo médico entra sempre em trial/ativo.
      NEW.plan := 'trial';
      NEW.active := true;
      NEW.plan_expires_at := NULL;
    ELSE
      -- Nem muda depois pela mão: mantém o que o servidor definiu.
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
