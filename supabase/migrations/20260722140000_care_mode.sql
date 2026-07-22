-- ════════════════════════════════════════════════════════════════════════
-- Modo Cuidado 🤍 — pausa ética da gamificação em momentos sensíveis
-- ════════════════════════════════════════════════════════════════════════
-- Quando ativo (perda gestacional, complicação, ou simplesmente um momento
-- difícil), o app silencia comemorações, streaks, moeda e contagens, e troca
-- por acolhimento. NADA é deletado — o que a paciente construiu é preservado.
-- É um estado da própria paciente (ela ativa/desativa quando quiser).

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS care_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS care_mode_since timestamptz;
