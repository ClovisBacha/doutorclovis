-- ═══════════════════════════════════════════════════════════════════════════
-- O STORY GANHA CAMADA DE VISIBILIDADE, ARQUIVO E DESTAQUE
--
-- Idempotente: rodar de novo é seguro.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
-- `CREATE TABLE IF NOT EXISTS`. A tabela já existe no banco do dono, e num banco
-- assim o `CREATE` é no-op: a coluna nova nunca nasce, e rodar de novo não
-- conserta. Foi exatamente assim que `carimbo_semana` passou a existir só no
-- papel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. A CAMADA ────────────────────────────────────────────────────────────

/* ⚠️ **O STORY ERA O ÚNICO CONTEÚDO SEM CAMADA — e é o mais íntimo.**

   O post escolhe entre `publico`, `seguidores` e `amigas` desde o primeiro dia.
   O story não escolhia nada: ia sempre para `sigo ∪ amigas`, ou seja, para o
   público MAIS LARGO que ela tem. Num app de gestação de alto risco isso é o
   contrário do que a natureza do formato pede — o story é onde ela põe a
   ultrassom que acabou de sair e o dia ruim, coisas que ela conta para seis
   pessoas e não para trezentas.

   ⚠️ **O PADRÃO É `seguidores`, e não `amigas`.** Ele é o comportamento que os
   stories já tinham: mudar o padrão para o mais fechado faria as publicações
   futuras dela alcançarem menos gente do que as de ontem, sem ela ter pedido —
   e ela descobriria isso pelo silêncio. Quem quiser fechar, fecha por
   publicação, que é o que a coluna existe para permitir.

   ⚠️ **E NÃO EXISTE `publico` aqui**, de propósito. Um story público seria
   visível a quem ela não conhece, e a fileira de stories não tem rótulo
   "Sugerido para você" nem nada que diga procedência — a paciente abriria a
   bolinha achando que é de alguém que ela segue. O post tem essa camada porque
   tem o rótulo; o story não tem o rótulo, então não tem a camada. */
ALTER TABLE public.rede_stories
  ADD COLUMN IF NOT EXISTS visibilidade text NOT NULL DEFAULT 'seguidores';

DO $$
BEGIN
  ALTER TABLE public.rede_stories DROP CONSTRAINT IF EXISTS rede_stories_visibilidade_check;
  ALTER TABLE public.rede_stories
    ADD CONSTRAINT rede_stories_visibilidade_check
    CHECK (visibilidade IN ('seguidores', 'amigas'));
END $$;

-- ─── 2. O DESTAQUE ──────────────────────────────────────────────────────────

/* ⚠️ **O ARQUIVO JÁ EXISTIA — ninguém o estava lendo.**

   Os stories expirados NUNCA foram apagados: a consulta da fileira filtra por
   `expira_em > now()`, e a linha fica no banco. O que faltava não era guardar —
   era uma tela que devolvesse a ela o que ela publicou. Nenhuma coluna nova é
   necessária para o arquivo.

   ⚠️ **O DESTAQUE É UM INSTANTE, e não um booleano.** Com booleano não haveria
   como ordenar os destaques entre si, e a fileira do perfil sairia em ordem
   arbitrária — que muda entre duas aberturas. Com o instante, o último
   destacado vai na frente, que é o que se espera de "acabei de destacar".

   ⚠️ E ele NÃO mexe em `expira_em`. Duas colunas dizendo quanto tempo a coisa
   vive divergiriam no primeiro ajuste; quem decide se um story aparece na
   FILEIRA continua sendo `expira_em`, e quem decide se ele aparece no PERFIL é
   esta coluna. São duas perguntas. */
ALTER TABLE public.rede_stories
  ADD COLUMN IF NOT EXISTS destacado_em timestamptz;

/* Índice PARCIAL: destaque é um punhado por conta, e um índice cheio sobre uma
   coluna quase toda nula custaria o tamanho da tabela para a mesma resposta. */
CREATE INDEX IF NOT EXISTS rede_stories_destacados
  ON public.rede_stories(autor_id, destacado_em DESC)
  WHERE destacado_em IS NOT NULL;

/* O arquivo dela é lido por `autor_id` + `criado_em`, e a fileira também. */
CREATE INDEX IF NOT EXISTS rede_stories_do_autor
  ON public.rede_stories(autor_id, criado_em DESC);

-- ─── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- As três linhas têm de vir `true`.

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rede_stories'
      AND column_name = 'visibilidade'
  ) AS visibilidade_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rede_stories'
      AND column_name = 'destacado_em'
  ) AS destacado_em_ok,
  EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rede_stories_visibilidade_check'
  ) AS check_ok;
