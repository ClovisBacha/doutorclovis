-- ════════════════════════════════════════════════════════════════════════
-- 20260720000000 — Suite de controle do dono (super-admin)
-- ════════════════════════════════════════════════════════════════════════
-- Tabelas novas para: comunicados (broadcast), feature flags, NPS, log de
-- auditoria (LGPD) e incidentes de pagamento (reembolsos/disputas do Stripe).
-- Todas server-only: RLS ligado sem policy + REVOKE anon/authenticated +
-- GRANT service_role — todo acesso passa por server functions (supabaseAdmin).

-- ── Comunicados (broadcast) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  audience   text NOT NULL DEFAULT 'todos',  -- 'medicos' | 'pacientes' | 'todos'
  level      text NOT NULL DEFAULT 'info',    -- 'info' | 'success' | 'warning'
  active     boolean NOT NULL DEFAULT true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.platform_announcements(active);

CREATE TABLE IF NOT EXISTS public.announcement_dismissals (
  announcement_id uuid NOT NULL,
  user_id         uuid NOT NULL,
  dismissed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- ── Feature flags / kill switch ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT true,
  rollout_pct int NOT NULL DEFAULT 100,  -- 0..100 (rollout gradual determinístico)
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── NPS (satisfação de médicos e pacientes) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.nps_responses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  role       text NOT NULL,              -- 'medico' | 'paciente'
  score      int NOT NULL,               -- 0..10
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nps_created ON public.nps_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_nps_user ON public.nps_responses(user_id);

-- ── Log de auditoria (LGPD / segurança) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid,
  actor_email text,
  action      text NOT NULL,             -- 'doctor.status' | 'coupon.create' | ...
  target      text,                      -- id/descrição do alvo
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log(action);

-- ── Incidentes de pagamento (reembolsos / disputas do Stripe) ────────────
CREATE TABLE IF NOT EXISTS public.payment_incidents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL,       -- 'refund' | 'dispute'
  stripe_charge_id   text,
  stripe_customer_id text,
  user_id            uuid,
  amount_cents       int NOT NULL DEFAULT 0,
  reason             text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, stripe_charge_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_incidents_created ON public.payment_incidents(created_at);

-- ── Segurança: tudo server-only ──────────────────────────────────────────
ALTER TABLE public.platform_announcements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_flags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_responses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_incidents        ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_announcements  FROM anon, authenticated;
REVOKE ALL ON public.announcement_dismissals FROM anon, authenticated;
REVOKE ALL ON public.platform_flags          FROM anon, authenticated;
REVOKE ALL ON public.nps_responses           FROM anon, authenticated;
REVOKE ALL ON public.audit_log               FROM anon, authenticated;
REVOKE ALL ON public.payment_incidents       FROM anon, authenticated;

GRANT ALL ON public.platform_announcements  TO service_role;
GRANT ALL ON public.announcement_dismissals TO service_role;
GRANT ALL ON public.platform_flags          TO service_role;
GRANT ALL ON public.nps_responses           TO service_role;
GRANT ALL ON public.audit_log               TO service_role;
GRANT ALL ON public.payment_incidents       TO service_role;
