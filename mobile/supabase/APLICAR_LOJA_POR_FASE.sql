-- ═══════════════════════════════════════════════════════════════════════
-- A LOJA POR FASE (out/2026) — a economia "mista" do app
-- ═══════════════════════════════════════════════════════════════════════
-- GERADO por mobile/scripts/gerar-loja-por-fase.ts a partir de
-- mobile/src/lib/jornada/loja-por-fase.ts. Não edite à mão: mude a régua e
-- gere de novo (a catraca do teste reprova o arquivo que divergir dela).
--
-- O app não vende o Premium (regra da Apple), e a lojinha grátis acabava em
-- ~10 dias. Aqui, 60 itens Premium passam a ser vendidos por sementinhas,
-- abrindo pela fase da gestação (o pós-parto abre todas):
--   semana  0+ · Primeiro trimestre
--   semana 14+ · Segundo trimestre
--   semana 28+ · Terceiro trimestre
--   semana 37+ · Reta final e pós-parto
-- O resto do Premium continua só do Premium.
--
-- Idempotente: rodar de novo regrava as duas tabelas e a função.
-- Depois de rodar, a vitrine do app mostra as fases sozinha (ela lê a tabela).

CREATE TABLE IF NOT EXISTS public.cantinho_por_fase (
  item_id        text    PRIMARY KEY,
  preco          integer NOT NULL CHECK (preco > 0),
  semana_minima  integer NOT NULL CHECK (semana_minima >= 0)
);
ALTER TABLE public.cantinho_por_fase ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cantinho_por_fase_leitura ON public.cantinho_por_fase;
CREATE POLICY cantinho_por_fase_leitura ON public.cantinho_por_fase
  FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.cantinho_por_fase FROM anon;
GRANT SELECT ON public.cantinho_por_fase TO authenticated;

-- Os conjuntos, para o bônus pago na compra: os itens que ela precisa TER (os
-- de preço zero já são dela) e o bônus — a mesma régua e a mesma chave
-- (conjunto:<id>) do servidor do site, então nunca paga duas vezes.
CREATE TABLE IF NOT EXISTS public.cantinho_conjuntos_por_fase (
  conjunto_id  text    PRIMARY KEY,
  nome         text    NOT NULL,
  itens        text[]  NOT NULL,
  bonus        integer NOT NULL CHECK (bonus > 0)
);
ALTER TABLE public.cantinho_conjuntos_por_fase ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cantinho_conjuntos_por_fase FROM anon, authenticated;

DELETE FROM public.cantinho_por_fase;
INSERT INTO public.cantinho_por_fase (item_id, preco, semana_minima) VALUES
  ('planta-cacto', 60, 0),
  ('planta-vaso', 60, 0),
  ('objeto-tapete', 70, 0),
  ('planta-tulipa', 70, 0),
  ('bicho-abelha', 80, 0),
  ('ceu-passarinhos', 80, 0),
  ('objeto-chaleira', 80, 0),
  ('objeto-luminaria', 80, 0),
  ('planta-girassol', 80, 0),
  ('luz-lampiao', 100, 0),
  ('objeto-almofada', 100, 0),
  ('planta-cerejeira', 110, 0),
  ('bicho-tartaruga', 140, 0),
  ('luz-pisca', 140, 0),
  ('objeto-novelo', 40, 14),
  ('planta-hortela', 50, 14),
  ('bicho-caracol', 60, 14),
  ('bicho-lagarta', 100, 14),
  ('planta-cogumelo', 100, 14),
  ('agua-caranguejo', 110, 14),
  ('objeto-espelho', 110, 14),
  ('ceu-pipa', 120, 14),
  ('agua-fonte', 140, 14),
  ('objeto-quadrinho', 140, 14),
  ('clima-petalas', 160, 14),
  ('bicho-esquilo', 180, 14),
  ('agua-coral', 220, 14),
  ('objeto-matrioska', 220, 14),
  ('bicho-ourico', 240, 14),
  ('agua-polvo', 270, 14),
  ('fundo-bosque', 290, 14),
  ('trilha-origami', 800, 14),
  ('agua-sapinho', 80, 28),
  ('objeto-fones', 130, 28),
  ('agua-patinho', 150, 28),
  ('ceu-balao-ar', 150, 28),
  ('ceu-sol', 180, 28),
  ('ceu-lua', 240, 28),
  ('ceu-arcoiris', 260, 28),
  ('objeto-mobile', 260, 28),
  ('clima-bolhas', 270, 28),
  ('agua-cisne', 320, 28),
  ('bicho-coruja', 320, 28),
  ('especial-chuva', 410, 28),
  ('fundo-lago', 410, 28),
  ('objeto-berco', 480, 28),
  ('fundo-quartinho', 500, 28),
  ('agua-peixinho', 180, 37),
  ('agua-concha', 240, 37),
  ('bicho-coelho', 270, 37),
  ('ceu-cometa', 270, 37),
  ('clima-peninhas', 290, 37),
  ('agua-golfinho', 310, 37),
  ('bicho-gato', 310, 37),
  ('bicho-passaro', 310, 37),
  ('bicho-raposa', 340, 37),
  ('objeto-poltrona', 340, 37),
  ('fundo-estrelas', 575, 37),
  ('fundo-mar', 650, 37),
  ('trilha-perolas', 850, 37);

