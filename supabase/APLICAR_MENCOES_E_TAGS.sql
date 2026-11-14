-- ═════════════════════════════════════════════════════════════════════════════
-- O @, A TROCA DO @ E A #  (ago/2026)
--
-- Pedido do dono: "faça exatamente como o Instagram faz hoje". As regras foram
-- verificadas (duas trocas a cada 14 dias, antigo reservado 14 dias; menção
-- com três opções, padrão Todos) e vivem em `src/lib/mencoes.ts`.
--
-- Idempotente: rodar de novo é seguro.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- O @
--
-- ⚠️ **ÚNICO SEM DIFERENCIAR MAIÚSCULA, e o índice é que garante.** `@Marina` e
-- `@marina` são a MESMA pessoa em toda rede social; sem o índice sobre
-- `lower()`, duas contas conviveriam e uma menção apontaria para a sorte.
-- Guardamos já em minúscula (`normalizarHandle`), e o índice é o cinto.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS handle text;

CREATE UNIQUE INDEX IF NOT EXISTS patient_profiles_handle_unico
  ON public.patient_profiles (lower(handle)) WHERE handle IS NOT NULL;

-- ⚠️ **AS TRÊS OPÇÕES DO INSTAGRAM, com o padrão dele.** Ver o comentário de
-- `mencoes.ts`: aqui os perfis nascem privados e a base é de gestantes de alto
-- risco, então "todos" é mais aberto do que eu escolheria. Decisão do dono,
-- tomada com o risco à vista.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS quem_pode_mencionar text NOT NULL DEFAULT 'todos';

DO $$ BEGIN
  ALTER TABLE public.patient_profiles ADD CONSTRAINT patient_profiles_mencionar_check
    CHECK (quem_pode_mencionar IN ('todos','sigo','ninguem'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- O HISTÓRICO DE @ — a reserva E o limite de trocas, na mesma tabela
--
-- ⚠️ **UMA TABELA SÓ FAZ AS DUAS COISAS.** O limite ("duas a cada 14 dias") sai
-- de contar as linhas recentes DELA; a reserva ("o antigo espera 14 dias") sai
-- de procurar o handle nas linhas de qualquer uma. Duas estruturas separadas
-- para o mesmo fato divergiriam — e a divergência apareceria como um @ liberado
-- cedo demais, com menções antigas apontando para outra pessoa.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_handles_antigos (
  handle      text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liberado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rede_handles_antigos_de_quem
  ON public.rede_handles_antigos(user_id, liberado_em DESC);

ALTER TABLE public.rede_handles_antigos ENABLE ROW LEVEL SECURITY;
-- Sem policy: quem lê e escreve é o servidor. A lista de @ que uma paciente já
-- usou é um histórico de identidade, e não precisa sair daqui.

-- ─────────────────────────────────────────────────────────────────────────────
-- AS TAGS
--
-- ⚠️ **TABELA, e não busca por texto na legenda.** `LIKE '%#gestação%'` varre a
-- tabela inteira a cada abertura da página, e casaria `#gestacaoderisco` dentro
-- de `#gestacao`. Com a linha por tag, o índice responde.
--
-- ⚠️ E a página da tag SÓ MOSTRA PUBLICAÇÃO PÚBLICA — a régua vive no servidor,
-- que refaz `podeVerPost`. Esta tabela guarda a tag de TODA publicação, porque
-- a autora pode abrir o post depois; filtrar na gravação faria a tag sumir para
-- sempre de um post que virou público.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rede_tags (
  post_id uuid NOT NULL REFERENCES public.rede_posts(id) ON DELETE CASCADE,
  tag     text NOT NULL,
  PRIMARY KEY (post_id, tag)
);
CREATE INDEX IF NOT EXISTS rede_tags_por_tag ON public.rede_tags(tag);
ALTER TABLE public.rede_tags ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- A espécie de aviso da menção
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rede_atividade DROP CONSTRAINT IF EXISTS rede_atividade_especie_check;
ALTER TABLE public.rede_atividade ADD CONSTRAINT rede_atividade_especie_check
  CHECK (especie IN (
    'seguiu','pediu_para_seguir','aceitou','reagiu','marcou','reagiu_story',
    'comentou','mencionou'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_name='patient_profiles' AND column_name='handle'))            AS handle_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_name='patient_profiles' AND column_name='quem_pode_mencionar')) AS config_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
     WHERE table_name='rede_handles_antigos'))                                 AS historico_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
     WHERE table_name='rede_tags'))                                            AS tags_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.check_constraints
     WHERE constraint_name='rede_atividade_especie_check'
       AND check_clause LIKE '%mencionou%'))                                   AS mencionou_ok;
