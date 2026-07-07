-- ─────────────────────────────────────────────────────────────────────────────
-- Segundo Cérebro — POR PERFIL DE MÉDICO
-- Base de conhecimento de cada médico (persona + Q&A reais) usada pela IA do
-- chatbot do site e do agente WhatsApp para responder como o próprio doutor.
-- Tabelas chaveadas por doctor_id (uid do médico no auth): cada perfil de
-- médico tem o SEU cérebro, com estilo e respostas próprios.
-- Acesso EXCLUSIVO via service_role (server functions com gate de admin) —
-- nenhuma policy para anon/authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

-- Transformação do shape antigo (linha única id=1), se houver de uma aplicação
-- anterior desta mesma migration — feature nunca lançada, sem dados a preservar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brain_settings' AND column_name = 'id'
  ) THEN
    DROP TABLE public.brain_settings;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brain_entries'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'brain_entries' AND column_name = 'doctor_id'
  ) THEN
    DROP TABLE public.brain_entries;
  END IF;
END $$;

-- Configurações do cérebro de cada médico (uma linha por médico)
CREATE TABLE IF NOT EXISTS public.brain_settings (
  doctor_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  persona          text        NOT NULL DEFAULT '',
  sample_phrases   text        NOT NULL DEFAULT '',
  rules            text        NOT NULL DEFAULT '',
  enabled_app      boolean     NOT NULL DEFAULT true,
  enabled_whatsapp boolean     NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brain_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_settings TO service_role;
REVOKE ALL ON public.brain_settings FROM anon, authenticated;

-- Entradas de conhecimento (pergunta + resposta na voz do médico dono)
CREATE TABLE IF NOT EXISTS public.brain_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question   text        NOT NULL,
  answer     text        NOT NULL,
  category   text,
  source     text        NOT NULL DEFAULT 'manual',  -- manual | pergunta | import...
  approved   boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_entries_doctor_created
  ON public.brain_entries(doctor_id, created_at DESC);

ALTER TABLE public.brain_entries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_entries TO service_role;
REVOKE ALL ON public.brain_entries FROM anon, authenticated;
