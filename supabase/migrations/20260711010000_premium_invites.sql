-- ════════════════════════════════════════════════════════════════════════
-- Convites premium — o médico Elite dá o app premium às pacientes por código
-- ════════════════════════════════════════════════════════════════════════
-- Cada médico Elite tem UM código (doctors.invite_code). A paciente digita o
-- código no app → ganha o premium. Até N resgates/mês (N vem do plano Elite).
-- Uma paciente conta uma vez por médico (UNIQUE), então re-digitar não gasta
-- cota. A cota do mês = linhas criadas no mês corrente.

ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

CREATE TABLE IF NOT EXISTS public.premium_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id       uuid NOT NULL,
  patient_user_id uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, patient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_premium_invites_doctor_month
  ON public.premium_invites(doctor_id, created_at);

ALTER TABLE public.premium_invites ENABLE ROW LEVEL SECURITY;

-- Médico lê os próprios convites (contador); paciente lê os seus.
DROP POLICY IF EXISTS "doctor reads own invites" ON public.premium_invites;
CREATE POLICY "doctor reads own invites" ON public.premium_invites
  FOR SELECT USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "patient reads own invites" ON public.premium_invites;
CREATE POLICY "patient reads own invites" ON public.premium_invites
  FOR SELECT USING (auth.uid() = patient_user_id);

-- Escrita só via service_role (as server functions usam supabaseAdmin) —
-- sem policy de INSERT/UPDATE/DELETE para authenticated = negado por padrão.
GRANT SELECT ON public.premium_invites TO authenticated;
