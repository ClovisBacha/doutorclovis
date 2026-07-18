import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Convite do médico pela paciente — o gatilho de crescimento:
 * o médico que entrar pelo link dela ganha +15% de desconto em qualquer plano
 * (aplicado no checkout) e, quando ASSINAR, a paciente ganha 1 ANO de Premium
 * grátis (vale ~R$108). Some sozinho se a migração ainda não rodou / sem login.
 *
 * variant:
 *   "card"    → faixa discreta (ex.: topo de "Minha conta").
 *   "hero"    → destaque forte (gatilho quando a busca não acha o médico dela).
 */
export function InviteDoctorCTA({ variant = "card" }: { variant?: "card" | "hero" }) {
  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) return setHidden(true);
        const { getMyDoctorInvite } = await import("@/lib/patientlink.functions");
        const res = await getMyDoctorInvite({ data: { accessToken: s.session.access_token } });
        if (res.ok) setInvite({ code: res.code, link: res.link });
        else setHidden(true);
      } catch {
        setHidden(true);
      }
    })();
  }, []);

  if (hidden || !invite) return null;

  const message = `Oi! Estou usando o app Obstétrica para acompanhar minha gestação e queria muito você lá comigo 💛 Entrando pelo meu link, você ganha 15% de desconto extra em qualquer plano — e eu ganho 1 ano de Premium: ${invite.link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar — selecione e copie manualmente.");
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  if (variant === "hero") {
    return (
      <div className="rounded-3xl border-2 border-emerald-300/70 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-6 text-center shadow-[var(--shadow-card)] dark:from-emerald-950/30 dark:to-teal-950/20">
        <p className="text-4xl">🎁</p>
        <h3 className="mt-2 font-serif text-xl font-semibold text-foreground">
          Não achou o seu médico? Convide-o e ganhe 1 ano de Premium grátis!
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Mande o seu link pessoal para o seu obstetra. Ele ganha <strong>15% de desconto</strong>{" "}
          em qualquer plano e, quando assinar, <strong>você ganha 1 ano do app Premium</strong> — um
          presente de ~R$108.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.03]"
          >
            Convidar no WhatsApp
          </a>
          <button
            onClick={copy}
            className="rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground"
          >
            {copied ? "Copiado ✓" : "Copiar convite"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-emerald-300/60 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🎁</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Seu médico ainda não está aqui? Convide-o!
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pelo seu link, ele ganha <strong>15% de desconto extra</strong> em qualquer plano — e
            quando ele assinar, <strong>você ganha 1 ano de Premium grátis</strong> (vale ~R$108)!
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Convidar no WhatsApp
            </a>
            <button
              onClick={copy}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-foreground"
            >
              {copied ? "Copiado ✓" : "Copiar convite"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
