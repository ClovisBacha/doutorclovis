-- ════════════════════════════════════════════════════════════════════════════
-- A MEMÓRIA DA CONVERSA — a tabela que nunca teve migration numerada
-- ════════════════════════════════════════════════════════════════════════════
--
-- `chat_messages` e `chat_memory` existiam SÓ dentro do `APLICAR_PENDENTES.sql`,
-- o arquivo consolidado que se roda à mão no editor do Supabase. Nenhuma
-- migration numerada as criava.
--
-- Por que isso é um problema de verdade, e não arrumação:
--
--   · `supabase db push` num banco limpo (ambiente novo, um segundo consultório,
--     a máquina de outra pessoa) produz um esquema SEM estas duas tabelas;
--   · e `historicoConfiavel` devolve `[]` em silêncio quando a leitura falha
--     (`chat-memory.server.ts`), porque ela foi escrita para não derrubar o chat
--     por causa de telemetria.
--
-- Somando os dois: o chat perde a memória INTEIRA e não há erro em lugar
-- nenhum. A paciente conversa, e a cada mensagem a IA a trata como se fosse a
-- primeira vez. É o formato de defeito mais caro deste repo — o silencioso.
--
-- Idempotente e igual ao consolidado (byte a byte no que importa): rodar os
-- dois, em qualquer ordem, não muda nada.

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  doctor_id  uuid,
  role       text NOT NULL CHECK (role IN ('user','assistant')),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- As duas leituras que existem: o histórico DELA (chat) e o recorte por médico
-- (prontuário/telemetria). Ambas sempre com "as mais recentes primeiro".
CREATE INDEX IF NOT EXISTS idx_chat_msgs_patient ON public.chat_messages(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_msgs_doctor  ON public.chat_messages(doctor_id, created_at DESC);

-- Server-only: quem escreve e lê é a chave de serviço, no `/api/chat`. O
-- navegador não toca aqui — é a conversa de uma gestante com o consultório, o
-- dado mais sensível do produto.
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_messages FROM anon, authenticated;
GRANT ALL ON public.chat_messages TO service_role;

-- O resumo do que já foi conversado (uma linha por paciente).
CREATE TABLE IF NOT EXISTS public.chat_memory (
  patient_id uuid PRIMARY KEY,
  doctor_id  uuid,
  summary    text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_memory FROM anon, authenticated;
GRANT ALL ON public.chat_memory TO service_role;
