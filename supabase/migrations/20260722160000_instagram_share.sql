-- ════════════════════════════════════════════════════════════════════════
-- Compartilhamento no Instagram → 100 Sementinhas (automático)
-- ════════════════════════════════════════════════════════════════════════
-- A paciente registra o @ dela do Instagram; quando ela marca @obstetrica.app
-- num Story, o webhook do Instagram (Graph/Messaging API) casa o @ com a conta
-- e credita 100 🌱 (no máx. 1x por semana, idempotente pelo ledger). O crédito
-- é sempre server-only, como todo ganho de Sementinhas.

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS instagram_handle text;

-- Busca por @ no webhook (case-insensitive; já gravamos normalizado em minúsculo).
CREATE INDEX IF NOT EXISTS idx_patient_profiles_instagram_handle
  ON public.patient_profiles (instagram_handle);
