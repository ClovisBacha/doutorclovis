-- Cupons de plataforma (super-admin): códigos que o DONO gera manualmente
-- para liberar o Premium do app (promoções, parcerias, cortesias). Diferente
-- dos convites do médico (invite_codes): estes não pertencem a um médico e
-- podem ter múltiplos usos (max_redemptions null = ilimitado).
CREATE TABLE IF NOT EXISTS public.platform_coupons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  kind            text NOT NULL DEFAULT 'premium',   -- o que o cupom concede
  max_redemptions int,                                -- null = ilimitado
  active          boolean NOT NULL DEFAULT true,
  note            text,                               -- rótulo interno (ex.: "Campanha Instagram")
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Um resgate por usuário por cupom (idempotente + conta os usos distintos).
CREATE TABLE IF NOT EXISTS public.platform_coupon_redemptions (
  coupon_id   uuid NOT NULL,
  user_id     uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coupon_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON public.platform_coupon_redemptions(coupon_id);

ALTER TABLE public.platform_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_coupon_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_coupons FROM anon, authenticated;
REVOKE ALL ON public.platform_coupon_redemptions FROM anon, authenticated;
GRANT ALL ON public.platform_coupons TO service_role;
GRANT ALL ON public.platform_coupon_redemptions TO service_role;
