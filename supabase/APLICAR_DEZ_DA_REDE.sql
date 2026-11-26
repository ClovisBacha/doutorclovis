-- ═══════════════════════════════════════════════════════════════════════════
-- AS DEZ DA REDE — direct, segurança, story, comentário e conta
--
-- Idempotente: rodar de novo é seguro.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
-- `CREATE TABLE IF NOT EXISTS`. As tabelas já existem no banco do dono, e num
-- banco assim o `CREATE` é no-op: a coluna nova nunca nasce, e rodar de novo
-- não conserta. Foi exatamente assim que `carimbo_semana` passou a existir só
-- no papel.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. RESPONDER A UMA MENSAGEM ESPECÍFICA ─────────────────────────────────

/* ⚠️ **UM NÍVEL SÓ, e quem garante é o servidor.** `responde_a` aponta sempre
   para a mensagem citada — e a citação NÃO se aninha: responder a uma resposta
   cita a mesma mensagem original. Numa tela de 393px, a citação da citação vira
   uma faixa de 40px que ninguém lê, e o histórico deixa de caber.

   ⚠️ E é `ON DELETE SET NULL`, e não CASCADE: apagar a mensagem citada não pode
   levar junto a resposta de OUTRA pessoa. Com `SET NULL` a resposta sobrevive e
   a citação vira "mensagem apagada", que é o que ela tem a dizer. */
ALTER TABLE public.rede_mensagens
  ADD COLUMN IF NOT EXISTS responde_a uuid REFERENCES public.rede_mensagens(id) ON DELETE SET NULL;

-- ─── 2. REAGIR A UMA MENSAGEM ───────────────────────────────────────────────

/* ⚠️ **UMA REAÇÃO POR PESSOA POR MENSAGEM, e o tipo mora na coluna.**

   Numa conversa de apoio — "estou com medo" às duas da manhã — um ❤️ custa nada
   e diz muito; hoje ou ela escreve, ou fica em silêncio.

   ⚠️ **A chave primária é (mensagem, quem)**, e é ela que faz trocar a reação
   ser um `upsert` em vez de duas escritas. Sem isso, tocar em dois emojis
   seguidos deixaria os dois. */
CREATE TABLE IF NOT EXISTS public.rede_mensagem_reacoes (
  mensagem_id uuid NOT NULL REFERENCES public.rede_mensagens(id) ON DELETE CASCADE,
  quem_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        text NOT NULL,
  criada_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mensagem_id, quem_id)
);
CREATE INDEX IF NOT EXISTS rede_mensagem_reacoes_de ON public.rede_mensagem_reacoes(quem_id);

ALTER TABLE public.rede_mensagem_reacoes ENABLE ROW LEVEL SECURITY;

/* ⚠️ **SEM POLICY PARA `authenticated`, como a própria `rede_mensagens`.** Uma
   policy de leitura por linha diria a quem soubesse montar a consulta QUEM
   reagiu a QUE mensagem — e o id da mensagem, cruzado com a conversa, é mapa de
   quem fala com quem. Quem lê é o servidor, com a chave de serviço, depois de
   conferir que a pessoa está na conversa. */

-- ─── 3. DENUNCIAR UMA MENSAGEM DO DIRECT ────────────────────────────────────

/* ⚠️ **`rede_denuncias` ganha o alvo `mensagem`.** Post, comentário, perfil e
   caixinha já tinham denúncia; o DIRECT não tinha — e é o canal mais privado,
   onde o assédio de verdade acontece. Bloquear existe, mas bloquear não deixa
   rastro nenhum para a plataforma: a próxima paciente recebe a mesma coisa.

   ⚠️ O CHECK é reescrito COM A LISTA COMPLETA. Uma lista cumulativa parcial
   apagaria os alvos anteriores no dia em que alguém re-rodasse este arquivo —
   é o defeito que `rede_atividade_especie_check` já teve aqui. */
DO $$
BEGIN
  ALTER TABLE public.rede_denuncias DROP CONSTRAINT IF EXISTS rede_denuncias_alvo_check;
  ALTER TABLE public.rede_denuncias
    ADD CONSTRAINT rede_denuncias_alvo_check
    CHECK (alvo IN ('post', 'perfil', 'comentario', 'pergunta', 'mensagem', 'story', 'conversa'));
END $$;

-- ─── 5. QUEM PODE COMENTAR ──────────────────────────────────────────────────

