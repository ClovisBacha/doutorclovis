-- ═══════════════════════════════════════════════════════════════════════════
-- O DIRECT COMPLETO — foto, conversa que nasce do app, silenciar e sair
--
-- Idempotente: rodar de novo é seguro.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e nunca dentro de um
-- `CREATE TABLE IF NOT EXISTS`. As duas tabelas JÁ EXISTEM no banco do dono, e
-- num banco assim o `CREATE` é no-op: a coluna nova simplesmente nunca nasce, e
-- rodar o arquivo de novo não conserta. Foi exatamente assim que
-- `carimbo_semana` passou a existir só no papel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── A MENSAGEM PASSOU A TER CORPO ──────────────────────────────────────────

/* A foto. Caminho no balde privado `conversas`; a URL é assinada na leitura. */
ALTER TABLE public.rede_mensagens ADD COLUMN IF NOT EXISTS imagem_path text;

/* O que a mensagem ANEXA, quando nasce de dentro do app.
   ⚠️ `ref_tipo` é um catálogo FECHADO. Campo livre aqui viraria um segundo
   sistema de anexos sem régua de visibilidade — e o que se anexa numa conversa
   é justamente o que a outra pessoa talvez não pudesse ver. */
ALTER TABLE public.rede_mensagens ADD COLUMN IF NOT EXISTS ref_tipo text;
ALTER TABLE public.rede_mensagens ADD COLUMN IF NOT EXISTS ref_id uuid;

DO $$ BEGIN
  ALTER TABLE public.rede_mensagens
    ADD CONSTRAINT rede_mensagens_ref_tipo CHECK (ref_tipo IN ('post', 'story'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

/* ⚠️ O TEXTO PRECISA PODER SER VAZIO. Uma mensagem que é SÓ foto, ou só um post
   anexado, não tem texto — e com `NOT NULL` sem default o INSERT falharia, ou
   (pior) o servidor mandaria a string vazia e a prévia da lista ficaria em
   branco sem ninguém entender por quê. */
ALTER TABLE public.rede_mensagens ALTER COLUMN texto SET DEFAULT '';

-- ─── SILENCIAR E SAIR, CADA UMA DO SEU LADO ─────────────────────────────────

/* ⚠️ SÃO QUATRO COLUNAS, DUAS POR PESSOA, e não duas compartilhadas.
   Silenciar e sair são decisões de UM lado: se fossem colunas únicas, silenciar
   calaria o aviso da outra também — e sair apagaria a conversa da tela de quem
   não pediu nada. É o mesmo motivo pelo qual `lida_a`/`lida_b` são duas. */
ALTER TABLE public.rede_conversas ADD COLUMN IF NOT EXISTS silenciada_a timestamptz;
ALTER TABLE public.rede_conversas ADD COLUMN IF NOT EXISTS silenciada_b timestamptz;

/* "Sair" ESCONDE a conversa de quem pediu; não apaga nada.
   ⚠️ Apagar as mensagens de verdade apagaria as da OUTRA pessoa junto — o texto
   dela, no aparelho dela, some porque eu limpei a minha lista. E a conversa
   volta sozinha se a outra escrever de novo, que é o comportamento do gênero. */
ALTER TABLE public.rede_conversas ADD COLUMN IF NOT EXISTS saiu_a timestamptz;
ALTER TABLE public.rede_conversas ADD COLUMN IF NOT EXISTS saiu_b timestamptz;

-- ─── O BALDE DAS FOTOS DA CONVERSA ──────────────────────────────────────────

/* ⚠️ BALDE PRÓPRIO, e PRIVADO. Não é o balde `rede` (que guarda o que foi
   publicado, e cuja régua de leitura é `podeVerPost`): aqui o conteúdo é de uma
   conversa de duas pessoas, e a única régua que vale é "sou uma das duas
   pontas". Misturar os dois faria a foto de um direct herdar a visibilidade de
   um post. */
INSERT INTO storage.buckets (id, name, public)
VALUES ('conversas', 'conversas', false)
ON CONFLICT (id) DO NOTHING;

/* ⚠️ SEM POLICY DE LEITURA PARA `authenticated`. Quem lê é o servidor, com a
   chave de serviço, depois de conferir que quem pergunta é dona da conversa —
   a mesma decisão de `rede_mensagens`, e pela mesma razão: aqui o arquivo é o
   segredo inteiro. A paciente SOBE pela URL assinada que o servidor emite. */

-- ─── CONFERÊNCIA ────────────────────────────────────────────────────────────
SELECT
  to_regclass('public.rede_mensagens')                                  AS mensagens_ok,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'rede_mensagens'
       AND column_name IN ('imagem_path','ref_tipo','ref_id'))          AS colunas_da_mensagem,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'rede_conversas'
       AND column_name IN ('silenciada_a','silenciada_b','saiu_a','saiu_b')) AS colunas_da_conversa,
  (SELECT count(*) FROM storage.buckets WHERE id = 'conversas')         AS balde_ok;
