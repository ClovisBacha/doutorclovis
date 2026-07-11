-- ════════════════════════════════════════════════════════════════════════
-- Assinaturas (Stripe) — fonte de verdade agnóstica de origem
-- ════════════════════════════════════════════════════════════════════════
-- Uma linha por assinatura ativa/histórica, seja qual for a origem do
-- pagamento (Stripe hoje; Apple/Google no futuro). O webhook do provedor é o
-- ÚNICO que escreve aqui (via service_role). Os "flags derivados" que o resto
-- do app já lê continuam valendo:
--   • paciente premium  → patient_profiles.quiz_premium
--   • plano do médico   → doctors.plan / doctors.active / doctors.plan_expires_at
-- O webhook liga/desliga esses flags conforme o status da assinatura.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL,
  -- 'quiz_premium' (paciente) | 'doctor_plan' (médico)
  product                text NOT NULL,
  -- quiz: 'monthly' | 'annual'  ·  médico: 'starter' | 'pro'
  plan                   text,
  -- 'stripe' | 'apple' | 'google' | 'comp' (cortesia manual)
  source                 text NOT NULL DEFAULT 'stripe',
  -- espelha o status do provedor: active | trialing | past_due | canceled | incomplete
  status                 text NOT NULL DEFAULT 'incomplete',
  stripe_customer_id     text,
  stripe_subscription_id text UNIQUE,
  current_period_end     timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON public.subscriptions(stripe_customer_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- A paciente/médico lê a PRÓPRIA assinatura (para a UI "Gerenciar assinatura").
DROP POLICY IF EXISTS "own subscriptions read" ON public.subscriptions;
CREATE POLICY "own subscriptions read" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Ninguém no papel "authenticated" escreve: só o service_role (webhook).
-- (Sem policy de INSERT/UPDATE/DELETE para authenticated = negado por padrão.)
GRANT SELECT ON public.subscriptions TO authenticated;

-- Coluna de expiração do plano do médico (se ainda não existir).
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

-- Toca updated_at automaticamente.
CREATE OR REPLACE FUNCTION public.touch_subscription_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_touch_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_updated_at();
