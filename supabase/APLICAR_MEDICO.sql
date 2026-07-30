-- ============================================================================
-- CADASTRO DO MEDICO  (aplicar no SQL Editor do Supabase)
-- ============================================================================
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

-- ============================================================================
-- Cadastro do médico: o que faltava para o app funcionar de verdade
-- ============================================================================
-- Cada coluna aqui existe porque alguma tela do app precisa dela e hoje se
-- vira com um substituto ruim.
-- ============================================================================

-- ── 1. Dois telefones, com papéis diferentes ────────────────────────────────
-- `whatsapp` continua sendo o número DAS PACIENTES: é o que aparece no SOS, na
-- carteirinha de emergência e no botão de WhatsApp do app. Um médico costuma
-- ter dois números, e misturá-los num campo só significa ou expor o pessoal ou
-- não ter para onde ligar numa emergência.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS personal_phone text;

COMMENT ON COLUMN public.doctors.whatsapp IS
  'Telefone/WhatsApp PARA PACIENTES — aparece no SOS e na carteirinha. Obrigatório.';
COMMENT ON COLUMN public.doctors.personal_phone IS
  'Telefone pessoal do médico. NUNCA é mostrado à paciente; serve para a plataforma falar com ele.';

-- ── 2. Convênio ou particular ───────────────────────────────────────────────
-- `insurances` (texto livre) já existia, mas não respondia a pergunta que a
-- paciente faz primeiro: "ele aceita o meu plano ou é particular?". Sem um
-- booleano, a busca não consegue filtrar e a lista de convênios em branco é
-- ambígua — pode significar "só particular" ou "ainda não preencheu".
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS accepts_insurance boolean NOT NULL DEFAULT false;
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS accepts_private   boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.doctors.accepts_insurance IS
  'Atende por convênio. Quando true, `insurances` lista quais.';
COMMENT ON COLUMN public.doctors.accepts_private IS
  'Atende particular. Quando true, `consultation_price_brl` é o valor da consulta.';

-- ── 3. Endereços do consultório (vários) ────────────────────────────────────
-- Tabela e não coluna: médico com dois consultórios é a regra, não a exceção,
-- e a paciente precisa ver o endereço mais perto dela — o que exige uma linha
-- por endereço, com cidade e coordenada próprias.
CREATE TABLE IF NOT EXISTS public.doctor_addresses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid        NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  label       text        NOT NULL DEFAULT '',   -- "Consultório Savassi", "Hospital Vila da Serra"
  street      text        NOT NULL DEFAULT '',
  city        text        NOT NULL DEFAULT '',
  state       text        NOT NULL DEFAULT '',
  zip         text        NOT NULL DEFAULT '',
  phone       text        NOT NULL DEFAULT '',   -- telefone daquele endereço (secretaria)
  notes       text        NOT NULL DEFAULT '',   -- "3º andar, sala 302"
  lat         double precision,
  lon         double precision,
  is_primary  boolean     NOT NULL DEFAULT false,
  position    smallint    NOT NULL DEFAULT 0,    -- ordem escolhida pelo médico
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_addresses_doctor
  ON public.doctor_addresses(doctor_id, position);

ALTER TABLE public.doctor_addresses ENABLE ROW LEVEL SECURITY;

-- O médico administra os próprios endereços.
DROP POLICY IF EXISTS "doctor manages own addresses" ON public.doctor_addresses;
CREATE POLICY "doctor manages own addresses" ON public.doctor_addresses
  FOR ALL USING (auth.uid() = doctor_id) WITH CHECK (auth.uid() = doctor_id);

-- Qualquer pessoa logada LÊ os endereços de médicos ativos: a paciente precisa
-- ver onde o médico atende antes de escolher, e depois para ir à consulta.
DROP POLICY IF EXISTS "authenticated reads active doctor addresses" ON public.doctor_addresses;
CREATE POLICY "authenticated reads active doctor addresses" ON public.doctor_addresses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.active));

GRANT ALL    ON public.doctor_addresses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_addresses TO authenticated;

-- ── 4. NÃO tem coluna de papel, e isto é de propósito ───────────────────────
-- O bug de o médico ser tratado como gestante (o app pedindo o nome do bebê a
-- quem começou o cadastro e não terminou) é resolvido SEM banco: o papel é
-- gravado no `user_metadata` do próprio Supabase Auth no primeiro passo do
-- cadastro, antes de existir perfil algum. Uma coluna exigiria uma linha em
-- `patient_profiles` para um médico — exatamente o registro que não deveria
-- existir para ele.
--
-- Vale notar que essa marca só RESTRINGE: ela tira o acesso ao app da
-- gestante, nunca dá acesso ao painel. Quem manda no painel continua sendo a
-- linha em `public.doctors` com `active = true`, que só o servidor escreve.

-- ── 5. O gatilho que criava conta de gestante para o médico ─────────────────
-- Esta é a causa-raiz do bug relatado: "o médico se cadastrou e o app começou
-- a pedir o nome do bebê".
--
-- `handle_new_patient` roda em CADA inserção em `auth.users` e cria uma linha
-- em `patient_profiles` — inclusive para quem está se cadastrando como médico.
-- A linha nasce sem âncora de gestação, e o app, vendo um perfil de gestante
-- sem data, abre o ritual de boas-vindas pedindo o nome do bebê a um obstetra.
--
-- Agora o gatilho pula quem chega marcado como médico. A marca é gravada pelo
-- próprio formulário de cadastro, no `raw_user_meta_data`, antes de existir
-- qualquer perfil — então ela já está lá quando este gatilho dispara.
CREATE OR REPLACE FUNCTION public.handle_new_patient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Médico não é paciente: sem perfil de gestante, sem ritual do bebê.
  IF COALESCE(NEW.raw_user_meta_data->>'role', '') = 'doctor' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.patient_profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 6. Limpeza das contas de médico que já ganharam perfil de gestante ──────
-- Quem se cadastrou antes desta correção tem uma linha órfã em
-- `patient_profiles`. Apagar é seguro: só remove a de quem TEM perfil de
-- médico e cujo perfil de gestante está vazio (sem âncora de gestação, sem
-- nome de bebê). Uma conta que de fato usou o app da gestante não é tocada.
DELETE FROM public.patient_profiles p
WHERE EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = p.id)
  AND p.lmp_date IS NULL
  AND p.due_date IS NULL
  AND p.reference_date IS NULL
  AND (p.baby_name IS NULL OR p.baby_name = '');
