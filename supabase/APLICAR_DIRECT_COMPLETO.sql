-- ═══════════════════════════════════════════════════════════════════════════
-- O DIRECT COMPLETO — grupo, voz, fixar, encaminhar e denunciar a conversa
--
-- Idempotente: rodar de novo é seguro.
--
-- ⚠️ TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
-- `CREATE TABLE IF NOT EXISTS`. As tabelas já existem, e num banco assim o
-- `CREATE` é no-op: a coluna nova nunca nasce, e rodar de novo não conserta.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. A CONVERSA EM GRUPO ─────────────────────────────────────────────────

/* ⚠️ **TABELA PRÓPRIA, e `rede_conversas` NÃO foi mexida.**
   Ela tem `a_id`/`b_id` `NOT NULL`, um `CHECK (a_id < b_id)` e um índice único
   por par — a forma inteira dela É "duas pessoas". Espremer um grupo ali
   exigiria afrouxar os três, e é neles que mora a garantia de que ninguém
   entra numa conversa de duas.

   ⚠️ **E o grupo é APERTADO de propósito.** Num app de gestação de alto risco,
   um grupo aberto é onde o conselho de leiga se multiplica — os 20,9% de
   respostas erradas em fóruns de gestação são o número que fechou os
   comentários deste app. Então: só a CRIADORA convida, só de dentro do grafo
   dela, teto de oito, e quem entra vê a partir de quando entrou. */
CREATE TABLE IF NOT EXISTS public.rede_grupos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criadora_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  ultima_em  timestamptz NOT NULL DEFAULT now(),
  /* A criadora saindo encerra o grupo — ver `sairDoGrupo`. */
  encerrado_em timestamptz
);
CREATE INDEX IF NOT EXISTS rede_grupos_da_criadora ON public.rede_grupos(criadora_id);

/* ⚠️ **`entrou_em` É O RECORTE DO HISTÓRICO, e não um enfeite.** Quem entra num
   grupo NÃO lê o que foi dito antes: numa conversa entre gestantes, o que veio
   antes pode ser um susto, um resultado de exame ou uma perda — e a pessoa que
   escreveu aquilo escolheu contar para quem estava lá naquele momento.

   ⚠️ **E `saiu_em` MARCA, nunca apaga a linha.** Apagar faria a mesma pessoa
   poder ser reconvidada e ver o histórico do período em que esteve fora. */
CREATE TABLE IF NOT EXISTS public.rede_grupo_membros (
  grupo_id  uuid NOT NULL REFERENCES public.rede_grupos(id) ON DELETE CASCADE,
  quem_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entrou_em timestamptz NOT NULL DEFAULT now(),
  saiu_em   timestamptz,
  lida_em   timestamptz,
  silenciado_em timestamptz,
  PRIMARY KEY (grupo_id, quem_id)
);
CREATE INDEX IF NOT EXISTS rede_grupo_membros_de ON public.rede_grupo_membros(quem_id);

/* ⚠️ **AS MENSAGENS DE GRUPO REUSAM `rede_mensagens`**, com `grupo_id` ao lado
   de `conversa_id` — e exatamente UM dos dois preenchido. Uma tabela separada
   duplicaria a citação, as reações, o apagar e a régua clínica: seis lugares
   para divergir, e a divergência apareceria como a triagem valendo no direct e
   não valendo no grupo. */
ALTER TABLE public.rede_mensagens
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.rede_grupos(id) ON DELETE CASCADE;

/* `conversa_id` precisa deixar de ser NOT NULL para a mensagem de grupo caber. */
ALTER TABLE public.rede_mensagens ALTER COLUMN conversa_id DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.rede_mensagens DROP CONSTRAINT IF EXISTS rede_mensagens_um_destino;
  ALTER TABLE public.rede_mensagens
    ADD CONSTRAINT rede_mensagens_um_destino
    CHECK ((conversa_id IS NULL) <> (grupo_id IS NULL));
END $$;

CREATE INDEX IF NOT EXISTS rede_mensagens_do_grupo
  ON public.rede_mensagens(grupo_id, criada_em DESC)
  WHERE grupo_id IS NOT NULL;

ALTER TABLE public.rede_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rede_grupo_membros ENABLE ROW LEVEL SECURITY;
/* ⚠️ **SEM POLICY PARA `authenticated`**, como `rede_mensagens`. Quem lê é o
   servidor, depois de conferir a participação — uma policy de linha entregaria
   a lista de membros de qualquer grupo a quem soubesse montar a consulta, e a
   lista de quem conversa com quem é o mapa social da base inteira. */

-- ─── 2. A MENSAGEM DE VOZ ───────────────────────────────────────────────────

/* ⚠️ **`audio_path`, e o áudio VAI PARA O BALDE — nunca para a coluna.** Um
   minuto de voz é ~150 kB; em base64 numa coluna, ele viaja inteiro em toda
   leitura da conversa, para sempre.

   ⚠️ **E `duracao_seg` é gravada, e não medida na leitura.** Sem ela a bolha
   nasce sem largura e a tela pula quando o áudio carrega — e num histórico
   longo isso é a conversa inteira dançando. */
ALTER TABLE public.rede_mensagens
  ADD COLUMN IF NOT EXISTS audio_path text;
ALTER TABLE public.rede_mensagens
  ADD COLUMN IF NOT EXISTS duracao_seg integer;

/* `texto` era NOT NULL: uma mensagem que é só voz não tem texto. */
ALTER TABLE public.rede_mensagens ALTER COLUMN texto DROP NOT NULL;

-- ─── 3. FIXAR A CONVERSA NO TOPO ────────────────────────────────────────────

/* ⚠️ **É POR PESSOA, e por isso são duas colunas.** Fixar é preferência de
   quem olha a lista; uma coluna só faria a escolha de uma valer para a outra. */
ALTER TABLE public.rede_conversas ADD COLUMN IF NOT EXISTS fixada_a timestamptz;
ALTER TABLE public.rede_conversas ADD COLUMN IF NOT EXISTS fixada_b timestamptz;

-- ─── 4. DENUNCIAR A CONVERSA INTEIRA ────────────────────────────────────────

/* ⚠️ **Denunciar mensagem a mensagem não serve para assédio.** O que caracteriza
   assédio é o PADRÃO — vinte mensagens que, uma a uma, não dizem nada. A
   denúncia da conversa leva um trecho das últimas para a fila poder ver o
   padrão. */
DO $$
BEGIN
  ALTER TABLE public.rede_denuncias DROP CONSTRAINT IF EXISTS rede_denuncias_alvo_check;
  ALTER TABLE public.rede_denuncias
    ADD CONSTRAINT rede_denuncias_alvo_check
    CHECK (alvo IN ('post', 'perfil', 'comentario', 'pergunta', 'mensagem', 'story', 'conversa'));
END $$;

-- ─── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Todas as linhas têm de vir `true`.

SELECT
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='rede_grupos') AS grupos_ok,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='rede_grupo_membros') AS membros_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_mensagens' AND column_name='grupo_id')
    AS grupo_id_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_mensagens' AND column_name='audio_path')
    AS audio_ok,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_conversas' AND column_name='fixada_a')
    AS fixar_ok,
  (SELECT is_nullable = 'YES' FROM information_schema.columns
    WHERE table_schema='public' AND table_name='rede_mensagens' AND column_name='texto')
    AS texto_anulavel_ok;
