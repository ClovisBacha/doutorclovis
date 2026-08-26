-- ═══════════════════════════════════════════════════════════════════════════
--  AS NOVE DA REDE — conteúdo sensível, rastro da triagem, legenda, arquivar
--  conversa, editar mensagem, vídeo no story, memórias e álbum.
--
--  Idempotente: rodar de novo é seguro.
--
--  ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
--  `CREATE TABLE IF NOT EXISTS`. As tabelas já existem no banco: ali o `CREATE`
--  é no-op, a coluna nunca nasce, e rodar de novo NÃO conserta. Foi exatamente
--  assim que `carimbo_semana` passou a existir só no papel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · AVISO DE CONTEÚDO SENSÍVEL ────────────────────────────────────────
--
-- ⚠️ Quem marca é QUEM PUBLICA, e isso é o recurso inteiro. O filtro de
-- palavras já existe e exige que ela ADIVINHE a palavra antes de doer; aqui a
-- proteção vem de quem escreveu, que é a única pessoa que sabe o que o texto
-- carrega. E protege os dois lados: quem publica sobre uma perda não quer
-- emboscar ninguém às três da manhã.
ALTER TABLE public.rede_posts   ADD COLUMN IF NOT EXISTS sensivel boolean NOT NULL DEFAULT false;
ALTER TABLE public.rede_stories ADD COLUMN IF NOT EXISTS sensivel boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.rede_posts.sensivel IS
  'A autora marcou como sensível: a tela borra e pede um toque. Nunca esconde.';

-- ── 2 · O RASTRO DA TRIAGEM CLÍNICA ───────────────────────────────────────
--
-- `triarTexto` recusa o post e NADA era registrado. Numa base onde 20,9% do
-- conselho leigo é errado, alguém tentando publicar conduta cinco vezes é um
-- sinal que ninguém vê.
--
-- ⚠️ **É TABELA PRÓPRIA, e não uma linha em `rede_denuncias`.** Ali `quem_id` é
-- QUEM DENUNCIOU e `denunciada_id` quem foi denunciada; aqui não há denunciante
-- — é o sistema barrando. Espremer os dois na mesma tabela faria a fila do
-- administrador misturar "alguém reclamou dela" com "ela tentou publicar algo
-- que a régua barra", que são conversas diferentes.
--
-- ⚠️ E o TRECHO é guardado porque sem ele a linha não diz nada: "tentou
-- publicar conduta" sem o texto não dá ao administrador o que julgar.
CREATE TABLE IF NOT EXISTS public.rede_triagem_barrada (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quem_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- 'post' | 'story' | 'comentario' | 'bio' | 'mensagem' | 'pergunta'
  onde       text NOT NULL,
  -- 'clinica' | 'emergencia' — o desfecho de `triarTexto`.
  desfecho   text NOT NULL,
  trecho     text NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rede_triagem_por_quem ON public.rede_triagem_barrada(quem_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS rede_triagem_recentes ON public.rede_triagem_barrada(criado_em DESC);
ALTER TABLE public.rede_triagem_barrada ENABLE ROW LEVEL SECURITY;
-- ⚠️ SEM policy nenhuma: só o service role lê e escreve. Uma policy de linha
-- daria à paciente a própria linha — e saber exatamente o que a régua barra é
-- o mapa para contorná-la.
REVOKE ALL ON public.rede_triagem_barrada FROM anon, authenticated;

-- ── 3 · LEGENDAS NO VÍDEO ─────────────────────────────────────────────────
--
-- ⚠️ É TEXTO, e não um arquivo `.vtt` no balde. A legenda de um vídeo de
-- quinze segundos cabe numa coluna, e um arquivo exigiria segundo upload,
-- segunda URL assinada e segunda varredura na exclusão de conta — três
-- superfícies novas para o que é uma frase.
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS video_legenda text;

-- ── 4 · ARQUIVAR CONVERSA ─────────────────────────────────────────────────
--
-- ⚠️ Duas colunas, uma por lado, pela MESMA razão de `fixada_a`/`fixada_b`:
-- arquivar é preferência de quem OLHA a lista. Uma coluna só faria a decisão
-- de uma sumir a conversa da tela da outra.
--
-- ⚠️ E é INSTANTE, nunca booleano: é ele que permite a conversa VOLTAR quando
-- a outra escreve — comparando com `ultima_em`. Com um booleano, arquivar
-- seria um sumiço permanente, que é o "sair" que já existe.
ALTER TABLE public.rede_conversas ADD COLUMN IF NOT EXISTS arquivada_a timestamptz;
ALTER TABLE public.rede_conversas ADD COLUMN IF NOT EXISTS arquivada_b timestamptz;

-- ── 5 · EDITAR MENSAGEM NO DIRECT ─────────────────────────────────────────
ALTER TABLE public.rede_mensagens ADD COLUMN IF NOT EXISTS editada_em timestamptz;

-- ── 6 · VÍDEO NO STORY ────────────────────────────────────────────────────
--
-- Mesmo balde e mesmo desenho do vídeo no post.
ALTER TABLE public.rede_stories ADD COLUMN IF NOT EXISTS video_path text;

-- ── 7 · MEMÓRIAS ──────────────────────────────────────────────────────────
--
-- ⚠️ **O CICLO É O QUE TORNA A MEMÓRIA SEGURA.** Sem ele não há como saber se
-- a publicação de um ano atrás é da gestação de agora ou de uma que terminou —
-- e ressuscitar a segunda é o pior desfecho possível deste recurso.
--
-- ⚠️ `NULL` é o caso das publicações ANTIGAS, e a régua trata `NULL` como
-- "não sei" e NÃO mostra. Errar para o lado de não lembrar.
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS ciclo text;

-- ⚠️ Guarda o que ela JÁ VIU, para a mesma memória não voltar todo dia.
CREATE TABLE IF NOT EXISTS public.rede_memorias_vistas (
  quem_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  post_id   uuid NOT NULL REFERENCES public.rede_posts ON DELETE CASCADE,
  visto_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quem_id, post_id)
);
ALTER TABLE public.rede_memorias_vistas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rede_memorias_vistas FROM anon, authenticated;

-- ── CONFERÊNCIA ───────────────────────────────────────────────────────────
DO $$
DECLARE faltando text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='rede_posts' AND column_name='sensivel') THEN faltando := faltando || ' posts.sensivel'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='rede_stories' AND column_name='sensivel') THEN faltando := faltando || ' stories.sensivel'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='rede_posts' AND column_name='video_legenda') THEN faltando := faltando || ' posts.video_legenda'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='rede_conversas' AND column_name='arquivada_a') THEN faltando := faltando || ' conversas.arquivada_a'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='rede_mensagens' AND column_name='editada_em') THEN faltando := faltando || ' mensagens.editada_em'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='rede_stories' AND column_name='video_path') THEN faltando := faltando || ' stories.video_path'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='rede_posts' AND column_name='ciclo') THEN faltando := faltando || ' posts.ciclo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_name='rede_triagem_barrada') THEN faltando := faltando || ' rede_triagem_barrada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_name='rede_memorias_vistas') THEN faltando := faltando || ' rede_memorias_vistas'; END IF;

  IF faltando <> '' THEN
    RAISE EXCEPTION 'APLICAR_NOVE_DA_REDE falhou. Faltando:%', faltando;
  END IF;
  RAISE NOTICE 'APLICAR_NOVE_DA_REDE: tudo no lugar.';
END $$;
