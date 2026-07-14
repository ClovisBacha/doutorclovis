-- Backfill do doctor_id nas linhas antigas (feitas antes do multi-tenant tagar
-- o doctor_id na escrita). Cada linha herda o doctor_id da PACIENTE (o médico
-- que ela escolheu, em patient_profiles.doctor_id). Só toca linhas com
-- doctor_id NULL e só quando a paciente TEM médico — quem não tem fica NULL
-- (= dono da instalação, visível para a equipe). Idempotente: rodar de novo
-- não muda nada além de novas linhas que porventura ainda estejam NULL.

-- Perguntas: user_id → perfil da paciente
UPDATE public.doctor_questions q
SET doctor_id = pp.doctor_id
FROM public.patient_profiles pp
WHERE q.user_id = pp.id
  AND q.doctor_id IS NULL
  AND pp.doctor_id IS NOT NULL;

-- Pré-consultas: user_id → perfil da paciente
UPDATE public.preconsulta_forms f
SET doctor_id = pp.doctor_id
FROM public.patient_profiles pp
WHERE f.user_id = pp.id
  AND f.doctor_id IS NULL
  AND pp.doctor_id IS NOT NULL;

-- Teleconsultas: patient_user_id → perfil da paciente
UPDATE public.teleconsulta_sessions t
SET doctor_id = pp.doctor_id
FROM public.patient_profiles pp
WHERE t.patient_user_id = pp.id
  AND t.doctor_id IS NULL
  AND pp.doctor_id IS NOT NULL;

-- Consultas (agendamento público por e-mail): e-mail → auth.users → perfil
UPDATE public.appointment_requests a
SET doctor_id = pp.doctor_id
FROM auth.users u
JOIN public.patient_profiles pp ON pp.id = u.id
WHERE lower(a.patient_email) = lower(u.email)
  AND a.doctor_id IS NULL
  AND pp.doctor_id IS NOT NULL;
