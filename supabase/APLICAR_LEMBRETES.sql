-- ============================================================================
--  LEMBRETES DE CONSULTA (24 h e 4 h) — o registro do que já foi enviado
--  Idempotente: pode rodar mais de uma vez.
-- ----------------------------------------------------------------------------
--  POR QUE UMA TABELA, E NÃO UMA COLUNA
--
--  A coluna teria de existir em DUAS tabelas (`appointment_requests` e
--  `teleconsulta_sessions`), duplicada, e cresceria de novo a cada espécie nova
--  de lembrete. Uma linha por (fonte, id, espécie) serve às duas e à próxima.
--
--  ── ESTA TABELA É O QUE IMPEDE O SPAM ──────────────────────────────────────
--
--  O cron passa de hora em hora pela MESMA consulta. Sem registro, a paciente
--  recebe "sua consulta é amanhã" a cada hora até a consulta acontecer — e
--  desliga as notificações do app, que é o mesmo canal por onde chega o aviso
--  de emergência.
--
--  A chave única é o que garante isso mesmo com duas execuções simultâneas do
--  cron: a segunda esbarra no índice em vez de mandar de novo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'consulta' | 'teleconsulta'
  fonte text NOT NULL,
  fonte_id uuid NOT NULL,
  -- '24h' | '4h'
  especie text NOT NULL CHECK (especie IN ('24h','4h')),
  enviado_em timestamptz NOT NULL DEFAULT now(),
  -- Para diagnóstico: chegou por push, por e-mail, ou por nenhum dos dois.
  canais text
);

-- O índice é a regra, não uma otimização: é ele que torna o envio duplo
-- impossível mesmo se dois crons rodarem no mesmo segundo.
CREATE UNIQUE INDEX IF NOT EXISTS appointment_reminders_uma_vez
  ON public.appointment_reminders (fonte, fonte_id, especie);

-- A varredura lê "o que já mandei nas últimas 48 h".
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_recentes
  ON public.appointment_reminders (enviado_em);

COMMENT ON TABLE public.appointment_reminders IS
  'O que já foi lembrado. A régua de QUANDO lembrar vive em src/lib/lembretes.ts (função pura, testada); esta tabela só guarda o que já saiu, e o índice único impede o envio duplo.';

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;
-- Sem política nenhuma: só o service role escreve e lê. Ninguém mais tem o que
-- fazer aqui, e uma política a mais seria superfície a mais.
GRANT ALL ON public.appointment_reminders TO service_role;
