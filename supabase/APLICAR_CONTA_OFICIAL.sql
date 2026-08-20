-- ═══════════════════════════════════════════════════════════════════════════
-- A CONTA OFICIAL DO CONSULTORIO na Comunidade
--
-- Pedido do dono (ideia 6): o feed de TODA conta nova nasce vazio. Uma conta
-- oficial que publica resolve o dia um -- e da ao dono um canal proprio para
-- os seguidores do Instagram dele.
--
-- ⚠️ ELA PUBLICA E E SEGUIDA. ELA NAO LE.
-- O CLAUDE.md registra uma decisao PENDENTE do dono: dar ao medico porta para
-- reagir "exigiria decidir se ele VE as publicacoes sociais da paciente". Essa
-- decisao continua dele, e esta conta foi desenhada para nao toca-la -- nada
-- aqui le o que as pacientes publicam.
--
-- ⚠️ E ELA NAO E SEGUIDA AUTOMATICAMENTE. Seguir e um gesto; um app que segue
-- coisas pela paciente ensina que a lista dela nao e dela. Ela aparece em
-- PRIMEIRO na fileira de sugeridas (um toque), e os posts dela ja aparecem na
-- zona de sugeridos mesmo sem seguir, porque sao publicos.
--
-- IDEMPOTENTE: rodar de novo e seguro.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · A coluna ───────────────────────────────────────────────────────────
-- ⚠️ `ALTER ... ADD COLUMN IF NOT EXISTS`, e NUNCA dentro de um
-- `CREATE TABLE IF NOT EXISTS`: em banco que ja tem a tabela, o CREATE e no-op
-- e a coluna nunca nasce. Foi isso que deixou `carimbo_semana` impossivel de
-- criar por uma leva inteira.
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS conta_oficial boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.patient_profiles.conta_oficial IS
  'Conta institucional do consultorio na Comunidade. Publica e le como qualquer conta -- sem privilegio nenhum sobre perfil privado. Fica FORA de toda contagem de paciente.';

-- ⚠️ UMA SO. Duas contas oficiais fariam a fileira de sugeridas ter duas
-- primeiras, e `comOficialNoTopo` fixaria uma arbitraria.
CREATE UNIQUE INDEX IF NOT EXISTS patient_profiles_uma_conta_oficial
  ON public.patient_profiles ((true))
  WHERE conta_oficial;

-- ── 2 · Como CRIAR a conta (passo manual, uma vez) ─────────────────────────
--
-- A conta precisa de uma linha em `auth.users`, porque `patient_profiles.id`
-- referencia essa tabela e `rede_posts.autor_id` tambem. O caminho mais simples
-- e o mais seguro e criar pelo proprio app:
--
--   1. Em /auth, crie uma conta com um e-mail SEU (ex.: comunidade@...),
--      confirme o e-mail e entre uma vez;
--   2. Na aba Comunidade > Configuracoes do perfil, ligue "perfil publico",
--      ponha o nome ("Obstetrica"), a bio e a foto;
--   3. Rode o UPDATE abaixo trocando o e-mail.
--
-- ⚠️ NAO ligue `mostrar_semana` nem `mostrar_bebe` nessa conta: ela nao tem
-- gestacao, e o selo calaria de qualquer jeito (`semanaPublica` exige DUM), mas
-- deixar as chaves desligadas evita que alguem se pergunte por que.

UPDATE public.patient_profiles
SET conta_oficial = true,
    perfil_publico = true,
    -- ⚠️ Ela nao e paciente de ninguem: `doctor_id` nulo a mantem fora da lista
    -- do consultorio e de toda cobranca clinica.
    doctor_id = NULL,
    -- ⚠️ E nao veio de convite nenhum: sem isto ela entraria na contagem do
    -- funil de indicacao como se fosse uma paciente trazida por alguem.
    referred_by = NULL,
    ref_code = NULL
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('TROQUE_PELO_EMAIL_DA_CONTA'));

-- ── 3 · Conferencia ────────────────────────────────────────────────────────
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name='patient_profiles' AND column_name='conta_oficial')  AS coluna_ok,
  (SELECT count(*) FROM public.patient_profiles WHERE conta_oficial)            AS quantas_oficiais,
  (SELECT display_name FROM public.patient_profiles WHERE conta_oficial LIMIT 1) AS nome_da_oficial,
  (SELECT perfil_publico FROM public.patient_profiles WHERE conta_oficial LIMIT 1) AS publica_ok;
