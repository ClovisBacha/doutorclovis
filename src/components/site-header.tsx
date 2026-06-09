import { Link } from "@tanstack/react-router";
import { Menu, X, Smartphone, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const navPublic = [
  { to: "/gestacao", label: "Gestação" },
  { to: "/calculadora", label: "Calculadora" },
  { to: "/dpp", label: "DPP" },
  { to: "/batimentos", label: "Batimentos" },
  { to: "/agendamento", label: "Agendamento" },
  { to: "/empresas", label: "Para Empresas" },
] as const;

const navAuth = [
  { to: "/minha-conta", label: "Meu App" },
  { to: "/agendamento", label: "Agendamento" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const nav = signedIn ? navAuth : navPublic;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight text-primary">Obstétrica</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            by Dr. Clóvis
          </span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: false }}
              activeProps={{ className: "text-primary" }}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {n.label}
            </Link>
          ))}
          {signedIn ? (
            <Link
              to="/minha-conta"
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <Smartphone className="h-4 w-4" /> Abrir App
            </Link>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <User className="h-4 w-4" /> Entrar no App
            </Link>
          )}
        </nav>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 text-foreground md:hidden"
          aria-label="Abrir menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-5 py-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-medium text-muted-foreground hover:text-primary"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to={signedIn ? "/minha-conta" : "/auth"}
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {signedIn ? <><Smartphone className="h-4 w-4" /> Abrir App</> : <><User className="h-4 w-4" /> Entrar no App</>}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}