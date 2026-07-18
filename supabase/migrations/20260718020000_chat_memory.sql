-- Memória por paciente + visibilidade das conversas da IA no painel.
--
-- chat_messages — cada mensagem do chat do app (paciente ↔ IA do médico),
--   chaveada por paciente E médico: o médico vê o que a IA respondeu a cada
--   paciente dele, e cada conversa é individual.
-- chat_memory — resumo do que a paciente já contou/perguntou/sentiu, gerado
--   pela IA e injetado no chat dela (e só dela) para dar continuidade.
-- whatsapp_conversations.doctor_id — conversa de WhatsApp por médico
--   (formaliza no banco o isolamento que o código já faz via contexto).

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  doctor_id  uuid,
  role       text NOT NULL CHECK (role IN ('user','assistant')),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_patient ON public.chat_messages(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_doctor  ON public.chat_messages(doctor_id, created_at DESC);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_messages FROM anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;

CREATE TABLE IF NOT EXISTS public.chat_memory (
  patient_id uuid PRIMARY KEY,
  doctor_id  uuid,
  summary    text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_memory FROM anon, authenticated;
GRANT ALL ON public.chat_memory TO service_role;

ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS doctor_id uuid;
CREATE INDEX IF NOT EXISTS idx_wa_conv_doctor ON public.whatsapp_conversations(doctor_id);
