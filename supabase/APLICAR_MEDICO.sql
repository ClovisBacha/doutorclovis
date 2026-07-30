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

-- ============================================================================
-- doctors: as colunas que o código já lê e o banco nunca teve
-- ============================================================================
-- `doctors` nasceu com 12 colunas em 20260707200000. Desde então o código
-- passou a ler 20 colunas a mais — perfil rico, valor da consulta, convênios,
-- formação, selo de verificado, validade do plano — e um comentário citava uma
-- migração "20260717030000" que não existe neste repositório.
--
-- Por que ninguém notou: `doctors.functions.ts` trata o erro 42703 (coluna
-- inexistente) refazendo a consulta só com as colunas básicas. Isso salvou o
-- app de quebrar, mas transformou metade do cadastro do médico em campo que
-- some ao salvar. É exatamente o caso de "aceita convênio", "valor da consulta"
-- e "formações": o médico preenche, a tela agradece, e o dado não existe.
--
-- Aqui as colunas passam a existir. Tudo `IF NOT EXISTS` e com default, então
-- rodar em banco que já tenha alguma delas é inofensivo.
-- ============================================================================

-- ── 1. Perfil profissional ──────────────────────────────────────────────────
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS bio              text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subspecialty     text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS has_masters      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_doctorate    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS city             text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS state            text    NOT NULL DEFAULT '';

COMMENT ON COLUMN public.doctors.state IS
  'UF onde o médico atende (2 letras). Usada na busca por proximidade.';

-- ── 2. O que a paciente pergunta antes de escolher ──────────────────────────
-- Ordem das perguntas reais: "onde ele atende", "aceita meu convênio",
-- "quanto custa", "ele é formado onde". Cada uma tem sua coluna.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS instagram             text,
  ADD COLUMN IF NOT EXISTS rqe                   text,
  ADD COLUMN IF NOT EXISTS education             text,
  ADD COLUMN IF NOT EXISTS hospitals             text,
  ADD COLUMN IF NOT EXISTS insurances            text,
  ADD COLUMN IF NOT EXISTS languages             text,
  ADD COLUMN IF NOT EXISTS approach              text,
  ADD COLUMN IF NOT EXISTS consultation_price_brl integer,
  ADD COLUMN IF NOT EXISTS offers_telehealth     boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.doctors.education IS
  'Formações e títulos, texto livre com uma linha por item. Obrigatório no cadastro.';
COMMENT ON COLUMN public.doctors.insurances IS
  'Quais convênios ele aceita. Só faz sentido quando accepts_insurance = true.';
COMMENT ON COLUMN public.doctors.consultation_price_brl IS
  'Valor da consulta particular em REAIS (inteiro, não centavos). Obrigatório quando accepts_private = true.';
COMMENT ON COLUMN public.doctors.rqe IS
  'Registro de Qualificação de Especialista. Complementar: nem todo CRM tem RQE emitido.';

-- ── 3. Plano e selo ─────────────────────────────────────────────────────────
-- `plan_expires_at` é o que faz o trial de 14 dias terminar de verdade: sem a
-- coluna, `planoValido()` tratava todo trial como eterno.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified        boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.doctors.verified IS
  'Selo de conferido pela plataforma. NÃO é pré-requisito para aparecer na busca — só ordena melhor.';

-- ── 4. Busca da paciente ────────────────────────────────────────────────────
-- A consulta da busca é sempre a mesma forma: filtra `active` e
-- `accepting_patients`, e ordena por `display_name` antes do LIMIT. Este índice
-- cobre os três na ordem certa, então o Postgres não precisa ordenar depois de
-- filtrar. `idx_doctors_directory` já cobre o filtro por UF.
--
-- Não indexamos `plan`: o ranking por plano acontece em JavaScript, sobre a
-- lista já recortada — um índice ali seria peso morto para escrita.
CREATE INDEX IF NOT EXISTS idx_doctors_busca_nome
  ON public.doctors(active, accepting_patients, display_name);

-- Versão anterior deste arquivo criava um índice em (active, accepting_patients,
-- plan). Removido: `plan` nunca entra no WHERE, então era peso morto na escrita.
DROP INDEX IF EXISTS public.idx_doctors_busca;


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
--
-- O `EXISTS (SELECT ... FROM doctors)` direto NÃO funciona aqui, e isso não é
-- óbvio: a subconsulta roda com os direitos de quem pergunta, e `doctors` tem
-- RLS que só deixa cada um ver a PRÓPRIA linha. Resultado: para a paciente o
-- EXISTS era sempre falso e ela via ZERO endereços — a política existia e não
-- concedia nada. (Testado num Postgres 16 de verdade: `SET ROLE authenticated`
-- + uid da médica A devolvia 1 endereço, o dela, em vez dos dois ativos.)
--
-- A função abaixo é SECURITY DEFINER só para responder "esse médico está
-- ativo?" — nada mais sai dela, então não vaza dado de médico nenhum.
CREATE OR REPLACE FUNCTION public.doctor_is_active(p_doctor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = p_doctor AND d.active);
$fn$;