/* ⚠️ **O POST ESCOLHE QUEM VÊ; NINGUÉM ESCOLHIA QUEM RESPONDE.**

   Hoje é tudo ou nada: `comentarios_abertos` fecha para todo mundo. Num app
   cuja decisão central foi limitar conselho de leiga (os 20,9% de respostas
   erradas em fóruns de gestação), "só amigas podem comentar" é a peça que
   faltava — ela deixa a publicação visível e restringe QUEM opina.

   ⚠️ **O padrão é `todos`**, que é o comportamento de hoje: fechar por padrão
   emudeceria as conversas já existentes sem ninguém ter pedido.

   ⚠️ E NUNCA pode ser mais ABERTO que a visibilidade do post — quem não vê não
   comenta. Isso é conferido no SERVIDOR, e não aqui: o CHECK não sabe cruzar
   duas colunas de forma legível. */
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS quem_comenta text NOT NULL DEFAULT 'todos';

DO $$
BEGIN
  ALTER TABLE public.rede_posts DROP CONSTRAINT IF EXISTS rede_posts_quem_comenta_check;
  ALTER TABLE public.rede_posts
    ADD CONSTRAINT rede_posts_quem_comenta_check
    CHECK (quem_comenta IN ('todos', 'seguidores', 'amigas'));
END $$;

-- ─── 7. SILENCIAR POSTS E STORIES SEPARADAMENTE ─────────────────────────────

/* ⚠️ **Hoje silenciar cala os DOIS de uma vez.** Quem quer só descansar dos
   stories de alguém — que são o formato mais frequente e mais invasivo — perde
   as publicações junto, e acaba não silenciando ninguém.

   ⚠️ **As duas colunas nascem `true`**, que é exatamente o comportamento atual:
   toda linha que já existe em `rede_silenciados` calava as duas coisas, e migrar
   para "só posts" mudaria o silêncio de quem já tinha escolhido. */
ALTER TABLE public.rede_silenciados
  ADD COLUMN IF NOT EXISTS cala_posts boolean NOT NULL DEFAULT true;
ALTER TABLE public.rede_silenciados
  ADD COLUMN IF NOT EXISTS cala_stories boolean NOT NULL DEFAULT true;

-- ─── 8. FIXAR UM COMENTÁRIO ─────────────────────────────────────────────────

/* ⚠️ **É um INSTANTE, e não um booleano** — a mesma razão do fixar publicação:
   com booleano não há como ordenar dois fixados entre si, e a lista sairia em
   ordem arbitrária, que muda entre duas aberturas.

   ⚠️ Quem fixa é a DONA DO POST, e não a autora do comentário: fixar é curadoria
   da conversa dela. O servidor confere. */
ALTER TABLE public.rede_comentarios
  ADD COLUMN IF NOT EXISTS fixado_em timestamptz;

CREATE INDEX IF NOT EXISTS rede_comentarios_fixados
  ON public.rede_comentarios(post_id, fixado_em DESC)
  WHERE fixado_em IS NOT NULL;

-- ─── 10. DESATIVAR A CONTA TEMPORARIAMENTE ──────────────────────────────────

/* ⚠️ **O MEIO-TERMO QUE NÃO EXISTIA.** Hoje há apagar (LGPD, irreversível) e o
   Modo Cuidado, que é para o luto e tem outro desenho. Faltava sumir por um
   tempo e voltar inteira.

   ⚠️ **É uma coluna em `patient_profiles`, e NÃO um `deleted_at`.** Nada é
   apagado: os posts, os stories, o arquivo e as conversas continuam onde estão,
   e voltam exatamente como estavam. A diferença entre "não está aqui agora" e
   "não existe mais" é a que separa pausar de apagar.

   ⚠️ **E ela é REVOGADA do `authenticated`.** `patient_profiles` é escrita
   direto do navegador com a chave anon em vários pontos do app — sem o REVOKE,
   uma paciente poderia desativar a conta de outra… não: poderia desativar a
   PRÓPRIA por acidente num pedido montado errado, e pior, o inverso: reativar
   sem passar pelo servidor. A escrita é do servidor, e só. */
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS rede_pausada_em timestamptz;

REVOKE UPDATE (rede_pausada_em) ON public.patient_profiles FROM authenticated;

-- ─── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Todas as linhas têm de vir `true`.

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_mensagens' AND column_name='responde_a')
    AS responde_a_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='rede_mensagem_reacoes')
    AS reacoes_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_posts' AND column_name='quem_comenta')
    AS quem_comenta_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_silenciados' AND column_name='cala_stories')
    AS silenciar_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_comentarios' AND column_name='fixado_em')
    AS comentario_fixado_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='patient_profiles' AND column_name='rede_pausada_em')
    AS pausa_ok;