DELETE FROM public.cantinho_conjuntos_por_fase;
INSERT INTO public.cantinho_conjuntos_por_fase (conjunto_id, nome, itens, bonus) VALUES
  ('bichinhos', 'Bichinhos de jardim', ARRAY['bicho-joaninha', 'bicho-borboleta', 'bicho-tartaruga'], 36),
  ('cha', 'Hora do chá', ARRAY['objeto-chaleira', 'objeto-livrinho', 'objeto-almofada', 'objeto-tapete'], 48),
  ('chao-de-floresta', 'Chão de floresta', ARRAY['planta-cogumelo', 'planta-hortela', 'bicho-ourico', 'bicho-esquilo'], 48),
  ('costura', 'Cantinho de costura', ARRAY['objeto-novelo', 'objeto-espelho', 'objeto-quadrinho', 'objeto-matrioska'], 48),
  ('depois-da-chuva', 'Depois da chuva', ARRAY['especial-chuva', 'ceu-sol', 'ceu-arcoiris'], 36),
  ('floral', 'Canteiro florido', ARRAY['planta-girassol', 'planta-tulipa', 'planta-cerejeira', 'bicho-abelha'], 48),
  ('lago', 'Beira do lago', ARRAY['fundo-lago', 'agua-sapinho', 'agua-patinho', 'agua-cisne'], 48),
  ('luzes', 'Luzes acesas', ARRAY['luz-vela', 'luz-lampiao', 'luz-pisca', 'objeto-luminaria'], 48),
  ('madrugada', 'Madrugada', ARRAY['bicho-coruja', 'objeto-fones', 'luz-lampiao', 'ceu-lua'], 48),
  ('mar', 'Fundo do mar', ARRAY['fundo-mar', 'agua-golfinho', 'agua-peixinho', 'agua-concha'], 48),
  ('noite', 'Noite estrelada', ARRAY['ceu-lua', 'ceu-estrelinhas', 'ceu-cometa', 'fundo-estrelas'], 48),
  ('quintal', 'Amigos do quintal', ARRAY['bicho-coelho', 'bicho-gato', 'bicho-raposa', 'bicho-passaro'], 48),
  ('recife', 'Recife', ARRAY['agua-coral', 'agua-caranguejo', 'agua-polvo'], 36),
  ('sem-pressa', 'Sem pressa', ARRAY['bicho-caracol', 'bicho-lagarta', 'bicho-borboleta', 'bicho-tartaruga'], 48);

