-- ============================================================================
-- Conferencia do CRM: guardar o que o conselho respondeu
-- ============================================================================

-- ── 13. Conferencia do CRM no conselho ──────────────────────────────────────
-- Hoje qualquer pessoa cria um perfil de medico sem verificacao nenhuma, e o
-- selo "verificado" e um botao que um super-admin aperta. Estas colunas guardam
-- o resultado de uma consulta AO CONSELHO — quem confirmou, quando, e com que
-- nome — para o selo passar a significar alguma coisa.
--
-- `crm_conferido_nome` existe para o caso mais util: o conselho responde um nome
-- DIFERENTE do que ele cadastrou. Nao e necessariamente fraude (nome de casada,
-- abreviacao), mas e exatamente o que um humano precisa ver antes de aprovar.
--
-- NENHUMA delas e editavel pelo cliente: um selo que o proprio interessado
-- escreve nao e selo. So o service_role grava.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS crm_conferido_em   timestamptz,
  ADD COLUMN IF NOT EXISTS crm_conferido_nome text,
  ADD COLUMN IF NOT EXISTS crm_conferido_situacao text;

COMMENT ON COLUMN public.doctors.crm_conferido_em IS
  'Quando o CRM foi conferido no conselho. NULL = nunca conferido.';
COMMENT ON COLUMN public.doctors.crm_conferido_nome IS
  'Nome que o conselho devolveu. Diferente do cadastrado = revisar a mao.';
COMMENT ON COLUMN public.doctors.crm_conferido_situacao IS
  'Situacao no conselho (ex.: Ativo, Cancelado). Texto do provedor, sem traducao.';
