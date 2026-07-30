-- ============================================================================
-- doctors: as colunas que o código já lê e o banco nunca teve
-- ============================================================================
-- `doctors` nasceu com 12 colunas em 20260707200000. Desde então o código
-- passou a ler 20 colunas a mais — perfil rico, valor da consulta, convênios,
-- formação, selo de verificado, validade do plano — e um comentário citava uma
-- migração "20260717030000" que não existe neste repositório.
--
-- Por que ninguém notou: `doctors.functions.ts` trata o erro 42703 (coluna
-- inexistente) refazendo a consulta só com as colunas básicas. Isso salvou o
-- app de quebrar, mas transformou metade do cadastro do médico em campo que
-- some ao salvar. É exatamente o caso de "aceita convênio", "valor da consulta"
-- e "formações": o médico preenche, a tela agradece, e o dado não existe.
--
-- Aqui as colunas passam a existir. Tudo `IF NOT EXISTS` e com default, então
-- rodar em banco que já tenha alguma delas é inofensivo.
-- ============================================================================

-- ── 1. Perfil profissional ──────────────────────────────────────────────────
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS bio              text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subspecialty     text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS has_masters      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_doctorate    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS city             text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS state            text    NOT NULL DEFAULT '';

COMMENT ON COLUMN public.doctors.state IS
  'UF onde o médico atende (2 letras). Usada na busca por proximidade.';

-- ── 2. O que a paciente pergunta antes de escolher ──────────────────────────
-- Ordem das perguntas reais: "onde ele atende", "aceita meu convênio",
-- "quanto custa", "ele é formado onde". Cada uma tem sua coluna.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS instagram             text,
  ADD COLUMN IF NOT EXISTS rqe                   text,
  ADD COLUMN IF NOT EXISTS education             text,
  ADD COLUMN IF NOT EXISTS hospitals             text,
  ADD COLUMN IF NOT EXISTS insurances            text,
  ADD COLUMN IF NOT EXISTS languages             text,
  ADD COLUMN IF NOT EXISTS approach              text,
  ADD COLUMN IF NOT EXISTS consultation_price_brl integer,
  ADD COLUMN IF NOT EXISTS offers_telehealth     boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.doctors.education IS
  'Formações e títulos, texto livre com uma linha por item. Obrigatório no cadastro.';
COMMENT ON COLUMN public.doctors.insurances IS
  'Quais convênios ele aceita. Só faz sentido quando accepts_insurance = true.';
COMMENT ON COLUMN public.doctors.consultation_price_brl IS
  'Valor da consulta particular em REAIS (inteiro, não centavos). Obrigatório quando accepts_private = true.';
COMMENT ON COLUMN public.doctors.rqe IS
  'Registro de Qualificação de Especialista. Complementar: nem todo CRM tem RQE emitido.';

-- ── 3. Plano e selo ─────────────────────────────────────────────────────────
-- `plan_expires_at` é o que faz o trial de 14 dias terminar de verdade: sem a
-- coluna, `planoValido()` tratava todo trial como eterno.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified        boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.doctors.verified IS
  'Selo de conferido pela plataforma. NÃO é pré-requisito para aparecer na busca — só ordena melhor.';

-- ── 4. Busca da paciente ────────────────────────────────────────────────────
-- A busca ordena por plano e nome e filtra por nome/cidade/especialidade. Sem
-- índice, cada digitada é um seq scan na tabela inteira.
CREATE INDEX IF NOT EXISTS idx_doctors_busca
  ON public.doctors(active, accepting_patients, plan);
CREATE INDEX IF NOT EXISTS idx_doctors_nome
  ON public.doctors(display_name);
