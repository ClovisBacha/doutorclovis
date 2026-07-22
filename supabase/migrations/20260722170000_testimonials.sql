-- ════════════════════════════════════════════════════════════════════════
-- Depoimentos das pacientes → 100 Sementinhas ao ser APROVADO pelo médico
-- ════════════════════════════════════════════════════════════════════════
-- A paciente escreve um depoimento no app; o Dr. Clóvis aprova no painel; ao
-- aprovar, ela ganha 100 🌱 (uma vez) e o depoimento pode aparecer na página
-- pública de depoimentos. Nada é publicado sem aprovação (mesma ética do resto
-- do app). Tudo passa pelas server functions (service role) — tabela server-only.

CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_testimonials_status ON public.testimonials (status);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Acesso só pela service role (server functions). O cliente nunca lê/escreve
-- direto — evita exposição de depoimentos pendentes/rejeitados de outras contas.
REVOKE ALL ON public.testimonials FROM anon, authenticated;
GRANT ALL ON public.testimonials TO service_role;
