-- WhatsApp por médico (scaffolding): mapeia o phone_number_id do WhatsApp
-- Business (Meta) ao doctor_id, para que o agente responda com o Segundo
-- Cérebro DAQUELE médico. Enquanto a tabela estiver vazia, o webhook cai no
-- comportamento atual (cérebro do dono) — mudança 100% aditiva.
--
-- RLS ligada e SEM policies: só o service_role (as server functions) acessa.

CREATE TABLE IF NOT EXISTS public.doctor_whatsapp_numbers (
  phone_number_id text PRIMARY KEY,   -- id do número no WhatsApp Cloud API (Meta)
  doctor_id       uuid NOT NULL,
  label           text,               -- rótulo livre (ex.: "Consultório Centro")
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_whatsapp_doctor
  ON public.doctor_whatsapp_numbers(doctor_id);

ALTER TABLE public.doctor_whatsapp_numbers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.doctor_whatsapp_numbers FROM anon, authenticated;
