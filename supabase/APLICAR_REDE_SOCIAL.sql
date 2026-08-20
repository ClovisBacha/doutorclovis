-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_REDE_SOCIAL.sql — perfis, seguir, posts, reações e bloqueio.
-- Idempotente: rode quantas vezes quiser.
--
-- ─── AS DEZ ESTRUTURAS ───────────────────────────────────────────────────────
--
-- Perfil · Seguir · Post · Visibilidade · Feed · Reações · Avisos · Descoberta
-- · Bloqueio · Modo Cuidado.
--
-- Mais o que o básico do Instagram exige e que veio depois, no mesmo arquivo
-- porque ele ainda não tinha sido rodado: STORIES (com o registro de quem
-- viu), SALVOS, CARROSSEL e ATIVIDADE.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- O QUE O PERFIL CONTA DA GESTAÇÃO — duas chaves, e nunca uma.
--
-- Pedido do dono: "a ideia aqui é fornecer o básico como tempo de gestação da
-- criança e nome; outras coisas são realmente sensíveis, e não podemos expor a
-- paciente sem ela saber".
--
-- ⚠️ DUAS colunas e não uma: uma chave só obrigaria quem quer publicar o NOME
-- do bebê a publicar junto a SEMANA, que é o dado clínico. São duas decisões,
-- por razões diferentes.
--
-- ⚠️ DEFAULT false pela mesma razão escrita em `perfil_publico`: nascer ligado
-- publicaria a idade gestacional de toda paciente que já tem perfil aberto,
-- sem ela nunca ter pedido.
--
-- Nenhum índice: elas nunca recortam consulta — decoram a linha que a rede já
-- lê em `perfisPorId`.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS mostrar_semana boolean NOT NULL DEFAULT false;
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS mostrar_bebe boolean NOT NULL DEFAULT false;

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
  tipo      text NOT NULL CHECK (tipo IN ('amei','torcendo','emocionei','forca','abraco','apaixonei','carinho','beijo','fofo','anjo','festa','uau','rindo')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- ⚠️ O CHECK ACIMA SÓ VALE PARA BANCO NOVO.
-- `CREATE TABLE IF NOT EXISTS` não toca numa tabela que já existe — então num
-- banco que já rodou a versão de cinco reações o CHECK antigo continuaria lá, e
-- as oito novas seriam ACEITAS pelo servidor e RECUSADAS pelo banco: a paciente
-- toca no 😂, a tela mostra, e nada grava. Este bloco reescreve a regra.
ALTER TABLE public.rede_reacoes DROP CONSTRAINT IF EXISTS rede_reacoes_tipo_check;
ALTER TABLE public.rede_reacoes ADD CONSTRAINT rede_reacoes_tipo_check
  CHECK (tipo IN ('amei','torcendo','emocionei','forca','abraco','apaixonei','carinho','beijo','fofo','anjo','festa','uau','rindo'));

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
-- STORIES — a foto que some em 24 horas.
--
-- ⚠️ **A FILEIRA DE BOLINHAS JÁ EXISTIA NA TELA e era decorativa.** Isso é pior
-- que não ter: um anel aceso promete conteúdo novo, e tocar nele não fazia
-- nada. Interface que promete e não cumpre é o defeito que este repositório
-- mais persegue.
--
-- ⚠️ **O story é o formato de MENOR risco desta rede inteira**, e a pesquisa é
-- clara sobre por quê: conteúdo que some tira o medo do escrutínio permanente,
-- e é o único formato que a perda gestacional NÃO transforma em ruína — um
-- status de 24h se apaga sozinho, ao contrário de uma grade de fotos de
-- barriga que quem perdeu não consegue nem manter nem apagar.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rede_stories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  imagem_path text NOT NULL,
  texto       text,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  -- ⚠️ A expiração é uma COLUNA, não `criado_em + interval` calculado na
  -- consulta. Com o cálculo na leitura, mudar as 24h para 48h mudaria
  -- retroativamente stories que já tinham sumido — e eles voltariam do nada
  -- para quem já os tinha visto desaparecer.
  expira_em   timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  -- ⚠️ O CARIMBO DA SEMANA É UM BOOLEANO, e a semana NÃO é guardada aqui.
  --
  -- Guardar o texto ("28 semanas") ou queimá-lo no pixel do JPEG faria a
  -- semana sobreviver à decisão dela: o arquivo no balde guarda o carimbo para
  -- sempre, e uma paciente que entra em Modo Cuidado depois de publicar teria
  -- a semana pendurada num arquivo que o app não sabe mais desenhar.
  --
  -- Derivado, ele morre sozinho: a régua (`semanaParaCarimbo`) cala em Modo
  -- Cuidado, depois do parto e sem DUM, e o story deixa de ser carimbado sem
  -- uma linha de migração.
  carimbo_semana boolean NOT NULL DEFAULT false
);

