import { conjuntosDaTabela, FASES_DA_LOJA, linhasDaTabela } from "~/lib/jornada/loja-por-fase";

/**
 * O SQL da loja por fase — `mobile/supabase/APLICAR_LOJA_POR_FASE.sql` é exatamente
 * este texto (`bun scripts/gerar-loja-por-fase.ts`, em mobile/, o grava; a catraca
 * em `loja-por-fase.test.ts` reprova se o arquivo e a régua divergirem).
 *
 * Por que no banco, e não no servidor do site: a compra de item Premium no
 * servidor exige assinatura (`buyCantinhoItem`, em `src/`, que não muda mais).
 * Uma função nova no banco vende SÓ os itens da tabela, só na fase certa, com
 * a mesma trava por usuária e a mesma conta do saldo da compra de lá.
 */

const aspas = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function sqlDaLojaPorFase(): string {
  const linhas = linhasDaTabela();
  const conjuntos = conjuntosDaTabela();
  const fases = FASES_DA_LOJA.map(
    (f) => `--   semana ${String(f.semana).padStart(2)}+ · ${f.nome}`,
  ).join("\n");
  const valores = linhas
    .map((l) => `  (${aspas(l.item_id)}, ${l.preco}, ${l.semana_minima})`)
    .join(",\n");
  const valoresDosConjuntos = conjuntos
    .map(
      (c) =>
        `  (${aspas(c.conjunto_id)}, ${aspas(c.nome)}, ARRAY[${c.itens.map(aspas).join(", ")}], ${c.bonus})`,
    )
    .join(",\n");
  return `-- ═══════════════════════════════════════════════════════════════════════
-- A LOJA POR FASE (out/2026) — a economia "mista" do app
-- ═══════════════════════════════════════════════════════════════════════
-- GERADO por mobile/scripts/gerar-loja-por-fase.ts a partir de
-- mobile/src/lib/jornada/loja-por-fase.ts. Não edite à mão: mude a régua e
-- gere de novo (a catraca do teste reprova o arquivo que divergir dela).
--
-- O app não vende o Premium (regra da Apple), e a lojinha grátis acabava em
-- ~10 dias. Aqui, ${linhas.length} itens Premium passam a ser vendidos por sementinhas,
-- abrindo pela fase da gestação (o pós-parto abre todas):
${fases}
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
${valores};

DELETE FROM public.cantinho_conjuntos_por_fase;
INSERT INTO public.cantinho_conjuntos_por_fase (conjunto_id, nome, itens, bonus) VALUES
${valoresDosConjuntos};

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
`;
}
