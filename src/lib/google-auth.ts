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
  return entrarComProvedor("google", role);
}

/**
 * ENTRAR COM A CONTA DA APPLE.
 *
 * ⚠️ **Uma função só para os dois, e não uma cópia.** O que faz o Google
 * funcionar aqui não é o nome do provedor: é a URL LIMPA (sem query string,
 * senão a allowlist do Supabase recusa em silêncio e devolve a pessoa na home)
 * e a intenção "sou médico" gravada no aparelho ANTES de sair. Uma segunda
 * cópia perderia uma das duas na primeira manutenção — e o sintoma seria o
 * médico entrando e aparecendo no app da gestante, sem erro nenhum na tela.
 *
 * ⚠️ **E ela é obrigatória, não enfeite.** Pela diretriz 4.8 da App Store, um
 * app que oferece login social de terceiro tem de oferecer "Sign in with Apple"
 * também. Sem isso, o app é recusado na revisão — e este app vai para a loja.
 *
 * Como ligar o provedor no Supabase: `docs/APPLE_LOGIN.md`. O segredo que ele
 * pede é um JWT que vence em seis meses — `scripts/segredo-apple.mjs` gera.
 */
export async function signInWithApple(role: "paciente" | "medico"): Promise<Error | null> {
  return entrarComProvedor("apple", role);
}

async function entrarComProvedor(
  provider: "google" | "apple",
  role: "paciente" | "medico",
): Promise<Error | null> {
  if (typeof window === "undefined") return null;
  const origin = window.location.origin;
  /* A intenção é gravada ANTES de sair para o Google: é o único momento em que
     temos certeza do que a pessoa escolheu, e ela precisa sobreviver à ida e
     volta — inclusive se o Supabase recusar o `redirectTo` e devolver na home. */
  try {
    const { INTENCAO_MEDICO, esquecerIntencaoMedico } = await import("@/lib/intencao-medico");
    if (role === "medico") localStorage.setItem(INTENCAO_MEDICO, String(Date.now()));
    else esquecerIntencaoMedico();
  } catch {
    /* sem storage: o `redirectTo` ainda leva ao lugar certo */
  }
  /* URL LIMPA, sem query string. Isso não é estética — é o que faz o Supabase
     aceitar o redirecionamento.

     A allowlist de "Redirect URLs" do Supabase compara a URL inteira, e uma
     entrada sem curinga casa de forma exata. `.../medicos/cadastro?papel=medico`
     NÃO casa com a entrada `.../medicos/cadastro` que está cadastrada — e
     quando o `redirectTo` é recusado o Supabase não avisa: ele manda a pessoa
     para a Site URL do projeto, que é a home. O médico entrava com o Google e
     aparecia no app da gestante sem nenhum erro na tela.

     A pista de "sou médico" não precisa mais viajar na URL: ela é gravada no
     aparelho (`lib/intencao-medico.ts`) antes de sair para o Google e ainda
     está lá quando ele volta. Uma pista que não depende de configuração de
     terceiro é melhor que uma que depende. */
  const redirectTo = role === "medico" ? `${origin}/medicos/cadastro` : `${origin}/minha-conta`;
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  return error ?? null;
}
