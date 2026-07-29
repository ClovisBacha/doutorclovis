-- ============================================================================
-- Vincular as pacientes existentes ao médico que as acompanha
-- ============================================================================
-- COLE E RODE. Não precisa editar nada.
--
-- POR QUE ISTO É NECESSÁRIO
--
-- O alerta do SOS vai para o médico DA PACIENTE, lido de
-- `patient_profiles.doctor_id`. As contas criadas antes do multi-tenant têm
-- esse campo nulo — e para elas o acionamento avisa o contato de emergência,
-- mas nenhum médico, e a mensagem sai sem as linhas "Médico", "Telefone do
-- médico" e "Onde o médico atende".
--
-- ANTES DE RODAR: o médico precisa existir em `public.doctors`. Ele nasce
-- sozinho quando o médico abre o Painel → Meu perfil e salva. Se a tabela
-- estiver vazia, este arquivo não faz nada e avisa — não é erro, é a ordem
-- certa: primeiro o perfil, depois o vínculo.
--
-- SEGURANÇA: só toca em quem está SEM médico. Quem já tem vínculo fica como
-- está, inclusive se pertencer a outro profissional. E só age quando existe
-- UM único médico cadastrado — com dois ou mais, não há como adivinhar de
-- quem é cada paciente, então ele para e manda usar a versão manual do fim.
-- ============================================================================

-- ── 1. Diagnóstico ──────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.doctors)                                    AS medicos_cadastrados,
  (SELECT count(*) FROM public.patient_profiles WHERE doctor_id IS NULL)   AS pacientes_sem_medico,
  (SELECT count(*) FROM public.patient_profiles WHERE doctor_id IS NOT NULL) AS pacientes_ja_vinculadas;

-- ── 2. O vínculo ────────────────────────────────────────────────────────────
-- Roda sozinho quando há exatamente um médico. Com zero ou dois ou mais, o
-- WHERE não bate e nenhuma linha é tocada.
UPDATE public.patient_profiles
SET doctor_id = (SELECT id FROM public.doctors LIMIT 1)
WHERE doctor_id IS NULL
  AND (SELECT count(*) FROM public.doctors) = 1;

-- ── 3. Resultado ────────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN (SELECT count(*) FROM public.doctors) = 0
      THEN 'NENHUM MEDICO CADASTRADO. Abra o Painel > Meu perfil, preencha nome, CRM e WhatsApp, salve, e rode este arquivo de novo.'
    WHEN (SELECT count(*) FROM public.doctors) > 1
      THEN 'HA MAIS DE UM MEDICO. Nada foi alterado — use a versao manual no fim deste arquivo.'
    WHEN (SELECT count(*) FROM public.patient_profiles WHERE doctor_id IS NULL) = 0
      THEN 'PRONTO. Todas as pacientes estao vinculadas a um medico.'
    ELSE 'ATENCAO: ainda ha pacientes sem medico. Confira o resultado acima.'
  END AS resultado;

-- ============================================================================
-- VERSÃO MANUAL — só use se houver mais de um médico cadastrado
-- ============================================================================
-- 1. veja os médicos:
--      SELECT id, display_name, crm FROM public.doctors;
-- 2. copie o id do médico certo, tire os dois hifens das duas linhas abaixo e
--    troque o UUID:
--
-- UPDATE public.patient_profiles
-- SET doctor_id = '00000000-0000-0000-0000-000000000000'::uuid
-- WHERE doctor_id IS NULL;
