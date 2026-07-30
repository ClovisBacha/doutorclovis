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
  /* `?papel=medico` na volta do Google.
     
     O OAuth não deixa gravar `user_metadata` no momento do cadastro, e é esse
     metadata que separa a conta de médico da de gestante. Sem nenhuma pista,
     quem entrasse por aqui viraria uma gestante aos olhos do app — o mesmo bug
     do cadastro por e-mail, por outra porta.
     
     O parâmetro é a pista, e ela é explícita: só existe quando a pessoa clicou
     em "sou médico". Marcar o papel só porque alguém ABRIU /medicos/cadastro
     seria pior — tiraria o app da gestante de qualquer paciente curiosa. */
  const redirectTo =
    role === "medico" ? `${origin}/medicos/cadastro?papel=medico` : `${origin}/minha-conta`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  return error ?? null;
}
