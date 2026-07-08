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
