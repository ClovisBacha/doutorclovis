-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE — um voto por pergunta, não um por opinião
--
-- Idempotente: pode rodar quantas vezes quiser.
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUE ISTO EXISTE
--
-- O índice único era `(user_id, question, helpful)` — com o `helpful` DENTRO da
-- chave. Ou seja: 👍 e 👎 da mesma paciente, sobre a mesma pergunta, são duas
-- linhas que convivem. Mudar de ideia não substitui: soma.
--
-- Duas consequências, e as duas doem em quem trabalha:
--
--  1. A SATISFAÇÃO MENTE. `computeBrainQualityStats` faz 👍 / (👍 + 👎) sobre
--     todas as linhas. Uma paciente que toca no 👎 sem querer e corrige para 👍
--     entra como um voto positivo E um negativo — 50% de satisfação sozinha.
--     É o número que o produto usa como prova de valor.
--
--  2. A FILA DE REVISÃO GUARDA TRABALHO QUE NÃO EXISTE MAIS. O 👎 fica
--     `status = 'aberta'` para sempre; o médico corrige uma resposta sobre a
--     qual a paciente já disse "não, isso me ajudou".
--
-- O certo é um voto por (paciente, pergunta): o último vale.
--
-- ─── ORDEM DAS OPERAÇÕES ────────────────────────────────────────────────────
-- Duplicatas primeiro (as que já existem sob a chave antiga), senão o índice
-- novo não é criado.

SET search_path = public;

-- ── 1. Onde há 👍 e 👎 da mesma paciente para a mesma pergunta, fica o ÚLTIMO
-- Empate impossível: `created_at` tem resolução de microssegundo, e mesmo assim
-- o `id` desempata para o resultado ser determinístico.
DELETE FROM public.brain_feedback a
 USING public.brain_feedback b
 WHERE a.user_id = b.user_id
   AND a.question IS NOT DISTINCT FROM b.question
   AND (a.created_at, a.id) < (b.created_at, b.id);

-- ── 2. A chave nova, sem o `helpful` dentro
DROP INDEX IF EXISTS uq_brain_feedback_voto;
CREATE UNIQUE INDEX IF NOT EXISTS uq_brain_feedback_voto
  ON public.brain_feedback (user_id, question);

-- ════════════════════════════════════════════════════════════════════════════
-- CONFERIR
-- ════════════════════════════════════════════════════════════════════════════
--
--   -- não pode sobrar ninguém votando duas vezes na mesma pergunta
--   SELECT user_id, question, count(*)
--     FROM public.brain_feedback
--    GROUP BY 1, 2 HAVING count(*) > 1;
--
--   -- e a satisfação do mês passa a ter um voto por paciente/pergunta
--   SELECT helpful, count(*) FROM public.brain_feedback GROUP BY 1;
