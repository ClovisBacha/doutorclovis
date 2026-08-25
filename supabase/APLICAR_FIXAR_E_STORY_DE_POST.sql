-- ═══════════════════════════════════════════════════════════════════════════
-- FIXAR PUBLICAÇÃO NO PERFIL, e COMPARTILHAR PUBLICAÇÃO EM STORY
--
-- Idempotente: rodar de novo é seguro.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
-- `CREATE TABLE IF NOT EXISTS`. As tabelas já existem no banco do dono, e num
-- banco assim o `CREATE` é no-op: a coluna nova nunca nasce, e rodar de novo
-- não conserta. Foi exatamente assim que `carimbo_semana` passou a existir só
-- no papel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. FIXAR PUBLICAÇÃO NO PERFIL ──────────────────────────────────────────

/* ⚠️ **É UM INSTANTE, e não um booleano.** Com `fixado boolean` não haveria
   como ordenar três publicações fixadas entre si, e a grade mostraria as três
   em ordem arbitrária — que muda entre duas aberturas, porque o `order` de
   desempate do Postgres não é estável sem coluna. Com o instante, a última
   fixada vai na frente, que é o que a pessoa espera de "acabei de fixar".

   E `NULL` é o estado normal: quase toda publicação não é fixada, e um booleano
   com `DEFAULT false` gravaria um byte em cada linha da tabela para dizer o que
   a ausência já diz. */
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS fixado_em timestamptz;

/* ⚠️ Índice PARCIAL, e o `WHERE` é o ponto: as fixadas são um punhado por
   conta (o teto é três), e um índice cheio sobre uma coluna quase toda nula
   custaria o tamanho da tabela para responder a mesma pergunta. */
CREATE INDEX IF NOT EXISTS rede_posts_fixados
  ON public.rede_posts(autor_id, fixado_em DESC)
  WHERE fixado_em IS NOT NULL;

-- ─── 2. COMPARTILHAR UMA PUBLICAÇÃO EM STORY ────────────────────────────────

/* ⚠️ **A REFERÊNCIA É UMA CHAVE ESTRANGEIRA, e o `ON DELETE SET NULL` é
   obrigatório.** Sem ele, arquivar/apagar o post referido derrubaria o story
   inteiro por violação de chave — e o story é de OUTRA pessoa, que não tem nada
   a ver com a decisão de quem apagou. Com `SET NULL`, o story sobrevive e o
   cartão simplesmente não desenha, que é o que um post que saiu do ar tem a
   dizer.

   ⚠️ **E a coluna NÃO carrega cópia nenhuma do post** — nem o texto, nem o
   caminho da foto, nem o nome de quem publicou. Só o id. Copiar qualquer coisa
   faria o cartão sobreviver à decisão de quem escreveu: ela edita a legenda, ou
   fecha o perfil, e a versão antiga continuaria circulando dentro do story. É a
   mesma decisão do carimbo da semana (derivado na leitura, nunca guardado) e a
   do carimbo do "então e agora". */
ALTER TABLE public.rede_stories
  ADD COLUMN IF NOT EXISTS post_de uuid REFERENCES public.rede_posts(id) ON DELETE SET NULL;

-- ─── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Rode o bloco abaixo depois: as duas linhas têm de vir `true`.

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rede_posts' AND column_name = 'fixado_em'
  ) AS fixado_em_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rede_stories' AND column_name = 'post_de'
  ) AS post_de_ok;
