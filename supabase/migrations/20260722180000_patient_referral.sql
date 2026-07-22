-- ════════════════════════════════════════════════════════════════════════
-- Indicar uma amiga → 100 Sementinhas quando ela cria a conta
-- ════════════════════════════════════════════════════════════════════════
-- Cada paciente tem um código próprio (referral_code). Quando uma amiga entra
-- pelo link (?amiga=CODE) e cria a conta, a indicadora ganha 100 🌱 — uma vez
-- por amiga. `referred_by` guarda quem indicou (fixado uma vez). Crédito
-- server-only, como todo ganho de Sementinhas.

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid;

-- Código único por paciente (parcial: permite vários NULL de quem ainda não gerou).
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_profiles_referral_code
  ON public.patient_profiles (referral_code)
  WHERE referral_code IS NOT NULL;

-- Busca de quem uma paciente indicou (para contar indicações).
CREATE INDEX IF NOT EXISTS idx_patient_profiles_referred_by
  ON public.patient_profiles (referred_by);

-- IMUTABILIDADE (anti-fraude): a paciente NÃO pode escrever essas duas colunas
-- pelo próprio cliente (RLS é por LINHA, não por coluna). Sem isto, ela poderia
-- resetar `referred_by` pra null e reindicar-se a vários "indicadores". Só a
-- service role (server functions) grava — a paciente segue editando o resto do
-- perfil normalmente (o cliente nunca inclui estas colunas no payload).
REVOKE UPDATE (referred_by, referral_code) ON public.patient_profiles FROM authenticated;
