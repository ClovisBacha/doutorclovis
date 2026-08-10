-- ============================================================================
--  CANCELAR CONSULTA, DIRETO NO DIA DA AGENDA — teleconsulta ganha o status
--  Idempotente: pode rodar mais de uma vez.
-- ----------------------------------------------------------------------------
--  Pedido (`appointment_requests`) e particular (`private_consultations`) já
--  aceitavam 'cancelled'/'cancelado' antes desta migration — o primeiro sem
--  CHECK nenhum na coluna, o segundo com um CHECK que já cobria o valor. Só a
--  teleconsulta (`teleconsulta_sessions`) nasceu com um CHECK fechado em três
--  palavras (agendada/sala_aberta/encerrada) e sem "cancelada" — o UPDATE do
--  médico falharia com violação de CHECK, sem aviso nenhum na tela além de
--  "não consegui".
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE public.teleconsulta_sessions DROP CONSTRAINT IF EXISTS teleconsulta_sessions_status_check;
  ALTER TABLE public.teleconsulta_sessions
    ADD CONSTRAINT teleconsulta_sessions_status_check
    CHECK (status IN ('agendada', 'sala_aberta', 'encerrada', 'cancelada'));
EXCEPTION WHEN undefined_table THEN
  NULL; -- banco que ainda não rodou a migration da teleconsulta
END $$;
