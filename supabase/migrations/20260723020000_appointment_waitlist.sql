-- ════════════════════════════════════════════════════════════════════════
-- Fila de espera por semana + cascata quando abre vaga
-- ════════════════════════════════════════════════════════════════════════
-- Sem horário na semana desejada, a paciente entra na FILA daquela semana.
-- Quando uma consulta confirmada é CANCELADA, a vaga é oferecida à 1ª da fila,
-- que tem 4h pra aceitar; se não responder, passa pra próxima (cascata). Tudo
-- server-only (service role) — a paciente nunca escreve direto nesta tabela.

CREATE TABLE IF NOT EXISTS public.appointment_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid,
  patient_name text NOT NULL,
  patient_email text NOT NULL,
  patient_phone text,
  reason text,
  week_start date NOT NULL, -- segunda-feira da semana desejada
  status text NOT NULL DEFAULT 'waiting', -- waiting|offered|booked|expired|declined|cancelled
  offer_date date, -- data do slot ofertado (veio do cancelamento)
  offer_time text,
  offer_deadline timestamptz, -- prazo pra responder à oferta (4h)
  offered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ordem da fila e busca por (médico, semana, status).
CREATE INDEX IF NOT EXISTS idx_waitlist_queue
  ON public.appointment_waitlist (doctor_id, week_start, status, created_at);

-- Cron/varredura: ofertas vencidas.
CREATE INDEX IF NOT EXISTS idx_waitlist_deadline
  ON public.appointment_waitlist (status, offer_deadline);

-- Uma paciente não entra duas vezes na MESMA semana enquanto está ativa.
-- NULLS NOT DISTINCT (PG15+) é ESSENCIAL: na instalação única o doctor_id é
-- NULL em todas as linhas; sem isto o índice não deduplicaria nada.
DROP INDEX IF EXISTS public.idx_waitlist_unique_active;
CREATE UNIQUE INDEX idx_waitlist_unique_active
  ON public.appointment_waitlist (doctor_id, week_start, lower(patient_email))
  NULLS NOT DISTINCT
  WHERE status IN ('waiting', 'offered');

ALTER TABLE public.appointment_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointment_waitlist FROM anon, authenticated;
GRANT ALL ON public.appointment_waitlist TO service_role;
