import { Link } from "@tanstack/react-router";
import { Menu, X, MessageCircle, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WHATSAPP_URL } from "@/components/whatsapp-button";

const nav = [
  { to: "/", label: "Início" },
  { to: "/sobre", label: "Sobre" },
  { to: "/gestacao", label: "Gestação" },
  { to: "/calculadora", label: "Calculadora" },
  { to: "/dpp", label: "DPP" },
  { to: "/batimentos", label: "Batimentos" },
  { to: "/modo-acompanhante", label: "Acompanhante" },
  { to: "/lives", label: "Lives" },
  { to: "/mural", label: "Mural" },
  { to: "/depoimentos", label: "Depoimentos" },
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
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight text-primary">Dr. Clóvis Bacha</span>
          <span className="hidden text-xs uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            Ginecologia · Obstetrícia
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              activeProps={{ className: "text-primary" }}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {n.label}
            </Link>
          ))}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium text-[#128C7E] hover:opacity-80"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
          <Link
            to="/agendamento"
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Marcar consulta
          </Link>
          <Link
            to={signedIn ? "/minha-conta" : "/auth"}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
          >
            <User className="h-4 w-4" /> {signedIn ? "Minha conta" : "Entrar"}
          </Link>
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
          </div>
        </div>
      )}
    </header>
  );
}