-- A consulta da fileira: stories vivos, dos que ela segue. Índice parcial
-- sobre a expiração, que é o que mais recorta.
CREATE INDEX IF NOT EXISTS rede_stories_vivos
  ON public.rede_stories (autor_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS rede_stories_expira
  ON public.rede_stories (expira_em);

ALTER TABLE public.rede_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autora gerencia os próprios stories" ON public.rede_stories;
CREATE POLICY "Autora gerencia os próprios stories" ON public.rede_stories
  FOR ALL USING (auth.uid() = autor_id) WITH CHECK (auth.uid() = autor_id);

DROP POLICY IF EXISTS "Service manages rede_stories" ON public.rede_stories;
CREATE POLICY "Service manages rede_stories" ON public.rede_stories
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Quem já viu — para o anel apagar.
CREATE TABLE IF NOT EXISTS public.rede_stories_vistos (
  story_id uuid NOT NULL REFERENCES public.rede_stories ON DELETE CASCADE,
  quem_id  uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  visto_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, quem_id)
);

ALTER TABLE public.rede_stories_vistos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vê o que ela mesma viu" ON public.rede_stories_vistos;
CREATE POLICY "Vê o que ela mesma viu" ON public.rede_stories_vistos
  FOR SELECT USING (auth.uid() = quem_id);

DROP POLICY IF EXISTS "Service manages rede_stories_vistos" ON public.rede_stories_vistos;
CREATE POLICY "Service manages rede_stories_vistos" ON public.rede_stories_vistos
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ═════════════════════════════════════════════════════════════════════════════
-- SALVOS — o marcador de página.
--
-- É privado por natureza: no Instagram ninguém vê o que você salvou, e aqui
-- menos ainda. O que uma gestante salva ("sinais de trabalho de parto", "o que
-- levar pra maternidade") diz mais sobre o momento dela que qualquer post que
-- ela publique.
-- ═════════════════════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- SILENCIAR SEM DEIXAR DE SEGUIR (ago/2026)
--
-- ⚠️ Faltava o MEIO-TERMO. Só existia bloquear, que desfaz o seguir nos dois
-- sentidos e que a própria tela descreve como coisa séria. Numa rede em que as
-- pessoas se conhecem da vida real — a irmã, a cunhada, a amiga do trabalho —
-- não ter o degrau de baixo faz alguém bloquear a irmã, ou desistir da aba.
--
-- ⚠️ SILENCIAR NÃO É BLOQUEAR, e a diferença é o recurso:
--   · o vínculo CONTINUA (ela segue seguindo, e continua sendo amiga);
--   · o perfil dela continua acessível — dá para visitar quando quiser;
--   · só o FEED deixa de trazer as publicações dela;
--   · é CALADO e reversível, e ninguém é avisado.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_silenciados (
  quem_id       uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  silenciado_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quem_id, silenciado_id)
);

ALTER TABLE public.rede_silenciados ENABLE ROW LEVEL SECURITY;

-- ⚠️ SÓ ELA vê e escreve a própria lista — inclusive contra a silenciada. Saber
-- quem te silenciou é exatamente o que transformaria um gesto privado numa
-- briga, que é a razão de o bloqueio também ser mudo.
DROP POLICY IF EXISTS "Vê só os próprios silenciados" ON public.rede_silenciados;
CREATE POLICY "Vê só os próprios silenciados" ON public.rede_silenciados
  FOR ALL USING (auth.uid() = quem_id) WITH CHECK (auth.uid() = quem_id);

COMMENT ON TABLE public.rede_silenciados IS
  'Some do feed sem desfazer o vínculo. Calado, reversível, e só a dona vê.';

-- ─────────────────────────────────────────────────────────────────────────────
-- AS DENÚNCIAS DA REDE (ago/2026)
--
-- ⚠️ Isto deixou de ser melhoria quando a aba ganhou conteúdo publicado por
-- usuária. Pela diretriz 1.2 da App Store, um app com conteúdo gerado por
-- usuário precisa de quatro coisas: filtrar o censurável, oferecer denúncia,
-- permitir bloquear e AGIR sobre a denúncia. As três primeiras existiam; a
-- quarta era um botão que consolava — denúncia de PERFIL não existia, e a de
-- post caía numa fila que só a caixinha alimentava.
--
-- ⚠️ O MOTIVO É CATÁLOGO FECHADO, e nunca texto livre: campo aberto num app de
-- gestação é onde alguém escreve a informação clínica de OUTRA pessoa, e esse
-- texto iria parar numa tela de administração, gravado, sobre quem nunca soube.
--
-- ⚠️ E o índice único é (alvo, alvo_id, quem_id): a mesma pessoa denunciando a
-- mesma coisa duas vezes é UM incômodo, não dois. Sem ele, um toque nervoso
-- inflaria a reincidência, que é o número que decide a ordem da fila.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_denuncias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alvo         text NOT NULL CHECK (alvo IN ('post','perfil')),
  alvo_id      uuid NOT NULL,
  -- Quem foi denunciada. É o que a plataforma precisa saber.
  denunciada_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  quem_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  motivo       text NOT NULL CHECK (motivo IN ('assedio','saude','imagem','spam','outro')),
  -- O texto do post denunciado, congelado no instante da denúncia: se ela
  -- editar ou arquivar depois, a fila continua sabendo o que foi denunciado.
  trecho       text,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS rede_denuncias_uma_por_pessoa
  ON public.rede_denuncias (alvo, alvo_id, quem_id);
