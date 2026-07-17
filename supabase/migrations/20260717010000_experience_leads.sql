-- Experiência Perinatal 3D ("Primeiro Encontro"): impressão 3D da face do
-- bebê a partir do ultrassom 3D/4D em clínicas parceiras, com experiência
-- tátil. Uma tabela única capta os dois lados do marketplace:
--   kind='gestante' → família querendo viver a experiência
--   kind='clinica'  → clínica de imagem querendo ser parceira
-- clinic_ref guarda o código da clínica que INDICOU a gestante (link
-- /experiencia?clinica=X) — base da participação por indicação desde o dia 1.
-- Idempotente: pode rodar mais de uma vez.
CREATE TABLE IF NOT EXISTS public.experience_leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('gestante', 'clinica')),
  name text not null,
  phone text not null,
  email text,
  city text,
  weeks integer,
  clinic_name text,
  clinic_ref text,
  message text,
  status text not null default 'novo',
  created_at timestamptz not null default now()
);

ALTER TABLE public.experience_leads ENABLE ROW LEVEL SECURITY;
-- Sem policies de anon/authenticated: só o servidor (service role) lê/escreve.
GRANT ALL ON public.experience_leads TO service_role;
CREATE INDEX IF NOT EXISTS idx_experience_leads_kind ON public.experience_leads(kind, created_at DESC);
