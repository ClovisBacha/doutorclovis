-- ============================================================================
-- O SOS SEGUE O VÍNCULO ATUAL — não o carimbo da linha
-- ============================================================================
--
-- `panic_events` ganhou policies chaveadas em `doctor_id = auth.uid()`, e esse
-- `doctor_id` é carimbado no instante do disparo e nunca revisitado. Encerrar o
-- acompanhamento zera `patient_profiles.doctor_id` — o que corta as onze server
-- functions que passam por `pacientesAtuais` —, mas não toca no carimbo.
--
-- O ex-médico não precisa de server function nenhuma: bate direto no PostgREST
-- com a chave anon pública e o JWT dele. Reproduzido numa auditoria:
--
--   SET ROLE authenticated; SET request.jwt.claim.sub = '<ex-medico>';
--   SELECT user_id, latitude, longitude, address FROM panic_events WHERE ...
--   →  -23.55 | -46.63 | Rua X, 100 - ap 42
--   UPDATE panic_events SET atendido_em = now() ...  →  UPDATE 1
--
-- Ele lê E escreve. Nas mesmas condições `doctor_questions` e
-- `patient_profiles` devolvem zero linhas — só o SOS vazava, e é justamente o
-- dado de geolocalização.
--
-- Numa plataforma de gestação de alto risco esse é o pior par de dados para
-- deixar aberto a uma relação encerrada: onde ela apertou o botão de
-- emergência, e a capacidade de marcar que aquilo foi atendido.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- A correção precisa de `SECURITY DEFINER`
--
-- A checagem natural seria `EXISTS (SELECT 1 FROM patient_profiles p WHERE ...)`
-- dentro da policy. Só que a subconsulta roda com os direitos de QUEM CONSULTA,
-- e `patient_profiles` tem RLS própria que só deixa a paciente ver a própria
-- linha — o médico veria zero e a policy negaria tudo, inclusive o legítimo.
-- É o mesmo motivo pelo qual `doctor_is_active()` já existe neste schema.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.e_paciente_atual(paciente uuid, medico uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_profiles p
     WHERE p.id = paciente AND p.doctor_id = medico
  )
$$;

REVOKE ALL ON FUNCTION public.e_paciente_atual(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.e_paciente_atual(uuid, uuid) TO authenticated, service_role;

DO $policies$
BEGIN
  IF to_regclass('public.panic_events') IS NULL THEN RETURN; END IF;

  DROP POLICY IF EXISTS "medico le panicos das suas pacientes" ON public.panic_events;
  CREATE POLICY "medico le panicos das suas pacientes" ON public.panic_events
    FOR SELECT TO authenticated
    /* As DUAS condições: o carimbo (era dele na época) E o vínculo de hoje.
       Só o carimbo abria a porta para o ex-médico; só o vínculo faria o médico
       novo herdar os acionamentos do anterior. */
    USING (doctor_id = auth.uid() AND public.e_paciente_atual(user_id, auth.uid()));

  DROP POLICY IF EXISTS "medico marca panico como atendido" ON public.panic_events;
  CREATE POLICY "medico marca panico como atendido" ON public.panic_events
    FOR UPDATE TO authenticated
    USING (doctor_id = auth.uid() AND public.e_paciente_atual(user_id, auth.uid()))
    WITH CHECK (doctor_id = auth.uid() AND public.e_paciente_atual(user_id, auth.uid()));
END
$policies$;

COMMENT ON FUNCTION public.e_paciente_atual(uuid, uuid) IS
  'A paciente e do medico AGORA? SECURITY DEFINER porque a subconsulta em patient_profiles roda com os direitos de quem consulta, e a RLS de la esconderia a linha do proprio medico.';
