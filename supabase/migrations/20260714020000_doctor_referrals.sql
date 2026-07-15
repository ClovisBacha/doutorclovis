-- Indicação médico→médico (referral). Cada médico indica colegas pela URL
-- /medicos/cadastro?ref=<doctorId>. Quando o indicado ASSINA um plano pago
-- (evento real do Stripe), o indicador ganha +30 dias — recompensa difícil de
-- fraudar (exige pagamento de verdade). `referral_rewarded` garante 1 vez só.

ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS referred_by uuid;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS referral_rewarded boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_doctors_referred_by ON public.doctors(referred_by);
