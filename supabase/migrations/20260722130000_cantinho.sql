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
