-- ============================================================================
-- APLICAR NO SQL EDITOR DO SUPABASE — Fluxo unificado de eventos clinicos
-- ============================================================================
-- Idempotente: pode rodar mais de uma vez. Rode DE NOVO depois de aplicar
-- outras migrations — a view se amplia sozinha com as tabelas que passarem
-- a existir.
--
-- O que este arquivo faz:
--   1. indices que faltavam em 6 tabelas clinicas (busca por paciente era
--      varredura sequencial)
--   2. faixas plausiveis (CHECK) — o banco aceitava pressao 99999 e peso 999kg
--   3. ON DELETE CASCADE — apagar a conta de uma paciente FALHAVA se ela
--      tivesse uma contracao, uma pre-consulta ou um SOS. LGPD inexequivel.
--   4. clinical_acks — o desfecho que o medico registra
--   5. clinical_events — a view que unifica 11 fontes clinicas num contrato so
-- ============================================================================

-- ============================================================================
-- ============================================================================
-- FLUXO UNIFICADO DE EVENTOS CLÍNICOS
-- ============================================================================
--
-- O problema que isto resolve não é de tela, é de forma dos dados.
--
-- A paciente registra pressão em TRÊS tabelas diferentes (`health_logs`,
-- `preconsulta_forms`, `triage_logs`), glicemia em duas, e o rastreio de
-- depressão em três — com três tipos diferentes para a mesma pontuação. Não
-- existe uma única VIEW no banco inteiro, nem um agregado: toda leitura do
-- painel é um `SELECT ... LIMIT 5000` varrido em memória no Node, sem recorte
-- de inquilino no SQL.
--
-- O resultado é o que a auditoria clínica encontrou: o painel do médico
-- enxerga SEIS tabelas. Triagem de sintomas, contrações, pânico, exames,
-- glicemia, biometria fetal, EPDS e a série pós-parto inteira nunca chegam a
-- ele. A triagem VERMELHA — cefaleia com escotomas, o sinal de iminência de
-- eclâmpsia — é gravada e nunca lida por ninguém.
--
-- Aqui a gente para de escrever uma consulta nova para cada tabela e passa a
-- ter UM contrato: quem, quando, de que espécie, com que números.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE UMA VIEW, E NÃO UMA TABELA MATERIALIZADA
--
-- Uma tabela de eventos exigiria gravar a gravidade no momento da escrita. Mas
-- metade das tabelas de origem é escrita DIRETO DO NAVEGADOR com a chave anon
-- (`health_logs`, `contraction_logs`, `exam_files`…), então o carimbo teria de
-- virar trigger em SQL — e a régua clínica viveria em dois lugares, SQL e
-- TypeScript. Duplicar a régua é exatamente a doença que este produto acabou
-- de curar: o app da paciente tinha uma cópia das faixas de glicemia que só
-- olhava para cima e chamava 35 mg/dL de "Normal".
--
-- Então: a VIEW entrega os NÚMEROS CRUS, normalizados. A gravidade é calculada
-- em `src/lib/sinais-clinicos.ts`, uma vez, para o médico e para a paciente.
-- Sem materialização não há divergência possível.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUE MONTADA DINAMICAMENTE
--
-- Produção tem menos tabelas do que o repositório: as migrations a partir de
-- 20260608120000 estão pendentes. Uma `CREATE VIEW` que referencie uma tabela
-- ausente falha inteira — e derrubaria junto as fontes que existem. O bloco
-- abaixo pergunta ao catálogo (`to_regclass`) quais existem e monta a união só
-- com essas. Rodar de novo depois de aplicar mais migrations amplia a view
-- sozinho.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ÍNDICES QUE FALTAVAM
--
-- Cinco tabelas clínicas são consultadas por `user_id` e não tinham índice
-- liderado por ele: toda leitura era varredura sequencial. Com o fluxo de
-- eventos elas passam a ser consultadas em TODA abertura do painel.
-- ────────────────────────────────────────────────────────────────────────────
DO $indices$
DECLARE
  alvo record;
