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
      style={{ paddingBottom: "calc(var(--safe-bottom) + 0.75rem)" }}
    >
      <Link
        to={to}
        aria-label={signedIn ? "Abrir meu app" : "Entrar no app"}
        className="shine group relative flex w-full max-w-md items-center justify-center gap-2.5 overflow-hidden rounded-full bg-[image:var(--gradient-primary)] px-6 py-4 text-base font-extrabold text-primary-foreground transition-transform duration-300 [transition-timing-function:var(--ease-spring)] active:scale-[0.97]"
        style={{
          // Acabamento "liquid glass" por cima do gradiente vivo: borda-luz,
          // brilho interno no topo, glow inferior suave e sombra flutuante.
          border: "1px solid rgba(255,255,255,0.42)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -12px 30px -18px rgba(255,255,255,0.30), 0 14px 38px -12px rgba(0,0,0,0.30)",
          backdropFilter: "blur(10px) saturate(160%)",
          WebkitBackdropFilter: "blur(10px) saturate(160%)",
        }}
      >
        {/* Reflexo especular (líquido) atravessando o topo do vidro */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.40), transparent)",
          }}
        />
        <span className="relative z-10 flex items-center gap-2.5">
          <Sparkles className="h-5 w-5" strokeWidth={2.4} />
          {signedIn ? "Abrir meu app" : "Entrar no app"}
          <ArrowRight
            className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2.4}
          />
        </span>
      </Link>
    </div>
  );
}
