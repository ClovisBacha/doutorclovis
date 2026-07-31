-- ============================================================================
-- SOS: o acionamento vira dado clinico, com dono, motivo e desfecho
-- ============================================================================

-- ── 14. O acionamento de SOS vira DADO, nao log ─────────────────────────────
-- `panic_events` nasceu com seis campos (quem, quando, onde) e uma politica
-- `auth.uid() = user_id`: o MEDICO nao consegue ler. Foi desenhada quando o app
-- era de um consultorio so e o SOS "avisava" por e-mail — o registro era um log
-- de servidor, nao um dado clinico.
--
-- Para virar produto faltam quatro coisas: de quem era a paciente, POR QUE ela
-- apertou, se alguem atendeu, e COMO ela estava naquele momento.
ALTER TABLE public.panic_events
  ADD COLUMN IF NOT EXISTS doctor_id    uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo       text,
  ADD COLUMN IF NOT EXISTS atendido_em  timestamptz,
  ADD COLUMN IF NOT EXISTS atendido_por uuid,
  ADD COLUMN IF NOT EXISTS ficha        jsonb;

COMMENT ON COLUMN public.panic_events.doctor_id IS
  'Medico da paciente NO MOMENTO do acionamento. Congelado de proposito: se ela trocar de medico depois, o historico continua contando quem era o responsavel naquele dia.';
COMMENT ON COLUMN public.panic_events.motivo IS
  'O que ela relatou (sangramento, dor de cabeca, perda de liquido...). NULL = apertou sem escolher.';
COMMENT ON COLUMN public.panic_events.ficha IS
  'Retrato clinico no instante do acionamento: semana, DPP, tipo sanguineo, alergias, medicacoes. Congelado porque o prontuario muda e o evento nao pode mudar com ele.';
COMMENT ON COLUMN public.panic_events.atendido_em IS
  'Quando alguem marcou como atendido no painel. NULL = ninguem confirmou ainda.';

CREATE INDEX IF NOT EXISTS idx_panic_doctor ON public.panic_events(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_panic_user   ON public.panic_events(user_id, created_at DESC);

-- O MEDICO le e atualiza os acionamentos das PROPRIAS pacientes. Sem isto ele
-- literalmente nao tem como saber que houve um SOS.
DROP POLICY IF EXISTS "medico le panicos das suas pacientes" ON public.panic_events;
/* Versao inicial: so o carimbo. Substituida por 20260731050000, que exige o
   vinculo ATUAL — sem isso o ex-medico continuava lendo a geolocalizacao. */
CREATE POLICY "medico le panicos das suas pacientes" ON public.panic_events
  FOR SELECT TO authenticated
  USING (doctor_id = auth.uid());

DROP POLICY IF EXISTS "medico marca panico como atendido" ON public.panic_events;
CREATE POLICY "medico marca panico como atendido" ON public.panic_events
  FOR UPDATE TO authenticated
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

-- Retroativo: os acionamentos que ja existem ganham o medico atual da paciente.
-- E o melhor palpite disponivel — dali para frente o valor e congelado no
-- momento do disparo, que e o correto.
UPDATE public.panic_events e
   SET doctor_id = p.doctor_id
  FROM public.patient_profiles p
 WHERE p.id = e.user_id
   AND e.doctor_id IS NULL
   AND p.doctor_id IS NOT NULL;
