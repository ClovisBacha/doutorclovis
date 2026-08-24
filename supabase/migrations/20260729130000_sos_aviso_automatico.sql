-- ============================================================================
-- SOS — aviso automático de emergência
-- ============================================================================
-- Até aqui o botão de emergência só gravava o evento e abria o WhatsApp com a
-- mensagem pronta: quem enviava era a paciente. Se ela não conseguisse
-- concluir, ninguém ficava sabendo.
--
-- Estas duas colunas são o que falta para o envio ser automático:
--
--  · `emergency_email` — o e-mail do contato de emergência. É o único canal
--    que chega em alguém de fora do app sem depender de provedor de SMS: o
--    Resend já está no ar para as confirmações de consulta. Sem ele, só dá
--    para avisar o médico (que tem conta) e a paciente precisa terminar o
--    aviso ao contato pela mão.
--
--  · `panic_events.channels` — o que DE FATO saiu em cada acionamento (push do
--    médico, e-mail do médico, e-mail do contato, SMS). Numa emergência, saber
--    depois se o aviso saiu ou não é a diferença entre corrigir um problema e
--    descobrir tarde demais que ele existia.
-- ============================================================================

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS emergency_email text;

ALTER TABLE public.panic_events
  ADD COLUMN IF NOT EXISTS channels jsonb;

COMMENT ON COLUMN public.patient_profiles.emergency_email IS
  'E-mail do contato de emergência — recebe o aviso automático do SOS.';
COMMENT ON COLUMN public.panic_events.channels IS
  'Canais que saíram neste acionamento: {"medicoPush":n,"medicoEmail":bool,"contatoEmail":bool,"sms":bool}.';
