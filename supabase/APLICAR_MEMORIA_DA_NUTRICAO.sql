-- ═══════════════════════════════════════════════════════════════════════════
-- A NUTRICIONISTA LEMBRA — as preferências dela, e a conversa de ontem.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Medido antes de escrever (set/2026): a nutricionista lia DUAS tabelas do
-- banco (perfil e health_logs) e nada mais. Não havia onde a paciente dizer
-- "sou vegetariana" ou "não como porco" — só a alergia, que é outra coisa —, e
-- a conversa morria com a aba: a pergunta de ontem sobre o ferro não existia
-- mais hoje. Uma nutricionista que recomeça do zero a cada visita não é
-- personalizada, por mais que saiba a semana.
--
-- 1. `patient_profiles.food_preferences` — texto livre, escrito por ELA, na
--    própria aba da nutrição. Não é alergia (esta continua em `allergies`,
--    com a instrução de segurança própria): é o que ela não come e o que
--    prefere. Ela escreve direto do navegador, como escreve a bio e a alergia.
--
-- 2. `nutricao_mensagens` — os turnos da conversa com a nutricionista.
--    ⚠️ NÃO é `chat_messages`: aquela é a transcrição CLÍNICA que o médico lê
--    no prontuário, e a nutrição ali poluiria o que ele lê. Tabela própria,
--    lida e escrita pela PACIENTE (RLS por `user_id`), e apagada junto com a
--    conta (CASCADE) e com "apagar minhas conversas".
--    A `assinatura` é o HMAC que o servidor põe em cada resposta
--    (`turno-assinado.server.ts`): é ela que deixa o turno do assistente
--    voltar ao modelo numa visita futura. Uma linha forjada pelo navegador
--    não tem assinatura válida e é descartada pelo servidor — guardar aqui
--    não abre a forja.
--
-- Idempotente: rodar de novo é seguro.

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS food_preferences text;

COMMENT ON COLUMN public.patient_profiles.food_preferences IS
  'Preferências e restrições alimentares escritas pela paciente (vegetariana, não come porco…). NÃO é alergia — esta fica em allergies.';

CREATE TABLE IF NOT EXISTS public.nutricao_mensagens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user','assistant')),
  content     text NOT NULL CHECK (char_length(content) <= 8000),
  assinatura  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutricao_msgs_user
  ON public.nutricao_mensagens(user_id, created_at DESC);

ALTER TABLE public.nutricao_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutricao_mensagens: dona lê" ON public.nutricao_mensagens;
CREATE POLICY "nutricao_mensagens: dona lê"
  ON public.nutricao_mensagens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "nutricao_mensagens: dona escreve" ON public.nutricao_mensagens;
CREATE POLICY "nutricao_mensagens: dona escreve"
  ON public.nutricao_mensagens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "nutricao_mensagens: dona apaga" ON public.nutricao_mensagens;
CREATE POLICY "nutricao_mensagens: dona apaga"
  ON public.nutricao_mensagens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.nutricao_mensagens TO authenticated;
GRANT ALL ON public.nutricao_mensagens TO service_role;

-- Conferência.
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patient_profiles' AND column_name = 'food_preferences'
  ) AS preferencias_ok,
  to_regclass('public.nutricao_mensagens') IS NOT NULL AS memoria_ok;
