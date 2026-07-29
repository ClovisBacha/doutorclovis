-- Telefone da própria gestante.
--
-- Faltava no perfil: havia o telefone do CONTATO de emergência, mas não o
-- dela. Numa emergência isso é o primeiro número que quem recebe o socorro
-- tenta — antes de sair de casa, antes de ligar para o hospital, a pessoa
-- liga para ela para saber se atende. Sem esse campo, o aviso pedia ajuda
-- sem dizer como falar com quem precisa dela.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.patient_profiles.phone IS
  'Telefone/WhatsApp da gestante — vai no aviso do SOS para quem for ajudar.';
