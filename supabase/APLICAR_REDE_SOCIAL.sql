-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_REDE_SOCIAL.sql — perfis, seguir, posts, reações e bloqueio.
-- Idempotente: rode quantas vezes quiser.
--
-- ─── AS DEZ ESTRUTURAS ───────────────────────────────────────────────────────
--
-- Perfil · Seguir · Post · Visibilidade · Feed · Reações · Avisos · Descoberta
-- · Bloqueio · Modo Cuidado.
--
-- As RÉGUAS moram em `src/lib/rede-social.ts`, testadas sem banco. Aqui ficam
-- só as garantias que o banco tem de dar: um seguir por par, uma reação por
-- pessoa por post, e ninguém escrevendo na linha de ninguém.
--
-- ─── ⚠️ NÃO EXISTE COMENTÁRIO, E ISSO É DECISÃO DE PRODUTO ───────────────────
--
-- Pedido do dono, sobre a pesquisa: de 1.098 respostas com conselho em fóruns
-- de gestação, 20,9% estavam erradas ou enganosas e 5,5% eram potencialmente
-- danosas — e o grupo não se autocorrige (só 5,2% das ruins foram retificadas).
-- Num app que carrega o nome do consultório, "comigo foi assim, não precisa ir
-- ao pronto-socorro" é responsabilidade do médico.
--
-- Reação dá quase toda a sensação de comunidade com uma fração do risco, e é
-- REVERSÍVEL: dá para abrir texto depois. O contrário não dá.
--
-- ─── ⚠️ POR QUE A LEITURA NÃO É RLS ──────────────────────────────────────────
--
-- Saber se eu posso ver um post exige cruzar QUATRO coisas: o Modo Cuidado do
-- autor, o bloqueio nos dois sentidos, o seguir, e o grafo de amizade que já
-- existe (`referred_by` + `amizades` − `amizades_encerradas`). Uma policy de
-- RLS que fizesse isso duplicaria `podeVerPost` em SQL, e as duas divergiriam
-- no primeiro conserto — com a divergência aparecendo como post vazando, não
-- como erro.
--
-- Por isso: a paciente ESCREVE o que é dela pela RLS, e toda LEITURA de
-- terceiro passa por `rede-social.functions.ts`, com service role, depois de
-- chamar a régua pura. `anon` não tem política nenhuma em tabela alguma.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1 · PERFIL — duas colunas em `patient_profiles`.
--
-- ⚠️ `perfil_publico` nasce FALSE, e o DEFAULT é a régua inteira. O grafo desta
-- aba nasceu fechado por indicação, e é isso que a torna segura SEM MODERAÇÃO.
-- Nascer público exporia milhares de gestantes de alto risco por omissão, sem
-- nunca terem pedido plateia.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS perfil_publico boolean NOT NULL DEFAULT false;
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS bio text;

-- A busca só varre quem abriu o perfil. Índice parcial: a tabela inteira é de
-- gestantes, e a fração pública é minúscula (influenciadoras).
CREATE INDEX IF NOT EXISTS patient_profiles_publicos
  ON public.patient_profiles (id) WHERE perfil_publico;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 · SEGUIR — assimétrico.