CREATE OR REPLACE FUNCTION public.comprar_item_da_fase(p_item text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_hoje   date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_preco  integer;
  v_semana_minima integer;
  v_lmp    date;
  v_ref    date;
  v_ref_semanas integer;
  v_ref_dias    integer;
  v_parto  date;
  v_cuidado boolean;
  v_dias   integer;
  v_semana integer;
  v_saldo  integer;
  v_conj   record;
  v_pagou  integer;
  v_novos  text[] := '{}';
  v_bonus  integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sem_sessao');
  END IF;

  SELECT preco, semana_minima INTO v_preco, v_semana_minima
    FROM public.cantinho_por_fase WHERE item_id = p_item;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'fora_da_loja');
  END IF;

  -- Variáveis soltas, e não um record: sem linha de perfil elas ficam nulas
  -- (semana zero), em vez de o record "ainda não atribuído" derrubar a compra.
  SELECT lmp_date, reference_date, reference_weeks, reference_days, birth_date, care_mode
    INTO v_lmp, v_ref, v_ref_semanas, v_ref_dias, v_parto, v_cuidado
    FROM public.patient_profiles WHERE id = v_user;
  IF COALESCE(v_cuidado, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'modo_cuidado');
  END IF;

  -- A semana pela mesma conta do app (o ultrassom vence a DUM); depois do
  -- parto, todas as fases. Um dia de folga: o relógio do aparelho pode estar
  -- um dia à frente do de São Paulo, e a vitrine não pode prometer o que a
  -- compra recusa.
  IF v_parto IS NOT NULL THEN
    v_semana := 99;
  ELSE
    v_dias := CASE
      WHEN v_ref IS NOT NULL AND v_ref_semanas IS NOT NULL
        THEN v_ref_semanas * 7 + COALESCE(v_ref_dias, 0) + (v_hoje - v_ref)
      WHEN v_lmp IS NOT NULL THEN v_hoje - v_lmp
      ELSE NULL
    END;
    v_semana := CASE WHEN v_dias IS NULL OR v_dias < 0 THEN 0 ELSE (v_dias + 1) / 7 END;
  END IF;
  IF v_semana < v_semana_minima THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ainda_nao_abriu', 'semana_minima', v_semana_minima);
  END IF;

  -- A mesma trava da compra do site: compras da mesma usuária em fila.
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text));

  SELECT COALESCE(SUM(amount), 0) INTO v_saldo
    FROM public.sementinhas_ledger WHERE user_id = v_user;
  IF EXISTS (SELECT 1 FROM public.cantinho_items WHERE user_id = v_user AND item_id = p_item) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ja_possui', 'balance', v_saldo);
  END IF;
  IF v_saldo < v_preco THEN
    RETURN jsonb_build_object('ok', false, 'error', 'saldo_insuficiente', 'balance', v_saldo);
  END IF;

  INSERT INTO public.sementinhas_ledger (user_id, amount, reason, dedupe_key)
    VALUES (v_user, -v_preco, 'spend:cantinho:' || p_item, NULL);
  INSERT INTO public.cantinho_items (user_id, item_id) VALUES (v_user, p_item);
  v_saldo := v_saldo - v_preco;

  FOR v_conj IN
    SELECT * FROM public.cantinho_conjuntos_por_fase WHERE p_item = ANY (itens)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM unnest(v_conj.itens) AS precisa(item_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.cantinho_items ci
        WHERE ci.user_id = v_user AND ci.item_id = precisa.item_id
      )
    ) THEN
      INSERT INTO public.sementinhas_ledger (user_id, amount, reason, dedupe_key)
        VALUES (v_user, v_conj.bonus, 'Conjunto completo: ' || v_conj.nome,
                'conjunto:' || v_conj.conjunto_id)
        ON CONFLICT (user_id, dedupe_key) DO NOTHING;
      GET DIAGNOSTICS v_pagou = ROW_COUNT;
      IF v_pagou > 0 THEN
        v_novos := v_novos || v_conj.conjunto_id;
        v_bonus := v_bonus + v_conj.bonus;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'balance', v_saldo + v_bonus,
    'conjuntosNovos', to_jsonb(v_novos),
    'bonusNovo', v_bonus
  );
END;
$$;

REVOKE ALL ON FUNCTION public.comprar_item_da_fase(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comprar_item_da_fase(text) TO authenticated;
