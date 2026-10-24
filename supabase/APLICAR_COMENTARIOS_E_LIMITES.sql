-- ═══════════════════════════════════════════════════════════════════════════
-- AS CINCO DA NOITE — responder, curtir, restringir, filtrar palavras, alt text
--
-- Idempotente: rodar de novo é seguro.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
-- `CREATE TABLE IF NOT EXISTS`. As tabelas já existem no banco do dono, e num
-- banco assim o `CREATE` é no-op: a coluna nova nunca nasce, e rodar de novo
-- não conserta. Foi exatamente assim que `carimbo_semana` passou a existir só
-- no papel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. RESPONDER A UM COMENTÁRIO ───────────────────────────────────────────

/* ⚠️ **UM NÍVEL SÓ, e a coluna sozinha não garante isso — o servidor garante.**
   `responde_a` aponta sempre para um comentário RAIZ: a resposta de uma
   resposta entra na MESMA linha da conversa, como no Instagram. Árvore infinita
   num celular de 393px vira uma coluna de 40px de largura no quarto nível, e
   ninguém lê. Ver `raizDoComentario` em `comentarios.ts`. */
ALTER TABLE public.rede_comentarios
  ADD COLUMN IF NOT EXISTS responde_a uuid REFERENCES public.rede_comentarios(id) ON DELETE CASCADE;

/* Sem este índice, montar a árvore de um post com 200 comentários varre a
   tabela inteira uma vez por raiz. */
CREATE INDEX IF NOT EXISTS rede_comentarios_resposta
  ON public.rede_comentarios(responde_a, criado_em)
  WHERE responde_a IS NOT NULL;

-- ─── 2. CURTIR UM COMENTÁRIO ────────────────────────────────────────────────

/* ⚠️ **UMA CURTIDA POR PESSOA, e quem garante é a CHAVE PRIMÁRIA.** Sem ela,
   dois toques rápidos gravam duas linhas e o contador do comentário passa a
   mentir para sempre — e não há como saber qual das duas apagar.

   ⚠️ **É a única reação com UM tipo, ao contrário do post (que tem treze).**
   Treze emojis embaixo de cada comentário viraria uma parede de emoji; e o
   comentário já é a resposta — quem quer nuance escreve. */
CREATE TABLE IF NOT EXISTS public.rede_comentario_curtidas (
  comentario_id uuid NOT NULL REFERENCES public.rede_comentarios(id) ON DELETE CASCADE,
  quem_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criada_em     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comentario_id, quem_id)
);
CREATE INDEX IF NOT EXISTS rede_comentario_curtidas_de
  ON public.rede_comentario_curtidas(quem_id);

ALTER TABLE public.rede_comentario_curtidas ENABLE ROW LEVEL SECURITY;

/* ⚠️ **SEM POLICY PARA `authenticated`.** Uma policy de leitura entregaria a
   LISTA de quem curtiu cada comentário a quem soubesse montar a consulta — e
   este app decidiu que "quem reagiu" só a autora vê. Quem lê é o servidor, com
   a chave de serviço, depois de conferir a visibilidade do post. */

-- ─── 3. RESTRINGIR ──────────────────────────────────────────────────────────

/* ⚠️ **O MEIO-TERMO ENTRE NADA E BLOQUEAR, e ele existe por um motivo social
   concreto:** bloquear a cunhada tem custo — ela descobre, e vira briga de
   família. Restringir é MUDO nos dois sentidos: o comentário da pessoa
   restringida aparece para ELA como sempre, e para mais ninguém.

   ⚠️ **NÃO É O BLOQUEIO COM OUTRO NOME.** O bloqueio corta os dois lados e
   apaga o vínculo; este não corta nada — ela continua seguindo, continua vendo
   os posts, continua podendo escrever. O que muda é quem LÊ o que ela escreve.

   Uma linha por direção, como o bloqueio: (A restringe B) não implica o
   contrário. */
CREATE TABLE IF NOT EXISTS public.rede_restricoes (
  quem_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restrito_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criada_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quem_id, restrito_id),
  /* Restringir a si mesma não quer dizer nada, e esconderia os próprios
     comentários da própria tela. */
  CONSTRAINT rede_restricoes_nao_eu CHECK (quem_id <> restrito_id)
);
CREATE INDEX IF NOT EXISTS rede_restricoes_restrito
  ON public.rede_restricoes(restrito_id);

ALTER TABLE public.rede_restricoes ENABLE ROW LEVEL SECURITY;

/* ⚠️ **SEM POLICY, e aqui isso é o recurso inteiro.** Se a pessoa restringida
   pudesse ler esta tabela, ela descobriria que foi restringida — e o silêncio é
   a única coisa que separa restringir de bloquear. */

-- ─── 4. FILTRO DE PALAVRAS ──────────────────────────────────────────────────

/* ⚠️ **É `text[]` numa coluna do perfil, e não tabela.** A lista é dela, curta,
   lida junto com o perfil e nunca cruzada com nada — uma tabela pagaria um JOIN
   em toda leitura de comentário para guardar no máximo algumas dezenas de
   palavras.

   ⚠️ **A palavra que dói é ESPECÍFICA de cada uma.** Numa gestação de alto
   risco não existe lista universal: para uma é "perdi", para outra é o nome de
   um hospital, para outra é "aborto". Por isso a lista é da paciente e não do
   app — e por isso o app NÃO sugere palavras. */
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS palavras_ocultas text[];

-- ─── 5. DESCRIÇÃO DA FOTO (acessibilidade) ──────────────────────────────────

/* ⚠️ **Uma coluna, não uma por foto do carrossel.** A descrição vale a
   PUBLICAÇÃO: quem usa leitor de tela quer saber o que aquele post mostra, e
   cinco descrições numa foto que rola lateralmente é ruído. O `alt` de cada
   `<img>` do carrossel repete a mesma frase com o número da foto. */
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS alt_texto text;

-- ─── CONFERÊNCIA ────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'rede_comentarios' AND column_name = 'responde_a')     AS responder_ok,
  to_regclass('public.rede_comentario_curtidas')                                AS curtidas_ok,
  to_regclass('public.rede_restricoes')                                         AS restricoes_ok,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'patient_profiles' AND column_name = 'palavras_ocultas') AS filtro_ok,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'rede_posts' AND column_name = 'alt_texto')             AS alt_ok;
