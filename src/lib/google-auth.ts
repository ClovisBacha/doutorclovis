import { supabase } from "@/integrations/supabase/client";

/**
 * Login/cadastro com Google (Supabase OAuth).
 *
 * - Paciente volta para o app (`/minha-conta`).
 * - Médico volta para o cadastro (`/medicos/cadastro`), que roteia direto ao
 *   painel se o perfil profissional já existe, ou mostra a etapa de perfil se
 *   é a primeira vez. Como o e-mail da conta passa a ser o e-mail do Google, as
 *   teleconsultas já caem na Agenda Google do médico automaticamente.
 *
 * Requer o provider Google habilitado no Supabase (ver docs/GOOGLE_LOGIN.md) e
 * as URLs de redirect na allowlist do projeto.
 */
export async function signInWithGoogle(role: "paciente" | "medico"): Promise<Error | null> {
  if (typeof window === "undefined") return null;
  const origin = window.location.origin;
  const redirectTo = role === "medico" ? `${origin}/medicos/cadastro` : `${origin}/minha-conta`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  return error ?? null;
}
