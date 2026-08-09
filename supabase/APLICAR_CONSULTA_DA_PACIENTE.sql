-- ============================================================================
--  A CONSULTA PASSA A APONTAR PARA A PACIENTE
--  Idempotente: pode rodar mais de uma vez.
-- ----------------------------------------------------------------------------
--  O QUE ESTAVA FALTANDO
--
--  `appointment_requests` nasceu como formulário público: identifica quem pediu
--  por `patient_email` DIGITADO. Isso funciona para quem não tem conta — e é o
--  que permite o médico marcar para qualquer pessoa —, mas significa que a
--  consulta nunca soube de QUAL paciente do app ela é.
--
--  Sem esse elo, três coisas ficam impossíveis:
--
--    · dizer, ao abrir o dia, se a pré-consulta daquela paciente já chegou;
--    · juntar o que ela registrou no app ENTRE duas consultas;
--    · mostrar a consulta na linha do tempo clínica dela.
--
--  Tudo isso hoje depende de casar o e-mail digitado com o e-mail da conta —
--  e um caractere diferente, ou o e-mail do marido, quebra o casamento em
--  silêncio.
--
--  ── NULO CONTINUA SENDO VÁLIDO, E ISSO É O PONTO ───────────────────────────
--
--  A coluna é opcional de propósito. Consulta marcada para quem não tem conta
--  no app é um caso legítimo e frequente — o consultório faz a intermediação.
--  `NOT NULL` aqui transformaria "não tem conta" em erro de gravação.
-- ============================================================================

ALTER TABLE IF EXISTS public.appointment_requests
  ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── ESTE ARQUIVO TEM DE SE BASTAR ───────────────────────────────────────────
-- O índice abaixo usa `confirmed_date`, que vem de outra leva. Num banco que
-- ainda não a tem, o `CREATE INDEX` falharia e derrubaria o arquivo inteiro —
-- inclusive a coluna que ele existe para criar. Garantir aqui é idempotente e
-- não muda nada onde a coluna já existe.
ALTER TABLE IF EXISTS public.appointment_requests
  ADD COLUMN IF NOT EXISTS confirmed_date date;

COMMENT ON COLUMN public.appointment_requests.patient_user_id IS
  'A conta da paciente no app, quando ela tem uma. NULL = consulta de quem não é do app (caso legítimo). Preenchido quando o médico escolhe a paciente da lista, ou quando o pedido vem do app autenticado.';

-- "As consultas desta paciente" é a consulta que a linha do tempo clínica faz.
CREATE INDEX IF NOT EXISTS idx_appt_paciente
  ON public.appointment_requests (patient_user_id, confirmed_date)
  WHERE patient_user_id IS NOT NULL;

-- ON DELETE SET NULL, e não CASCADE: apagar a conta da paciente (LGPD) não pode
-- apagar o registro de que a consulta ACONTECEU — o médico precisa da agenda
-- dele, e a linha deixa de apontar para uma pessoa identificável.
