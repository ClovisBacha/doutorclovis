-- ============================================================================
-- A CONSULTA VIRA OBJETO DO SISTEMA
-- ============================================================================
--
-- Hoje a consulta presencial não deixa rastro nenhum. `appointment_requests` é
-- um PEDIDO de horário — e nem sequer aponta para a conta da paciente: ela é
-- identificada por `patient_email`, texto livre digitado num formulário. Nota
-- clínica só existe em teleconsulta, e mesmo essa nunca chega a ela.
--
-- A consequência é a pergunta que o obstetra faz toda vez e que o sistema não
-- consegue responder: **"o que mudou desde a última consulta?"**. Sem uma
-- entidade com data, achados e conduta, não há de onde tirar o "desde".
--
-- E é isso que faz o dado ACUMULAR. Sem esta tabela, cada tela serve uma
-- consulta de cada vez; com ela, a gestação inteira vira uma linha do tempo com
-- pontos de decisão — que é onde mora o valor de um prontuário longitudinal.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIDA AFERIDA ≠ MEDIDA CASEIRA
--
-- As medidas daqui são as que ELE aferiu no consultório, e ficam em colunas
-- próprias em vez de irem para `health_logs`. Não é duplicação: são grandezas
-- com procedência diferente. A pressão que ela mede em casa, com aparelho de
-- braço e sem repouso, e a que ele afere não têm o mesmo peso na decisão — e
-- misturá-las num histórico só apagaria justamente a distinção que importa.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.consultations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id    uuid        NOT NULL,
  -- A PACIENTE PELA CONTA, e não por e-mail digitado num formulário. É a
  -- diferença entre um registro que se liga ao prontuário e um que não.
  user_id      uuid        NOT NULL,
  -- Quando ACONTECEU. Consulta lançada depois (o normal: ele registra à noite)
  -- precisa entrar na data certa, senão a linha do tempo mente.
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  kind         text        NOT NULL DEFAULT 'presencial'
                           CHECK (kind IN ('presencial', 'teleconsulta', 'retorno', 'urgencia')),

  -- O que ele viu e o que decidiu. Texto livre de propósito: conduta não cabe
  -- em enum, e um enum incompleto faz o médico escolher a opção menos errada
  -- em vez de escrever o que aconteceu.
  achados      text,
  conduta      text,

  -- MEDIDAS AFERIDAS. Mesmas faixas de `sinais-clinicos.ts` — se divergirem, a
  -- tela marca o que o banco aceita, ou o banco recusa o que a tela mostra.
  systolic         integer      CHECK (systolic IS NULL OR systolic BETWEEN 50 AND 300),
  diastolic        integer      CHECK (diastolic IS NULL OR diastolic BETWEEN 20 AND 200),
  weight_kg        numeric(5,2) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 25 AND 350),
  -- Altura uterina: uma das duas medidas que só existem em consultório.
  fundal_height_cm numeric(4,1) CHECK (fundal_height_cm IS NULL OR fundal_height_cm BETWEEN 5 AND 60),
  -- BPM FETAL, não materno. `health_logs.heart_rate_bpm` é dela; este é do bebê.
  fetal_bpm        integer      CHECK (fetal_bpm IS NULL OR fetal_bpm BETWEEN 60 AND 220),
  CONSTRAINT consultations_pa_par CHECK (num_nonnulls(systolic, diastolic) <> 1),

  /* O QUE ELA PODE VER.

     Separado de `achados`/`conduta` de propósito. O prontuário é escrito para
     outro médico — abreviado, técnico, às vezes com hipótese que assustaria sem
     contexto. Mostrar o campo cru para a paciente seria a versão clínica de
     vazamento; não mostrar nada é o que o produto faz hoje, e ela sai da
     consulta anotando à mão o que ele disse. O resumo é o que ele escolhe
     contar, escrito para ela. */
  resumo_paciente text,

  -- De qual pedido de agenda veio, quando veio. Nullable: consulta de urgência
  -- e encaixe não passam pela agenda.
  appointment_id uuid,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- A consulta é sempre lida "as N últimas desta paciente".
CREATE INDEX IF NOT EXISTS idx_consultations_paciente
    ON public.consultations (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_medico
    ON public.consultations (doctor_id, occurred_at DESC);

DO $fks$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.consultations'::regclass
       AND conname = 'consultations_user_id_fkey'
  ) THEN
    /* CASCADE: a paciente pediu para ser esquecida, o registro vai junto.
       A guarda de prontuário (CFM, 20 anos) é obrigação de quem tem o
       documento assinado — não justifica manter dado vivo e legível no painel
       depois de a conta ser apagada, que é o que uma FK sem `ON DELETE`
       produziria (a exclusão simplesmente FALHARIA). */
    ALTER TABLE public.consultations
      ADD CONSTRAINT consultations_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$fks$;

-- `updated_at` pelo relógio do SERVIDOR. Vindo do cliente, um aparelho com a
-- data errada reordena a evolução da paciente.
CREATE OR REPLACE FUNCTION public.touch_consultations_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $touch$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$touch$;

DROP TRIGGER IF EXISTS trg_touch_consultations ON public.consultations;
CREATE TRIGGER trg_touch_consultations
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.touch_consultations_updated_at();

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

/* A PACIENTE LÊ SÓ O QUE FOI ESCRITO PARA ELA.

   O Postgres não tem RLS por coluna, então uma policy de SELECT nesta tabela
   entregaria `achados` e `conduta` junto — o prontuário cru. Por isso ela NÃO
   tem policy de leitura aqui: o resumo chega pela server function, que devolve
   só `resumo_paciente`. É a mesma decisão que manteve o conteúdo do diário fora
   do fluxo de eventos do médico, na direção oposta. */
DROP POLICY IF EXISTS "servico gerencia consultas" ON public.consultations;
CREATE POLICY "servico gerencia consultas" ON public.consultations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.consultations FROM anon, authenticated;
GRANT ALL ON public.consultations TO service_role;

COMMENT ON TABLE public.consultations IS
  'A consulta como objeto: data, achados, conduta e medidas AFERIDAS em consultorio (distintas das caseiras de health_logs). E a ancora de "o que mudou desde a ultima consulta".';

/* ────────────────────────────────────────────────────────────────────────────
   DUPLICATA NÃO ENTRA

   Dois `INSERT` idênticos criavam duas consultas — e como o painel usa
   `consultas[0]` para ancorar "o que mudou desde a última", com `occurred_at`
   empatado o Postgres devolve em ordem arbitrária: a conduta exibida e o peso
   base da comparação saíam de uma das duas, indeterminada.

   Mesmo remédio já usado contra double-booking de horário (`appt_confirmed_slot`).
   ──────────────────────────────────────────────────────────────────────────── */
CREATE UNIQUE INDEX IF NOT EXISTS consultations_sem_duplicata
    ON public.consultations (doctor_id, user_id, occurred_at);
