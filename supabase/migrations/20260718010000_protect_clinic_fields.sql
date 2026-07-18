-- ════════════════════════════════════════════════════════════════════════
-- Segurança (plano Clínica): clinic_id/clinic_role só mudam via service_role
-- ════════════════════════════════════════════════════════════════════════
-- doctors tem RLS UPDATE do próprio dono + GRANT UPDATE a authenticated.
-- clinic_id/clinic_role são a BASE da autorização do plano Clínica
-- (resolveBrainDoctor, adminClinicOf, herança de plano). Sem isto, um médico
-- logado poderia, pelo console do navegador: virar admin da própria clínica
-- (clinic_role='admin' → operar o cérebro dos colegas), "entrar" numa clínica
-- alheia (clinic_id de terceiro → cérebros de outro inquilino + plano Clínica
-- de graça). Estende o trigger de billing para congelar também esses campos.

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
      -- E ninguém nasce dentro de uma clínica por conta própria.
      NEW.clinic_id := NULL;
      NEW.clinic_role := 'member';
    ELSE
      -- Nem muda depois pela mão: mantém o que o servidor definiu.
      NEW.plan := OLD.plan;
      NEW.active := OLD.active;
      NEW.plan_expires_at := OLD.plan_expires_at;
      NEW.clinic_id := OLD.clinic_id;
      NEW.clinic_role := OLD.clinic_role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_doctor_billing ON public.doctors;
CREATE TRIGGER trg_protect_doctor_billing
  BEFORE INSERT OR UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.protect_doctor_billing();
