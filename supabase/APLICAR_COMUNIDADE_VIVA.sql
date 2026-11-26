-- ═════════════════════════════════════════════════════════════════════════════
-- A COMUNIDADE QUE NÃO MORRE NO PARTO  (ago/2026)
--
-- Pedido do dono: "como que a gente vai criar que essa aba de comunidade ela
-- não morra a partir do momento que o filho nasce".
--
-- ⚠️ O DEFEITO ERA ESTRUTURAL, NÃO DE CONTEÚDO. Toda a identidade da paciente
-- saía de `lmp_date`: a semana, a bolha, a fruta, o dia da jornada. Isso tem
-- prazo de validade — no dia do parto a conta vira uma pessoa sem assunto, e o
-- pós-parto cobre doze semanas e acaba.
--
-- Uma mãe usa aplicativo de bebê por ANOS. O que muda é o sujeito da frase.
--
-- Idempotente: rodar de novo é seguro.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- OS FILHOS
--
-- ⚠️ CADA FILHO É UMA LINHA, e não um campo no perfil. Um `tem_bebe boolean`
-- ou um `qtd_filhos int` não sabem dizer QUEM, nem QUANDO, nem distinguir uma
-- gestação de gêmeos de duas gestações seguidas.
--
-- ⚠️ `nome` E `sexo` SÃO NULOS POR PADRÃO, e isso não é preguiça de formulário:
-- há quem não queira publicar o nome, há quem ainda não escolheu, e há quem
-- perdeu uma gestação e quer que aquele filho continue contando sem escrever o
-- nome dele numa tela pública. "Mãe de 2" tem de ser dizível sem nomear ninguém.
--
-- ⚠️ GESTANDO É `nascido_em IS NULL`. Gemelaridade é a CONTAGEM dessas linhas —
-- duas linhas sem data de nascimento são gêmeos. Não há coluna "é gêmeo", que
-- seria um segundo lugar dizendo a mesma coisa e um dia discordaria.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_filhos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         text,
  sexo         text CHECK (sexo IN ('f','m')),
  nascido_em   date,
  previsto_para date,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

-- Um teto sóbrio: protege contra o dedo preso no botão, sem julgar ninguém.
DO $$ BEGIN
  ALTER TABLE public.patient_filhos
    ADD CONSTRAINT patient_filhos_datas_plausiveis CHECK (
      (nascido_em   IS NULL OR nascido_em   BETWEEN '1950-01-01' AND '2100-01-01') AND
      (previsto_para IS NULL OR previsto_para BETWEEN '1950-01-01' AND '2100-01-01')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS patient_filhos_user ON public.patient_filhos(user_id);
-- A turma sai daqui: quem nasceu no mesmo mês.
CREATE INDEX IF NOT EXISTS patient_filhos_turma
  ON public.patient_filhos(nascido_em) WHERE nascido_em IS NOT NULL;

ALTER TABLE public.patient_filhos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Dona lê os próprios filhos" ON public.patient_filhos
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Dona escreve os próprios filhos" ON public.patient_filhos
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ⚠️ QUEM MOSTRA O FILHO A TERCEIROS É O SERVIDOR, com a chave de serviço, e
-- SÓ depois de passar pela régua de visibilidade do perfil. Uma policy de
-- leitura para `authenticated` entregaria a lista de filhos (com nome e data de
-- nascimento) de qualquer paciente a qualquer conta — dado de criança, no app
-- de um consultório.

-- ─────────────────────────────────────────────────────────────────────────────
-- O FEED DEIXA DE SER SÓ DE QUEM ELA SEGUE
--
-- Pedido do dono: mostrar publicações de quem ela segue E de quem ela não
-- segue, com uma configuração para voltar ao fechado.
--
-- ⚠️ O PADRÃO É O ABERTO (`false` = não é "só seguindo"). Uma rede social que
-- abre vazia para quem acabou de chegar não dá a ninguém motivo para voltar —
-- e conta nova não segue ninguém.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.patient_profiles
  ADD COLUMN IF NOT EXISTS feed_so_seguindo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.patient_profiles.feed_so_seguindo IS
  'Quando true, o feed mostra apenas quem ela segue. Padrão false: descoberta ligada.';

-- ─────────────────────────────────────────────────────────────────────────────
-- OS MARCOS — o assunto que existe DEPOIS da barriga
--
-- ⚠️ É a metade prática do "a aba não morre". A gestante tem assunto pronto
-- (a semana muda sozinha toda terça); a mãe de um bebê de 7 meses não tem
-- nenhum, e é por isso que ela para de publicar. O marco devolve o calendário:
-- primeiro sorriso, primeiro dente, mesversário, primeiro passo.
--
-- ⚠️ GUARDA O `filho_id` E A IDADE EM DIAS, não o texto "3 meses". Texto
-- envelhece: um post de mesversário escrito hoje continuaria dizendo "3 meses"
-- daqui a um ano. Com a idade em dias, a tela sempre calcula certo.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS marco_tipo text;
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS marco_filho uuid
  REFERENCES public.patient_filhos(id) ON DELETE SET NULL;
ALTER TABLE public.rede_posts ADD COLUMN IF NOT EXISTS marco_dias integer;

COMMENT ON COLUMN public.rede_posts.marco_tipo IS
  'Chave do marco (mesversario, sorriso, dente, engatinhou, andou, ...). Catálogo em src/lib/marcos.ts.';
COMMENT ON COLUMN public.rede_posts.marco_dias IS
  'Idade do bebê em dias no momento do marco. Nunca o texto — texto envelhece.';

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFERÊNCIA — o que este arquivo deixou de pé
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT EXISTS (SELECT 1 FROM information_schema.tables
     WHERE table_name='patient_filhos'))                                  AS filhos_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_name='patient_profiles' AND column_name='feed_so_seguindo')) AS feed_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_name='rede_posts' AND column_name='marco_tipo'))         AS marco_ok,
  (SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_name='rede_posts' AND column_name='marco_dias'))         AS marco_dias_ok;