BEGIN
  FOR alvo IN
    SELECT * FROM (VALUES
      ('contraction_logs',   'idx_contraction_logs_user',   'user_id, started_at DESC'),
      ('preconsulta_forms',  'idx_preconsulta_forms_user',  'user_id, submitted_at DESC'),
      ('ppd_screenings',     'idx_ppd_screenings_user',     'user_id, screened_at DESC'),
      ('consultation_notes', 'idx_consultation_notes_user', 'user_id, recorded_at DESC')
    ) AS t(tabela, indice, colunas)
  LOOP
    /* A GUARDA QUE FALTAVA. `IF NOT EXISTS` protege o índice, não a tabela — e
       estas são todas de migrations pendentes. No SQL Editor do Supabase o lote
       roda numa transação implícita: bastava a primeira não existir para NADA
       ser commitado, nem a view, nem as constraints, nem o CASCADE. O arquivo
       inteiro não aplicava no único banco onde precisava aplicar. */
    CONTINUE WHEN to_regclass('public.' || alvo.tabela) IS NULL;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)',
                   alvo.indice, alvo.tabela, alvo.colunas);
  END LOOP;
END
$indices$;

/* `exam_files` e `panic_events` NÃO entram: já têm índice idêntico
   (`idx_exam_files_user`, `idx_panic_user`). Criar o segundo dobrava o custo de
   escrita e o espaço para ganho zero. */

-- ────────────────────────────────────────────────────────────────────────────
-- 2. FAIXAS PLAUSÍVEIS NO BANCO
--
-- Não havia UM CHECK de faixa clínica no schema inteiro. `systolic` é
-- `integer`: o banco aceita 99999. E `health_logs` é escrita direto do
-- navegador, sem servidor no caminho — então não havia onde pendurar validação.
--
-- `NOT VALID` de propósito: vale para linhas NOVAS e não recusa o que já está
-- gravado. Apagar histórico ruim é pior que marcá-lo — e a régua de leitura já
-- sabe rotular o impossível como impossível.
--
-- As faixas são as MESMAS de `src/lib/sinais-clinicos.ts`. Se divergirem, a
-- paciente vê "confira o número" e o banco aceita, ou o contrário — e o
-- contrário é o pior: um erro genérico que a faz desistir de registrar.
--
-- ⚠️ SÃO PISOS, E NÃO FAIXAS (set/2026). Não há teto de plausibilidade em peso,
-- pressão, glicemia nem frequência: um teto chutado RECUSA o número de uma
-- paciente real, e o app é que estaria errado. Sobrevivem só os dois máximos
-- que são DEFINIÇÃO da grandeza — saturação em 100% e sono em 24 h.
-- ────────────────────────────────────────────────────────────────────────────
DO $faixas$
DECLARE
  alvo record;
BEGIN
  FOR alvo IN
    SELECT * FROM (VALUES
      ('health_logs',      'systolic',        'systolic IS NULL OR systolic >= 50'),
      ('health_logs',      'diastolic',       'diastolic IS NULL OR diastolic >= 20'),
      ('health_logs',      'glucose_mg_dl',   'glucose_mg_dl IS NULL OR glucose_mg_dl >= 20'),
      ('health_logs',      'weight_kg',       'weight_kg IS NULL OR weight_kg > 0'),
      ('health_logs',      'spo2',            'spo2 IS NULL OR spo2 BETWEEN 50 AND 100'),
      ('health_logs',      'heart_rate_bpm',  'heart_rate_bpm IS NULL OR heart_rate_bpm >= 30'),
      ('health_logs',      'sleep_hours',     'sleep_hours IS NULL OR sleep_hours BETWEEN 0 AND 24'),
      ('preconsulta_forms','systolic',        'systolic IS NULL OR systolic >= 50'),
      ('preconsulta_forms','diastolic',       'diastolic IS NULL OR diastolic >= 20'),
      ('preconsulta_forms','current_weight',  'current_weight IS NULL OR current_weight > 0'),
      ('triage_logs',      'systolic',        'systolic IS NULL OR systolic >= 50'),
      ('triage_logs',      'diastolic',       'diastolic IS NULL OR diastolic >= 20')
    ) AS t(tabela, coluna, regra)
  LOOP
    -- Tabela ou coluna ausente (migration pendente) simplesmente não ganha a
    -- constraint. Rodar de novo depois de aplicar as migrations a adiciona.
    CONTINUE WHEN to_regclass('public.' || alvo.tabela) IS NULL;
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = alvo.tabela
         AND column_name = alvo.coluna
    );
    -- ⚠️ DROP ANTES DE ADD, e nunca `CONTINUE WHEN EXISTS`. Com o CONTINUE este
    -- arquivo era no-op para quem já o tinha rodado: o CHECK ANTIGO (com o teto
    -- de 350 kg) ficaria de pé para sempre, e a paciente veria o app aceitar o
    -- peso dela e o banco recusar com 23514. Idempotente continua sendo — o
    -- DROP é `IF EXISTS` e o ADD reescreve a regra da versão de hoje.
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      alvo.tabela, alvo.tabela || '_' || alvo.coluna || '_faixa'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID',
      alvo.tabela, alvo.tabela || '_' || alvo.coluna || '_faixa', alvo.regra
    );
  END LOOP;
