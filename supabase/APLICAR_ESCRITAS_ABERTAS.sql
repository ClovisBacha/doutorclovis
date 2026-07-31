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
