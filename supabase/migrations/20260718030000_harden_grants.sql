-- ════════════════════════════════════════════════════════════════════════
-- Reforço de segurança: REVOKE explícito nas tabelas server-only
-- ════════════════════════════════════════════════════════════════════════
-- Estas tabelas já estavam seguras (RLS habilitado sem policy → zero linhas
-- para anon/authenticated), mas dependiam só disso. Verificação em produção
-- (2026-07-18) mostrou que o SELECT era permitido no nível de GRANT (voltava
-- vazio). Cinto e suspensório: como todo o acesso é via service_role no
-- servidor, revogamos o GRANT também — igual a brain_entries/clinics/chat_*.
-- Nenhuma delas é acessada direto do navegador (verificado no código).

REVOKE ALL ON public.brain_gaps            FROM anon, authenticated;
REVOKE ALL ON public.brain_feedback        FROM anon, authenticated;
REVOKE ALL ON public.brain_hits            FROM anon, authenticated;
REVOKE ALL ON public.epds_logs             FROM anon, authenticated;
REVOKE ALL ON public.experience_leads      FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_conversations FROM anon, authenticated;
