-- ════════════════════════════════════════════════════════════════════════
-- 20260720120000 — DoctorThink: API keys (produto do Segundo Cérebro)
-- ════════════════════════════════════════════════════════════════════════
-- Chaves de API por inquilino (app cliente) para consumir o DoctorThink via
-- /api/doctorthink/*. Guardamos só o HASH (sha256) da chave — nunca a chave
-- crua. Server-only: todo acesso passa por service_role.

CREATE TABLE IF NOT EXISTS public.doctorthink_api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,               -- app cliente (ex.: 'obstetrica')
  name         text,                        -- rótulo humano da chave
  key_hash     text NOT NULL UNIQUE,        -- sha256 hex da chave crua
  active       boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dtk_keys_hash ON public.doctorthink_api_keys(key_hash);

ALTER TABLE public.doctorthink_api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.doctorthink_api_keys FROM anon, authenticated;
GRANT ALL ON public.doctorthink_api_keys TO service_role;