REVOKE ALL     ON FUNCTION public.doctor_is_active(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.doctor_is_active(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "authenticated reads active doctor addresses" ON public.doctor_addresses;
CREATE POLICY "authenticated reads active doctor addresses" ON public.doctor_addresses
  FOR SELECT TO authenticated
  USING (public.doctor_is_active(doctor_id));

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

-- ── 7. A agenda global que qualquer pessoa logada podia reescrever ──────────
-- `doctor_availability` e `blocked_dates` nasceram single-tenant: sem coluna
-- `doctor_id`, com uma linha por dia da semana para o consultório inteiro, e
-- com a política `FOR ALL USING (auth.role() = 'authenticated')`.
--
-- Numa plataforma com vários médicos isso significa duas coisas graves: a
-- agenda de um é a agenda de todos, e QUALQUER pessoa logada — inclusive uma
-- paciente — pode apagar as férias e reescrever os horários do consultório.
--
-- A correção mínima e segura é fechar a escrita: nenhum cliente escreve
-- direto; só o `service_role`, através de server functions que sabem de quem é
-- a agenda. A leitura pública continua (a tela de agendamento precisa dela).
--
-- Não adicionamos `doctor_id` aqui de propósito: nada em `src/` lê estas
-- tabelas hoje (a aba que as usava não está no menu), então uma coluna nova
-- seria esquema morto. Quando a agenda por médico for construída, ela nasce
-- com a coluna e com política própria.
-- Guardado em DO porque DROP POLICY e REVOKE nao tem "IF EXISTS" de tabela:
-- num banco sem a migracao de agenda, as duas linhas abaixo abortariam o
-- arquivo inteiro no meio.
DO $guard$
BEGIN
  IF to_regclass('public.doctor_availability') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "auth_write_availability" ON public.doctor_availability';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.doctor_availability FROM authenticated';
  END IF;
  IF to_regclass('public.blocked_dates') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "auth_write_blocked" ON public.blocked_dates';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.blocked_dates FROM authenticated';
  END IF;
END
$guard$;

-- ── 8. A linha que guarda o painel era editável pelo navegador ───────────────
-- `20260707200000` fez `GRANT SELECT, UPDATE ON public.doctors TO authenticated`
-- SEM lista de colunas, e a política de RLS só confere `auth.uid() = id`. Junto,
-- isso significa que o próprio médico podia escrever `plan`, `plan_expires_at`,
-- `verified` e `active` — exatamente as colunas que `entitlements.server.ts` lê
-- como fonte de verdade do que ele pagou.
--
-- Na prática: qualquer pessoa cria um perfil de médico (não há verificação de
-- CRM), abre o console do navegador e roda
--   supabase.from('doctors').update({plan:'clinica', verified:true}).eq('id', uid)
-- ganhando painel pago completo e o selo de verificado na busca, de graça e para
-- sempre. As server functions nunca deixaram isso passar (`ProfileSchema` não
-- tem esses campos) — o buraco era o GRANT, não o código.
--
-- A correção é cirúrgica: o médico continua editando o PERFIL dele pelo cliente;
-- plano, selo e status só pelo service_role.
REVOKE UPDATE ON public.doctors FROM authenticated;

GRANT UPDATE (
  display_name, title, specialty, crm, whatsapp, personal_phone, pix_key,
  bio, subspecialty, years_experience, has_masters, has_doctorate,
  city, state, accepting_patients,
  instagram, rqe, education, hospitals, insurances, languages, approach,
  consultation_price_brl, offers_telehealth,
  accepts_insurance, accepts_private,
  updated_at
) ON public.doctors TO authenticated;

COMMENT ON COLUMN public.doctors.plan IS
  'Plano do medico. NAO editavel pelo cliente: so service_role (checkout/webhook).';
COMMENT ON COLUMN public.doctors.active IS
  'Perfil ativo. NAO editavel pelo cliente: so service_role.';

-- ── 9. O trial que nunca acabava ────────────────────────────────────────────
-- `entitlements.server` só rebaixa um trial quando `plan_expires_at` tem data.
-- Como a coluna acabou de nascer (secao 3), TODO medico cadastrado antes disto
-- tem `plan='trial'` com `plan_expires_at = NULL` — ou seja, plano Pro eterno:
-- 150 pacientes, IA no app e no WhatsApp, e primeiro lugar na busca, para
-- sempre, sem pagar. O mesmo vale para qualquer linha criada enquanto a coluna
-- nao existia.
--
-- O backfill da 14 dias contados do CADASTRO, nao de hoje: e o prazo que ele
-- teria tido se a coluna existisse desde o inicio. Quem se cadastrou ha mais de
-- 14 dias ja entra vencido, o que e a resposta correta — ele usou o teste.
-- O backfill precisa passar por cima do `trg_protect_doctor_billing`
-- (APLICAR_PENDENTES), que reverte qualquer escrita em `plan_expires_at` feita
-- por quem nao e `service_role`. No SQL Editor do Supabase `current_user` e
-- `postgres`, nao `service_role` — ou seja, sem desligar o gatilho este UPDATE
-- diria "UPDATE 3" e nao mudaria nada. (Foi exatamente o que aconteceu quando
-- testei num Postgres local: sucesso reportado, zero efeito.)
DO $trial$
DECLARE
  tem_guard boolean := EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.doctors'::regclass
       AND tgname  = 'trg_protect_doctor_billing'
       AND NOT tgisinternal
  );
BEGIN
  IF tem_guard THEN
    ALTER TABLE public.doctors DISABLE TRIGGER trg_protect_doctor_billing;
  END IF;

  UPDATE public.doctors
     SET plan_expires_at = created_at + interval '14 days'
   WHERE plan = 'trial'
     AND plan_expires_at IS NULL;

  IF tem_guard THEN
    ALTER TABLE public.doctors ENABLE TRIGGER trg_protect_doctor_billing;
  END IF;
END
$trial$;
