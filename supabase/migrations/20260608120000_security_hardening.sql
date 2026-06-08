-- Endurecimento de segurança do modo acompanhante.
--
-- Antes, qualquer usuário ANÔNIMO podia ler TODOS os convites (token + user_id)
-- por causa da política "public read by token" com USING (true). A leitura do
-- convite agora acontece só no servidor (service role), via a server function
-- getCompanionView, que valida o token e a expiração. Então removemos o acesso
-- anônimo direto à tabela.

DROP POLICY IF EXISTS "public read by token" ON public.companion_invites;
REVOKE SELECT ON public.companion_invites FROM anon;

-- Faz os convites expirarem por padrão (90 dias) e preenche os que estão sem data.
ALTER TABLE public.companion_invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '90 days');

UPDATE public.companion_invites
  SET expires_at = created_at + interval '90 days'
  WHERE expires_at IS NULL;
