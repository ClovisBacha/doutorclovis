-- 1. Disponibilidade semanal do médico
CREATE TABLE IF NOT EXISTS public.doctor_availability (
  id           UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week  SMALLINT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom ... 6=Sáb
  start_time   TEXT      NOT NULL DEFAULT '08:00',
  end_time     TEXT      NOT NULL DEFAULT '18:00',
  slot_minutes INTEGER   NOT NULL DEFAULT 30,
  enabled      BOOLEAN   NOT NULL DEFAULT true,
  UNIQUE(day_of_week)
);
-- Padrão: segunda a sexta 08:00–12:00 e 14:00–18:00 (dois registros por dia não suportados aqui;
-- usamos um único horário contínuo por dia para simplicidade)
INSERT INTO public.doctor_availability (day_of_week, start_time, end_time, slot_minutes, enabled) VALUES
  (0, '08:00', '12:00', 30, false),
  (1, '08:00', '18:00', 30, true),
  (2, '08:00', '18:00', 30, true),
  (3, '08:00', '18:00', 30, true),
  (4, '08:00', '18:00', 30, true),
  (5, '08:00', '18:00', 30, true),
  (6, '08:00', '12:00', 30, false)
ON CONFLICT (day_of_week) DO NOTHING;

ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.doctor_availability TO anon, authenticated;
GRANT ALL ON public.doctor_availability TO service_role;
CREATE POLICY "public_read_availability"  ON public.doctor_availability FOR SELECT USING (true);
CREATE POLICY "auth_write_availability"   ON public.doctor_availability FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 2. Datas bloqueadas (férias, afastamento)
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  date       DATE      NOT NULL UNIQUE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.blocked_dates TO anon, authenticated;
GRANT ALL ON public.blocked_dates TO service_role;
CREATE POLICY "public_read_blocked"   ON public.blocked_dates FOR SELECT USING (true);
CREATE POLICY "auth_write_blocked"    ON public.blocked_dates FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 3. Campos adicionais em appointment_requests
ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS confirmed_date    DATE,
  ADD COLUMN IF NOT EXISTS confirmed_time    TEXT,
  ADD COLUMN IF NOT EXISTS payment_status    TEXT NOT NULL DEFAULT 'sem_cobranca',
  ADD COLUMN IF NOT EXISTS price_brl         INTEGER,         -- centavos
  ADD COLUMN IF NOT EXISTS internal_notes    TEXT;

-- Índice para calendar view
CREATE INDEX IF NOT EXISTS idx_appt_confirmed_date
  ON public.appointment_requests(confirmed_date)
  WHERE confirmed_date IS NOT NULL;
