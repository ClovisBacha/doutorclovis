-- Cobertura do Segundo Cerebro — ver supabase/APLICAR_COBERTURA.sql para o
-- porque e as consultas prontas.

ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS cobertura boolean,
  ADD COLUMN IF NOT EXISTS similaridade real;

