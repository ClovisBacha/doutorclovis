import { useState } from "react";
import { toast } from "sonner";
import { signInWithGoogle } from "@/lib/google-auth";

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
      className="flex w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
    >
      <GoogleIcon />
      {busy ? "Redirecionando…" : label}
    </button>
  );
}

/** Divisor "ou" entre o botão do Google e o formulário de e-mail. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">ou</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
