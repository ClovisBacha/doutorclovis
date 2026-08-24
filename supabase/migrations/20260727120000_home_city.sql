-- Cidade onde a paciente mora.
--
-- O céu, o clima e a chuva do app são a janela dela: se o lugar estiver
-- errado, tudo mente junto. A cadeia de origem já era GPS → IP da borda →
-- clínica; esta coluna entra entre os dois primeiros.
--
-- Por que ela ganha do IP: o IP erra em VPN, em viagem e quando a operadora
-- roteia o tráfego por outro estado — casos em que a paciente continua
-- morando onde sempre morou. O GPS continua mandando quando existe, porque
-- é o único que sabe onde ela está AGORA.
--
-- Guardamos as coordenadas junto do nome de propósito: a busca de cidade é
-- resolvida UMA vez, na hora de salvar, e nunca mais. Sem isso, toda abertura
-- do app pagaria uma geocodificação só para redescobrir a mesma cidade.
--
-- Nada aqui é obrigatório: quem não preencher segue com IP e clínica.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS home_city text,
  ADD COLUMN IF NOT EXISTS home_lat double precision,
  ADD COLUMN IF NOT EXISTS home_lon double precision;

COMMENT ON COLUMN public.patient_profiles.home_city IS
  'Cidade informada no cadastro (ex.: "Belo Horizonte, MG"). Só rótulo — quem manda no clima são home_lat/home_lon.';
COMMENT ON COLUMN public.patient_profiles.home_lat IS
  'Latitude da cidade, resolvida na busca ao salvar. Usada quando não há GPS.';
COMMENT ON COLUMN public.patient_profiles.home_lon IS
  'Longitude da cidade, resolvida na busca ao salvar. Usada quando não há GPS.';