CREATE INDEX IF NOT EXISTS rede_denuncias_abertas
  ON public.rede_denuncias (criado_em DESC) WHERE resolvido_em IS NULL;
CREATE INDEX IF NOT EXISTS rede_denuncias_por_alvo
  ON public.rede_denuncias (denunciada_id);

ALTER TABLE public.rede_denuncias ENABLE ROW LEVEL SECURITY;

-- ⚠️ NENHUMA policy para `authenticated`. Uma paciente que pudesse varrer esta
-- tabela leria quem denunciou quem, e por quê — a lista de desafetos da
-- plataforma inteira. Escrita e leitura só pelo servidor, que confere a sessão
-- (e, na leitura, o e-mail de administrador).
DROP POLICY IF EXISTS "Service manages rede_denuncias" ON public.rede_denuncias;
CREATE POLICY "Service manages rede_denuncias" ON public.rede_denuncias
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.rede_denuncias IS
  'Denúncias de post e de perfil. Motivo de catálogo fechado; só o servidor lê e escreve.';

-- ─────────────────────────────────────────────────────────────────────────────
-- EDITAR A LEGENDA DEPOIS DE PUBLICAR (ago/2026)
--
-- ⚠️ A coluna é o SELO, não o histórico. Ela existe para a tela poder dizer
-- "editado" — sem isso, corrigir uma vírgula vira reescrita silenciosa da
-- história, e quem reagiu ao texto antigo não tem como saber que ele mudou.
--
-- ⚠️ E NÃO guardamos a versão anterior. Guardar o texto antigo de um post sobre
-- gestação criaria um arquivo de coisas que ela decidiu tirar do ar — o
-- oposto do que editar significa.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS editado_em timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- "ENTÃO E AGORA" (ago/2026 — ideia 2)
--
-- ⚠️ GUARDA SÓ QUAL POST É O "ENTÃO". As duas semanas são DERIVADAS na leitura,
-- pela mesma razão do carimbo do story: texto guardado sobrevive à decisão dela.
-- Uma paciente que desliga `mostrar_semana` (ou entra em Modo Cuidado) depois de
-- publicar teria a semana pendurada numa coluna que o app não sabe mais apagar.
--
-- ⚠️ E `ON DELETE SET NULL`, nunca CASCADE: apagar a publicação ANTIGA não pode
-- apagar a comparação — ela vira um carrossel comum de duas fotos, que é o
-- desfecho certo. Com CASCADE, apagar um post de quatro meses atrás derrubaria
-- silenciosamente o post de ontem.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS comparacao_de uuid REFERENCES public.rede_posts(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- MARCAR QUEM ESTAVA JUNTO (ago/2026 — ideia 10)
--
-- ⚠️ A marcação NÃO amplia a visibilidade do post. Um post `amigas` marcado
-- continua visível só para as amigas de QUEM PUBLICOU — a leitura é feita em
-- `podeVerPost`, e não aqui. Se a marcação escancarasse o post para a rede da
-- marcada, ela viraria a porta dos fundos da camada de visibilidade.
--
-- ⚠️ E quem tira a marcação é A MARCADA. Ter o próprio nome numa foto de
-- gestação de outra pessoa não é decisão de quem publicou; sem essa saída a
-- única defesa dela seria pedir para a amiga apagar o post inteiro.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_marcacoes (
  post_id   uuid NOT NULL REFERENCES public.rede_posts ON DELETE CASCADE,
  quem_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, quem_id)
);

-- Os posts em que EU fui marcada, do mais novo para o mais velho: é a consulta
-- da aba do perfil dela.
-- ─────────────────────────────────────────────────────────────────────────────
-- ENQUETE E CAIXINHA DENTRO DO STORY (ago/2026 — ideia 4)
--
-- ⚠️ AS RÉGUAS SÃO AS MESMAS do post e da caixinha (`limparOpcoes`,
-- `enqueteValida`, `decidirPergunta`). O que muda é só ONDE o voto é guardado —
-- e ele precisa de tabela própria porque a chave estrangeira aponta para
-- `rede_stories`, que expira em 24 h e some com os votos junto (CASCADE).
--
-- ⚠️ E a PERGUNTA do story não ganha tabela nenhuma: ela cai na MESMA
-- `rede_perguntas` da caixinha, com a mesma triagem clínica. O story é só outra
-- porta para a caixinha que já existe.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rede_stories
  ADD COLUMN IF NOT EXISTS enquete_opcoes text[];
ALTER TABLE public.rede_stories
  ADD COLUMN IF NOT EXISTS pergunta_aberta boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- REAGIR AO STORY (ago/2026)