END
$faixas$;

-- Pressão pela metade. Um "140/" gravado é uma linha que nenhuma tela consegue
-- interpretar — e a sistólica sozinha é justamente a que mais importa.
DO $par_pa$
BEGIN
  /* IF aninhado, e não `AND`: em SQL o `AND` não faz curto-circuito, então o
     cast `'public.health_logs'::regclass` era avaliado mesmo com a tabela
     ausente — e estourava. */
  IF to_regclass('public.health_logs') IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.health_logs'::regclass
          AND conname = 'health_logs_pa_par'
     )
  THEN
    ALTER TABLE public.health_logs
      ADD CONSTRAINT health_logs_pa_par
      CHECK (num_nonnulls(systolic, diastolic) <> 1) NOT VALID;
  END IF;
END
$par_pa$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. DIREITO AO ESQUECIMENTO
--
-- Dezesseis tabelas referenciam `auth.users` sem `ON DELETE`, o que em Postgres
-- é NO ACTION: apagar a conta de uma paciente que tenha UMA contração
-- cronometrada, UMA pré-consulta ou UM acionamento de SOS **falha** com
-- violação de chave estrangeira. Não é um detalhe de arquitetura — é a LGPD
-- inexequível na prática, e a descoberta acontece no pior momento possível,
-- com a paciente pedindo exclusão.
--
-- Recria cada FK com CASCADE. Idempotente: só age onde a regra atual não é
-- CASCADE.
-- ────────────────────────────────────────────────────────────────────────────
DO $cascata$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT c.conname, c.conrelid::regclass AS tabela, a.attname AS coluna
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND c.confrelid = 'auth.users'::regclass
       /* SÓ `NO ACTION` ('a'), que é o default de quem esqueceu de escrever
          `ON DELETE`. `SET NULL` ('n') é decisão de alguém: `doctor_accounts`
          usa isso de propósito para que apagar o LOGIN do médico não apague a
          conta comercial dele. "Tudo que não é CASCADE vira CASCADE" desfazia
          essa decisão em silêncio. */
       AND c.confdeltype = 'a'
       AND connamespace = 'public'::regnamespace
       AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.tabela, fk.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      fk.tabela, fk.conname, fk.coluna
    );
  END LOOP;
END
$cascata$;

-- `health_logs` e `doctor_questions` não têm FK NENHUMA — as duas tabelas
-- clínicas mais antigas e mais usadas do produto. Apagar a conta deixaria as
-- linhas órfãs, com dado clínico de uma pessoa que pediu para ser esquecida.
DO $fk_orfas$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['health_logs', 'doctor_questions'] LOOP
    CONTINUE WHEN to_regclass('public.' || t) IS NULL;
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = ('public.' || t)::regclass AND contype = 'f'
         AND confrelid = 'auth.users'::regclass
    );
    /* `NOT VALID`, e não um DELETE das órfãs.
    
       A primeira versão apagava as linhas sem dono antes de criar a FK — dado
       clínico sumindo sem contagem, sem aviso e sem backup, num arquivo que
       cem linhas acima argumenta o contrário ("apagar histórico ruim é pior
       que marcá-lo"). `NOT VALID` dá a MESMA proteção: bloqueia órfã nova e
       cascateia na exclusão, sem tocar no que já está lá. Quem quiser validar
       o passado roda `VALIDATE CONSTRAINT` depois de olhar o que tem. */
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID',
      t, t || '_user_id_fkey'
    );
  END LOOP;
END
$fk_orfas$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. DESFECHO DE EVENTO
--
-- "O médico viu" e "o médico resolveu" são coisas diferentes, e nenhuma das
-- duas cabe na tabela de origem — que pertence à paciente e é escrita por ela.
-- Esta é a única tabela NOVA do fluxo, e ela guarda só o que é do médico.
--
-- Chave composta por (médico, fonte, id da linha de origem): o mesmo evento
-- pode ser tratado por médicos diferentes ao longo do tempo sem sobrescrita.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clinical_acks (
  doctor_id  uuid        NOT NULL,
  fonte      text        NOT NULL,
  fonte_id   uuid        NOT NULL,
  user_id    uuid        NOT NULL,
  visto_em   timestamptz NOT NULL DEFAULT now(),
  -- O que ele fez. Texto livre de propósito: conduta não cabe em enum, e um
  -- enum errado faz o médico escolher a opção menos errada em vez de escrever.
  conduta    text,
  PRIMARY KEY (doctor_id, fonte, fonte_id)
);

