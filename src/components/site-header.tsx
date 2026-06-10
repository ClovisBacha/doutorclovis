import { Link } from "@tanstack/react-router";
import { Menu, X, Smartphone, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const navPublic = [
  { to: "/gestacao", label: "Gestação" },
  { to: "/dpp", label: "DPP" },
  { to: "/batimentos", label: "Batimentos" },
  { to: "/agendamento", label: "Agendar" },
  { to: "/medicos", label: "Para Médicos" },
] as const;

const navAuth = [
  { to: "/minha-conta", label: "Meu App" },
  { to: "/agendamento", label: "Agendamento" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const nav = signedIn ? navAuth : navPublic;

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] ${
        scrolled
          ? "border-b border-border/60 bg-background/70 shadow-[0_1px_24px_-12px_oklch(0.4_0.08_18/0.25)] backdrop-blur-xl backdrop-saturate-150"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="group flex items-baseline gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight text-primary transition-opacity duration-300 group-hover:opacity-80">
            Obstétrica
          </span>
          <span className="hidden text-xs text-muted-foreground sm:inline">by Dr. Clóvis</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: false }}
              activeProps={{ className: "text-primary" }}
              className="nav-link text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-primary"
            >
              {n.label}
            </Link>
          ))}
          <Link
            to={signedIn ? "/minha-conta" : "/auth"}
            className="press flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:shadow-[var(--shadow-soft)]"
          >
            {signedIn ? (
              <>
                <Smartphone className="h-4 w-4" /> Abrir App
              </>
            ) : (
              <>
                <User className="h-4 w-4" /> Entrar no App
              </>
            )}
          </Link>
        </nav>
        <button
          onClick={() => setOpen((o) => !o)}
          className="press relative rounded-md p-2 text-foreground md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          <span className="relative block h-5 w-5">
            <Menu
              className={`absolute inset-0 h-5 w-5 transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] ${
                open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <X
              className={`absolute inset-0 h-5 w-5 transition-all duration-300 [transition-timing-function:var(--ease-out-expo)] ${
                open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
              }`}
            />
          </span>
        </button>
      </div>

      {/* Menu mobile — altura animada via grid-template-rows */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 [transition-timing-function:var(--ease-out-expo)] md:hidden ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/60 bg-background/90 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl flex-col px-5 py-3">
              {nav.map((n, i) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  style={{ transitionDelay: open ? `${60 + i * 40}ms` : "0ms" }}
                  className={`py-2 text-sm font-medium text-muted-foreground transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] hover:text-primary ${
                    open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
              <Link
                to={signedIn ? "/minha-conta" : "/auth"}
                onClick={() => setOpen(false)}
                style={{ transitionDelay: open ? `${60 + nav.length * 40}ms` : "0ms" }}
                className={`press mt-2 mb-1 flex items-center gap-1.5 self-start rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] ${
                  open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                }`}
              >
                {signedIn ? (
                  <>
                    <Smartphone className="h-4 w-4" /> Abrir App
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4" /> Entrar no App
                  </>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