--
-- O story tinha enquete e caixinha, e não tinha o gesto mais simples de todos.
--
-- ⚠️ NO MODELO, a reação ao story vira uma MENSAGEM DIRETA para quem publicou.
-- Este app não tem mensagem direta — e não vai ter, porque conversa privada
-- entre pacientes é o canal que a decisão de fechar os comentários evitou. Aqui
-- ela cai na caixa de Atividade da autora, com o nome de quem reagiu, e mais
-- nada: é um afago, não uma conversa.
--
-- ⚠️ E UMA por pessoa por story, trocável — a mesma régua da reação ao post.
-- Sem a chave única, cinco toques viram cinco linhas e a autora abre a
-- Atividade achando que cinco pessoas reagiram.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_story_reacoes (
  story_id  uuid NOT NULL REFERENCES public.rede_stories ON DELETE CASCADE,
  quem_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tipo      text NOT NULL CHECK (tipo IN ('amei','torcendo','emocionei','forca','abraco','apaixonei','carinho','beijo','fofo','anjo','festa','uau','rindo')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, quem_id)
);

CREATE INDEX IF NOT EXISTS rede_story_reacoes_do ON public.rede_story_reacoes (story_id);

ALTER TABLE public.rede_story_reacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service manages rede_story_reacoes" ON public.rede_story_reacoes;
CREATE POLICY "Service manages rede_story_reacoes" ON public.rede_story_reacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.rede_story_reacoes IS
  'Reação a um story. Vai para a Atividade da autora — não existe mensagem direta neste app.';

CREATE TABLE IF NOT EXISTS public.rede_story_votos (
  story_id  uuid NOT NULL REFERENCES public.rede_stories ON DELETE CASCADE,
  quem_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Índice da opção. O texto vive no story; guardar a string aqui faria o
  -- resultado mentir se ela editasse a opção depois.
  opcao     smallint NOT NULL CHECK (opcao >= 0 AND opcao <= 3),
  criado_em timestamptz NOT NULL DEFAULT now(),
  -- ⚠️ UM VOTO POR PESSOA, garantido pela chave primária — a mesma decisão da
  -- enquete do post, e é ela que permite a tela dizer "o voto não muda depois"
  -- sem depender de o cliente se comportar.
  PRIMARY KEY (story_id, quem_id)
);

CREATE INDEX IF NOT EXISTS rede_story_votos_do ON public.rede_story_votos (story_id);

ALTER TABLE public.rede_story_votos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service manages rede_story_votos" ON public.rede_story_votos;
CREATE POLICY "Service manages rede_story_votos" ON public.rede_story_votos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.rede_story_votos IS
  'Votos na enquete de um story. Some com o story (24h). Um por pessoa.';

CREATE INDEX IF NOT EXISTS rede_marcacoes_de ON public.rede_marcacoes (quem_id, criado_em DESC);

ALTER TABLE public.rede_marcacoes ENABLE ROW LEVEL SECURITY;

-- Escrita só pelo servidor: é ele que confere o vínculo (`saoAmigas`), o
-- bloqueio e o Modo Cuidado de cada marcada, uma por uma. Um `INSERT` direto do
-- navegador poria o nome de qualquer paciente embaixo de qualquer foto.
DROP POLICY IF EXISTS "Service manages rede_marcacoes" ON public.rede_marcacoes;
CREATE POLICY "Service manages rede_marcacoes" ON public.rede_marcacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.rede_marcacoes IS
  'Quem estava junto num post. Escrita só pelo servidor; a marcada pode tirar a própria marcação.';

CREATE TABLE IF NOT EXISTS public.rede_salvos (
  quem_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  post_id   uuid NOT NULL REFERENCES public.rede_posts ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quem_id, post_id)
);

CREATE INDEX IF NOT EXISTS rede_salvos_de ON public.rede_salvos (quem_id, criado_em DESC);

ALTER TABLE public.rede_salvos ENABLE ROW LEVEL SECURITY;

-- ⚠️ SÓ ELA, inclusive para a autora do post: quem salvou o meu post não é da
-- minha conta, e saber disso mudaria como eu leio quem me acompanha.
DROP POLICY IF EXISTS "Vê só os próprios salvos" ON public.rede_salvos;
CREATE POLICY "Vê só os próprios salvos" ON public.rede_salvos
  FOR ALL USING (auth.uid() = quem_id) WITH CHECK (auth.uid() = quem_id);

DROP POLICY IF EXISTS "Service manages rede_salvos" ON public.rede_salvos;
CREATE POLICY "Service manages rede_salvos" ON public.rede_salvos
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ═════════════════════════════════════════════════════════════════════════════
-- CARROSSEL — várias fotos num post.
--
-- ⚠️ Uma COLUNA de array em `rede_posts`, e não uma tabela filha. O carrossel
-- do Instagram tem no máximo 10 fotos, sempre lidas juntas com o post e nunca
-- consultadas sozinhas — uma tabela filha custaria um `join` em toda leitura
-- do feed para guardar no máximo dez strings.
--
-- `imagem_path` continua sendo a PRIMEIRA foto, e não foi trocada por
-- `imagens[0]`: todo código que já lê o post continua funcionando, e um post
-- de foto única nunca precisa olhar o array.
-- ═════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS imagens text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.rede_posts
  DROP CONSTRAINT IF EXISTS carrossel_ate_dez;
