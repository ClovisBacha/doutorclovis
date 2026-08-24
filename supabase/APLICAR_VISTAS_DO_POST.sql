-- ═══════════════════════════════════════════════════════════════════════════
-- QUANTAS PESSOAS VIRAM O POST
--
-- O story tem "visto por" desde o comeco; o post nao tinha nada. Publicar sem
-- saber se alguem viu e falar para uma parede -- e e o motivo numero um de
-- alguem parar de publicar. Numa base pequena, entao, o silencio total lê como
-- "ninguem se importa" mesmo quando trinta pessoas viram.
--
-- ⚠️ SO O NUMERO, NUNCA A LISTA -- e a diferenca em relacao ao story e
-- deliberada. O story some em 24h e e uma foto solta; o post e permanente e
-- pode ser um desabafo. A lista de quem LEU o desabafo de uma gestante de alto
-- risco e uma informacao que este app nao entrega a ninguem, nem a autora --
-- entre outras coisas porque ela produz a pergunta "por que a fulana viu e nao
-- reagiu?", que e exatamente o tipo de leitura que a aba nao pode induzir.
--
-- Por isso a tabela guarda `quem_id`: e o que permite CONTAR UMA VEZ por
-- pessoa. Ele e gravado e nunca devolvido -- a mesma decisao de
-- `rede_perguntas.quem_id` na caixinha anonima.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rede_post_vistas (
  post_id    uuid        NOT NULL REFERENCES public.rede_posts(id) ON DELETE CASCADE,
  quem_id    uuid        NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  -- ⚠️ A CHAVE E O QUE IMPEDE O NUMERO DE INFLAR. Sem ela, rolar o feed para
  -- cima e para baixo contaria a mesma pessoa dez vezes, e o numero viraria
  -- "quantas vezes o cartao passou pela tela" com nome de "quantas pessoas
  -- viram" -- que e pior que nao ter numero nenhum.
  PRIMARY KEY (post_id, quem_id)
);

COMMENT ON TABLE public.rede_post_vistas IS
  'Uma linha por pessoa por post. quem_id existe para contar uma vez, e NUNCA e devolvido a ninguem.';

CREATE INDEX IF NOT EXISTS rede_post_vistas_post ON public.rede_post_vistas (post_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- ⚠️ SEM POLICY NENHUMA, e isso e o desenho.
--
-- Uma policy de LINHA para a autora (`post_id in (meus posts)`) daria a ela a
-- linha INTEIRA, com `quem_id` dentro -- e RLS NAO ESCONDE COLUNA. Seria
-- entregar pelo banco exatamente a lista que a tela decidiu nao mostrar. A
-- escrita e a contagem passam pelo servidor, com service role.
ALTER TABLE public.rede_post_vistas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rede_post_vistas FROM anon, authenticated;

-- ── Conferencia ────────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_post_vistas')  AS tabela_ok,
  (SELECT count(*) FROM public.rede_post_vistas)                          AS vistas_ate_agora;
