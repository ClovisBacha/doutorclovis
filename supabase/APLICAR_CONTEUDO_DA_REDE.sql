-- ═══════════════════════════════════════════════════════════════════════════
-- O CONTEÚDO — carrossel de story, foto na resposta, lugar e figurinha
--
-- Idempotente: rodar de novo é seguro.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
-- `CREATE TABLE IF NOT EXISTS`. As tabelas já existem, e num banco assim o
-- `CREATE` é no-op: a coluna nova nunca nasce, e rodar de novo não conserta.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. O CARROSSEL DE STORY ────────────────────────────────────────────────

/* ⚠️ **O MESMO DESENHO DO POST, e de propósito.** `rede_posts.imagens` é uma
   coluna de array com `imagem_path` continuando a ser a PRIMEIRA foto — todo
   código que já lê continua funcionando, e um story de foto única nunca precisa
   olhar o array. Uma tabela filha custaria um `join` na tela que mais abre.

   ⚠️ **E o teto é MENOR que o do post: cinco.** O story é folheado com o dedo em
   pé, com a barrinha correndo — dez fotos ali viram uma sequência que ninguém
   termina, e o formato existe para ser rápido. */
ALTER TABLE public.rede_stories
  ADD COLUMN IF NOT EXISTS imagens text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  ALTER TABLE public.rede_stories DROP CONSTRAINT IF EXISTS story_carrossel_ate_cinco;
  ALTER TABLE public.rede_stories
    ADD CONSTRAINT story_carrossel_ate_cinco
    CHECK (array_length(imagens, 1) IS NULL OR array_length(imagens, 1) <= 5);
END $$;

-- ─── 2. O LUGAR ─────────────────────────────────────────────────────────────

/* ⚠️ **É UM RÓTULO QUE ELA ESCREVE, e NUNCA coordenada.**
   Guardar latitude e longitude de uma gestante — e devolvê-las a quem abre o
   post — é dado de localização precisa numa base de alto risco: é o que permite
   a alguém saber onde ela mora. O texto ("Maternidade Santa Casa", "casa da
   minha mãe") diz o que ela quer dizer e não localiza ninguém.

   ⚠️ **E NÃO HÁ AUTOCOMPLETAR de lugares.** Um catálogo de endereços
   transformaria o campo numa lista de maternidades com as pacientes de cada
   uma — exatamente o cruzamento que a régua de "nada clínico no perfil" existe
   para impedir. */
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS lugar text;

-- ─── 3. A FOTO NA RESPOSTA AO STORY ─────────────────────────────────────────

/* Nenhuma coluna nova: a resposta ao story JÁ é uma mensagem do direct
   (`rede_mensagens`, com `ref_tipo = 'story'`), e ela já aceita `imagem_path`
   desde o `APLICAR_CONVERSA_E_COMENTARIOS`. O que faltava era a TELA. */

-- ─── 4. AS FIGURINHAS ───────────────────────────────────────────────────────

/* Nenhuma coluna nova: a figurinha é uma mensagem de TEXTO com um marcador
   (`:dc-fig:<id>:`), e o catálogo vive no código.

   ⚠️ **E ela é NOSSA, e não um GIF de fora.** Giphy exigiria abrir a CSP para um
   host externo, tem custo por chamada, e — o que decide — entrega conteúdo NÃO
   MODERADO dentro de um app de gestação: a busca por "grávida" no Giphy devolve
   piada de parto e imagem de teor sexual. Um catálogo pequeno, desenhado aqui,
   diz as mesmas coisas sem nenhum desses três problemas. */

-- ─── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Todas as linhas têm de vir `true`.

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_stories' AND column_name='imagens')
    AS story_carrossel_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_posts' AND column_name='lugar')
    AS lugar_ok;
