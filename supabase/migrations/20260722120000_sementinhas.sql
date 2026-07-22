-- ════════════════════════════════════════════════════════════════════════
-- Sementinhas 🌱 — moeda de recompensa (autocuidado / educação / marcos)
-- ════════════════════════════════════════════════════════════════════════
-- Princípios éticos (ver pesquisa): o saldo NUNCA zera (nada é deletado);
-- ganhos são idempotentes por dedupe_key; gastos são linhas NEGATIVAS. O saldo
-- é sempre SUM(amount). O ganho é concedido SÓ no servidor (service_role) —
-- o cliente jamais escreve aqui, pra ninguém "imprimir" moeda. Por isso a
-- tabela é server-only: RLS ligado, sem policy para authenticated, REVOKE de
-- anon/authenticated e GRANT só para service_role.

CREATE TABLE IF NOT EXISTS public.sementinhas_ledger (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users NOT NULL,
  amount      integer     NOT NULL,            -- + ganho, − gasto
  reason      text        NOT NULL,            -- ex.: 'achievement:first_kicks', 'week:25', 'checkin:2026-07-22', 'spend:cantinho:planta'
  dedupe_key  text,                            -- ganhos idempotentes; NULL para gastos
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Ganhos únicos: o mesmo marco/dia não é concedido duas vezes. Gastos têm
-- dedupe_key NULL e, como NULLs são distintos no Postgres, vários gastos são
-- permitidos sem conflito. (Índice não-parcial permite ON CONFLICT via upsert.)
CREATE UNIQUE INDEX IF NOT EXISTS sementinhas_ledger_dedupe
  ON public.sementinhas_ledger (user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS sementinhas_ledger_user
  ON public.sementinhas_ledger (user_id);

ALTER TABLE public.sementinhas_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service manages sementinhas" ON public.sementinhas_ledger;
CREATE POLICY "Service manages sementinhas"
  ON public.sementinhas_ledger FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.sementinhas_ledger FROM anon, authenticated;
GRANT ALL ON public.sementinhas_ledger TO service_role;
