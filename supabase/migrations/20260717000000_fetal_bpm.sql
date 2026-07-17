-- "Sentir o coração" v2 (estilo Trellis): o médico registra o BPM fetal real
-- medido na consulta/ultrassom e o Painel do Papai vibra no ritmo exato do
-- bebê — sem a família precisar ajustar manualmente.
-- Idempotente: pode rodar mais de uma vez.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS fetal_bpm integer,
  ADD COLUMN IF NOT EXISTS fetal_bpm_at date;
