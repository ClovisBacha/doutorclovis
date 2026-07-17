-- Autoaprendizado do Segundo Cérebro (com o médico SEMPRE no loop):
--
-- brain_gaps  → "fila de lacunas": toda pergunta que o cérebro NÃO soube
--               cobrir (nenhuma entrada casou) fica registrada, deduplicada e
--               contada; o médico responde no painel e vira conhecimento.
-- brain_feedback → 👍/👎 da paciente em cada resposta da IA do app; o 👎
--               também alimenta a fila de lacunas.
-- Idempotente.
CREATE TABLE IF NOT EXISTS public.brain_gaps (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null,
  question text not null,
  norm_question text not null,
  channel text not null default 'app',
  hits integer not null default 1,
  status text not null default 'aberta' check (status in ('aberta', 'respondida', 'ignorada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brain_gaps_doctor_question
  ON public.brain_gaps(doctor_id, norm_question);
CREATE INDEX IF NOT EXISTS idx_brain_gaps_doctor_status
  ON public.brain_gaps(doctor_id, status, updated_at DESC);
ALTER TABLE public.brain_gaps ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_gaps TO service_role;

CREATE TABLE IF NOT EXISTS public.brain_feedback (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid,
  user_id uuid not null,
  question text,
  helpful boolean not null,
  channel text not null default 'app',
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_brain_feedback_doctor
  ON public.brain_feedback(doctor_id, created_at DESC);
ALTER TABLE public.brain_feedback ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_feedback TO service_role;

-- Origem da entrada de conhecimento ('manual' | 'pergunta' | 'kit' | 'lacuna')
ALTER TABLE public.brain_entries ADD COLUMN IF NOT EXISTS source text;
