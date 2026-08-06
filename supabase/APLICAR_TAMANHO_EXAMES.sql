-- ════════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE — o custo dos exames, medido
--
-- Idempotente: pode rodar quantas vezes quiser.
-- ════════════════════════════════════════════════════════════════════════════
--
-- POR QUE ISTO EXISTE
--
-- O laudo que a paciente envia vive em `exam_files.image_data`, uma coluna
-- `TEXT` com o arquivo inteiro em base64.
--
-- É a escolha certa hoje: a RLS, o visualizador do médico, a devolutiva e o
-- registro de leitura já existem e funcionam em cima dessa tabela. Trocar por
-- Supabase Storage agora seria refazer um ciclo que está de pé, com bucket,
-- políticas próprias e URL assinada — risco alto num caminho clínico, em troca
-- de uma economia que ainda não dói.
--
-- Mas ela DÓI DEPOIS, e sozinha:
--
--   · base64 infla o arquivo em 4/3;
--   · JPEG e PDF já vêm comprimidos, então o TOAST do Postgres quase não
--     recupera nada — o piso de entropia é o que é;
--   · disco de banco custa cerca de SEIS VEZES o de Storage, e ainda entra em
--     todo backup e em todo PITR;
--   · cada abertura arrasta o arquivo por PostgREST → função → JSON →
--     navegador, sem cache e sem streaming.
--
-- Cem pacientes com oito exames cada, metade em PDF de 1 MB, dão ~1,3 GB — 16%
-- do banco incluído no plano Pro.
--
-- A decisão de migrar é do Clóvis, e ele precisa de um NÚMERO para tomá-la. Sem
-- isso, "um dia isso vai custar caro" nunca vira uma data — vira uma surpresa
-- na fatura. Esta função põe o número na tela dele.

SET search_path = public;

-- `pg_column_size` mede o tamanho REAL da linha depois da compressão do TOAST,
-- que é o que ocupa disco — e não o comprimento do base64, que é o que a
-- intuição sugere e superestima.
--
-- `STABLE` e não `VOLATILE`: dentro da mesma consulta o resultado não muda, e
-- isso permite ao planejador reaproveitá-la.
CREATE OR REPLACE FUNCTION public.tamanho_dos_exames(p_user_ids uuid[])
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(pg_column_size(image_data)), 0)::bigint
  FROM public.exam_files
  WHERE user_id = ANY(p_user_ids)
    AND image_data IS NOT NULL;
$$;

-- Só a chave de serviço chama — o recorte por paciente do médico é decidido no
-- servidor, e receber a lista de ids do navegador seria deixar qualquer um
-- medir a caixa de outro consultório.
REVOKE ALL ON FUNCTION public.tamanho_dos_exames(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tamanho_dos_exames(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.tamanho_dos_exames(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tamanho_dos_exames(uuid[]) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- CONFERIR
-- ════════════════════════════════════════════════════════════════════════════
--
--   -- o total de todo o banco, em MB (esperado: pequeno hoje)
--   SELECT pg_size_pretty(SUM(pg_column_size(image_data))::bigint)
--     FROM public.exam_files WHERE image_data IS NOT NULL;
--
--   -- e quantos exames existem
--   SELECT count(*) FROM public.exam_files WHERE image_data IS NOT NULL;
--
-- QUANDO MIGRAR PARA STORAGE: quando este número passar de ~1 GB, ou quando os
-- exames passarem de ~500. Antes disso, a migração custa mais que economiza.
