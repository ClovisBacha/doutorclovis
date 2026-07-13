-- Nível 2 do Google Meet/Agenda: cada médico conecta a PRÓPRIA conta Google
-- (escopo calendar.events) para hospedar as teleconsultas na agenda dele, em
-- vez de uma conta central. O refresh token é um SEGREDO — fica numa tabela
-- própria com RLS ligada e SEM policies, ou seja: nenhum cliente (anon/
-- authenticated) lê ou escreve; só o service_role (as server functions) acessa.

CREATE TABLE IF NOT EXISTS public.doctor_google_tokens (
  user_id       uuid PRIMARY KEY,
  refresh_token text NOT NULL,
  google_email  text,
  connected_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_google_tokens ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma policy de propósito: RLS ligada + zero policies = acesso apenas
-- via service_role (que ignora RLS). O token nunca chega ao navegador.

REVOKE ALL ON TABLE public.doctor_google_tokens FROM anon, authenticated;
