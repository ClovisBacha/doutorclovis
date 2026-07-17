-- Três decisões de produto aplicadas de uma vez (idempotente):
--
-- 1) EPDS salva e alerta o médico: a escala de depressão (pública) passa a
--    gravar o resultado na conta da paciente logada e o médico dela recebe
--    aviso por e-mail quando o rastreio é positivo.
-- 2) Resposta do médico VOLTA à paciente: doctor_questions ganha o texto da
--    resposta (antes só alimentava a IA e a paciente via apenas o flag).
-- 3) Lives gerenciáveis: fim das datas fixas no código — a equipe cadastra
--    as lives no painel e a página pública /lives lê do banco.

-- 1) EPDS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.epds_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  doctor_id uuid,
  score integer not null,
  q10_score integer not null default 0,
  level text not null,
  created_at timestamptz not null default now()
);
ALTER TABLE public.epds_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own epds logs" ON public.epds_logs;
CREATE POLICY "Own epds logs" ON public.epds_logs
  FOR SELECT USING (auth.uid() = user_id);
GRANT SELECT ON public.epds_logs TO authenticated;
GRANT ALL ON public.epds_logs TO service_role;
CREATE INDEX IF NOT EXISTS idx_epds_logs_doctor ON public.epds_logs(doctor_id, created_at DESC);

-- 2) Resposta do médico ----------------------------------------------------
ALTER TABLE public.doctor_questions
  ADD COLUMN IF NOT EXISTS answer text,
  ADD COLUMN IF NOT EXISTS answered_at timestamptz;

-- 3) Lives -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_at timestamptz,
  link text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
ALTER TABLE public.lives ENABLE ROW LEVEL SECURITY;
-- Sem policies de anon/authenticated: leitura pública passa pelo servidor.
GRANT ALL ON public.lives TO service_role;
