-- ════════════════════════════════════════════════════════════════════════
-- DoctorThink — schema do serviço standalone (Supabase / Postgres + pgvector)
-- ════════════════════════════════════════════════════════════════════════
-- Rode este arquivo UMA vez no SQL Editor de um projeto Supabase NOVO (o banco
-- próprio do DoctorThink). Depois preencha as envs (ver .env.example) e suba o
-- servidor. `doctor_id` é o ID EXTERNO do profissional no app cliente (texto —
-- pode ser uuid ou qualquer string), sem FK para auth: o DoctorThink não conhece
-- os usuários do app cliente, só o id que ele manda.

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Persona/config do profissional ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brain_settings (
  doctor_id        text PRIMARY KEY,
  persona          text,
  sample_phrases   text,
  rules            text,
  enabled_app      boolean NOT NULL DEFAULT true,
  enabled_whatsapp boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Conhecimento aprovado (Q&A) + vetor semântico ────────────────────────
CREATE TABLE IF NOT EXISTS public.brain_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  text NOT NULL,
  question   text NOT NULL,
  answer     text NOT NULL,
  category   text,
  source     text NOT NULL DEFAULT 'api',
  approved   boolean NOT NULL DEFAULT true,
  embedding  vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brain_entries_doctor ON public.brain_entries(doctor_id, created_at DESC);

-- ── Lacunas (perguntas sem cobertura) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brain_gaps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     text NOT NULL,
  question      text NOT NULL,
  norm_question text NOT NULL,
  hits          int NOT NULL DEFAULT 1,
  status        text NOT NULL DEFAULT 'aberta',
  channel       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, norm_question)
);

-- ── Telemetria de uso do cérebro ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brain_hits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  text NOT NULL,
  channel    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── API keys (por inquilino/app cliente; guarda só o hash) ────────────────
CREATE TABLE IF NOT EXISTS public.doctorthink_api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  doctor_id    text,                        -- se preenchido: chave trancada a este profissional
  name         text,
  key_hash     text NOT NULL UNIQUE,        -- sha256 hex da chave crua
  active       boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dtk_keys_hash ON public.doctorthink_api_keys(key_hash);

-- ── Metering (uma linha por chamada) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctorthink_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  doctor_id    text,
  endpoint     text NOT NULL,               -- 'ask' | 'train'
  had_coverage boolean,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dtk_usage_created ON public.doctorthink_usage(created_at);

-- ── Busca semântica (cosseno) — mesma assinatura usada pelo store ─────────
CREATE OR REPLACE FUNCTION public.match_brain_entries(
  p_doctor_id text,
  p_embedding vector(768),
  p_limit int DEFAULT 6
)
RETURNS TABLE (question text, answer text, similarity double precision)
LANGUAGE sql
STABLE
AS $$
  SELECT e.question, e.answer, 1 - (e.embedding <=> p_embedding) AS similarity
  FROM public.brain_entries e
  WHERE e.doctor_id = p_doctor_id
    AND e.approved = true
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> p_embedding
  LIMIT p_limit;
$$;

-- ── Segurança: tudo server-only (o servidor usa a service_role key) ──────
ALTER TABLE public.brain_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_gaps            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_hits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctorthink_api_keys  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctorthink_usage     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.brain_settings        FROM anon, authenticated;
REVOKE ALL ON public.brain_entries         FROM anon, authenticated;
REVOKE ALL ON public.brain_gaps            FROM anon, authenticated;
REVOKE ALL ON public.brain_hits            FROM anon, authenticated;
REVOKE ALL ON public.doctorthink_api_keys  FROM anon, authenticated;
REVOKE ALL ON public.doctorthink_usage     FROM anon, authenticated;

GRANT ALL ON public.brain_settings        TO service_role;
GRANT ALL ON public.brain_entries         TO service_role;
GRANT ALL ON public.brain_gaps            TO service_role;
GRANT ALL ON public.brain_hits            TO service_role;
GRANT ALL ON public.doctorthink_api_keys  TO service_role;
GRANT ALL ON public.doctorthink_usage     TO service_role;

REVOKE ALL ON FUNCTION public.match_brain_entries(text, vector, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_brain_entries(text, vector, int) TO service_role;

-- Índice vetorial por último (se o HNSW não existir nesta versão do pgvector,
-- a falha aqui não impede a busca — cai em seq scan).
CREATE INDEX IF NOT EXISTS idx_brain_entries_embedding
  ON public.brain_entries USING hnsw (embedding vector_cosine_ops);
