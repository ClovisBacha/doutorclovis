-- Consistência do gate de verificação (C2): a busca de médicos DENTRO da conta
-- (minha-conta → RPC search_doctors) precisa esconder médicos não verificados,
-- igual à vitrine pública (/encontrar-medico, que já filtra verified no server).
-- Sem isso, uma paciente logada poderia encontrar e solicitar vínculo a um
-- médico ainda não verificado, furando o selo.
--
-- Re-define a função (idempotente) adicionando `AND d.verified = true`. Precisa
-- rodar DEPOIS de 20260713020000 (que cria a coluna doctors.verified).

CREATE OR REPLACE FUNCTION public.search_doctors(p_query text)
RETURNS TABLE (
  id           uuid,
  display_name text,
  title        text,
  specialty    text,
  slug         text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.display_name, d.title, d.specialty, d.slug
  FROM public.doctors d
  WHERE d.active = true
    AND d.accepting_patients = true
    AND d.verified = true
    AND d.display_name <> ''
    AND (
      p_query = ''
      OR d.display_name ILIKE '%' || p_query || '%'
      OR d.specialty   ILIKE '%' || p_query || '%'
      OR d.title       ILIKE '%' || p_query || '%'
    )
  ORDER BY d.display_name
  LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.search_doctors(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_doctors(text) TO authenticated, service_role;
