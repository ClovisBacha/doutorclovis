-- ============================================================================
-- Moeda da consulta: escolher em vez de deduzir, e centavos em inteiro
-- ============================================================================
-- Roda depois de 20260730030000 (que cria consultation_price_brl) e de
-- 20260730040000 (que fecha o GRANT por coluna).
-- ============================================================================

-- ── 10. Moeda e centavos do valor da consulta ───────────────────────────────
-- `consultation_price_brl` guarda unidades inteiras e traz a moeda embutida no
-- NOME: enquanto a plataforma era um consultorio em Minas isso bastava. Um
-- medico que atende brasileiras fora do pais cobra em dolar ou euro, e "450" sem
-- moeda e um numero que a paciente le errado por um fator de cinco.
--
-- Centavos em INTEIRO porque ponto flutuante para dinheiro erra (0.1 + 0.2 nao
-- da 0.3), e e o formato que Mercado Pago e Stripe ja usam.
--
-- A coluna antiga CONTINUA sendo escrita, com o valor arredondado: telas e
-- calculos de receita ainda a leem. As duas convivem de proposito ate a ultima
-- leitura migrar.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS consultation_currency    text    NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS consultation_price_cents integer;

COMMENT ON COLUMN public.doctors.consultation_currency IS
  'Moeda do valor da consulta: BRL, USD ou EUR.';
COMMENT ON COLUMN public.doctors.consultation_price_cents IS
  'Valor da consulta em CENTAVOS da moeda escolhida. Fonte de verdade; consultation_price_brl e o espelho arredondado.';

-- Semeia os centavos a partir do que ja existe, para nenhum medico "perder" o
-- preco que cadastrou.
UPDATE public.doctors
   SET consultation_price_cents = consultation_price_brl * 100
 WHERE consultation_price_cents IS NULL
   AND consultation_price_brl IS NOT NULL;

-- O medico edita as duas pelo cliente; plano e selo seguem fora do alcance dele.
GRANT UPDATE (consultation_currency, consultation_price_cents)
  ON public.doctors TO authenticated;
