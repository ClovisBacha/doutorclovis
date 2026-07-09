import { Link } from "@tanstack/react-router";
import { Menu, X, Smartphone, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-obstetrica.png";
import logoWhite from "@/assets/logo-obstetrica-white.png";
import { useHeroDark } from "@/components/hero-theme";

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

  const heroDark = useHeroDark();
  // Logo branca só quando o header está TRANSPARENTE sobre um hero escuro;
  // ao rolar (fundo claro) ou fora do hero escuro → logo rosa.
  const overDark = heroDark && !scrolled;

  const nav = signedIn ? navAuth : navPublic;
  // Navegação dividida à esquerda/direita da logo centralizada
  const half = Math.ceil(nav.length / 2);
  const leftNav = nav.slice(0, half);
  const rightNav = nav.slice(half);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] ${
        scrolled
          ? "border-b border-border/60 bg-background/70 shadow-[0_1px_24px_-12px_oklch(0.4_0.08_18/0.25)] backdrop-blur-xl backdrop-saturate-150"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        {/* Esquerda: hambúrguer (mobile) + 1ª metade da navegação (desktop) */}
        <div className="flex items-center gap-6">
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
          <nav className="hidden items-center gap-6 md:flex">
            {leftNav.map((n) => (
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
          </nav>
        </div>

        {/* Logo centralizada (desktop e celular) — troca inteligente:
            branca sobre o hero escuro (topo/noite), rosa nos demais casos. */}
        <Link
          to="/"
          aria-label="Obstétrica — página inicial"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300 hover:opacity-80"
        >
          <span className="relative block h-8 md:h-9">
            <img
              src={logo}
              alt="Obstétrica — Excelência no atendimento à gestante"
              className={`h-8 w-auto md:h-9 [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.16))] transition-opacity duration-500 ${
                overDark ? "opacity-0" : "opacity-100"
              }`}
            />
            <img
              src={logoWhite}
              alt=""
              aria-hidden
              className={`absolute inset-0 h-8 w-auto md:h-9 [filter:drop-shadow(0_1px_3px_rgb(0_0_0/0.28))] transition-opacity duration-500 ${
                overDark ? "opacity-100" : "opacity-0"
              }`}
            />
          </span>
        </Link>

        {/* Direita: 2ª metade da navegação + CTA (desktop) / espaçador (mobile) */}
        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-6 md:flex">
            {rightNav.map((n) => (
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
          </nav>
          <Link
            to={signedIn ? "/minha-conta" : "/auth"}
            className="press hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:shadow-[var(--shadow-soft)] md:flex"
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
          {/* espaçador direito no mobile — equilibra o hambúrguer da esquerda */}
          <div className="w-9 md:hidden" aria-hidden />
        </div>
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
