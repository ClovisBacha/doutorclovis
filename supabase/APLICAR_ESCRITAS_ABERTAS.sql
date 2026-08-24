-- ============================================================================
-- APLICAR NO SQL EDITOR DO SUPABASE — URGENTE
-- ============================================================================
-- Idempotente. Fecha tres escritas que uma auditoria EXPLOROU com curl:
--
--   1. a paciente reescrevia a propria nota clinica (e o link da sala)
--   2. a paciente marcava a propria consulta de R$ 280 como PAGA
--   3. um anonimo bloqueava a agenda inteira de qualquer medico por um ano
--   4. a paciente apagava o proprio acionamento de SOS
-- ============================================================================

-- ============================================================================
-- TRÊS ESCRITAS ABERTAS QUE UMA AUDITORIA EXPLOROU COM `curl`
-- ============================================================================
--
-- Este produto já tem o padrão certo em dois lugares: `doctor_orders` concede
-- UPDATE de UMA coluna (`cumprido_em`), e `patient_profiles` usa um gatilho que
-- reverte o que não é do dono. Três tabelas ficaram fora dos dois — e a
-- auditoria executou os três ataques em Postgres real.
--
-- O padrão da falha é sempre o mesmo: a policy diz uma coisa no NOME
-- ("Patients can update only patient_notes") e o GRANT concede a tabela
-- inteira. A policy governa QUAIS LINHAS; o grant governa QUAIS COLUNAS. Sem os
-- dois, o comentário vira ficção.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. A PACIENTE REESCREVIA A PRÓPRIA NOTA CLÍNICA
--
--   UPDATE teleconsulta_sessions
--      SET clinical_note = 'APAGADO PELA PACIENTE',
--          doctor_notes  = 'medica disse que esta tudo bem',
--          status        = 'encerrada',
--          meet_url      = 'https://evil.example/phish'
--    WHERE id = '<a sessão dela>';
--   → UPDATE 1
--
-- Ela não alcança a sessão de outra (o `WITH CHECK` barra), mas dentro da
-- própria linha reescrevia o prontuário, o link da sala e o status. Isso é
-- adulteração de registro clínico feita pelo paciente — e o link da sala
-- apontando para fora é phishing com a marca do produto.
-- ────────────────────────────────────────────────────────────────────────────
DO $tele$
BEGIN
  IF to_regclass('public.teleconsulta_sessions') IS NULL THEN RETURN; END IF;

  REVOKE UPDATE ON public.teleconsulta_sessions FROM authenticated;
  /* SÓ a coluna que é dela. É o que a policy sempre disse fazer. */
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'teleconsulta_sessions'
       AND column_name = 'patient_notes'
  ) THEN
    GRANT UPDATE (patient_notes) ON public.teleconsulta_sessions TO authenticated;
  END IF;
END
$tele$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. A PACIENTE MARCAVA A PRÓPRIA CONSULTA COMO PAGA
--
--   UPDATE private_consultations
--      SET status = 'confirmado', amount_cents = 0, mp_payment_id = 'falso'
--    WHERE id = '<a consulta dela>';
--   → status = confirmado, amount_cents = 0
--
-- E `getPrivateConsultationsForDoctor` lê exatamente esse `status`: a consulta
-- de R$ 280 aparecia paga no painel do médico. As funções de servidor
-- (`markPaymentSent`, `confirmPaymentForDoctor`) são cuidadosas e eram
-- inteiramente contornáveis — o PostgREST era a porta dos fundos.
--
-- A paciente não precisa de UPDATE nenhum nesta tabela: quem confirma pagamento
-- é o webhook (service_role) ou o médico. O que ela faz é criar o pedido.
-- ────────────────────────────────────────────────────────────────────────────
DO $priv$
BEGIN
  IF to_regclass('public.private_consultations') IS NULL THEN RETURN; END IF;
  REVOKE UPDATE ON public.private_consultations FROM authenticated;
