-- ============================================================================
--  HORÁRIOS DISPONÍVEIS E BLOQUEIOS — por médico, com RLS desde o nascimento
--  Idempotente: pode rodar mais de uma vez.
-- ----------------------------------------------------------------------------
--  POR QUE ESTAS TABELAS NASCEM DE NOVO
--
--  Existiram `doctor_availability` e `blocked_dates`. Elas foram REVOGADAS na
--  migration 20260730020000, e não por capricho:
--
--    · nasceram sem `doctor_id` — uma linha por dia da semana para o
--      consultório INTEIRO, o que é insustentável num produto multi-médico;
--    · a política de RLS deixava QUALQUER pessoa autenticada (inclusive uma
--      paciente) reescrever os horários e apagar as férias do médico;
--    · nenhum fluxo de agendamento as lia. Era uma tela que gravava num lugar
--      que ninguém consultava, por um caminho que ninguém deveria ter.
--
--  Aqui o dono é `NOT NULL` desde a primeira coluna, e a leitura da paciente é
--  recortada pelo vínculo ATUAL (`patient_profiles.doctor_id`) — nunca por um
--  `doctor_id` carimbado na linha de origem.
-- ============================================================================

-- ── 1. A grade semanal ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctor_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 0 = domingo … 6 = sábado, igual ao `Date#getDay` do JS. Um CHECK aqui
  -- impede o 7 (domingo em ISO) de entrar e criar um dia que nunca aparece.
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time   time NOT NULL,
  slot_minutes smallint NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
  -- 'presencial' | 'teleconsulta' | 'ambos'
  kind text NOT NULL DEFAULT 'ambos' CHECK (kind IN ('presencial','teleconsulta','ambos')),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Faixa invertida é erro de digitação, e sem o CHECK ela vira uma faixa que
  -- não gera horário nenhum — indistinguível de "o médico não abriu o dia".
  CONSTRAINT doctor_slots_faixa_valida CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_doctor_slots_dono
  ON public.doctor_slots (doctor_id, weekday, start_time);

-- ── 2. Os bloqueios ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.doctor_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at   timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT doctor_blocks_faixa_valida CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_doctor_blocks_dono
  ON public.doctor_blocks (doctor_id, starts_at);

COMMENT ON TABLE public.doctor_slots IS
  'Grade semanal de atendimento POR MÉDICO. A expansão em horários concretos e a subtração de bloqueios/ocupados vivem em src/lib/disponibilidade.ts — a régua é uma só, testada, e não se repete em SQL.';
COMMENT ON TABLE public.doctor_blocks IS
  'Intervalos fechados pelo médico (férias, congresso, uma tarde). Início inclusivo, fim EXCLUSIVO — mesma borda que a régua do app.';

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.doctor_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_blocks ENABLE ROW LEVEL SECURITY;

-- O médico manda na própria grade, e só nela.
DROP POLICY IF EXISTS "medico_gerencia_a_propria_grade" ON public.doctor_slots;
CREATE POLICY "medico_gerencia_a_propria_grade" ON public.doctor_slots
  FOR ALL TO authenticated
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

DROP POLICY IF EXISTS "medico_gerencia_os_proprios_bloqueios" ON public.doctor_blocks;
CREATE POLICY "medico_gerencia_os_proprios_bloqueios" ON public.doctor_blocks
  FOR ALL TO authenticated
  USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

-- A paciente LÊ a grade do médico dela — e só a dele.
--
-- É SELECT e nada mais. A tabela antiga dava `FOR ALL` a qualquer autenticado,
-- o que significa que uma paciente podia apagar as férias do médico.
--
-- O recorte é pelo vínculo ATUAL em `patient_profiles`: é a mesma régua que o
-- resto do produto usa, e é o que faz o vínculo encerrado deixar de dar acesso
-- no mesmo instante.
DROP POLICY IF EXISTS "paciente_le_a_grade_do_medico_dela" ON public.doctor_slots;
CREATE POLICY "paciente_le_a_grade_do_medico_dela" ON public.doctor_slots
  FOR SELECT TO authenticated
  USING (
    doctor_id IN (
      SELECT p.doctor_id FROM public.patient_profiles p
      WHERE p.id = auth.uid() AND p.doctor_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "paciente_le_os_bloqueios_do_medico_dela" ON public.doctor_blocks;
CREATE POLICY "paciente_le_os_bloqueios_do_medico_dela" ON public.doctor_blocks
  FOR SELECT TO authenticated
  USING (
    doctor_id IN (
      SELECT p.doctor_id FROM public.patient_profiles p
      WHERE p.id = auth.uid() AND p.doctor_id IS NOT NULL
    )
  );

-- ── 4. Por que a paciente NÃO calcula os horários livres no navegador ───────
--
-- Ela pode ler a grade e os bloqueios (acima), mas para saber o que está LIVRE
-- é preciso subtrair o que já está marcado — e o que já está marcado são as
-- consultas DE OUTRAS PACIENTES. Dar esse SELECT a ela vazaria nome, e-mail e
-- horário de todo mundo.
--
-- Por isso `horariosLivresDoMedico` (src/lib/disponibilidade.functions.ts) roda
-- com service role e devolve SÓ os horários — sem dizer de quem é nenhum deles.

GRANT SELECT ON public.doctor_slots  TO authenticated;
GRANT SELECT ON public.doctor_blocks TO authenticated;
GRANT ALL    ON public.doctor_slots  TO service_role;
GRANT ALL    ON public.doctor_blocks TO service_role;
