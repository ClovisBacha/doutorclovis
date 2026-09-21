-- ─────────────────────────────────────────────────────────────────────────────
-- SUSPENDER UMA CONTA DA COMUNIDADE — o degrau que faltava na moderação.
--
-- A fila só sabia tirar UMA publicação por vez. Uma conta que reincide continua
-- publicando, e a única saída era remover peça por peça enquanto ela produz
-- mais — o que não é moderação, é enxugar gelo.
--
-- ⚠️ **A COLUNA É REVOGADA DE `authenticated`.** `patient_profiles` é escrita
-- direto do navegador com a chave anon em vários pontos do app (a chave do
-- perfil público, a bio, a foto, o Modo Cuidado). Sem o REVOKE, um pedido
-- montado à mão LEVANTARIA a própria suspensão sem passar pelo servidor — e
-- quem foi suspensa é exatamente quem tentaria.
--
-- ⚠️ **É a mesma trava de `conta_oficial`**, e pela mesma razão: RLS de LINHA
-- não distingue COLUNA.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS rede_suspensa_em timestamptz;

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS rede_suspensa_motivo text;

REVOKE UPDATE (rede_suspensa_em, rede_suspensa_motivo)
  ON public.patient_profiles FROM authenticated, anon;

-- ── Conferência ──────────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patient_profiles' AND column_name = 'rede_suspensa_em')     AS coluna_ok,
  NOT EXISTS (SELECT 1 FROM information_schema.column_privileges
    WHERE table_name = 'patient_profiles' AND column_name = 'rede_suspensa_em'
      AND grantee = 'authenticated' AND privilege_type = 'UPDATE')                  AS revoke_ok;
