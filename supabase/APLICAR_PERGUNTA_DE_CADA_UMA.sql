-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE — cada paciente recebe a PRÓPRIA pergunta
--
-- Idempotente: pode rodar quantas vezes quiser.
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠️  ESTE É O MAIS SÉRIO DESTA BASE. Rode antes dos outros.
--
-- O QUE ACONTECIA
--
-- `brain_gaps` é deduplicada por texto normalizado E por semelhança de vetor
-- (≥ 0,82). Isso é de propósito e é bom: impede o médico de responder "é normal
-- sentir enjoo?" três vezes. O efeito colateral é que perguntas ESCRITAS DE
-- FORMAS DIFERENTES viram uma linha só — e essa linha guarda o texto CRU da
-- primeira paciente que perguntou.
--
-- Na entrega, `entregarRespostaDaLacuna` mandava `gap.question` para TODAS as
-- pacientes de `brain_gap_askers`:
--
--   · como `doctor_questions.question`, na aba Perguntas de cada uma;
--   · e como CORPO DO PUSH, na tela de bloqueio do celular delas.
--
-- Ou seja: a paciente A escreve "estou com corrimento com cheiro depois da
-- relação". A paciente B pergunta algo parecido com outras palavras. B recebe
-- no celular "Seu médico respondeu — estou com corrimento com cheiro depois da
-- relação", e vê aquilo no app como se fosse a pergunta dela.
--
-- Texto clínico íntimo de uma paciente, entregue a outra, na tela de bloqueio.
--
-- O comentário do código explicava a intenção e ela estava certa para UMA
-- paciente: "a pergunta que vai junto é a CRUA dela, não a versão generalizada
-- — ela precisa reconhecer a própria dúvida". O que faltou foi notar que a
-- lacuna é COMPARTILHADA, e que "a crua dela" virou "a crua da primeira".
--
-- O CONSERTO
--
-- `brain_gap_askers` passa a guardar o texto de cada uma. Quem perguntou
-- recebe o que escreveu; quem não tiver texto guardado recebe a versão
-- generalizada do médico — nunca, em hipótese alguma, o texto de outra.

SET search_path = public;

-- NULL = linha criada antes desta coluna. O código trata como "usa a versão
-- generalizada do médico", que é o lado seguro.
ALTER TABLE public.brain_gap_askers
  ADD COLUMN IF NOT EXISTS pergunta text;

COMMENT ON COLUMN public.brain_gap_askers.pergunta IS
  'O texto que ESTA paciente escreveu. A lacuna e compartilhada; a pergunta nao e.';

-- ════════════════════════════════════════════════════════════════════════════
-- CONFERIR
-- ════════════════════════════════════════════════════════════════════════════
--
--   -- lacunas com mais de uma paciente: é aí que o vazamento acontecia
--   SELECT gap_id, count(*) AS pacientes
--     FROM public.brain_gap_askers
--    GROUP BY 1 HAVING count(*) > 1
--    ORDER BY 2 DESC;
--
--   -- e quantas já têm o próprio texto guardado
--   SELECT count(*) FILTER (WHERE pergunta IS NOT NULL) AS com_texto,
--          count(*) AS total
--     FROM public.brain_gap_askers;
