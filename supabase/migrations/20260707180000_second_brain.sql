-- ─────────────────────────────────────────────────────────────────────────────
-- Segundo Cérebro do Dr. Clóvis
-- Base de conhecimento do médico (persona + Q&A reais) usada pela IA do
-- chatbot do site e do agente WhatsApp para responder como o próprio doutor.
-- Acesso EXCLUSIVO via service_role (server functions) — nenhuma policy para
-- anon/authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

-- Configurações do segundo cérebro (linha única, id = 1)
CREATE TABLE IF NOT EXISTS public.brain_settings (
  id               int         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
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

-- Entradas de conhecimento (pergunta + resposta na voz do médico)
CREATE TABLE IF NOT EXISTS public.brain_entries (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL,
  answer     text        NOT NULL,
  category   text,
  source     text        NOT NULL DEFAULT 'manual',  -- manual | pergunta | import...
  approved   boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_entries_created
  ON public.brain_entries(created_at DESC);

ALTER TABLE public.brain_entries ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_entries TO service_role;
REVOKE ALL ON public.brain_entries FROM anon, authenticated;
