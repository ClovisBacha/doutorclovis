-- ============================================================================
-- Foto do medico: bucket publico + a URL na linha
-- ============================================================================

-- ── 12. Foto do medico ──────────────────────────────────────────────────────
-- Um rosto e a maior diferenca isolada entre dois cards num diretorio de saude.
-- Hoje o card mostra a inicial do nome para todo mundo que nao e o fundador.
--
-- A imagem vai para o STORAGE e a coluna guarda so a URL. Guardar base64 na
-- linha seria mais simples e destruiria a busca: ela devolve ate 200 medicos por
-- consulta, e 200 fotos embutidas viram megabytes numa lista.
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS photo_url text;

COMMENT ON COLUMN public.doctors.photo_url IS
  'URL publica da foto no bucket `medicos`. So a URL: a imagem nunca entra na linha.';

GRANT UPDATE (photo_url) ON public.doctors TO authenticated;

-- Bucket publico: a foto aparece no diretorio, que e uma pagina aberta. Nada
-- privado mora aqui — e por isso que ele pode ser publico sem ressalva.
-- Guardado: `storage` e do Supabase. Num Postgres sem ele, uma linha solta
-- abortaria o arquivo inteiro no meio.
DO $foto$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN RETURN; END IF;
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('medicos', 'medicos', true)
  ON CONFLICT (id) DO NOTHING;

  EXECUTE $p$DROP POLICY IF EXISTS "medico escreve a propria foto" ON storage.objects$p$;
  EXECUTE $p$CREATE POLICY "medico escreve a propria foto" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'medicos' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'medicos' AND (storage.foldername(name))[1] = auth.uid()::text)$p$;

  EXECUTE $p$DROP POLICY IF EXISTS "qualquer um le foto de medico" ON storage.objects$p$;
  EXECUTE $p$CREATE POLICY "qualquer um le foto de medico" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'medicos')$p$;
END
$foto$;

