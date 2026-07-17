import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Home, Stethoscope, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { to: "/" as const, icon: Home, label: "Início" },
  { to: "/gestacao" as const, icon: Stethoscope, label: "Gestação" },
  { to: "/agendamento" as const, icon: CalendarDays, label: "Agendar" },
] as const;

/** Barra inferior para visitantes nas páginas públicas. Oculta no /minha-conta. */
export function PublicBottomNav() {
  const { location } = useRouterState();
  // Logada → "App" abre o app direto; visitante → tela de login.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (location.pathname.startsWith("/minha-conta") || location.pathname.startsWith("/painel"))
    return null;

  const appItem = {
    to: signedIn ? ("/minha-conta" as const) : ("/auth" as const),
    icon: User,
    label: "App",
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="print:hidden fixed inset-x-0 bottom-0 z-40 flex md:hidden items-center justify-around border-t border-border/70 bg-background/90 backdrop-blur-xl backdrop-saturate-150"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {[...items, appItem].map(({ to, icon: Icon, label }) => {
        const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors duration-200 ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon
              className={`h-6 w-6 transition-transform duration-300 [transition-timing-function:var(--ease-spring)] ${active ? "scale-110" : "scale-100"}`}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span className={`text-[10px] font-medium ${active ? "text-primary" : ""}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