ALTER TABLE public.rede_posts
  ADD CONSTRAINT carrossel_ate_dez CHECK (array_length(imagens, 1) IS NULL OR array_length(imagens, 1) <= 10);

-- ═════════════════════════════════════════════════════════════════════════════
-- ATIVIDADE — a aba do coração.
--
-- Quem seguiu, quem pediu para seguir, quem reagiu. É a única tela da rede que
-- responde "o que aconteceu comigo enquanto eu estava fora".
--
-- ⚠️ **É TABELA, e não uma view sobre `rede_reacoes` + `rede_seguidores`.**
-- Uma view teria de ordenar duas fontes por data a cada abertura, e — o que
-- importa mais — não teria onde guardar o VISTO. Sem o visto não há emblema,
-- e sem emblema a aba não serve para nada: ninguém abre uma tela para
-- descobrir se há algo nela.
--
-- ⚠️ E ela NÃO manda push. Só o pedido para seguir manda, e isso é decidido em
-- `avisoMandaPush` (`rede-social.ts`), não aqui: o push deste app é o mesmo
-- canal do aviso de emergência, e quem desliga as notificações por causa de um
-- coraçãozinho de madrugada desliga o resto junto.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rede_atividade (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- De quem é a caixa.
  dono_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- Quem fez.
  quem_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  especie   text NOT NULL CHECK (especie IN ('seguiu','pediu_para_seguir','aceitou','reagiu','marcou','reagiu_story')),
  -- Só em 'reagiu'. `ON DELETE CASCADE`: post apagado leva a linha junto —
  -- uma atividade que aponta para o nada é uma linha que não abre nada.
  post_id   uuid REFERENCES public.rede_posts ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  visto_em  timestamptz,
  CONSTRAINT nao_avisa_a_si_mesma CHECK (dono_id <> quem_id)
);

-- A consulta da aba, e a do emblema (as não vistas).
CREATE INDEX IF NOT EXISTS rede_atividade_caixa
  ON public.rede_atividade (dono_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS rede_atividade_novas
  ON public.rede_atividade (dono_id) WHERE visto_em IS NULL;

-- ⚠️ Uma linha por (quem, espécie, post). Sem isto, tirar e pôr a reação cinco
-- vezes encheria a caixa dela com cinco avisos da mesma pessoa sobre o mesmo
-- post — e ela abriria a aba achando que cinco pessoas reagiram.
-- ⚠️ O CHECK acima só vale para banco NOVO — `CREATE TABLE IF NOT EXISTS` não
-- toca em tabela existente. Sem este bloco, a marcação seria aceita pelo
-- servidor e o AVISO recusado pelo banco: a marcada nunca saberia.
ALTER TABLE public.rede_atividade DROP CONSTRAINT IF EXISTS rede_atividade_especie_check;
ALTER TABLE public.rede_atividade ADD CONSTRAINT rede_atividade_especie_check
  CHECK (especie IN ('seguiu','pediu_para_seguir','aceitou','reagiu','marcou','reagiu_story'));

CREATE UNIQUE INDEX IF NOT EXISTS rede_atividade_uma_por_gesto
  ON public.rede_atividade (dono_id, quem_id, especie, coalesce(post_id, dono_id));

ALTER TABLE public.rede_atividade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vê a própria caixa" ON public.rede_atividade;
CREATE POLICY "Vê a própria caixa" ON public.rede_atividade
  FOR SELECT USING (auth.uid() = dono_id);

DROP POLICY IF EXISTS "Service manages rede_atividade" ON public.rede_atividade;
CREATE POLICY "Service manages rede_atividade" ON public.rede_atividade
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.rede_atividade IS
  'A aba do coração. Tabela e não view porque precisa guardar o VISTO — sem '
  'ele não há emblema, e sem emblema ninguém abre a aba. Uma linha por gesto '
  '(índice único), para tirar e pôr a reação não encher a caixa.';

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

-- ═════════════════════════════════════════════════════════════════════════════
-- FASE 4 · A AULA E A ENQUETE DENTRO DO POST
-- ═════════════════════════════════════════════════════════════════════════════

-- A aula que ela acabou de fazer, anexada ao post.
--
-- ⚠️ Guarda o DIA e o TÍTULO, e mais nada. Não entra a nota (seria o placar
-- público que a aba das Amigas gastou um arquivo inteiro para não ter), não
-- entram enunciado, alternativas nem gabarito (vaza conteúdo premium pelo
-- `quizPremium` e estraga a aula de quem está uma semana atrás).
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS aula jsonb;

-- A enquete mora em ARRAY no próprio post, pela razão já escrita para
-- `imagens`: são 2 a 4 strings curtas, sempre lidas junto com o post.
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS enquete_opcoes text[] NOT NULL DEFAULT '{}';

-- ⚠️ CHECK por DROP/ADD, e nunca `IF NOT EXISTS`: a tabela já existe em
-- produção, e `ADD CONSTRAINT IF NOT EXISTS` não altera uma restrição
-- existente — é a lição de `APLICAR_LEMBRETES`, cujo CHECK antigo recusava a
-- espécie nova em silêncio.
ALTER TABLE public.rede_posts DROP CONSTRAINT IF EXISTS enquete_de_2_a_4;
ALTER TABLE public.rede_posts ADD CONSTRAINT enquete_de_2_a_4
  CHECK (array_length(enquete_opcoes, 1) IS NULL
         OR array_length(enquete_opcoes, 1) BETWEEN 2 AND 4);

-- Um voto por pessoa por enquete — e a PK É a garantia, não um índice à parte.
CREATE TABLE IF NOT EXISTS public.rede_votos (
  post_id   uuid     NOT NULL REFERENCES public.rede_posts(id) ON DELETE CASCADE,
  quem_id   uuid     NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  opcao     smallint NOT NULL CHECK (opcao BETWEEN 0 AND 3),
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, quem_id)
);
CREATE INDEX IF NOT EXISTS rede_votos_por_post ON public.rede_votos (post_id);

