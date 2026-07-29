-- ============================================================================
-- Vincular as pacientes existentes ao médico que as acompanha
-- ============================================================================
-- POR QUE ISTO É NECESSÁRIO
--
-- O alerta do SOS vai para o médico DA PACIENTE, lido de
-- `patient_profiles.doctor_id`. As contas criadas antes do multi-tenant têm
-- esse campo nulo — e para elas o acionamento avisa o contato de emergência,
-- mas nenhum médico. A tela diz isso à paciente, então não há mentira; mas
-- também não há médico avisado.
--
-- COMO USAR
--
--  1. o médico precisa existir em `public.doctors`. Ele nasce sozinho quando
--     o médico abre o Painel → Meu perfil e salva (nome, CRM e WhatsApp).
--     Confira antes de continuar:
--        SELECT id, display_name, crm, whatsapp FROM public.doctors;
--
--  2. copie o `id` dele e substitua nas duas linhas abaixo.
--
--  3. rode. Só toca em quem está SEM médico — quem já tem vínculo fica como
--     está, inclusive se pertencer a outro profissional.
-- ============================================================================

-- Confira quantas contas estão sem médico antes de mexer:
SELECT count(*) AS pacientes_sem_medico
FROM public.patient_profiles
WHERE doctor_id IS NULL;

-- ⬇⬇ TROQUE o UUID abaixo pelo id do médico ⬇⬇
UPDATE public.patient_profiles
SET doctor_id = 'COLE-AQUI-O-ID-DO-MEDICO'::uuid
WHERE doctor_id IS NULL;

-- Confirme o resultado:
SELECT count(*) AS ainda_sem_medico
FROM public.patient_profiles
WHERE doctor_id IS NULL;