END
$priv$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. UM ANÔNIMO DESLIGAVA A AGENDA DE QUALQUER MÉDICO POR UM ANO
--
-- `Anyone can request an appointment` é `FOR INSERT TO anon WITH CHECK (true)`
-- — sem restrição de `status`. Combinada com o índice único de slot
-- (`appt_confirmed_slot`), um insert anônimo com `status='confirmed'` OCUPA o
-- horário permanentemente. A auditoria bloqueou 2.928 horários com a chave anon
-- que está no bundle do navegador, e depois disso nem o `service_role`
-- conseguia confirmar uma paciente real:
--
--   ERROR: duplicate key value violates unique constraint "appt_confirmed_slot"
--
-- Nenhum fluxo legítimo insere `confirmed` por aqui: a confirmação é feita pelo
-- médico e a oferta da fila de espera é escrita por `service_role`, que ignora
-- RLS.
-- ────────────────────────────────────────────────────────────────────────────
DO $appt$
BEGIN
  IF to_regclass('public.appointment_requests') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Anyone can request an appointment" ON public.appointment_requests;
  CREATE POLICY "Anyone can request an appointment" ON public.appointment_requests
    FOR INSERT TO anon, authenticated
    WITH CHECK (
      status = 'pending'
      AND confirmed_date IS NULL
      AND confirmed_time IS NULL
    );
END
$appt$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. A PACIENTE APAGAVA O PRÓPRIO ACIONAMENTO DE SOS
--
-- A policy é `FOR ALL` com grant de todas as colunas: ela marcava
-- `atendido_em` (e a emergência VIVA sumia da tela do médico, que filtra por
-- `atendido_em IS NULL`) ou simplesmente apagava a linha.
--
-- O comentário do código diz que o evento é "congelado" e "não pode mudar
-- junto". No banco, podia. Ela continua criando e lendo os próprios eventos —
-- o que muda é que o desfecho é do médico.
-- ────────────────────────────────────────────────────────────────────────────
DO $panic$
BEGIN
  IF to_regclass('public.panic_events') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "Patient manages own panic events" ON public.panic_events;
  /* `DROP ... IF EXISTS` antes de cada `CREATE`, e NENHUM bloco `EXCEPTION`.

     A primeira versão disto tinha `EXCEPTION WHEN duplicate_object THEN NULL`
     para tolerar reexecução — e o efeito foi o oposto do pretendido: na segunda
     rodada o `CREATE POLICY` levantava a exceção, o bloco inteiro era abortado,
     e o `REVOKE` no fim NUNCA rodava. O teste mostrou a paciente ainda apagando
     o próprio acionamento de SOS depois de a migration ter aplicado "com
     sucesso". Um `EXCEPTION` que engole erro esperado também engole o trabalho
     que vinha depois dele. */
  DROP POLICY IF EXISTS "paciente cria o proprio acionamento" ON public.panic_events;
  CREATE POLICY "paciente cria o proprio acionamento" ON public.panic_events
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "paciente le os proprios acionamentos" ON public.panic_events;
  CREATE POLICY "paciente le os proprios acionamentos" ON public.panic_events
    FOR SELECT TO authenticated USING (user_id = auth.uid());
END
$panic$;

/* Fora do bloco, para não depender de nada acima ter dado certo. */
DO $revoga$
BEGIN
  IF to_regclass('public.panic_events') IS NULL THEN RETURN; END IF;
  REVOKE UPDATE, DELETE ON public.panic_events FROM anon, authenticated;
END
$revoga$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. O ÍNDICE DA TRILHA DE AUDITORIA (pega carona aqui para você não ter que
--    abrir mais um arquivo)
--
-- `audit_log` passou a registrar acesso clínico: quem abriu o prontuário, a
-- ficha, o laudo, quem emitiu receita e quem encerrou o acompanhamento. A
-- consulta que responde "quem abriu a ficha da paciente X" filtra por `target`
-- — que não tinha índice nenhum. Sem isto, a tabela que mais cresce no banco é
-- varrida inteira a cada pergunta, e a trilha custa sem servir.
-- ────────────────────────────────────────────────────────────────────────────
DO $trilha$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN RETURN; END IF;
  CREATE INDEX IF NOT EXISTS idx_audit_target
    ON public.audit_log (target, created_at DESC);
END
$trilha$;

-- ############################################################################
-- PARTE 2 — AS COLUNAS QUE SÓ O SERVIDOR PODE ESCREVER
--
-- Segunda auditoria, mesma técnica: nove ataques executados em Postgres 16
-- com as 63 migrations aplicadas. Vai junto neste arquivo para você não ter
-- que abrir mais um. Idempotente — pode rodar de novo sem medo.
-- ############################################################################

