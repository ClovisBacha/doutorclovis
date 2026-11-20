import { useState } from "react";
import { toast } from "sonner";
import { signInWithApple, signInWithGoogle } from "@/lib/google-auth";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/** Botão "Continuar com Google" (login/cadastro via Supabase OAuth). */
export function GoogleButton({
  role,
  label = "Continuar com Google",
}: {
  role: "paciente" | "medico";
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const err = await signInWithGoogle(role);
    if (err) {
      setBusy(false);
      const notEnabled =
        err.message.includes("provider is not enabled") ||
        err.message.includes("Unsupported provider");
      toast.error(
        notEnabled
          ? "Login com Google ainda não foi habilitado. Use o e-mail por enquanto."
          : "Não foi possível iniciar o login com Google. Tente novamente.",
      );
    }
    // Em caso de sucesso o navegador é redirecionado ao Google — nada a resetar.
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className="pill-3d press flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
    >
      <GoogleIcon />
      {busy ? "Redirecionando…" : label}
    </button>
  );
}

/**
 * O logotipo da Apple.
 *
 * ⚠️ **Desenhado, e nunca o emoji nem uma imagem.** A Apple exige o glifo dela
 * nas Human Interface Guidelines do "Sign in with Apple", e um `` sai como
 * quadrado vazio em Android e Windows — que é metade de quem abre este site.
 */
function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M17.05 12.54c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.11 8.76.73 1.06 1.6 2.25 2.75 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.87.69 1.19-.02 1.94-1.08 2.66-2.14.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.34-3.51zM14.86 5.4c.6-.74 1.01-1.75.9-2.77-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.97-.5 2.58-1.24z" />
    </svg>
  );
}

/**
 * Botão "Continuar com a Apple".
 *
 * ⚠️ **Não é enfeite: é requisito de loja.** Pela diretriz 4.8 da App Store, um
 * app que oferece login social de terceiro precisa oferecer o da Apple também —
 * e este app vai para a loja (`IAP_ATIVO` já existe desligado esperando isso).
 * Sem ele, a revisão recusa.
 *
 * ⚠️ E ele avisa quando o provedor ainda não foi habilitado no Supabase, como o
 * do Google: um botão que responde com erro genérico faz a paciente concluir
 * que a conta dela é que tem problema.
 */
export function AppleButton({
  role,
  label = "Continuar com a Apple",
}: {
  role: "paciente" | "medico";
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const err = await signInWithApple(role);
    if (err) {
      setBusy(false);
      const notEnabled =
        err.message.includes("provider is not enabled") ||
        err.message.includes("Unsupported provider");
      toast.error(
        notEnabled
          ? "Login com Apple ainda não foi habilitado. Use o Google ou o e-mail por enquanto."
          : "Não foi possível iniciar o login com a Apple. Tente novamente.",
      );
    }
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className="pill-3d press flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
    >
      <AppleIcon />
      {busy ? "Redirecionando…" : label}
    </button>
  );
}

/** Divisor "ou" entre os botões de conta e o formulário de e-mail. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">ou</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
