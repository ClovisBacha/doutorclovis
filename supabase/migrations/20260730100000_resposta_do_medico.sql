-- Resposta do médico na pergunta da paciente: texto + carimbo de tempo.
--
-- Estas duas colunas já existiam no arquivo consolidado `APLICAR_PENDENTES.sql`
-- referenciando uma migration `20260717020000` que nunca foi versionada — ou
-- seja, `supabase db push` num banco novo não as criava, e o código tinha um
-- recuo silencioso para 42703 em três lugares.
--
-- Passou a doer agora: a prova de valor do painel conta "perguntas respondidas
-- DESTE MÊS" com `answered_at >= início do mês`. Sem a coluna, a contagem é
-- zero para sempre — pior que o número histórico que ela substituiu.
--
-- Idempotente: pode rodar em banco que já tem as colunas.

ALTER TABLE public.doctor_questions
  ADD COLUMN IF NOT EXISTS answer text,
  ADD COLUMN IF NOT EXISTS answered_at timestamptz;

-- Retroativo: quem já estava respondida ganha um carimbo aproximado (a data da
-- pergunta). Não é a data real da resposta e não deve ser tratada como tal —
-- serve só para essas linhas não ficarem eternamente fora de qualquer contagem
-- por período. Sem isto, o histórico inteiro seria invisível.
UPDATE public.doctor_questions
   SET answered_at = created_at
 WHERE answered IS TRUE
   AND answered_at IS NULL;

-- A contagem mensal filtra por `answered_at`; sem índice ela varre a tabela a
-- cada carregamento do painel.
CREATE INDEX IF NOT EXISTS idx_doctor_questions_answered_at
    ON public.doctor_questions (doctor_id, answered_at)
 WHERE answered IS TRUE;