-- ============================================================================
-- AS COLUNAS QUE SÓ O SERVIDOR PODE ESCREVER
-- ============================================================================
--
-- Nove ataques executados em Postgres 16 com o schema real (63 migrations
-- aplicadas em ordem). Todos com a chave anon que está no bundle do navegador.
-- O padrão é sempre o mesmo, e é o mesmo da migration 20260731060000: onde a
-- régua mora numa server function, o PostgREST é a porta dos fundos. A policy
-- escolhe a LINHA; o GRANT tem que escolher a COLUNA; e INSERT e DELETE
-- precisam do mesmo cuidado que o UPDATE ganhou.
--
-- Duas técnicas, escolhidas por caso:
--
--   · GATILHO, quando a paciente edita legitimamente a MESMA tabela e enumerar
--     as colunas dela seria frágil (`patient_profiles` tem dezenas, e uma
--     esquecida quebra o Perfil dela em silêncio). É o que
--     `trg_protect_doctor_id` já faz desde 09/07 — aqui ele só passa a guardar
--     mais quatro colunas.
--   · GRANT/REVOKE, quando o navegador não escreve a tabela (ou escreve uma
--     coluna só). Mais barato e mais explícito.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. A PACIENTE SE DAVA O PRODUTO PAGO
--
--   UPDATE patient_profiles SET quiz_premium = true WHERE id = auth.uid();
--   → UPDATE 1   (antes: f · depois: t)
--
-- `quiz_premium` é o produto do Stripe (`quiz_premium:monthly/annual`), gravado
-- pelo webhook e por `invites.functions.ts` — os dois com `service_role`. O
-- paywall lê `profile?.quiz_premium` direto da linha. Uma linha de console do
-- navegador liberava a assinatura para sempre.
--
-- Junto vêm outras três da mesma natureza:
--
--   `referral_code` / `referred_by` — a migration 20260722180000 tentou fechar
--   com `REVOKE UPDATE (referred_by, referral_code) ... FROM authenticated`, e
--   isso é NO-OP: no Postgres, revogar privilégio de COLUNA não remove o
--   privilégio de TABELA, e o GRANT de tabela de 20260607050155 continua de pé.
--   O autor achou que tinha fechado. Medido: `UPDATE 1`, código de indicação
--   sequestrado (o índice único garante que só uma conta fica com ele) e
--   indicador autoatribuído — que é a moeda das sementinhas.
--
--   `corporate_account_id` — `joinCorporate` valida o código, exige
--   `status='ativo'` e confere `max_seats`. Nada disso era necessário: medido
--   `UPDATE 1` e `assentos_ocupados = 2` com `max_seats = 1`.
--
-- Por que gatilho e não GRANT de coluna: a paciente edita o próprio perfil pelo
-- navegador com um `upsert` de payload grande e variável (o código tem até
-- recuo para coluna ainda não migrada). Trocar isso por uma lista de GRANT
-- significaria enumerar dezenas de colunas e manter a lista para sempre — uma
-- esquecida quebra o Perfil dela sem erro visível.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_patient_doctor_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  /* Uma vez só. `to_jsonb(NEW)` serializa a linha inteira, e `patient_profiles`
     é larga — chamá-lo quatro vezes por escrita seria pagar quatro vezes pela
     mesma pergunta ("essa coluna existe nesta base?"). A resposta não muda no
     meio do gatilho. */
  colunas jsonb := to_jsonb(NEW);
