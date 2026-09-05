-- ══════════════════════════════════════════════════════════════════════════
-- MAIS DA REDE — esconder o story de pessoas específicas, rascunho no
-- servidor, desfecho da denúncia e o link público da publicação.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS` e `CREATE TABLE IF NOT
-- EXISTS`, nunca colunas novas dentro de um CREATE de tabela que já existe:
-- num banco que já a tem, o CREATE vira no-op e a coluna NUNCA nasce — e
-- rodar o SQL de novo não conserta. Foi assim que `carimbo_semana` passou a
-- existir só no papel.
--
-- Idempotente: rodar de novo é seguro.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. ESCONDER O STORY DE PESSOAS ESPECÍFICAS ────────────────────────────
--
-- ⚠️ A camada do story (`seguidores` / `amigas`) é GROSSA. O que faltava é o
-- "esconder do fulano": a sogra, a chefe, a colega. É o controle que faz ela
-- publicar — e no Instagram ele se chama "Ocultar story de".
--
-- ⚠️ É uma EXCLUSÃO, e não uma lista de permissão: quem não está aqui vê. A
-- lista de permissão já existe e é a camada; duas listas de permissão para o
-- mesmo story seriam duas réguas a divergir.
CREATE TABLE IF NOT EXISTS public.rede_story_escondido (
  quem_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  escondido_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quem_id, escondido_id)
);
ALTER TABLE public.rede_story_escondido ENABLE ROW LEVEL SECURITY;
-- ⚠️ Sem policy: quem lê é só o servidor. Uma policy de LINHA daria à paciente
-- a própria linha — e saber que ELA está na lista de alguém é exatamente o que
-- este recurso não pode contar. Esconder é calado, como o silenciar.
REVOKE ALL ON public.rede_story_escondido FROM anon, authenticated;

-- ── 2. O RASCUNHO DA PUBLICAÇÃO, NO SERVIDOR ──────────────────────────────
--
-- ⚠️ Hoje ele vive no `localStorage`: morre ao trocar de aparelho, e o app
-- recusa guardar as FOTOS ali de propósito (a cota de ~5 MB é compartilhada
-- com o `journey_state`, e estourá-la derruba a próxima gravação de qualquer
-- coisa). No servidor o texto sobrevive à troca de celular.
--
-- ⚠️ UM rascunho por pessoa (a chave é o autor): uma lista viraria uma
-- segunda caixa de publicações não publicadas, com o peso de tela que isso tem.
CREATE TABLE IF NOT EXISTS public.rede_rascunhos (
  autor_id     uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  texto        text,
  visibilidade text,
  lugar        text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rede_rascunhos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rede_rascunhos FROM anon, authenticated;

-- ── 3. O DESFECHO DA DENÚNCIA VOLTA A QUEM DENUNCIOU ──────────────────────
--
-- ⚠️ A tela promete "fica registrada para a gente olhar", a fila existe no
-- painel, e o desfecho nunca voltava. Denúncia sem retorno é a que ninguém faz
-- duas vezes — e num app onde a alternativa é o bloqueio cego, isso custa.
ALTER TABLE public.rede_denuncias ADD COLUMN IF NOT EXISTS desfecho text;
--
-- ⚠️ **NÃO existe `avisada_em` aqui, e a ausência é deliberada.** Ela estava
-- nesta migration e NADA na rede a escrevia ou lia — coluna morta, com a
-- aparência de que o aviso já é entregue. Quem entrega o desfecho é a TELA
-- (`meusDesfechos`); no dia em que ele virar push, a coluna nasce junto com
-- quem a carimba, nunca antes.

-- ── 4. O LINK PÚBLICO DA PUBLICAÇÃO ───────────────────────────────────────
--
-- ⚠️ O perfil tem `/p/<codigo>`; uma publicação sozinha não tinha endereço. O
-- código é PRÓPRIO por publicação e sorteado — nunca o uuid: o uuid viaja em
-- toda reação e todo salvo, e transformá-lo em endereço público faria qualquer
-- um que já o tenha visto abrir a publicação fora do app.
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS codigo_publico text;
CREATE UNIQUE INDEX IF NOT EXISTS rede_posts_codigo_publico
  ON public.rede_posts (codigo_publico) WHERE codigo_publico IS NOT NULL;

-- ── CONFERÊNCIA ───────────────────────────────────────────────────────────
DO $$
DECLARE faltando text := '';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_name='rede_story_escondido') THEN faltando := faltando || ' rede_story_escondido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_name='rede_rascunhos') THEN faltando := faltando || ' rede_rascunhos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='rede_denuncias' AND column_name='desfecho') THEN faltando := faltando || ' denuncias.desfecho'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='rede_posts' AND column_name='codigo_publico') THEN faltando := faltando || ' posts.codigo_publico'; END IF;
  IF faltando = '' THEN RAISE NOTICE 'MAIS DA REDE: tudo no lugar ✅';
  ELSE RAISE NOTICE 'MAIS DA REDE: FALTANDO →%', faltando; END IF;
END $$;
