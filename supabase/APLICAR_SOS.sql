-- ============================================================================
-- SOS — aviso automático de emergência  (aplicar no SQL Editor do Supabase)
-- ============================================================================
-- Idempotente: pode rodar mais de uma vez.
--
--  · patient_profiles.emergency_email — o e-mail do contato de emergência. É o
--    único canal que o app consegue disparar SOZINHO até alguém de fora (o
--    Resend já está no ar). Sem ele, o SOS avisa o médico na hora e a paciente
--    ainda precisa terminar o aviso à família pela mão.
--
--  · panic_events.channels — o que DE FATO saiu em cada acionamento. Numa
--    emergência, saber depois se o aviso saiu é a diferença entre corrigir um
--    problema e descobrir tarde demais que ele existia.
-- ============================================================================

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS emergency_email text;

ALTER TABLE public.panic_events
  ADD COLUMN IF NOT EXISTS channels jsonb;

COMMENT ON COLUMN public.patient_profiles.emergency_email IS
  'E-mail do contato de emergência — recebe o aviso automático do SOS.';
COMMENT ON COLUMN public.panic_events.channels IS
  'Canais que saíram neste acionamento: {"medicoPush":n,"medicoEmail":bool,"contatoEmail":bool,"sms":bool}.';