BEGIN
  /* SECURITY INVOKER (padrão, e de propósito): o gatilho precisa enxergar o
     papel REAL de quem escreve. SECURITY DEFINER quebraria a checagem — passaria
     a ver sempre o dono da função. */
  IF current_user <> 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      -- A paciente nunca se vincula nem se premia sozinha ao criar o perfil.
      NEW.doctor_id := NULL;
    ELSE
      -- Nem troca/define depois: mantém o valor que o servidor definiu.
      IF NEW.doctor_id IS DISTINCT FROM OLD.doctor_id THEN
        NEW.doctor_id := OLD.doctor_id;
      END IF;
    END IF;
  END IF;

  /* As quatro novas ficam num bloco à parte, com `colunas ? 'coluna'`:
     produção tem menos colunas que o repo, e referenciar `NEW.quiz_premium`
     numa base sem a coluna faria o gatilho falhar em TODA escrita de perfil —
     trocando um furo de assinatura por um app que não salva nada. */
  IF current_user <> 'service_role' THEN
    IF colunas ? 'quiz_premium' THEN
      IF TG_OP = 'INSERT' THEN
        NEW.quiz_premium := false;
      ELSIF NEW.quiz_premium IS DISTINCT FROM OLD.quiz_premium THEN
        NEW.quiz_premium := OLD.quiz_premium;
      END IF;
    END IF;
    IF colunas ? 'referral_code' THEN
      IF TG_OP = 'INSERT' THEN
        NEW.referral_code := NULL;
      ELSIF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
        NEW.referral_code := OLD.referral_code;
      END IF;
    END IF;
    IF colunas ? 'referred_by' THEN
      IF TG_OP = 'INSERT' THEN
        NEW.referred_by := NULL;
      ELSIF NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
        NEW.referred_by := OLD.referred_by;
      END IF;
    END IF;
    IF colunas ? 'corporate_account_id' THEN
      IF TG_OP = 'INSERT' THEN
        NEW.corporate_account_id := NULL;
      ELSIF NEW.corporate_account_id IS DISTINCT FROM OLD.corporate_account_id THEN
        NEW.corporate_account_id := OLD.corporate_account_id;
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

-- ────────────────────────────────────────────────────────────────────────────
-- 2. O `access_code` DE TODAS AS EMPRESAS ESTAVA À VISTA
--
--   SELECT id, company_name, max_seats, access_code
--     FROM corporate_accounts WHERE status='ativo';
--   → ABC123
--
-- A policy `Authenticated can read active accounts for validation` é
-- `FOR SELECT USING (status='ativo')` com GRANT SELECT da tabela INTEIRA. A
-- validação que ela existe para servir acontece em `joinCorporate`, que roda
-- com `service_role` e não precisa desse SELECT. Nenhuma tela lê esta tabela
-- pelo navegador (conferido em `src/`).
-- ────────────────────────────────────────────────────────────────────────────
DO $corp$
BEGIN
  IF to_regclass('public.corporate_accounts') IS NULL THEN RETURN; END IF;
  REVOKE ALL ON public.corporate_accounts FROM anon, authenticated;
  GRANT ALL ON public.corporate_accounts TO service_role;
END
$corp$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. A CONSULTA FORJADA VOLTOU PELO INSERT
--
-- A 20260731060000 revogou só o UPDATE. `GRANT ALL` deixou INSERT e DELETE de
-- pé, e a policy é `WITH CHECK (patient_user_id = auth.uid())` — sem restrição
-- de `status` nem de `amount_cents`. Medido:
--
--   INSERT ... ('video','confirmado',0,'FALSO-123', <medico>)   → INSERT 0 1
--   INSERT ... com doctor_id de médico SEM vínculo com ela      → INSERT 0 1
--   DELETE FROM private_consultations WHERE id = <a real>       → DELETE 1
--
-- A linha forjada aparece como paga no painel do médico e entra no somatório
-- financeiro da plataforma. E o DELETE apagava o registro verdadeiro.
--
-- `requestPrivateConsultation` insere pelo `supabaseAdmin`: ela não precisa de
-- escrita nenhuma aqui.
-- ────────────────────────────────────────────────────────────────────────────
DO $priv$
BEGIN
  IF to_regclass('public.private_consultations') IS NULL THEN RETURN; END IF;
  REVOKE INSERT, UPDATE, DELETE ON public.private_consultations FROM anon, authenticated;
  GRANT ALL ON public.private_consultations TO service_role;