--
-- ⚠️ Este é o primeiro grafo ASSIMÉTRICO do app. `amizades` e `duplas` usam par
-- ordenado (menor < maior) porque a relação é mútua; aqui NÃO se pode usar
-- isso — (A segue B) e (B segue A) são duas linhas diferentes e ambas válidas.
-- Copiar o padrão do par ordenado faria "seguir de volta" apagar o seguir
-- original.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_seguidores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seguidor_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  seguido_id  uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- 'ativo' | 'pendente'. Não existe 'recusado': recusar APAGA a linha, senão
  -- a chave única bloquearia o par para sempre e quem pediu de novo depois de
  -- um mal-entendido nunca mais conseguiria. Mesma decisão de APLICAR_DUPLAS.
  estado      text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('ativo','pendente')),
  criado_em   timestamptz NOT NULL DEFAULT now(),
  aceito_em   timestamptz,
  CONSTRAINT nao_segue_a_si_mesma CHECK (seguidor_id <> seguido_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS rede_seguidores_par
  ON public.rede_seguidores (seguidor_id, seguido_id);
-- As duas consultas do feed e do perfil: "quem eu sigo" e "quem me segue".
CREATE INDEX IF NOT EXISTS rede_seguidores_de
  ON public.rede_seguidores (seguidor_id) WHERE estado = 'ativo';
CREATE INDEX IF NOT EXISTS rede_seguidores_para
  ON public.rede_seguidores (seguido_id) WHERE estado = 'ativo';
-- Os pedidos que ela precisa responder.
CREATE INDEX IF NOT EXISTS rede_seguidores_pendentes
  ON public.rede_seguidores (seguido_id) WHERE estado = 'pendente';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 e 4 · POSTS E VISIBILIDADE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  texto        text,
  -- Caminho no balde privado `rede`. Nunca URL: a URL é assinada na hora, com
  -- validade de 1h (`urlAssinada` em imagens.server.ts).
  imagem_path  text,
  -- ⚠️ SEPARADA da do perfil, e a separação é o recurso: um perfil público com
  -- um post 'amigas' é o caso NORMAL. A influenciadora publica a ultrassom
  -- para o mundo e o desabafo de terça para as seis pessoas que ela conhece.
  visibilidade text NOT NULL DEFAULT 'amigas'
    CHECK (visibilidade IN ('publico','seguidores','amigas')),
  criado_em    timestamptz NOT NULL DEFAULT now(),
  -- Apagar MARCA. As reações apontam para o post, e um DELETE levaria junto o
  -- registro de quem esteve ali.
  arquivado_em timestamptz,
  -- Post vazio não existe: ou tem foto, ou tem texto.
  CONSTRAINT post_tem_conteudo CHECK (imagem_path IS NOT NULL OR btrim(coalesce(texto,'')) <> '')
);

-- O feed lê por autor e por data. Índice composto, só nos vivos.
CREATE INDEX IF NOT EXISTS rede_posts_autor_data
  ON public.rede_posts (autor_id, criado_em DESC) WHERE arquivado_em IS NULL;
CREATE INDEX IF NOT EXISTS rede_posts_data
  ON public.rede_posts (criado_em DESC) WHERE arquivado_em IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6 · REAÇÕES
