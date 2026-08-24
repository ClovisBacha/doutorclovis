-- ============================================================================
-- doctors: fechar a escrita de plano, selo e status pelo navegador
-- ============================================================================
-- Roda depois de 20260730030000, porque concede UPDATE nas colunas que ela cria.
-- ============================================================================

-- ── 8. A linha que guarda o painel era editável pelo navegador ───────────────
-- `20260707200000` fez `GRANT SELECT, UPDATE ON public.doctors TO authenticated`
-- SEM lista de colunas, e a política de RLS só confere `auth.uid() = id`. Junto,
-- isso significa que o próprio médico podia escrever `plan`, `plan_expires_at`,
-- `verified` e `active` — exatamente as colunas que `entitlements.server.ts` lê
-- como fonte de verdade do que ele pagou.
--
-- Na prática: qualquer pessoa cria um perfil de médico (não há verificação de
-- CRM), abre o console do navegador e roda
--   supabase.from('doctors').update({plan:'clinica', verified:true}).eq('id', uid)
-- ganhando painel pago completo e o selo de verificado na busca, de graça e para
-- sempre. As server functions nunca deixaram isso passar (`ProfileSchema` não
-- tem esses campos) — o buraco era o GRANT, não o código.
--
-- A correção é cirúrgica: o médico continua editando o PERFIL dele pelo cliente;
-- plano, selo e status só pelo service_role.
REVOKE UPDATE ON public.doctors FROM authenticated;

GRANT UPDATE (
  display_name, title, specialty, crm, whatsapp, personal_phone, pix_key,
  bio, subspecialty, years_experience, has_masters, has_doctorate,
  city, state, accepting_patients,
  instagram, rqe, education, hospitals, insurances, languages, approach,
  consultation_price_brl, offers_telehealth,
  accepts_insurance, accepts_private,
  updated_at
) ON public.doctors TO authenticated;

COMMENT ON COLUMN public.doctors.plan IS
  'Plano do medico. NAO editavel pelo cliente: so service_role (checkout/webhook).';
COMMENT ON COLUMN public.doctors.active IS
  'Perfil ativo. NAO editavel pelo cliente: so service_role.';

-- ── 9. O trial que nunca acabava ────────────────────────────────────────────
-- `entitlements.server` só rebaixa um trial quando `plan_expires_at` tem data.
-- Como a coluna acabou de nascer (secao 3), TODO medico cadastrado antes disto
-- tem `plan='trial'` com `plan_expires_at = NULL` — ou seja, plano Pro eterno:
-- 150 pacientes, IA no app e no WhatsApp, e primeiro lugar na busca, para
-- sempre, sem pagar. O mesmo vale para qualquer linha criada enquanto a coluna
-- nao existia.
--
-- O backfill da 14 dias contados do CADASTRO, nao de hoje: e o prazo que ele
-- teria tido se a coluna existisse desde o inicio. Quem se cadastrou ha mais de
-- 14 dias ja entra vencido, o que e a resposta correta — ele usou o teste.
-- O backfill precisa passar por cima do `trg_protect_doctor_billing`
-- (APLICAR_PENDENTES), que reverte qualquer escrita em `plan_expires_at` feita
-- por quem nao e `service_role`. No SQL Editor do Supabase `current_user` e
-- `postgres`, nao `service_role` — ou seja, sem desligar o gatilho este UPDATE
-- diria "UPDATE 3" e nao mudaria nada. (Foi exatamente o que aconteceu quando
-- testei num Postgres local: sucesso reportado, zero efeito.)
DO $trial$
DECLARE
  tem_guard boolean := EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.doctors'::regclass
       AND tgname  = 'trg_protect_doctor_billing'
       AND NOT tgisinternal
  );
BEGIN
  IF tem_guard THEN
    ALTER TABLE public.doctors DISABLE TRIGGER trg_protect_doctor_billing;
  END IF;

  UPDATE public.doctors
     SET plan_expires_at = created_at + interval '14 days'
   WHERE plan = 'trial'
     AND plan_expires_at IS NULL;

  IF tem_guard THEN
    ALTER TABLE public.doctors ENABLE TRIGGER trg_protect_doctor_billing;
  END IF;
END
$trial$;
