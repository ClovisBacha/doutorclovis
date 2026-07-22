-- ════════════════════════════════════════════════════════════════════════
-- Cenário equipado do Cantinho (só 1 fundo ativo por vez). NULL = sem cenário.
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS cantinho_fundo text;
