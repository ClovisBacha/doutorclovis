-- ============================================================================
-- DIREITO AO ESQUECIMENTO — a metade que faltava
-- ============================================================================
--
-- A migration de 31/07 dedicou uma seção inteira ao assunto e consertou o que
-- já tinha chave estrangeira. Mas quem não tinha chave NENHUMA ficou de fora —
-- e uma auditoria testou o que sobrevive ao `DELETE FROM auth.users`:
--
--   chat_messages        1 → 1   "tive uma tentativa de aborto aos 19 anos e
--                                  nunca contei pra ninguém"
--   chat_memory          1 → 1   "Paciente relata histórico de aborto e ansiedade"
--   epds_logs            1 → 1   rastreio de depressão, com q10 (ideação)
--   companion_invites    1 → 1
--   appointment_requests 1 → 1   nome, e-mail, telefone, motivo
--   brain_feedback       1 → 1
--
-- Ou seja: a paciente pede exclusão, recebe a confirmação, e o texto continua
-- no banco indexado por `patient_id`. Isso não é pendência de backlog — é a
-- promessa do art. 18 da LGPD não sendo cumprida no exato momento em que
-- alguém a exerce.
--
-- Ironia que vale registrar: `epds_logs` é FONTE da view `clinical_events`
-- criada no mesmo dia. A migration lia a tabela e não percebeu que ela não
-- tinha chave estrangeira.
-- ============================================================================

DO $esquecer$
DECLARE
  alvo record;
  orfas bigint;
BEGIN
  FOR alvo IN
    SELECT * FROM (VALUES
      ('chat_messages',        'patient_id'),
      ('chat_memory',          'patient_id'),
      ('epds_logs',            'user_id'),
      ('companion_invites',    'user_id'),
      ('brain_feedback',       'user_id'),
      ('nps_responses',        'user_id'),
      ('announcement_dismissals', 'user_id'),
      ('doctor_google_tokens', 'user_id')
    ) AS t(tabela, coluna)
  LOOP
    CONTINUE WHEN to_regclass('public.' || alvo.tabela) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = alvo.tabela
         AND column_name = alvo.coluna
    );
    -- Já tem FK para auth.users nessa coluna? Não mexe.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM pg_constraint c
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.conrelid = ('public.' || alvo.tabela)::regclass
         AND c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
         AND a.attname = alvo.coluna
    );

    /* `NOT VALID`: protege daqui para a frente e cascateia na exclusão, sem
       recusar as linhas órfãs que já existem. Apagar histórico às escuras é
       pior que marcá-lo — e é a mesma decisão tomada nas outras chaves. */
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID',
      alvo.tabela, alvo.tabela || '_' || alvo.coluna || '_esquecer_fkey', alvo.coluna
    );

    EXECUTE format(
      'SELECT count(*) FROM public.%I x WHERE x.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.%I)',
      alvo.tabela, alvo.coluna, alvo.coluna
    ) INTO orfas;
    IF orfas > 0 THEN
      RAISE NOTICE 'esquecimento: %.% tem % linha(s) orfa(s) de contas ja apagadas — apague-as ou rode VALIDATE CONSTRAINT depois de conferir',
        alvo.tabela, alvo.coluna, orfas;
    END IF;
  END LOOP;
END
$esquecer$;

/* `appointment_requests` NÃO ganha chave estrangeira, e é decisão, não
   esquecimento: a tabela identifica a paciente por `patient_email` — texto
   digitado num formulário, sem coluna de conta. Não há o que cascatear. O
   caminho certo é anonimizar por e-mail no fluxo de exclusão, e fica
   registrado aqui como pendência conhecida em vez de passar por resolvida. */

-- ────────────────────────────────────────────────────────────────────────────
-- O GATILHO DOS ACKS PRECISA DE REDE
--
-- `clinical_acks` não tem chave estrangeira (`fonte_id` é polimórfico) e a
-- exclusão dependia inteiramente de um gatilho em `auth.users`. Em vários
-- projetos Supabase o papel do SQL Editor não pode criar gatilho nesse schema —
-- e um `CREATE TRIGGER` sem guarda **aborta o arquivo inteiro** dentro da
-- transação implícita, derrubando junto a view e as constraints.
--
-- O polimorfismo é do `fonte_id`, não do `user_id`. Então `user_id` ganha chave
-- de verdade, e o gatilho passa a ser reforço, não a única linha de defesa.
-- ────────────────────────────────────────────────────────────────────────────
DO $acks$
BEGIN
  IF to_regclass('public.clinical_acks') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.clinical_acks'::regclass
       AND conname = 'clinical_acks_user_id_fkey'
  ) THEN
    DELETE FROM public.clinical_acks x
     WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.user_id);
    ALTER TABLE public.clinical_acks
      ADD CONSTRAINT clinical_acks_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$acks$;
