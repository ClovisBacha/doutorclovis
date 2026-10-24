-- ═══════════════════════════════════════════════════════════════════════════
-- AVISOS, PREFERÊNCIAS E O QUE VEM DEPOIS
--
-- Idempotente: rodar de novo é seguro.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
-- `CREATE TABLE IF NOT EXISTS`. As tabelas já existem no banco do dono, e num
-- banco assim o `CREATE` é no-op: a coluna nova nunca nasce, e rodar de novo
-- não conserta.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── AS PREFERÊNCIAS DE AVISO ───────────────────────────────────────────────

/* ⚠️ **"OU TUDO, OU NADA" ERA A ÚNICA ESCOLHA, e numa gestação de alto risco
   isso é uma escolha que ninguém deveria ter de fazer.** Até aqui, parar de
   receber aviso da Comunidade significava desligar a notificação do app inteiro
   — o mesmo canal por onde chega o aviso de emergência e o lembrete de
   consulta.

   ⚠️ **A LISTA É DO QUE ELA DESLIGOU, e não do que ligou.** Guardar o que está
   LIGADO faria toda espécie nova nascer desligada para quem já usa o app — e um
   recurso que nasce mudo para a base inteira é um recurso que ninguém descobre.
   Desligado é sempre escolha explícita, e o padrão (`'{}'`) é "recebo tudo".

   ⚠️ **É `text[]`, e não uma tabela.** É uma lista curta de chaves que a régua
   pura (`AVISOS_QUE_ELA_DESLIGA`) já enumera; uma tabela exigiria uma leitura a
   mais em `registrarAtividade`, que roda em toda reação de toda pessoa. */
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS avisos_desligados text[] NOT NULL DEFAULT '{}';

-- ─── O LINK DA BIO ──────────────────────────────────────────────────────────

/* ⚠️ **COLUNA PRÓPRIA, e não um link solto DENTRO da bio.** Varrer a bio atrás
   de `http` transformaria qualquer texto com endereço num link — inclusive o
   que ela escreveu sem querer que fosse clicável. E o servidor precisa validar
   o esquema antes de a tela pintar: `javascript:` numa bio é XSS na tela de
   quem visita. */
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS bio_link text;

-- ─── QUANTAS VIRAM A PUBLICAÇÃO ─────────────────────────────────────────────

/* ⚠️ **`rede_post_vistas` JÁ EXISTE e já é gravada** — `marcarPostsVistos`
   escreve nela desde que o feed passou a saber o que ela já viu. O que faltava
   era LER: a autora não tinha como saber se as trinta pessoas que a seguem
   viram a foto do ultrassom ou se ninguém abriu o app naquele dia.

   Só o índice, para a contagem não varrer a tabela. */
CREATE INDEX IF NOT EXISTS rede_post_vistas_por_post
  ON public.rede_post_vistas (post_id);

-- ─── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Todas as linhas têm de vir `true`.

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='patient_profiles'
      AND column_name='avisos_desligados') AS avisos_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='patient_profiles'
      AND column_name='bio_link') AS bio_link_ok,
  EXISTS (SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='rede_post_vistas_por_post')
    AS indice_vistas_ok;