--
-- ⚠️ UMA por pessoa por post — é a chave única que garante. Tocar na mesma
-- tira, tocar noutra troca (UPDATE). Sem ela, uma pessoa encheria um post com
-- cinco emojis, o que num post sobre notícia difícil pareceria deboche.
--
-- ⚠️ E o CHECK dos tipos existe para o dia em que alguém acrescentar '😂' pelo
-- cliente. O catálogo mora em `rede-social.ts` e nenhuma das cinco pode ser
-- lida como julgamento — ver o comentário longo de `REACOES`.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_reacoes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   uuid NOT NULL REFERENCES public.rede_posts ON DELETE CASCADE,
  quem_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tipo      text NOT NULL CHECK (tipo IN ('amei','torcendo','emocionei','forca','abraco')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rede_reacoes_uma_por_pessoa
  ON public.rede_reacoes (post_id, quem_id);
CREATE INDEX IF NOT EXISTS rede_reacoes_post ON public.rede_reacoes (post_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9 · BLOQUEIO
--
-- ⚠️ Guardado em UMA direção, com efeito nos DOIS sentidos. Se eu bloqueio
-- alguém, nenhuma das duas vê a outra — bloquear "só de um lado" deixaria a
-- bloqueada continuar lendo tudo que eu escrevo, o que é o oposto do que a
-- palavra promete. Quem aplica a simetria é `podeVerPost`, lendo o bloqueio
-- nos dois sentidos.
--
-- ⚠️ E bloquear DESFAZ o seguir nos dois sentidos (feito no servidor). Sem
-- isso a linha fica viva e ressuscita o vínculo no dia em que o bloqueio for
-- desfeito.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_bloqueios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quem_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  bloqueado_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nao_bloqueia_a_si_mesma CHECK (quem_id <> bloqueado_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS rede_bloqueios_par
  ON public.rede_bloqueios (quem_id, bloqueado_id);
CREATE INDEX IF NOT EXISTS rede_bloqueios_de   ON public.rede_bloqueios (quem_id);
CREATE INDEX IF NOT EXISTS rede_bloqueios_para ON public.rede_bloqueios (bloqueado_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- RLS — a paciente escreve o que é dela; leitura de terceiro é server-side.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rede_seguidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_reacoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_bloqueios  ENABLE ROW LEVEL SECURITY;

-- Seguir: ela vê os vínculos de que participa (para saber quem segue e quem a
-- segue). Escrita nenhuma pelo cliente — seguir passa por `aoSeguir`, que
-- confere bloqueio e Modo Cuidado.
DROP POLICY IF EXISTS "Vê os próprios vínculos" ON public.rede_seguidores;
CREATE POLICY "Vê os próprios vínculos" ON public.rede_seguidores
  FOR SELECT USING (auth.uid() = seguidor_id OR auth.uid() = seguido_id);

DROP POLICY IF EXISTS "Service manages rede_seguidores" ON public.rede_seguidores;
CREATE POLICY "Service manages rede_seguidores" ON public.rede_seguidores
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Posts: a AUTORA gerencia os dela por RLS (é o caminho simples e não depende
-- do grafo). Ler post de terceiro passa pelo servidor.
DROP POLICY IF EXISTS "Autora gerencia os próprios posts" ON public.rede_posts;
CREATE POLICY "Autora gerencia os próprios posts" ON public.rede_posts
  FOR ALL USING (auth.uid() = autor_id) WITH CHECK (auth.uid() = autor_id);

DROP POLICY IF EXISTS "Service manages rede_posts" ON public.rede_posts;
CREATE POLICY "Service manages rede_posts" ON public.rede_posts
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Reações: ela vê e apaga a PRÓPRIA. Inserir passa pelo servidor, que confere
-- se ela podia ver o post — reagir a um post que não se pode ver é o vazamento
-- pela porta dos fundos (a existência do post confirmada por um 200).
DROP POLICY IF EXISTS "Vê a própria reação" ON public.rede_reacoes;
CREATE POLICY "Vê a própria reação" ON public.rede_reacoes
  FOR SELECT USING (auth.uid() = quem_id);

DROP POLICY IF EXISTS "Service manages rede_reacoes" ON public.rede_reacoes;
CREATE POLICY "Service manages rede_reacoes" ON public.rede_reacoes
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Bloqueio: só quem bloqueou vê a linha. ⚠️ A bloqueada NUNCA pode ler esta
-- tabela — o bloqueio é calado, e uma consulta que devolvesse "você foi
-- bloqueada" transformaria a proteção num ato de confronto.
DROP POLICY IF EXISTS "Vê os próprios bloqueios" ON public.rede_bloqueios;
CREATE POLICY "Vê os próprios bloqueios" ON public.rede_bloqueios
  FOR ALL USING (auth.uid() = quem_id) WITH CHECK (auth.uid() = quem_id);

DROP POLICY IF EXISTS "Service manages rede_bloqueios" ON public.rede_bloqueios;
CREATE POLICY "Service manages rede_bloqueios" ON public.rede_bloqueios
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ═════════════════════════════════════════════════════════════════════════════
-- O BALDE DAS FOTOS — privado, sem policy.
--
-- Mesmo desenho de `album`, `exames` e `presentes`: `public = false` e ZERO
-- policies de storage. Quem entrega o arquivo é o servidor, por URL assinada de
-- 1 hora, e o caminho passa por `pastaDoDono` (sha256 do uuid) para a URL não
-- revelar quem é a paciente.
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('rede', 'rede', false)
ON CONFLICT (id) DO UPDATE SET public = false;

COMMENT ON TABLE public.rede_seguidores IS
  'Seguir ASSIMÉTRICO — o primeiro grafo do app que não é par ordenado. '
  '(A segue B) e (B segue A) são duas linhas válidas. Régua em rede-social.ts.';
COMMENT ON TABLE public.rede_posts IS
  'Posts com foto e/ou texto. `visibilidade` é separada da do perfil: um perfil '
  'público com post "amigas" é o caso normal.';
COMMENT ON TABLE public.rede_reacoes IS
  'Uma reação por pessoa por post. As cinco do CHECK são as únicas que não '
  'podem ser lidas como julgamento — não há 😂, 😮 nem 😢. Não há comentário.';
COMMENT ON TABLE public.rede_bloqueios IS
  'Guardado numa direção, efeito nos dois. Calado: a bloqueada nunca lê esta '
  'tabela nem recebe aviso.';

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA. As sete linhas têm que voltar `true`.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'patient_profiles' AND column_name = 'perfil_publico') AS coluna_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_seguidores')             AS seguidores_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_posts')                  AS posts_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_reacoes')                AS reacoes_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_bloqueios')              AS bloqueios_ok,
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE schemaname='public' AND indexname='rede_reacoes_uma_por_pessoa')    AS uma_reacao_ok,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id='rede' AND public = false)         AS balde_ok;
