-- ─────────────────────────────────────────────────────────────────────────────
-- brain_hits — telemetria do Segundo Cérebro para o dashboard do médico.
-- Cada linha registra um "acerto": um momento em que o cérebro do médico foi
-- realmente montado e injetado no prompt (chat do app ou agente WhatsApp).
-- Serve para o dashboard mostrar o VALOR do cérebro (quantas vezes ele
-- respondeu no mês). Acesso EXCLUSIVO via service_role (logging server-side) —
-- nenhuma policy para anon/authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.brain_hits (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  uuid,
  channel    text        NOT NULL,  -- app | whatsapp | teste
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_hits_doctor_created
  ON public.brain_hits(doctor_id, created_at DESC);

ALTER TABLE public.brain_hits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.brain_hits TO service_role;
REVOKE ALL ON public.brain_hits FROM anon, authenticated;
