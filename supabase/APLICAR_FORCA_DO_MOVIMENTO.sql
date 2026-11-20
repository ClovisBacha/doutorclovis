-- ═══════════════════════════════════════════════════════════════════════════
-- A FORÇA DO MOVIMENTO — o eixo que prediz desfecho e que o app não coletava.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Heazell et al. (BMC Pregnancy Childbirth 2017;17:369), caso-controle
-- internacional, razões de chance ajustadas para natimortalidade:
--
--   atividade fetal significativamente reduzida ....... aOR 14,1
--   redução de FREQUÊNCIA ............................ aOR  2,97
--   redução de FORÇA ................................. aOR  2,53
--   um único episódio de atividade frenética ......... aOR  4,30
--
-- O contador media a FREQUÊNCIA e nada mais. Força reduzida pesa quase o mesmo,
-- e é o que o Count the Kicks registra ao lado do tempo — a régua de alerta
-- deles é explicitamente a MUDANÇA em qualquer um dos dois.
--
-- ⚠️ São TRÊS níveis, e não a escala de 1 a 5 do Count the Kicks: a tela irmã
-- (contrações) já usa três, e duas escalas no mesmo hub ensinam a decodificar.
--
-- ⚠️ E "mais fraco" NÃO vira alarme automático: seria um limiar clínico novo
-- inventado aqui, e a régua deste app mora em `sinais-clinicos.ts`. Ele oferece
-- o mesmo caminho de contato que a percepção dela já oferece.
--
-- Idempotente: rodar de novo é seguro.

ALTER TABLE public.kick_sessions
  ADD COLUMN IF NOT EXISTS strength smallint;

-- Faixa plausível — a mesma família dos CHECK de `APLICAR_EVENTOS_CLINICOS`.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kick_sessions_strength_check'
  ) THEN
    ALTER TABLE public.kick_sessions
      ADD CONSTRAINT kick_sessions_strength_check
      CHECK (strength IS NULL OR strength BETWEEN 1 AND 3);
  END IF;
END $$;

COMMENT ON COLUMN public.kick_sessions.strength IS
  '1 = mais fraco que o normal dela, 2 = como sempre, 3 = mais forte. NULL = sessão anterior a set/2026 ou banco sem a coluna quando a linha nasceu.';

-- Conferência.
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kick_sessions' AND column_name = 'strength'
  ) AS forca_ok;
