import { Link } from "@tanstack/react-router";
import { Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AppCtaBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem("cta_banner_dismissed") === "1";
    if (wasDismissed) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setVisible(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setVisible(!s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!visible || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem("cta_banner_dismissed", "1");
    setDismissed(true);
  }

  return (
    // No mobile a PublicBottomNav ocupa o rodapé (h≈64px) — o banner sobe para
    // não cobrir a navegação; no md+ a bottom-nav some e o banner volta ao chão.
    <div className="fixed bottom-[64px] left-0 right-0 z-50 border-t border-primary/20 bg-background/95 backdrop-blur shadow-[0_-4px_24px_rgba(0,0,0,0.08)] safe-area-bottom md:bottom-0">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground leading-tight">
              Salve sua gestação no app
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Acompanhe semana a semana, chat IA, agendamento e muito mais.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to="/auth"
            className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground whitespace-nowrap transition-opacity hover:opacity-90"
          >
            Criar conta grátis
          </Link>
          <button
            onClick={dismiss}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