ALTER TABLE public.rede_votos ENABLE ROW LEVEL SECURITY;

-- ⚠️ Ela vê o PRÓPRIO voto, e mais nada. Nem a autora do post lê esta tabela:
-- no Instagram a autora vê quem votou em quê, e esse é exatamente o dado que
-- este app decidiu não expor — a mesma razão de `rede_salvos` ser privado
-- "inclusive para a autora do post".
DROP POLICY IF EXISTS "Vê o próprio voto" ON public.rede_votos;
CREATE POLICY "Vê o próprio voto" ON public.rede_votos
  FOR SELECT USING (auth.uid() = quem_id);

DROP POLICY IF EXISTS "Service manages rede_votos" ON public.rede_votos;
CREATE POLICY "Service manages rede_votos" ON public.rede_votos
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.rede_votos IS
  'Um voto por pessoa por enquete (a PK garante). Ninguém lê o voto de '
  'ninguém — nem a autora do post.';

-- ═════════════════════════════════════════════════════════════════════════════
-- FASE 5 · O DESAFIO DA SEMANA EM GRUPO
--
-- ⚠️ OPT-IN, e é ele que impede o grupo compulsório. A tentação óbvia é juntar
-- automaticamente todo mundo que carrega o `ref_code` da criadora — e não dá: o
-- código foi TIRADO do grafo de amizade justamente para uma criadora não virar
-- amiga de três mil gestantes, e `ref_code` é fixado UMA VEZ, então não haveria
-- como sair. `desafio_participantes` guarda CONSENTIMENTO, não contagem.
--
-- ⚠️ E NÃO HÁ COLUNA DE "quantas fecharam". O contador é derivado de
-- `sementinhas_ledger` (as linhas `wellness:`), como o troféu conta o ledger e
-- não `doneDays`. Contador materializado vira "3 fecharam" numa tela e "5" na
-- outra na primeira corrida.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.desafios_em_grupo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Junta por CÓDIGO, como `ref_code` e `affiliate_earnings` já fazem.
  affiliate_code text NOT NULL,
  -- ⚠️ De catálogo fechado (as quatro atividades de bem-estar do app), nunca
  -- campo livre: texto livre aqui é conselho de saúde de leiga distribuído em
  -- massa com o nome do consultório em volta.
  atividade      text NOT NULL CHECK (atividade IN ('movement','meditation','bonding','gratitude')),
  -- ⚠️ Guardados, nunca derivados: mudar a régua da semana não pode reescrever
  -- o passado de um desafio que já aconteceu.
  inicio         date NOT NULL,
  fim            date NOT NULL,
  dias_alvo      int  NOT NULL CHECK (dias_alvo BETWEEN 1 AND 7),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  arquivado_em   timestamptz
);

-- Um desafio por criadora por semana. Duas seriam duas ofensivas concorrentes
-- para a mesma pessoa, e o placar de várias frentes é o que a dupla das Amigas
-- gastou um índice parcial para não ter.
CREATE UNIQUE INDEX IF NOT EXISTS desafio_um_por_semana
  ON public.desafios_em_grupo (affiliate_code, inicio);
CREATE INDEX IF NOT EXISTS desafio_vigente ON public.desafios_em_grupo (inicio DESC);

CREATE TABLE IF NOT EXISTS public.desafio_participantes (
  desafio_id uuid NOT NULL REFERENCES public.desafios_em_grupo(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)               ON DELETE CASCADE,
  entrou_em  timestamptz NOT NULL DEFAULT now(),
  -- Sair MARCA, nunca apaga: apagar faria "ela nunca entrou" e "ela saiu"
  -- serem a mesma linha ausente, e a criadora veria o grupo encolher sem
  -- entender por quê.
  saiu_em    timestamptz,
  PRIMARY KEY (desafio_id, user_id)
);
CREATE INDEX IF NOT EXISTS desafio_de_quem ON public.desafio_participantes (user_id)
  WHERE saiu_em IS NULL;

ALTER TABLE public.desafios_em_grupo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desafio_participantes ENABLE ROW LEVEL SECURITY;

