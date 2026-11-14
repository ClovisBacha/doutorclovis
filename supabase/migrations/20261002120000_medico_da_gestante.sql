-- ═════════════════════════════════════════════════════════════════════════════
-- APLICAR_MEDICO_DA_GESTANTE.sql — o contato do médico que ELA cadastra.
-- Idempotente: rode quantas vezes quiser.
--
-- ─── POR QUE ─────────────────────────────────────────────────────────────────
--
-- O app de gestantes (mobile/) não tem médico vinculado na v1. O único fio com
-- o médico é este: ela digita o nome, o celular e o e-mail de quem acompanha a
-- gestação, e o SOS (`dispararEmergencia`) manda para ele o e-mail de
-- emergência e, com a API do WhatsApp configurada, a mensagem. Sem a API, o
-- app abre o WhatsApp do próprio aparelho com a mensagem pronta.
--
-- Não substitui `doctor_id` (o vínculo da plataforma, do site): é só contato.
-- A leitura no servidor é um select À PARTE, então até este arquivo rodar o
-- SOS continua avisando o contato de emergência e o médico vinculado como
-- antes — e o app guarda o contato também no aparelho, para o SOS sem rede.
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS medico_nome text;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS medico_celular text;
ALTER TABLE public.patient_profiles ADD COLUMN IF NOT EXISTS medico_email text;

-- Faixas plausíveis: um texto gigante aqui só serviria para abuso.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'patient_profiles_medico_tamanho') THEN
    ALTER TABLE public.patient_profiles
      ADD CONSTRAINT patient_profiles_medico_tamanho CHECK (
        coalesce(length(medico_nome), 0) <= 120
        AND coalesce(length(medico_celular), 0) <= 30
        AND coalesce(length(medico_email), 0) <= 200
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
