-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE — apagar a conta passa a apagar a IA junto
--
-- Idempotente: pode rodar quantas vezes quiser.
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUE ISTO EXISTE
--
-- `excluirMinhaConta` chama `auth.admin.deleteUser` e confia nos cascatas. O
-- comentário dela diz, com todas as letras: "o resto sai pelos ON DELETE
-- CASCADE". Quatro tabelas não tinham chave estrangeira nenhuma para
-- `auth.users` — nem CASCADE, nem SET NULL, nem restrição:
--
--   · chat_messages     — a transcrição das conversas dela com a IA;
--   · chat_memory       — o RESUMO CLÍNICO que o modelo escreveu sobre ela;
--   · brain_feedback    — a pergunta dela, no texto original, até 4.000 chars;
--   · brain_gap_askers  — quais dúvidas ela fez.
--
-- Sem chave estrangeira, o `deleteUser` funciona: nada bloqueia. E a paciente
-- lê "sua conta foi apagada" enquanto o dado mais íntimo do produto continua no
-- banco, órfão de um usuário que não existe mais — sem dono, sem RLS que a
-- proteja, e para sempre.
--
-- O código dizia uma coisa que o banco não fazia. É pior que não ter apagado:
-- é ter acreditado que apagou.
--
-- ─── ORDEM DAS OPERAÇÕES ────────────────────────────────────────────────────
-- Órfãos primeiro (linhas de contas já apagadas), senão o ADD CONSTRAINT falha.

SET search_path = public;

-- ── 1. Limpa o que já ficou para trás ───────────────────────────────────────
DELETE FROM public.chat_messages
  WHERE patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = chat_messages.patient_id);

DELETE FROM public.chat_memory
  WHERE patient_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = chat_memory.patient_id);

DELETE FROM public.brain_feedback
  WHERE user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = brain_feedback.user_id);

DELETE FROM public.brain_gap_askers
  WHERE user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = brain_gap_askers.user_id);

-- ── 2. Passa a cascatear ────────────────────────────────────────────────────
-- `DO` + `to_regclass`: produção tem menos tabelas que o repo, e um ALTER sobre
-- tabela ausente derrubaria o arquivo inteiro. Mesmo padrão da view de eventos
-- clínicos.
DO $$
DECLARE
  alvo record;
BEGIN
  FOR alvo IN
    SELECT * FROM (VALUES
      ('chat_messages',    'patient_id', 'chat_messages_patient_fk'),
      ('chat_memory',      'patient_id', 'chat_memory_patient_fk'),
      ('brain_feedback',   'user_id',    'brain_feedback_user_fk'),
      ('brain_gap_askers', 'user_id',    'brain_gap_askers_user_fk')
    ) AS t(tabela, coluna, nome)
  LOOP
    IF to_regclass('public.' || alvo.tabela) IS NULL THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = alvo.nome) THEN CONTINUE; END IF;
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I)
         REFERENCES auth.users(id) ON DELETE CASCADE',
      alvo.tabela, alvo.nome, alvo.coluna
    );
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- CONFERIR
-- ════════════════════════════════════════════════════════════════════════════
--
--   -- as quatro chaves devem aparecer, todas com delete_rule = CASCADE
--   SELECT tc.table_name, kcu.column_name, rc.delete_rule
--     FROM information_schema.table_constraints tc
--     JOIN information_schema.key_column_usage kcu USING (constraint_name)
--     JOIN information_schema.referential_constraints rc USING (constraint_name)
--    WHERE tc.constraint_name IN ('chat_messages_patient_fk','chat_memory_patient_fk',
--                                 'brain_feedback_user_fk','brain_gap_askers_user_fk');
--
--   -- e não deve sobrar órfão nenhum
--   SELECT count(*) FROM public.chat_memory m
--    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = m.patient_id);