-- ⚠️ Sem política para `anon` nem para `authenticated`: a leitura passa pelo
-- servidor, como `APLICAR_REDE_SOCIAL` e `APLICAR_INFLUENCIADORA` já decidiram.
-- `desafio_participantes` é lista de gente, e uma policy de LINHA não esconde
-- coluna: dar SELECT ao authenticated entregaria quem participa de quê.
DROP POLICY IF EXISTS "Service manages desafios" ON public.desafios_em_grupo;
CREATE POLICY "Service manages desafios" ON public.desafios_em_grupo
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service manages participantes" ON public.desafio_participantes;
CREATE POLICY "Service manages participantes" ON public.desafio_participantes
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.desafio_participantes IS
  'CONSENTIMENTO, não contagem: a paciente entra e pode sair. Agrupar por '
  'ref_code recriaria o grupo compulsório que o código existe para não criar.';

-- ═════════════════════════════════════════════════════════════════════════════
-- FASE 6 · A CAIXINHA DE PERGUNTAS
--
-- ⚠️ É A FUNÇÃO MAIS ARRISCADA DA ABA, e a razão é a mesma que fechou os
-- comentários: de 1.098 respostas com conselho em fóruns de gestação, 20,9%
-- estavam erradas e 5,5% eram potencialmente danosas. A diferença é que aqui o
-- texto perigoso é a RESPOSTA — quem responde é a paciente, e ela responde para
-- todo mundo de uma vez.
--
-- O que segura isso não é uma tabela, é a régua (`src/lib/pergunta-clinica.ts`)
-- rodando nos DOIS textos. O que a tabela guarda é o resto: quem perguntou (que
-- a tela NUNCA vê), o desfecho da triagem, e o teto diário.
-- ═════════════════════════════════════════════════════════════════════════════

-- ⚠️ OPT-IN, e o padrão é NÃO. Uma caixa anônima aberta por omissão numa base
-- de gestantes de alto risco é um canal de assédio que ninguém pediu. É a mesma
-- decisão de `perfil_publico`, `mostrar_semana` e `mostrar_bebe`: o erro
-- possível é a caixa não existir para quem a queria, nunca existir para quem
-- não a queria.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS aceita_perguntas boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- A VITRINE NA INTERNET ABERTA (/p/<codigo>) -- chave PROPRIA.
--
-- ATENCAO: NAO e a mesma coisa que `perfil_publico`, e a separacao e o recurso.
-- A tela onde ela liga o perfil publico diz, com todas as letras, "qualquer
-- pessoa NO APP pode te achar e te acompanhar". A pagina /p/<codigo> nao e no
-- app: abre na internet aberta, sem conta nenhuma, e mostra bio, selo da
-- semana, nome do bebe e doze publicacoes. Autorizar isso com a chave de dentro
-- seria alargar, pela porta dos fundos, um consentimento dado para outra coisa
-- -- exatamente o que "nao podemos expor a paciente sem ela saber" proibe.
--
-- Nasce FALSA, como as outras tres chaves do perfil. As DUAS precisam estar
-- ligadas para a pagina abrir: desligar `perfil_publico` fecha o perfil em todo
-- lugar, inclusive aqui.
-- ---------------------------------------------------------------------------
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS vitrine_publica boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.patient_profiles.vitrine_publica IS
  'Ela autorizou a pagina /p/<referral_code>, que abre FORA do app e sem conta. '
  'Separada de perfil_publico de proposito: sao dois consentimentos diferentes.';

CREATE TABLE IF NOT EXISTS public.rede_perguntas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- De quem é a caixa (quem responde).
  dona_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  -- ⚠️ QUEM PERGUNTOU. Guardado SEMPRE e devolvido à tela NUNCA.
  --
  -- A caixa é anônima para a dona — é isso que faz alguém perguntar. Mas sem
  -- esta coluna não haveria como: rotear a pergunta clínica para o médico DE
  -- QUEM PERGUNTOU, aplicar o teto diário, recusar quem foi bloqueada, e
  -- bloquear a partir de uma pergunta. Anonimato na TELA, nunca no banco.
  quem_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  texto     text NOT NULL,
  -- O que a régua decidiu: 'publicavel' | 'clinica' | 'emergencia'. Guardado
  -- para a auditoria conseguir responder "quantas viraram caso clínico?" sem
  -- reprocessar texto de paciente.
  desfecho  text NOT NULL DEFAULT 'publicavel'
            CHECK (desfecho IN ('publicavel','clinica','emergencia')),
  -- A resposta dela. Passa pela MESMA régua antes de existir.
  resposta  text,
  -- O post que a resposta virou, quando virou.
  post_id   uuid REFERENCES public.rede_posts ON DELETE SET NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  respondido_em  timestamptz,
  -- Arquivar MARCA, nunca apaga: a denúncia precisa da linha, e apagar faria
  -- "nunca perguntou" e "perguntou e eu escondi" serem a mesma ausência.
  arquivado_em   timestamptz,
  denunciado_em  timestamptz,
  CONSTRAINT nao_pergunta_a_si_mesma CHECK (dona_id <> quem_id)
);

