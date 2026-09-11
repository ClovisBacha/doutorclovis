-- ═════════════════════════════════════════════════════════════════════════════
-- VÍDEO NA PUBLICAÇÃO  (ago/2026)
--
-- Era o último formato que faltava: a aba só aceitava foto, e é em vídeo que
-- uma mãe mostra o bebê mexendo, o primeiro sorriso, o primeiro passo. Foto
-- conta que aconteceu; vídeo mostra.
--
-- Idempotente: rodar de novo é seguro.
-- ═════════════════════════════════════════════════════════════════════════════

-- ⚠️ **O VÍDEO NÃO SOBE PELO CAMINHO DA FOTO.** As fotos viajam como data URL
-- dentro da chamada do servidor (1080px de JPEG ≈ 200 KB, e isso cabe). Trinta
-- segundos de vídeo de celular são 10 a 30 MB, e em base64 ficam 1,4× maiores:
-- estouraria o corpo da requisição. Ele sobe DIRETO para o Storage com URL
-- assinada, e só o CAMINHO chega ao servidor.
--
-- ⚠️ E é por isso que existe `caminhoEhDoDono` em `video-do-post.ts`: o cliente
-- manda a string do caminho, e sem aquela conferência ele mandaria o de outra
-- paciente.
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS video_path text;
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS video_segundos real;

COMMENT ON COLUMN public.rede_posts.video_path IS
  'Caminho no balde `rede`. A pasta é o uuid da autora — ver caminhoEhDoDono.';

-- ─────────────────────────────────────────────────────────────────────────────
-- O BALDE
--
-- ⚠️ **PRIVADO, como o das fotos.** A publicação tem camadas (`amigas`, "quem
-- me segue"), e um balde público entregaria o vídeo a quem tivesse a URL —
-- desfazendo pela porta dos fundos a escolha de visibilidade que ela fez.
-- Quem serve é a URL assinada, com validade.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('rede', 'rede', false)
ON CONFLICT (id) DO NOTHING;

-- ⚠️ A dona escreve só na PASTA DELA. O primeiro segmento do caminho é o uuid,
-- e é isto que faz a URL assinada de upload não virar uma porta para escrever
-- em cima do arquivo de outra pessoa.
DO $$ BEGIN
  CREATE POLICY "Dona escreve na própria pasta da rede" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'rede'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_name='rede_posts' AND column_name='video_path'))     AS video_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_name='rede_posts' AND column_name='video_segundos')) AS dur_ok,
  (SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id='rede'))     AS balde_ok;

-- ─────────────────────────────────────────────────────────────────────────────
-- REPUBLICAR (repost)
--
-- ⚠️ **SÓ PUBLICAÇÃO PÚBLICA PODE SER REPUBLICADA, e essa é a regra inteira.**
-- A aba tem camadas: um post pode ser para "quem me segue" ou só para as
-- amigas. Republicar uma dessas ampliaria a audiência escolhida pela autora —
-- e ela nunca saberia. É a porta dos fundos da visibilidade, e a única forma de
-- fechá-la é não deixar sair do público.
--
-- ⚠️ `ON DELETE SET NULL`: arquivar a original não pode derrubar a republicação
-- de quem republicou. O que a tela mostra então é "publicação não disponível",
-- nunca uma cópia velha do texto — cópia sobreviveria à decisão da autora de
-- tirar do ar.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS repost_de uuid REFERENCES public.rede_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS rede_posts_repost ON public.rede_posts(repost_de)
  WHERE repost_de IS NOT NULL;

SELECT (SELECT EXISTS (SELECT 1 FROM information_schema.columns
  WHERE table_name='rede_posts' AND column_name='repost_de')) AS repost_ok;
