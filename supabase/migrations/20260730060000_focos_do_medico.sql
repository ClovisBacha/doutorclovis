-- ============================================================================
-- Focos de atuacao: um medico atende mais de uma coisa
-- ============================================================================
-- Roda depois de 20260730030000 (que cria as colunas do perfil).
-- ============================================================================

-- ── 11. Focos de atuacao: uma lista, nao um so ──────────────────────────────
-- `specialty` guarda UM texto. Um obstetra atende alto risco E parto humanizado
-- E endometriose; escolhendo um, ele some das buscas dos outros dois — e a
-- paciente que procura "endometriose" nao acha quem trata endometriose.
--
-- Array de texto e nao tabela: sao rotulos curtos de uma lista fechada, sempre
-- lidos junto com o medico e nunca sozinhos. Uma tabela aqui seria um join a
-- mais em toda busca para guardar uma etiqueta.
--
-- `specialty` CONTINUA existindo com o foco principal: e o que aparece embaixo
-- do nome no card e na carteirinha, onde cabe um so.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS focos text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.doctors.focos IS
  'Focos de atuacao adicionais. `specialty` segue sendo o principal, exibido no card.';

-- Semeia com o foco principal de quem ja cadastrou, para ninguem comecar vazio.
UPDATE public.doctors
   SET focos = ARRAY[specialty]
 WHERE cardinality(focos) = 0
   AND coalesce(btrim(specialty), '') <> '';

-- GIN porque a busca pergunta "contem este foco?" (operador &&/@>), e e para
-- isso que o indice de array serve.
CREATE INDEX IF NOT EXISTS idx_doctors_focos ON public.doctors USING gin (focos);

GRANT UPDATE (focos) ON public.doctors TO authenticated;
