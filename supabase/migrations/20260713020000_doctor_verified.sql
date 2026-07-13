-- ════════════════════════════════════════════════════════════════════════
-- Diretório seguro: médico só aparece na busca depois de VERIFICADO
-- ════════════════════════════════════════════════════════════════════════
-- Sem isto, qualquer conta se cadastra como "médico" (active=true por padrão)
-- e entra no diretório público sem checagem de CRM. Agora a busca exige
-- verified=true; o super-admin verifica cada médico no console da plataforma.
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