END
$priv$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. A PRÉ-CONSULTA SE MARCAVA COMO JÁ VISTA
--
--   UPDATE preconsulta_forms SET seen_by_doctor = true WHERE user_id = auth.uid();
--   → UPDATE 1   (antes: f · depois: t)
--
-- Mesma mecânica do `panic_events.atendido_em`: `seen_by_doctor` é o DESFECHO
-- do médico — o painel conta os não lidos por ele. O formulário saía da fila
-- sem ele ter aberto. E dava para injetar no painel de outro médico:
--
--   INSERT ... (user_id, doctor_id de outro, false)  → INSERT 0 1
--   UPDATE ... SET doctor_id = <outro>               → UPDATE 2
--
-- O navegador dela só faz SELECT nesta tabela; `submitPreConsulta` grava pelo
-- `supabaseAdmin`.
-- ────────────────────────────────────────────────────────────────────────────
DO $pre$
BEGIN
  IF to_regclass('public.preconsulta_forms') IS NULL THEN RETURN; END IF;
  REVOKE INSERT, UPDATE, DELETE ON public.preconsulta_forms FROM anon, authenticated;
  GRANT ALL ON public.preconsulta_forms TO service_role;
END
$pre$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. A PACIENTE ESCREVIA A RESPOSTA DO MÉDICO
--
--   UPDATE doctor_questions
--      SET answer = 'O Dr. Fulano disse que pode tomar dipirona a vontade.',
--          answered = true, answered_at = now()
--    WHERE id = '<pergunta dela>';
--   → UPDATE 1
--
-- Orientação médica fabricada e atribuída ao médico, exibida no painel dele
-- como resposta dele. É o pior dos nove: o risco não é de dado, é
-- médico-legal. De quebra, `answered_at` é a métrica "respondidas neste mês"
-- do painel, e `doctor_id` podia ser recarimbado para outro consultório.
--
-- `answered` É dela por desenho — o checklist "já perguntei" é o uso da tela.
-- Então aqui o remédio é GRANT de coluna, exatamente como `doctor_orders`:
-- ela cria, lê, apaga e marca como perguntada; o texto da resposta é do médico.
-- ────────────────────────────────────────────────────────────────────────────
DO $dq$
BEGIN
  IF to_regclass('public.doctor_questions') IS NULL THEN RETURN; END IF;

  REVOKE ALL ON public.doctor_questions FROM anon, authenticated;
  /* O navegador dela faz INSERT (pergunta), SELECT, DELETE e o toggle. */
  GRANT SELECT, INSERT, DELETE ON public.doctor_questions TO authenticated;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'doctor_questions'
       AND column_name = 'answered'
  ) THEN
    GRANT UPDATE (answered) ON public.doctor_questions TO authenticated;
  END IF;
  GRANT ALL ON public.doctor_questions TO service_role;
END
$dq$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. O PEDIDO ANÔNIMO JÁ NASCIA "PAGO"
--
-- O `WITH CHECK` que a 20260731060000 escreveu prende `status` e `confirmed_*`
-- — e deixou passar duas colunas que o painel lê como verdade:
--
--   INSERT (anon) ... payment_status='pago',
--                     internal_notes='[nota interna injetada pelo cliente]'
--   → INSERT 0 1
--
-- O painel renderiza `payment_status = 'pago'` como "✓ R$ …", e lê
-- `internal_notes` como anotação interna DELE. O default da coluna é
-- `sem_cobranca`; quem cobra é o médico.
--
-- As colunas entram no `WITH CHECK` só se existirem: produção pode não ter as
-- duas, e uma policy citando coluna ausente falharia na criação.
-- ────────────────────────────────────────────────────────────────────────────
DO $appt$
DECLARE
  cond text := 'status = ''pending'' AND confirmed_date IS NULL AND confirmed_time IS NULL';
