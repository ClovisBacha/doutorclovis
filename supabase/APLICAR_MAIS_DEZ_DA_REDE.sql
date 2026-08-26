-- ═══════════════════════════════════════════════════════════════════════════
-- MAIS DEZ DA REDE — denúncia de story, filtro no direct, editar comentário,
-- conversa não lida, notas, favoritos, coleções, título do destaque, marcação
-- em story e busca de hashtag.
--
-- Idempotente: rodar de novo é seguro.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
-- `CREATE TABLE IF NOT EXISTS`. As tabelas já existem no banco do dono, e num
-- banco assim o `CREATE` é no-op: a coluna nova nunca nasce, e rodar de novo
-- não conserta. Foi assim que `carimbo_semana` passou a existir só no papel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. DENUNCIAR UM STORY ──────────────────────────────────────────────────

/* ⚠️ **ERA A ÚLTIMA SUPERFÍCIE SEM DENÚNCIA.** Post, perfil, comentário,
   pergunta e mensagem já tinham; o story não — e ele é o formato mais efêmero
   de todos. Sem denúncia, o que sai do ar em 24 h nunca chega à plataforma:
   a próxima paciente recebe a mesma coisa da mesma pessoa, e ninguém soube.

   ⚠️ O CHECK é reescrito COM A LISTA COMPLETA — uma lista cumulativa parcial
   apagaria os alvos anteriores no dia em que alguém re-rodasse este arquivo. */
DO $$
BEGIN
  ALTER TABLE public.rede_denuncias DROP CONSTRAINT IF EXISTS rede_denuncias_alvo_check;
  ALTER TABLE public.rede_denuncias
    ADD CONSTRAINT rede_denuncias_alvo_check
    CHECK (alvo IN ('post', 'perfil', 'comentario', 'pergunta', 'mensagem', 'story'));
END $$;

-- ─── 3. EDITAR UM COMENTÁRIO ────────────────────────────────────────────────

/* ⚠️ **A MARCA DE EDITADO NÃO É ENFEITE.** Quem respondeu a um comentário
   respondeu ao texto que estava lá; sem o selo, trocar o texto depois faz as
   respostas parecerem sem sentido — ou, pior, faz a autora parecer ter dito
   uma coisa que ninguém leu. É a mesma coluna que o POST já tem. */
ALTER TABLE public.rede_comentarios
  ADD COLUMN IF NOT EXISTS editado_em timestamptz;

-- ─── 5. AS NOTAS ────────────────────────────────────────────────────────────

/* ⚠️ **O RECADO CURTO QUE VIVE 24 H, no topo do direct.**
   Numa comunidade de gestação, "não consigo dormir 😅" às três da manhã é
   exatamente o sinal de baixo risco que começa uma conversa — e que ninguém
   publica como POST, porque post é para sempre e tem plateia.

   ⚠️ **UMA POR PESSOA** (a chave primária é o autor): a nota SUBSTITUI a
   anterior. Uma lista de notas viraria um segundo feed, e o valor dela é
   justamente ser uma frase só.

   ⚠️ **SEM POLICY PARA `authenticated`.** Quem lê é o servidor, depois de
   conferir o grafo — a lista de quem escreveu nota é a lista de quem está
   acordada agora. */
CREATE TABLE IF NOT EXISTS public.rede_notas (
  autor_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  texto     text NOT NULL,
  criada_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS rede_notas_vivas ON public.rede_notas(expira_em);
ALTER TABLE public.rede_notas ENABLE ROW LEVEL SECURITY;

-- ─── 6. FAVORITOS — "ver primeiro" ──────────────────────────────────────────

/* ⚠️ **O OPOSTO DE SILENCIAR, e ele faltava.** Silenciar já existe; num feed
   cronológico, quem segue trinta pessoas perde a publicação da amiga que está
   passando por alguma coisa. Favoritar é dizer "esta eu não quero perder".

   ⚠️ **É CALADO.** Ninguém é avisado de que foi favoritada — a mesma decisão do
   silenciar, do bloqueio e da saída de amizade. */
CREATE TABLE IF NOT EXISTS public.rede_favoritos (
  quem_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorita_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quem_id, favorita_id)
);
ALTER TABLE public.rede_favoritos ENABLE ROW LEVEL SECURITY;

-- ─── 7. COLEÇÕES NOS SALVOS ─────────────────────────────────────────────────

/* ⚠️ **UMA COLUNA, e não uma tabela de coleções.** A coleção é um RÓTULO que
   ela escreve; uma tabela própria exigiria criar a coleção antes de salvar, e
   o gesto de salvar tem de continuar sendo um toque só. `NULL` = "Salvos", que
   é onde tudo que já foi salvo continua. */
ALTER TABLE public.rede_salvos
  ADD COLUMN IF NOT EXISTS colecao text;

CREATE INDEX IF NOT EXISTS rede_salvos_colecao
  ON public.rede_salvos (quem_id, colecao)
  WHERE colecao IS NOT NULL;

-- ─── 8. O TÍTULO DO DESTAQUE ────────────────────────────────────────────────

/* ⚠️ **DESTAQUE SEM NOME É UMA GRADE DE IMAGENS.** O recurso existe desde
   ago/2026 e o perfil mostrava só os quadradinhos: "Ultrassons" e "Chá de bebê"
   são o que faz alguém tocar. */
ALTER TABLE public.rede_stories
  ADD COLUMN IF NOT EXISTS destaque_titulo text;

-- ─── 9. MARCAR ALGUÉM NUM STORY ─────────────────────────────────────────────

/* ⚠️ **TABELA PRÓPRIA, e não `story_id` em `rede_marcacoes`.** Lá o `post_id` é
   `NOT NULL` e faz parte da CHAVE PRIMÁRIA: torná-lo opcional exigiria trocar a
   chave, e a chave é o que impede a marcação duplicada. Duas tabelas, duas
   chaves, nenhuma migração de dado.

   ⚠️ **`ON DELETE CASCADE` no story**: ele expira e some, e a marcação some
   junto — ela não sobrevive ao que descrevia. */
CREATE TABLE IF NOT EXISTS public.rede_story_marcacoes (
  story_id  uuid NOT NULL REFERENCES public.rede_stories(id) ON DELETE CASCADE,
  quem_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, quem_id)
);
CREATE INDEX IF NOT EXISTS rede_story_marcacoes_de ON public.rede_story_marcacoes(quem_id);
ALTER TABLE public.rede_story_marcacoes ENABLE ROW LEVEL SECURITY;

-- ─── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Todas as linhas têm de vir `true`.

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_comentarios' AND column_name='editado_em')
    AS comentario_editado_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='rede_notas') AS notas_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='rede_favoritos') AS favoritos_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_salvos' AND column_name='colecao')
    AS colecao_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_stories' AND column_name='destaque_titulo')
    AS destaque_titulo_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='rede_story_marcacoes')
    AS story_marcacoes_ok;
