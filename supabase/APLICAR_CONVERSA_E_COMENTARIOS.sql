-- ═════════════════════════════════════════════════════════════════════════════
-- MENSAGEM DIRETA E COMENTÁRIOS  (ago/2026)
--
-- As duas peças que faltavam para a aba ser uma rede social de verdade. Cada
-- uma traz um risco próprio, e as travas de cada uma estão comentadas onde
-- moram — nunca só aqui.
--
-- Idempotente: rodar de novo é seguro.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- A CONVERSA
--
-- ⚠️ **O PAR É ORDENADO (`a_id < b_id`), e isso não é estética.** Sem a ordem,
-- (A,B) e (B,A) são duas linhas: duas pessoas que se escrevem ao mesmo tempo
-- criam DUAS conversas, cada uma vê a sua, e as mensagens da outra somem. O
-- projeto já pagou esse desenho em `duplas`, e a lição está escrita lá.
--
-- ⚠️ **`aceita = false` É UM PEDIDO, e o pedido tem uma trava que o Instagram
-- não tem: quem pediu só pode mandar UMA mensagem até ser aceito.** Num app de
-- gestação de alto risco, a caixa de entrada aberta a desconhecidos é o vetor
-- de assédio mais óbvio que existe — e o custo de errar aqui é uma paciente
-- recebendo vinte mensagens de alguém que ela nunca respondeu. A trava vive em
-- `conversa.functions.ts`, contada no servidor.
--
-- ⚠️ **`lida_a`/`lida_b` são INSTANTES, não uma linha por mensagem.** Um
-- "lido" por mensagem seria uma tabela que cresce com o produto do número de
-- mensagens pelo de gente; o instante responde a mesma pergunta ("o que chegou
-- depois disto ainda não vi") com duas colunas.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_conversas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  b_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  /* Quem puxou conversa. Decide de quem é o pedido enquanto `aceita` é falso. */
  iniciada_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aceita       boolean NOT NULL DEFAULT false,
  criada_em    timestamptz NOT NULL DEFAULT now(),
  /* Para ordenar a lista sem varrer as mensagens. */
  ultima_em    timestamptz NOT NULL DEFAULT now(),
  lida_a       timestamptz,
  lida_b       timestamptz,
  CONSTRAINT rede_conversas_par_ordenado CHECK (a_id < b_id)
);

/* Uma conversa por par — é a chave única que faz o par ordenado valer. */
CREATE UNIQUE INDEX IF NOT EXISTS rede_conversas_par
  ON public.rede_conversas(a_id, b_id);
CREATE INDEX IF NOT EXISTS rede_conversas_de_a ON public.rede_conversas(a_id, ultima_em DESC);
CREATE INDEX IF NOT EXISTS rede_conversas_de_b ON public.rede_conversas(b_id, ultima_em DESC);

CREATE TABLE IF NOT EXISTS public.rede_mensagens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.rede_conversas(id) ON DELETE CASCADE,
  autor_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto       text NOT NULL,
  criada_em   timestamptz NOT NULL DEFAULT now(),
  /* Apagar para todo mundo marca; o texto some, a linha fica para a ordem da
     conversa não abrir buraco. */
  apagada_em  timestamptz
);
CREATE INDEX IF NOT EXISTS rede_mensagens_da_conversa
  ON public.rede_mensagens(conversa_id, criada_em DESC);

ALTER TABLE public.rede_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_mensagens ENABLE ROW LEVEL SECURITY;

-- ⚠️ **SEM POLICY PARA `authenticated`, e aqui isso pesa mais que em qualquer
-- outra tabela desta aba.** Uma policy de leitura por linha entregaria o TEXTO
-- de conversas privadas a quem soubesse montar a consulta. Quem lê é o servidor,
-- com a chave de serviço, depois de conferir que quem pergunta é uma das duas
-- pontas. RLS não protege coluna, e aqui a coluna é o segredo inteiro.

-- ─────────────────────────────────────────────────────────────────────────────
-- OS COMENTÁRIOS
--
-- ⚠️ **ELES FORAM DELIBERADAMENTE DEIXADOS DE FORA POR MESES, e o número que
-- os barrou continua verdadeiro:** de 1.098 respostas com conselho em fóruns de
-- gestação, 20,9% estavam erradas e 5,5% eram potencialmente danosas — e o
-- grupo corrigiu só 5,2% delas. Num app que carrega o nome de um consultório,
-- "comigo foi assim, não precisa ir ao pronto-socorro" é responsabilidade do
-- médico.
--
-- Entram por decisão do dono, e com a trava que a caixinha já tinha: `triarTexto`
-- roda em TODO comentário, e o que lê como conduta clínica é recusado antes de
-- existir. É a mesma régua, no mesmo arquivo — nunca uma segunda cópia.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_comentarios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES public.rede_posts(id) ON DELETE CASCADE,
  autor_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto        text NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  /* Apagado pela autora do comentário OU pela dona do post. */
  apagado_em   timestamptz,
  denunciado_em timestamptz
);
CREATE INDEX IF NOT EXISTS rede_comentarios_do_post
  ON public.rede_comentarios(post_id, criado_em);

ALTER TABLE public.rede_comentarios ENABLE ROW LEVEL SECURITY;

-- ⚠️ **A DONA DO POST PODE FECHAR OS COMENTÁRIOS DAQUELE POST.** É a saída que
-- transforma "não quero opinião nisto" numa escolha em vez de num apagar
-- constante — e o post sobre uma perda é exatamente onde ela precisa dela.
ALTER TABLE public.rede_posts
  ADD COLUMN IF NOT EXISTS comentarios_abertos boolean NOT NULL DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
     WHERE table_name='rede_conversas'))                                    AS conversas_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
     WHERE table_name='rede_mensagens'))                                    AS mensagens_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
     WHERE table_name='rede_comentarios'))                                  AS comentarios_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_name='rede_posts' AND column_name='comentarios_abertos'))  AS fechar_ok;
