-- ════════════════════════════════════════════════════════════════════════
-- 20260720140000 — DoctorThink: medição de uso (metering p/ faturamento)
-- ════════════════════════════════════════════════════════════════════════
-- Um registro por chamada de API (ask/train). Base para cobrar por uso e para
-- o dono ver o consumo por inquilino. Server-only.

CREATE TABLE IF NOT EXISTS public.doctorthink_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  doctor_id    uuid,
  endpoint     text NOT NULL,        -- 'ask' | 'train'
  had_coverage boolean,              -- só no ask: o cérebro cobriu a pergunta?
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dtk_usage_created ON public.doctorthink_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_dtk_usage_tenant ON public.doctorthink_usage(tenant_id);

ALTER TABLE public.doctorthink_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.doctorthink_usage FROM anon, authenticated;
GRANT ALL ON public.doctorthink_usage TO service_role;
