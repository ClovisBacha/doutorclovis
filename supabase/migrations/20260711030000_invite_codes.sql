-- ════════════════════════════════════════════════════════════════════════
-- Códigos de convite gerados na hora (uso único) — Elite/Black
-- ════════════════════════════════════════════════════════════════════════
-- O médico gera um código no momento (não há código fixo). Cada código é de
-- USO ÚNICO: uma paciente resgata e ele é consumido. A cota mensal do plano
-- conta os códigos GERADOS no mês (Elite 25, Black 250).

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  doctor_id    uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  redeemed_by  uuid,
  redeemed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_doctor_month
  ON public.invite_codes(doctor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- O médico lê os próprios códigos (histórico/contador). A paciente NÃO precisa
-- ler (resgata via server function); escrita só via service_role.
DROP POLICY IF EXISTS "doctor reads own codes" ON public.invite_codes;
CREATE POLICY "doctor reads own codes" ON public.invite_codes
  FOR SELECT USING (auth.uid() = doctor_id);

GRANT SELECT ON public.invite_codes TO authenticated;
