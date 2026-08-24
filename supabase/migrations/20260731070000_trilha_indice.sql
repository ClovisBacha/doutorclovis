-- ============================================================================
-- O ÍNDICE QUE FAZ A TRILHA DE AUDITORIA SERVIR PARA ALGUMA COISA
-- ============================================================================
--
-- `audit_log` nasceu com índice em `created_at` e em `action` — os dois certos
-- para o uso que ela tinha: "o que o super-admin fez esta semana", "todas as
-- criações de cupom".
--
-- A trilha clínica pergunta o oposto, e é a única pergunta que importa numa
-- auditoria de prontuário:
--
--   SELECT * FROM audit_log WHERE target = '<uuid da paciente>'
--    ORDER BY created_at DESC;
--
-- Por `target`, que não tem índice nenhum. Numa tabela que agora cresce a cada
-- ABERTURA de ficha — e não mais a cada ação de super-admin —, isso é varredura
-- sequencial em cima da tabela de crescimento mais rápido do banco. Escrever a
-- trilha e não conseguir lê-la é ter o custo do registro sem o benefício dele.
--
-- Composto e com `created_at DESC` na segunda posição: o `ORDER BY` sai do
-- próprio índice, sem passo de ordenação.
-- ============================================================================

DO $trilha$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN RETURN; END IF;
  CREATE INDEX IF NOT EXISTS idx_audit_target
    ON public.audit_log (target, created_at DESC);
END
$trilha$;

COMMENT ON TABLE public.audit_log IS
  'Log de acoes sensiveis. Desde 31/07 tambem registra acesso clinico: prontuario.ler, ficha.ler, exame.imagem, emissao.criar, vinculo.encerrar — com target = id da paciente. meta guarda so ids, nunca conteudo clinico.';
