-- ════════════════════════════════════════════════════════════════════
-- APLICAR no Supabase da Obstétrica (SQL Editor). Idempotente: pode rodar
-- mais de uma vez. Liga: Sementinhas 🌱, Meu Cantinho, e Modo Cuidado 🤍.
-- ════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════════
-- Meu Cantinho 🌱 — itens comprados com Sementinhas (spend sink)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cantinho_items (
  user_id      uuid        REFERENCES auth.users NOT NULL,
  item_id      text        NOT NULL,
  acquired_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)         -- não dá pra comprar o mesmo item 2x
);

ALTER TABLE public.cantinho_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service manages cantinho" ON public.cantinho_items;
CREATE POLICY "Service manages cantinho"
  ON public.cantinho_items FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
REVOKE ALL ON public.cantinho_items FROM anon, authenticated;
GRANT ALL ON public.cantinho_items TO service_role;

-- Compra ATÔMICA: verifica saldo, debita e adiciona o item numa única transação.
-- Um advisory lock por usuário serializa compras concorrentes (evita saldo
-- negativo em double-submit / cliques rápidos). O preço vem do servidor.
CREATE OR REPLACE FUNCTION public.buy_cantinho_item(p_user uuid, p_item text, p_price int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance int;
BEGIN
  -- Serializa compras do MESMO usuário até o fim da transação.
  PERFORM pg_advisory_xact_lock(hashtext(p_user::text));

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.sementinhas_ledger
  WHERE user_id = p_user;

  IF v_balance < p_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'saldo_insuficiente', 'balance', v_balance);
  END IF;

  IF EXISTS (SELECT 1 FROM public.cantinho_items WHERE user_id = p_user AND item_id = p_item) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ja_possui', 'balance', v_balance);
  END IF;

  INSERT INTO public.sementinhas_ledger (user_id, amount, reason, dedupe_key)
  VALUES (p_user, -p_price, 'spend:cantinho:' || p_item, NULL);

  INSERT INTO public.cantinho_items (user_id, item_id) VALUES (p_user, p_item);

  RETURN jsonb_build_object('ok', true, 'balance', v_balance - p_price);
END;
$$;

REVOKE ALL ON FUNCTION public.buy_cantinho_item(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buy_cantinho_item(uuid, text, int) TO service_role;


-- ════════════════════════════════════════════════════════════════════════
-- Modo Cuidado 🤍 — pausa ética da gamificação em momentos sensíveis
-- ════════════════════════════════════════════════════════════════════════
-- Quando ativo (perda gestacional, complicação, ou simplesmente um momento
-- difícil), o app silencia comemorações, streaks, moeda e contagens, e troca
-- por acolhimento. NADA é deletado — o que a paciente construiu é preservado.
-- É um estado da própria paciente (ela ativa/desativa quando quiser).

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS care_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS care_mode_since timestamptz;


-- ════════════════════════════════════════════════════════════════════════
-- Cenário equipado do Cantinho (só 1 fundo ativo por vez). NULL = sem cenário.
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS cantinho_fundo text;


-- ════════════════════════════════════════════════════════════════════════
-- Instagram → 100 Sementinhas: @ da paciente p/ casar com o Story marcado
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS instagram_handle text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_profiles_instagram_handle
  ON public.patient_profiles (instagram_handle)
  WHERE instagram_handle IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════
-- Depoimentos → 100 Sementinhas ao ser aprovado pelo médico
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_testimonials_status ON public.testimonials (status);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.testimonials FROM anon, authenticated;
GRANT ALL ON public.testimonials TO service_role;