-- A caixa dela, e o teto diário de quem pergunta.
CREATE INDEX IF NOT EXISTS rede_perguntas_caixa
  ON public.rede_perguntas (dona_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS rede_perguntas_de_quem
  ON public.rede_perguntas (quem_id, criado_em DESC);

ALTER TABLE public.rede_perguntas ENABLE ROW LEVEL SECURITY;

-- ⚠️ NENHUMA policy para `authenticated`, e aqui isso é mais importante que
-- nas outras tabelas: uma policy de LINHA (`auth.uid() = dona_id`) daria à dona
-- a linha INTEIRA — com `quem_id` dentro. RLS não esconde coluna. A leitura
-- passa pelo servidor, que devolve a pergunta sem o autor.
DROP POLICY IF EXISTS "Service manages rede_perguntas" ON public.rede_perguntas;
CREATE POLICY "Service manages rede_perguntas" ON public.rede_perguntas
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON COLUMN public.rede_perguntas.quem_id IS
  'Anonimato na TELA, nunca no banco: sem esta coluna não há roteamento '
  'clínico, teto diário, bloqueio nem denúncia. O servidor jamais a devolve.';

-- ⚠️ **O CARIMBO DO STORY PRECISA DE `ALTER`, e por isso ele está AQUI.**
--
-- Ele nasceu escrito DENTRO do `CREATE TABLE IF NOT EXISTS public.rede_stories`
-- lá em cima. Num banco que já tinha a tabela — que é o caso de qualquer um que
-- rodou este arquivo antes —, o `CREATE` vira no-op e a coluna NUNCA nasce; e
-- rodar o SQL de novo não conserta, porque continua sendo o mesmo no-op. A
-- própria conferência do fim relatava `carimbo_ok = false` sem que houvesse
-- comando algum capaz de mudar isso.
--
-- Era a única coluna nova do arquivo fora do padrão `ALTER TABLE … ADD COLUMN
-- IF NOT EXISTS`. A definição de cima fica (serve ao banco que nasce agora);
-- esta linha serve ao que já existe.
ALTER TABLE public.rede_stories
  ADD COLUMN IF NOT EXISTS carimbo_semana boolean NOT NULL DEFAULT false;

-- Quando um administrador já olhou a denúncia. ⚠️ Marca, nunca apaga: o
-- histórico é o que permite contar reincidência da mesma conta.
ALTER TABLE public.rede_perguntas
  ADD COLUMN IF NOT EXISTS resolvido_em timestamptz;

CREATE INDEX IF NOT EXISTS rede_perguntas_denunciadas
  ON public.rede_perguntas (denunciado_em DESC)
  WHERE denunciado_em IS NOT NULL AND resolvido_em IS NULL;

-- A pergunta que a resposta responde. ⚠️ Guardada no POST e não só na linha da
-- pergunta: o post viaja pelo feed inteiro, e ler a resposta sem a pergunta
-- entregaria um texto solto que ninguém entende.
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS pergunta text;

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA. Todas as linhas têm que voltar `true`.
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
  EXISTS (SELECT 1 FROM storage.buckets WHERE id='rede' AND public = false)         AS balde_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_stories')                 AS stories_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_salvos')                  AS salvos_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_posts' AND column_name='imagens')                   AS carrossel_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_atividade')               AS atividade_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='patient_profiles' AND column_name='mostrar_semana')      AS selo_semana_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='patient_profiles' AND column_name='mostrar_bebe')        AS selo_bebe_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_stories' AND column_name='carimbo_semana')          AS carimbo_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_posts' AND column_name='enquete_opcoes')            AS enquete_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_votos')                   AS votos_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_posts' AND column_name='aula')                      AS aula_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='desafios_em_grupo')            AS desafio_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='desafio_participantes')        AS participantes_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='patient_profiles' AND column_name='aceita_perguntas')    AS caixinha_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_perguntas')               AS perguntas_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_posts' AND column_name='pergunta')                  AS resposta_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_perguntas' AND column_name='resolvido_em')          AS denuncia_ok,
  -- As oito ideias novas. Cada uma destas colunas/tabelas, faltando, apaga um
  -- recurso INTEIRO em silencio -- e a leitura ja tem recuo, entao nada quebra:
  -- so deixa de existir. Por isso elas aparecem aqui.
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_posts' AND column_name='comparacao_de')             AS entao_agora_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_posts' AND column_name='editado_em')                AS editar_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_posts' AND column_name='arquivado_em')              AS arquivar_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='rede_stories' AND column_name='pergunta_aberta')         AS caixinha_story_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_marcacoes')               AS marcar_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_silenciados')             AS silenciar_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_denuncias')               AS denuncia_perfil_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_story_reacoes')           AS reacao_story_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='rede_story_votos')             AS enquete_story_ok,
  -- Sem esta, a vitrine publica (/p/<codigo>) nao abre para ninguem -- o que e
  -- o lado seguro: banco sem a coluna e banco sem consentimento.
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='patient_profiles' AND column_name='vitrine_publica')     AS vitrine_ok;