CREATE INDEX IF NOT EXISTS idx_clinical_acks_paciente
    ON public.clinical_acks (user_id, visto_em DESC);

/* O ACK PRECISA MORRER COM A CONTA.
   
   `fonte_id` é polimórfico (aponta para onze tabelas diferentes), então não há
   FK possível — e sem FK a linha sobrevivia ao `DELETE` da paciente. Numa seção
   chamada "direito ao esquecimento" isso é o defeito mais constrangedor que dá
   para ter: `conduta` é texto livre onde o médico escreve o que quiser,
   inclusive nome e telefone dela, e ficava lá indexado por `user_id` depois da
   exclusão. O gatilho fecha o que a FK não alcança. */
CREATE OR REPLACE FUNCTION public.limpa_acks_da_conta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $limpa$
BEGIN
  DELETE FROM public.clinical_acks WHERE user_id = OLD.id;
  RETURN OLD;
END
$limpa$;

/* Guardado: em vários projetos Supabase o papel do SQL Editor não pode criar
   gatilho em `auth`. Sem o `EXCEPTION`, o erro aborta o arquivo inteiro dentro
   da transação implícita e derruba junto a view e as constraints — o operador
   lê "Success" e não fica nada. A chave estrangeira de
   `20260731040000_esquecimento_completo.sql` é quem garante a limpeza; este
   gatilho é reforço. */
DO $trg$
BEGIN
  DROP TRIGGER IF EXISTS trg_limpa_acks_da_conta ON auth.users;
  CREATE TRIGGER trg_limpa_acks_da_conta
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.limpa_acks_da_conta();
EXCEPTION
  WHEN insufficient_privilege OR undefined_table THEN
    RAISE NOTICE 'sem permissao para o gatilho em auth.users — a FK de clinical_acks cobre a limpeza';
END
$trg$;

ALTER TABLE public.clinical_acks ENABLE ROW LEVEL SECURITY;

-- Só o servidor escreve. O médico chega por server function com o token
-- validado; a paciente nunca precisa desta tabela.
DROP POLICY IF EXISTS "servico gerencia acks" ON public.clinical_acks;
CREATE POLICY "servico gerencia acks" ON public.clinical_acks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.clinical_acks FROM anon, authenticated;
GRANT ALL ON public.clinical_acks TO service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. A VIEW
--
-- Contrato: uma linha por evento clínico, com os NÚMEROS CRUS em `dados`. A
-- gravidade não mora aqui — mora na régua de leitura, uma só.
--
--   fonte       de qual tabela veio (também a chave do desfecho em clinical_acks)
--   fonte_id    id da linha de origem
--   user_id     a paciente
--   ocorrido_em quando ACONTECEU (não quando foi gravado)
--   especie     como a tela agrupa: medida | sintoma | emergencia | exame |
--               contracao | humor | movimento | consulta | pergunta
--   dados       jsonb com os números, nomes já normalizados entre as fontes
--   texto       o que ela escreveu, quando escreveu algo
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tem_coluna(t text, c text) RETURNS boolean
LANGUAGE sql STABLE AS $tc$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = t AND column_name = c
  )
$tc$;

DO $view$
DECLARE
  partes text[] := ARRAY[]::text[];
  pares  text[];
  sql    text;
