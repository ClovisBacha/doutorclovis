-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_ACOMPANHANTE.sql — o acompanhante ganha CONTA PRÓPRIA.
-- Idempotente: rode quantas vezes quiser.
--
-- ─── A DECISÃO DO DONO ───────────────────────────────────────────────────────
--
-- "A conta do acompanhante tem que ser própria, onde ele tem que criar a conta,
-- e dentro da aba específica dele terá funções específicas e personalizadas
-- para a gestante que ele está acompanhando."
--
-- Até aqui ele NÃO tinha conta: a gestante gerava um link com token
-- (`companion_invites`) e ele abria `/acompanhar/<token>` — uma página pública,
-- só de leitura, sem identidade. Isso bastava para ELE VER; não basta para ele
-- FAZER — e é fazer que transforma o acompanhante em ajuda de verdade.
--
-- ─── ⚠️ POR QUE NÃO NASCE UMA TABELA NOVA ────────────────────────────────────
--
-- O vínculo continua sendo o CONVITE que ela criou. Uma tabela `companions`
-- separada teria de responder "quem autorizou?" duplicando o que
-- `companion_invites` já responde — e duas fontes para o mesmo vínculo divergem
-- no primeiro conserto. Aqui o convite ACEITO **é** o vínculo:
--
--   convite criado  → `aceito_por IS NULL`  (link ainda solto)
--   convite aceito  → `aceito_por = <conta dele>`
--   ela revoga      → a linha é apagada, como já era
--
-- ⚠️ E O TOKEN CONTINUA VALENDO. Quem já usa o link não pode ser expulso por
-- uma migration: sem `aceito_por`, o caminho antigo funciona igual. A conta é
-- um degrau A MAIS, não uma troca.
--
-- ─── ⚠️ O PAPEL É DELE, MAS QUEM DECIDE O QUE ELE VÊ É ELA ───────────────────
--
-- `papel` (parceiro · amiga · mãe · doula · outro) muda o TEXTO do app, nunca a
-- permissão: "leve algo salgado antes de ela levantar" é para quem mora com
-- ela; "mande uma mensagem" é para quem está longe. Permissão é assunto do
-- convite, e o convite é dela.
--
-- ⚠️ `ver_saude` NASCE FALSO. O acompanhante vê semana, DPP e o que ela publica
-- para ele. Humor do diário, pressão e glicemia são dado clínico dela, e o
-- padrão de um app de gestação de alto risco não pode ser "o parceiro vê tudo":
-- quem liga isso é ela, item por item, sabendo o que está ligando.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. O convite aprende a ser um vínculo ───────────────────────────────────
ALTER TABLE public.companion_invites
  ADD COLUMN IF NOT EXISTS aceito_por uuid REFERENCES auth.users ON DELETE CASCADE;

ALTER TABLE public.companion_invites
  ADD COLUMN IF NOT EXISTS aceito_em timestamptz;

ALTER TABLE public.companion_invites
  ADD COLUMN IF NOT EXISTS papel text;

ALTER TABLE public.companion_invites
  ADD COLUMN IF NOT EXISTS apelido text;

COMMENT ON COLUMN public.companion_invites.aceito_por IS
  'A conta do acompanhante que resgatou este convite. NULL = link ainda não aceito (o caminho antigo, só leitura, continua valendo).';
COMMENT ON COLUMN public.companion_invites.papel IS
  'parceiro | amiga | mae | doula | outro. Muda o TEXTO do app, nunca a permissão.';

-- ⚠️ UMA CONTA NÃO ACOMPANHA A MESMA GESTANTE DUAS VEZES. Sem isto, dois
-- convites resgatados pela mesma pessoa criariam duas linhas e a aba dela
-- apareceria duplicada — com dois botões que fazem a mesma coisa.
CREATE UNIQUE INDEX IF NOT EXISTS companion_invites_conta_por_gestante
  ON public.companion_invites (user_id, aceito_por)
  WHERE aceito_por IS NOT NULL;

-- A aba dele pergunta "quem eu acompanho?" a cada abertura.
CREATE INDEX IF NOT EXISTS companion_invites_aceito_por
  ON public.companion_invites (aceito_por)
  WHERE aceito_por IS NOT NULL;

-- ── 2. O que ela deixa ele ver ──────────────────────────────────────────────
-- ⚠️ COLUNAS SEPARADAS, e não um jsonb de permissões: cada uma é uma decisão
-- que ela toma com um interruptor na tela, e um blob esconderia quais existem.
ALTER TABLE public.companion_invites
  ADD COLUMN IF NOT EXISTS ver_saude boolean NOT NULL DEFAULT false;

ALTER TABLE public.companion_invites
  ADD COLUMN IF NOT EXISTS ver_humor boolean NOT NULL DEFAULT false;

ALTER TABLE public.companion_invites
  ADD COLUMN IF NOT EXISTS ver_consultas boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.companion_invites.ver_saude IS
  'Pressão, glicemia e peso. Nasce FALSO — é dado clínico dela.';
COMMENT ON COLUMN public.companion_invites.ver_humor IS
  'O RÓTULO do humor do diário (nunca o texto). Nasce FALSO.';
COMMENT ON COLUMN public.companion_invites.ver_consultas IS
  'Data e tipo da próxima consulta. Nasce VERDADEIRO: ir junto é a razão mais comum de existir um acompanhante.';

-- ── 3. Os recados que ele manda para ela ────────────────────────────────────
-- ⚠️ MÃO DUPLA. Hoje o acompanhante só LÊ. Um recado que ela abre no app é a
-- diferença entre "ele viu minha semana" e "ele está comigo nisto".
CREATE TABLE IF NOT EXISTS public.companion_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gestante_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  autor_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  texto       text NOT NULL CHECK (length(texto) BETWEEN 1 AND 2000),
  lida_em     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS companion_notes_gestante
  ON public.companion_notes (gestante_id, created_at DESC);

ALTER TABLE public.companion_notes ENABLE ROW LEVEL SECURITY;

-- ⚠️ ELA LÊ E APAGA O QUE É DELA; ele lê e escreve o que mandou. A conferência
-- do VÍNCULO (o convite aceito) fica no servidor, com service role — RLS que
-- tentasse validar o convite aqui teria de repetir a regra em SQL, e ela
-- passaria a viver em dois lugares.
DROP POLICY IF EXISTS "notes_gestante_le" ON public.companion_notes;
CREATE POLICY "notes_gestante_le"
  ON public.companion_notes FOR SELECT
  TO authenticated
  USING (gestante_id = auth.uid() OR autor_id = auth.uid());

DROP POLICY IF EXISTS "notes_gestante_apaga" ON public.companion_notes;
CREATE POLICY "notes_gestante_apaga"
  ON public.companion_notes FOR DELETE
  TO authenticated
  USING (gestante_id = auth.uid() OR autor_id = auth.uid());

-- ⚠️ NENHUMA POLÍTICA DE INSERT. Escrever passa pelo servidor, que confere o
-- vínculo antes — sem isso, qualquer autenticado escreveria na caixa de
-- qualquer gestante cujo uuid ele descobrisse.
