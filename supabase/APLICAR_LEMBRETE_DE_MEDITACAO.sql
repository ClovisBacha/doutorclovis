-- ============================================================================
--  LEMBRETE DIÁRIO DE MEDITAÇÃO — o horário que ela escolheu
--  Idempotente: pode rodar mais de uma vez.
-- ----------------------------------------------------------------------------
--  POR QUE COLUNAS, E NÃO UMA TABELA
--
--  É UM valor por paciente, sem histórico e sem espécie: "quero ser lembrada às
--  21h". Uma tabela só para isso teria uma linha por pessoa, uma chave única
--  para garantir que é uma só, e uma junção a cada varredura do cron.
--
--  ── POR QUE O HORÁRIO É GUARDADO EM UTC ────────────────────────────────────
--
--  O servidor não sabe em que fuso ela está, e nenhum banco resolve isso
--  sozinho. `med_reminder_utc_min` são os MINUTOS DEPOIS DA MEIA-NOITE UTC: o
--  cron compara com o próprio relógio, sem tabela de fuso e sem biblioteca.
--
--  `med_reminder_offset` é o deslocamento dela (São Paulo: −180). Ele não
--  serve para disparar — serve para o servidor saber que dia é HOJE no quarto
--  dela, e assim NÃO mandar o lembrete para quem já meditou. Sem ele, a
--  paciente que medita às 22h receberia o empurrão logo depois de terminar.
--
--  ── ⚠️ `med_reminder_sent_at` É COLUNA DO SERVIDOR ─────────────────────────
--
--  Ela é o que impede o lembrete repetido — e por isso o `REVOKE` no fim: o
--  navegador não escreve nela. Mesmo padrão de `referred_by` (ver
--  20260722180000_patient_referral.sql).
--
--  E o registro é um INSTANTE, não uma data: contar "uma vez por dia do
--  calendário" mandaria duas vezes para quem escolhe 21h em São Paulo — 23:50
--  UTC cai num dia, 00:10 cai no seguinte. A regra é "faz menos de 20 h".
-- ============================================================================

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS med_reminder_utc_min smallint;
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS med_reminder_offset smallint NOT NULL DEFAULT 0;
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS med_reminder_sent_at timestamptz;

-- Faixa plausível: 0..1439 minutos, e deslocamento entre −12 h e +14 h.
-- NULL em `utc_min` é o estado normal de quem não quer lembrete.
DO $$
BEGIN
  ALTER TABLE public.patient_profiles
    ADD CONSTRAINT patient_profiles_med_reminder_min_ok
    CHECK (med_reminder_utc_min IS NULL
           OR (med_reminder_utc_min >= 0 AND med_reminder_utc_min <= 1439));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.patient_profiles
    ADD CONSTRAINT patient_profiles_med_reminder_offset_ok
    CHECK (med_reminder_offset >= -720 AND med_reminder_offset <= 840);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A varredura do cron lê SÓ quem pediu lembrete. Índice parcial porque a
-- esmagadora maioria das linhas tem NULL aqui, e elas não precisam ser lidas.
CREATE INDEX IF NOT EXISTS idx_patient_profiles_med_reminder
  ON public.patient_profiles (med_reminder_utc_min)
  WHERE med_reminder_utc_min IS NOT NULL;

-- ⚠️ O navegador não escreve o carimbo de envio. Sem isto, qualquer cliente
-- poderia empurrar a data para a frente e silenciar o próprio lembrete — ou,
-- pior, para trás, e receber um push por hora.
REVOKE UPDATE (med_reminder_sent_at) ON public.patient_profiles FROM authenticated;
