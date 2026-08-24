-- ============================================================================
--  A CONSULTA GANHA DURAÇÃO — o intervalo, não só o instante
--  Idempotente: pode rodar mais de uma vez.
-- ----------------------------------------------------------------------------
--  O QUE ESTAVA FALTANDO
--
--  `appointment_requests` guardava só o INÍCIO da consulta (`confirmed_time`).
--  Duas consultas marcadas em horários próximos — 10:00 e 10:15, por exemplo —
--  não tinham hora IGUAL, então a checagem de choque (que comparava só o minuto
--  exato) deixava passar, mesmo a segunda começando bem no meio da primeira.
--
--  Decisão do dono (ago/2026): "das 10h até as 11h, tem que ter o intervalo da
--  consulta".
--
--  ── EM MINUTOS, E NÃO UMA SEGUNDA COLUNA DE HORA-FIM ───────────────────────
--
--  Uma coluna `confirmed_time_end` reabriria o mesmo problema que
--  `confirmed_time` já tem — texto solto, sem fuso, sem garantia de bater com
--  o início. Duração em minutos é um número só: soma-se ao início para achar o
--  fim, na mesma régua pura que já testa a agenda inteira
--  (`src/lib/agenda-unificada.ts`, `minutosDesdeMeiaNoite`/`horaDosMinutos`).
--
--  ── NULO CONTINUA SENDO VÁLIDO ──────────────────────────────────────────────
--
--  Todo pedido feito pela paciente, e toda consulta marcada antes deste SQL,
--  não tem duração combinada. `NULL` é o valor honesto para esses — a LEITURA
--  (não o banco) assume 30 minutos só para efeito de colisão, sem gravar esse
--  padrão de volta na linha.
-- ============================================================================

ALTER TABLE IF EXISTS public.appointment_requests
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

ALTER TABLE IF EXISTS public.appointment_requests
  DROP CONSTRAINT IF EXISTS appointment_requests_duration_minutes_check;

ALTER TABLE IF EXISTS public.appointment_requests
  ADD CONSTRAINT appointment_requests_duration_minutes_check
  CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 5 AND 240);

COMMENT ON COLUMN public.appointment_requests.duration_minutes IS
  'Quanto tempo a consulta ocupa, em minutos (5–240). NULL = duração não combinada (pedido da paciente, ou consulta marcada antes deste campo existir) — a leitura assume 30 min só para efeito de colisão, em src/lib/agenda-unificada.ts.';