BEGIN
  IF to_regclass('public.health_logs') IS NOT NULL THEN
    /* AS COLUNAS, UMA A UMA.
    
       `to_regclass` responde pela tabela e não pelas colunas dela — e
       `glucose_mg_dl`, `spo2` e `heart_rate_bpm` vieram de migrations
       pendentes. Num banco com as 8 tabelas originais a tabela EXISTE, o ramo
       era montado, e a view inteira falhava em `column h.glucose_mg_dl does not
       exist` — derrubando junto tudo o mais no mesmo lote. */
    pares := ARRAY[]::text[];
    IF public.tem_coluna('health_logs','systolic')       THEN pares := pares || ARRAY[$$'systolic', h.systolic$$]; END IF;
    IF public.tem_coluna('health_logs','diastolic')      THEN pares := pares || ARRAY[$$'diastolic', h.diastolic$$]; END IF;
    IF public.tem_coluna('health_logs','glucose_mg_dl')  THEN pares := pares || ARRAY[$$'glucose_mg_dl', h.glucose_mg_dl$$]; END IF;
    IF public.tem_coluna('health_logs','weight_kg')      THEN pares := pares || ARRAY[$$'weight_kg', h.weight_kg$$]; END IF;
    IF public.tem_coluna('health_logs','spo2')           THEN pares := pares || ARRAY[$$'spo2', h.spo2$$]; END IF;
    IF public.tem_coluna('health_logs','heart_rate_bpm') THEN pares := pares || ARRAY[$$'heart_rate_bpm', h.heart_rate_bpm$$]; END IF;

    IF array_length(pares, 1) IS NOT NULL THEN
      partes := array_append(partes, format($sql$
        SELECT 'health_logs'::text AS fonte, h.id AS fonte_id, h.user_id,
               COALESCE(h.created_at, h.log_date::timestamptz + interval '12 hours') AS ocorrido_em,
               'medida'::text AS especie,
               jsonb_strip_nulls(jsonb_build_object(%s)) AS dados,
               h.notes AS texto
          FROM public.health_logs h
         WHERE num_nonnulls(%s) > 0
      $sql$,
      array_to_string(pares, ', '),
      array_to_string(ARRAY(SELECT 'h.' || c FROM unnest(ARRAY['systolic','diastolic','glucose_mg_dl','weight_kg','spo2','heart_rate_bpm']) c
                             WHERE public.tem_coluna('health_logs', c)), ', ')));
    END IF;
  END IF;

  IF to_regclass('public.triage_logs') IS NOT NULL THEN
    partes := array_append(partes, $sql$
      SELECT 'triage_logs'::text AS fonte, t.id AS fonte_id, t.user_id, t.created_at AS ocorrido_em,
             'sintoma'::text,
             jsonb_strip_nulls(jsonb_build_object(
               'systolic', t.systolic, 'diastolic', t.diastolic,
               'nivel', t.level, 'sintomas', to_jsonb(t.symptoms)
             )),
             t.note
        FROM public.triage_logs t
    $sql$);
  END IF;

  IF to_regclass('public.preconsulta_forms') IS NOT NULL THEN
    partes := array_append(partes, $sql$
      SELECT 'preconsulta_forms'::text, p.id, p.user_id,
             COALESCE(p.submitted_at, now()),
             'consulta'::text,
             jsonb_strip_nulls(jsonb_build_object(
               'systolic', p.systolic, 'diastolic', p.diastolic,
               'weight_kg', p.current_weight,
               'semana', p.weeks_at_submission,
               'sintomas', to_jsonb(p.symptoms),
               'medicamentos', p.medications,
               'emocional', p.emotional_state
             )),
             p.questions
        FROM public.preconsulta_forms p
    $sql$);
  END IF;

  IF to_regclass('public.panic_events') IS NOT NULL THEN
    partes := array_append(partes, $sql$
      SELECT 'panic_events'::text, e.id, e.user_id, e.created_at,
             'emergencia'::text,
             jsonb_strip_nulls(jsonb_build_object(
               'latitude', e.latitude, 'longitude', e.longitude
             )),
             e.address
        FROM public.panic_events e
    $sql$);
  END IF;

  IF to_regclass('public.contraction_logs') IS NOT NULL THEN
    partes := array_append(partes, $sql$
      SELECT 'contraction_logs'::text, c.id, c.user_id, c.started_at,
             'contracao'::text,
             jsonb_strip_nulls(jsonb_build_object(
               'intensidade', c.intensity,
               'duracao_seg', CASE WHEN c.ended_at IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (c.ended_at - c.started_at))::int END
             )),
             c.notes
        FROM public.contraction_logs c
    $sql$);
  END IF;

  IF to_regclass('public.exam_files') IS NOT NULL THEN
    -- `image_data` fica DE FORA: é base64 de JPEG inteiro, e um stream de
    -- eventos que carrega imagem vira megabytes por paciente. Quem quiser a
    -- imagem busca a linha pelo `fonte_id`.
    partes := array_append(partes, $sql$
      SELECT 'exam_files'::text, x.id, x.user_id, x.created_at,
             'exame'::text,
             jsonb_strip_nulls(jsonb_build_object(
               'categoria', x.category, 'semana', x.week, 'nome', x.name
             )),
             x.notes
        FROM public.exam_files x
    $sql$);
  END IF;

  IF to_regclass('public.kick_sessions') IS NOT NULL THEN
    partes := array_append(partes, $sql$
      SELECT 'kick_sessions'::text, k.id, k.user_id, k.started_at,
             'movimento'::text,
             jsonb_build_object('chutes', k.kick_count),
             k.notes
        FROM public.kick_sessions k
    $sql$);
  END IF;

  IF to_regclass('public.journal_entries') IS NOT NULL THEN
    -- Só o RÓTULO de humor. O conteúdo do diário é dela, e um fluxo de eventos
    -- que o carrega para o painel transforma desabafo em prontuário.
    partes := array_append(partes, $sql$
      SELECT 'journal_entries'::text, j.id, j.user_id, j.created_at,
             'humor'::text,
             jsonb_strip_nulls(jsonb_build_object('humor', j.mood)),
             NULL::text
        FROM public.journal_entries j
       WHERE j.mood IS NOT NULL
    $sql$);
  END IF;

  IF to_regclass('public.glucose_diary') IS NOT NULL THEN
    partes := array_append(partes, $sql$
      SELECT 'glucose_diary'::text, g.id, g.user_id, g.measured_at,
             'medida'::text,
             jsonb_build_object('glucose_mg_dl', g.value_mgdl, 'momento', g.moment),
             g.notes
        FROM public.glucose_diary g
       WHERE g.user_id IS NOT NULL
    $sql$);
  END IF;

  IF to_regclass('public.epds_logs') IS NOT NULL THEN
    partes := array_append(partes, $sql$
      SELECT 'epds_logs'::text, l.id, l.user_id, l.created_at,
             'humor'::text,
             jsonb_build_object('epds', l.score, 'epds_q10', l.q10_score, 'nivel', l.level),
             NULL::text
        FROM public.epds_logs l
    $sql$);
  END IF;

  IF to_regclass('public.doctor_questions') IS NOT NULL THEN
    partes := array_append(partes, $sql$
      SELECT 'doctor_questions'::text, q.id, q.user_id, q.created_at,
             'pergunta'::text,
             jsonb_build_object('respondida', q.answered),
             q.question
        FROM public.doctor_questions q
    $sql$);
  END IF;

  IF array_length(partes, 1) IS NULL THEN
    RAISE NOTICE 'clinical_events: nenhuma tabela de origem existe — view não criada';
    RETURN;
  END IF;

  sql := 'CREATE OR REPLACE VIEW public.clinical_events AS ' ||
         array_to_string(partes, ' UNION ALL ');
  EXECUTE sql;

  -- `security_invoker` faz a view respeitar a RLS de quem consulta, em vez de
  -- a do dono. Sem isto, uma view sobre tabelas com RLS vira porta dos fundos:
  -- qualquer `authenticated` leria a plataforma inteira.
  EXECUTE 'ALTER VIEW public.clinical_events SET (security_invoker = true)';

  /* SÓ `service_role`. `security_invoker` faz a view exigir privilégio nas
     tabelas-base, e `epds_logs` teve o SELECT revogado de `authenticated` num
     hardening deliberado — então conceder a view a `authenticated` anunciava
     uma capacidade que erraria em 100% das consultas ("permission denied for
     table epds_logs"), inclusive filtrando a fonte, porque privilégio é checado
     no plano e não na linha. Quem lê é o servidor. */
  REVOKE ALL ON public.clinical_events FROM anon, authenticated;
  GRANT SELECT ON public.clinical_events TO service_role;
  EXECUTE 'COMMENT ON VIEW public.clinical_events IS ' || quote_literal(
    'Fluxo unificado de eventos clinicos da paciente. Numeros CRUS — a gravidade e calculada em src/lib/sinais-clinicos.ts, uma regua so para medico e paciente. Montada dinamicamente: rode de novo depois de aplicar migrations para ampliar as fontes.');
END
$view$;

-- (comentário aplicado dentro do bloco: fora dele, o caminho "nenhuma fonte
-- existe" terminava em erro justamente onde deveria sair de fininho)
SELECT 1 WHERE false; -- no-op
COMMENT ON TABLE public.clinical_acks IS
  'Desfecho que o medico registrou para um evento clinico. Guarda o que e DELE; a linha de origem pertence a paciente.';
