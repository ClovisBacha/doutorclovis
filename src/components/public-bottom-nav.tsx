import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Barra inferior das páginas públicas: um único botão grande e chamativo para
 * entrar no app. Oculta dentro do app (/minha-conta) e no painel (/painel).
 */
export function PublicBottomNav() {
  const { location } = useRouterState();
  // Logada → abre o app direto; visitante → tela de login.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (location.pathname.startsWith("/minha-conta") || location.pathname.startsWith("/painel"))
    return null;

  const to = signedIn ? ("/minha-conta" as const) : ("/auth" as const);

  return (
    <div
      className="print:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pt-2 md:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <Link
        to={to}
        aria-label={signedIn ? "Abrir meu app" : "Entrar no app"}
        className="shine group flex w-full max-w-md items-center justify-center gap-2.5 rounded-full bg-[image:var(--gradient-primary)] px-6 py-4 text-base font-extrabold text-primary-foreground shadow-[0_12px_34px_rgba(0,0,0,0.20)] transition-transform duration-300 [transition-timing-function:var(--ease-spring)] active:scale-[0.97]"
      >
        <Sparkles className="h-5 w-5" strokeWidth={2.4} />
        {signedIn ? "Abrir meu app" : "Entrar no app"}
        <ArrowRight
          className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
          strokeWidth={2.4}
        />
      </Link>
    </div>
  );
}