BEGIN
  IF to_regclass('public.appointment_requests') IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'appointment_requests'
       AND column_name = 'payment_status'
  ) THEN
    cond := cond || ' AND payment_status = ''sem_cobranca''';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'appointment_requests'
       AND column_name = 'internal_notes'
  ) THEN
    cond := cond || ' AND internal_notes IS NULL';
  END IF;

  DROP POLICY IF EXISTS "Anyone can request an appointment" ON public.appointment_requests;
  EXECUTE format(
    'CREATE POLICY "Anyone can request an appointment" ON public.appointment_requests
       FOR INSERT TO anon, authenticated WITH CHECK (%s)', cond);
END
$appt$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. O CRM MUDAVA E O SELO DO CONSELHO FICAVA VERDE
--
--   UPDATE doctors SET crm = 'CRM-SP 99999' WHERE id = auth.uid();
--   → UPDATE 1, e `crm_conferido_nome` seguia 'FULANO DE TAL', selo = t
--
-- `crm` está na lista de `GRANT UPDATE (...)` de 20260730040000 — e deve
-- continuar: o médico precisa poder corrigir um dígito errado. O que não pode é
-- o SELO sobreviver à troca, apontando para um número que ninguém conferiu.
--
-- Por isso gatilho, e não REVOKE: revogar tiraria dele a correção legítima. O
-- gatilho deixa corrigir e derruba a conferência junto — que é o que "conferido"
-- significa.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_mudou_derruba_selo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  /* Mesmo motivo do gatilho de `patient_profiles`: produção pode não ter as
     colunas do selo, e citá-las direto faria ESTE gatilho derrubar toda escrita
     em `doctors`. */
  colunas jsonb := to_jsonb(NEW);
BEGIN
  IF NEW.crm IS DISTINCT FROM OLD.crm THEN
    IF colunas ? 'crm_conferido_em'      THEN NEW.crm_conferido_em := NULL;      END IF;
    IF colunas ? 'crm_conferido_nome'    THEN NEW.crm_conferido_nome := NULL;    END IF;
    IF colunas ? 'crm_conferido_situacao' THEN NEW.crm_conferido_situacao := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $crm$
BEGIN
  IF to_regclass('public.doctors') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'doctors' AND column_name = 'crm'
  ) THEN RETURN; END IF;
  DROP TRIGGER IF EXISTS trg_crm_derruba_selo ON public.doctors;
  CREATE TRIGGER trg_crm_derruba_selo
    BEFORE UPDATE ON public.doctors
    FOR EACH ROW EXECUTE FUNCTION public.crm_mudou_derruba_selo();
END
$crm$;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. O PEDIDO DE VÍNCULO ESCRITO À MÃO
--
--   INSERT INTO patient_link_requests (..., status='accepted', decided_at=now())
--   → INSERT 0 1
--   DELETE FROM patient_link_requests WHERE ...  → DELETE 1
--
-- Não gera vínculo — `acceptLinkRequest` re-exige `status='pending'` e só o
-- `service_role` escreve `patient_profiles.doctor_id` (o gatilho reverte). Mas
-- fura as checagens de `requestPatientLink` (`accepting_patients`, teto do
-- plano) e deixa ela tornar o próprio pedido invisível para o médico, que
-- filtra por `status='pending'`.
--
-- O navegador não toca nesta tabela em lugar nenhum de `src/`.
-- ────────────────────────────────────────────────────────────────────────────
DO $plr$
BEGIN
  IF to_regclass('public.patient_link_requests') IS NULL THEN RETURN; END IF;
  REVOKE INSERT, UPDATE, DELETE ON public.patient_link_requests FROM anon, authenticated;
  GRANT ALL ON public.patient_link_requests TO service_role;
END
$plr$;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. DEFESA EM PROFUNDIDADE: o `anon` continuava com privilégio de tabela
--
-- Os REVOKE de 20260730040000 e 20260731060000 dizem `FROM authenticated`
-- apenas. O `anon` seguiu com UPDATE de todas as colunas de `doctors`,
-- `private_consultations` e `teleconsulta_sessions`, herdado do default
-- privilege. Hoje só a RLS segura, porque `auth.uid()` é NULL — testado,
-- `UPDATE 0`. Mas isso deixa a segurança de três tabelas dependendo de nenhuma
-- policy futura ser escrita sem `TO`, o que é uma linha de distância.
--
-- Privilégio que ninguém usa é privilégio que deve sair.
-- ────────────────────────────────────────────────────────────────────────────
DO $anon$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'doctors', 'private_consultations', 'teleconsulta_sessions',
    'patient_profiles', 'doctor_questions', 'preconsulta_forms'
  ] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t);
  END LOOP;
END
$anon$;

COMMENT ON FUNCTION public.protect_patient_doctor_id() IS
  'Devolve ao valor do servidor as colunas de patient_profiles que a paciente nao pode escrever: doctor_id, quiz_premium (produto pago), referral_code/referred_by (moeda de indicacao) e corporate_account_id (assento de empresa). SECURITY INVOKER de proposito.';
COMMENT ON FUNCTION public.crm_mudou_derruba_selo() IS
  'Trocar o CRM derruba a conferencia do conselho. O medico pode corrigir o numero; o selo verde nao sobrevive a troca.';
