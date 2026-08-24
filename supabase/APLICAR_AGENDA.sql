-- ════════════════════════════════════════════════════════════════════
-- APLICAR no Supabase da Obstétrica (SQL Editor). Idempotente: pode rodar
-- mais de uma vez. Liga o fluxo novo de AGENDA: contraproposta de horário
-- e fila de espera.
-- ════════════════════════════════════════════════════════════════════

-- ── As colunas de que este arquivo DEPENDE ────────────────────────────────
-- Elas nascem em `20260610010000_doctor_scheduling.sql`, que é POSTERIOR a
-- 20260608120000 — ou seja, está entre as migrations pendentes em produção.
--
-- Sem estas duas linhas, o índice `appt_confirmed_slot` mais abaixo falhava
-- com 42703 (coluna não existe). E o SQL Editor do Supabase roda o arquivo
-- inteiro numa transação: o erro derrubava TUDO junto, inclusive a
-- `appointment_waitlist` criada depois. O dono rodava o arquivo que o
-- CLAUDE.md manda rodar, via um erro, e ficava sem fila de espera nenhuma —
-- exatamente o que ele estava tentando ligar.
--
-- Um arquivo "APLICAR" precisa bastar-se: quem o roda não sabe quais
-- migrations o banco dele já viu.
ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS confirmed_date date;

ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS confirmed_time text;

-- ── Contraproposta: o médico sugere outro horário e a paciente aprova ──────
ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS proposed_date date;

ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS proposed_time text;

-- Backstop contra double-booking (parcial, só 'confirmed'; NULLS NOT DISTINCT
-- cobre a instalação única com doctor_id NULL). Se falhar por duplicata já
-- existente em produção, ajuste as confirmações conflitantes e rode de novo.
CREATE UNIQUE INDEX IF NOT EXISTS appt_confirmed_slot
  ON public.appointment_requests (doctor_id, confirmed_date, confirmed_time)
  NULLS NOT DISTINCT
  WHERE status = 'confirmed';


-- ── Fila de espera por semana + cascata quando abre vaga ───────────────────
CREATE TABLE IF NOT EXISTS public.appointment_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid,
  patient_name text NOT NULL,
  patient_email text NOT NULL,
  patient_phone text,
  reason text,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  offer_date date,
  offer_time text,
  offer_deadline timestamptz,
  offered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_queue
  ON public.appointment_waitlist (doctor_id, week_start, status, created_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_deadline
  ON public.appointment_waitlist (status, offer_deadline);
-- NULLS NOT DISTINCT é essencial: na instalação única o doctor_id é NULL.
DROP INDEX IF EXISTS public.idx_waitlist_unique_active;
CREATE UNIQUE INDEX idx_waitlist_unique_active
  ON public.appointment_waitlist (doctor_id, week_start, lower(patient_email))
  NULLS NOT DISTINCT
  WHERE status IN ('waiting', 'offered');

ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointment_waitlist FROM anon, authenticated;
GRANT ALL ON public.appointment_waitlist TO service_role;
