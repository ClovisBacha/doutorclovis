-- Tema do céu da home do app.
--
-- NULL (padrão) = "v2", a arte por momento do dia. O valor só passa a existir
-- quando a paciente compra o Céu Clássico na Loja e o aplica — por isso não há
-- DEFAULT: quem nunca trocou continua no tema novo sem escrita nenhuma.
--
-- A coluna é validada no servidor contra os ids conhecidos (setSkyTheme), e o
-- app trata coluna ausente como "v2", então rodar esta migração é opcional
-- para o app funcionar — só é necessária para a troca persistir.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS sky_theme text;

COMMENT ON COLUMN public.patient_profiles.sky_theme IS
  'Tema do céu da home: NULL/v2 = arte por período; v1 = gradiente original (item tema-ceu-v1 da Loja).';
