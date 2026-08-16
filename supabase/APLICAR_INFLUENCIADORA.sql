-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_INFLUENCIADORA.sql — o e-mail que dá à influenciadora acesso aos
-- próprios números. Idempotente: rode quantas vezes quiser.
--
-- ─── POR QUE ─────────────────────────────────────────────────────────────────
--
-- O motor de afiliados já rodava inteiro: `?ref=CODIGO` guardado 90 dias no
-- navegador, `ref_code` carimbado na paciente, metadata na Stripe, e cada fatura
-- PAGA creditando 50% em `affiliate_earnings` (webhook, idempotente por fatura).
--
-- ⚠️ E A INFLUENCIADORA NÃO TINHA COMO OLHAR NADA DISSO. As únicas telas que
-- liam essas tabelas eram o `/admin` e o `/painel` da equipe. O dinheiro dela
-- estava sendo contado corretamente para uma pessoa que não conseguia ver o
-- próprio saldo — que é a mesma família de defeito do presente do médico, que
-- chegava na paciente sem nenhum aviso.
--
-- Faltava UMA coisa para ela ter tela: uma identidade. `affiliates` tinha
-- `code`, `name`, `commission_pct` e `active` — nada que ligasse a linha a uma
-- conta que faz login.
--
-- ─── ⚠️ O E-MAIL É A CHAVE, E ELE É COMPARADO EM MINÚSCULAS ──────────────────
--
-- O login do Supabase guarda o e-mail como a pessoa digitou. "Maria@Gmail.com"
-- e "maria@gmail.com" são a MESMA caixa e strings diferentes — sem normalizar,
-- a influenciadora que se cadastrou com maiúscula abriria a tela e veria "você
-- ainda não é embaixadora", com o painel dela existindo do outro lado.
--
-- O índice único também é sobre `lower(email)`: duas linhas de afiliado para a
-- mesma caixa fariam a consulta devolver uma delas ao acaso, e os números
-- mudariam de valor entre duas aberturas da mesma tela.
--
-- ⚠️ NÃO HÁ RLS NOVA AQUI, de propósito. `affiliates` e `affiliate_earnings`
-- continuam fechadas para o cliente; quem lê é o SERVIDOR (service role), que
-- resolve o e-mail da sessão e devolve SÓ as linhas daquele código. Abrir a
-- tabela por RLS deixaria uma influenciadora consultar o faturamento das
-- outras.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.affiliates.email IS
  'E-mail da conta que abre o painel dela em /influenciadora. Comparado sempre em lower().';

CREATE UNIQUE INDEX IF NOT EXISTS affiliates_email_unico
  ON public.affiliates (lower(email))
  WHERE email IS NOT NULL;

-- A consulta da tela dela filtra por código; sem índice, é varredura completa
-- de `affiliate_earnings` a cada abertura.
CREATE INDEX IF NOT EXISTS affiliate_earnings_code_data
  ON public.affiliate_earnings (affiliate_code, created_at DESC);
