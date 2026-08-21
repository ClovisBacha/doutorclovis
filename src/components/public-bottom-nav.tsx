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

  /* As BANCADAS (`/preview-*`) existem para fotografar pedaços do app fora do
     login, e esta barra pousava por cima do que elas fotografam — foi ela que
     cobriu a navbar na bancada do tutorial. São telas `noindex` de desenho:
     um convite para entrar no app não tem o que fazer ali. */
  /* ⚠️ **`/auth` TAMBÉM**, e este era um defeito aberto documentado no
     CLAUDE.md: a barra pousava por cima do botão "Entrar" da própria tela de
     login. Medido em 393px — o flutuante cobre o submit inteiro. E o texto
     piorava: "Entrar no app", em cima do formulário onde ela está tentando
     exatamente isso, é o app oferecendo o que a tela já é. */
  /* ⚠️ **`/p/` TAMBÉM FICA DE FORA, e este é o defeito de `indicacao.ts`
     reintroduzido na superfície mais nova.**

     A vitrine pública (`/p/<codigo>`) é a única página do app em que o código
     de indicação chega pelo CAMINHO, e não por `?amiga=`/`?ref=` — e as três
     capturas do app (`useReferralCapture`, `useAffiliateCapture` e a faixa)
     leem só a QUERY. Ou seja: abrir `/p/MARINA` não guarda código nenhum.

     Com a barra desenhada por cima, o CTA visualmente dominante da tela (um
     botão gradiente de largura inteira, e só no celular, que é exatamente onde
     um link do WhatsApp abre) apontava para `/auth` PURO. A amiga criava a
     conta, `referred_by` ficava nulo, e ela não aparecia na lista de Amigas, não
     dava para formar dupla nem presentear, e as 100 🌱 não eram pagas a
     ninguém — em silêncio, semanas depois, sem nada a que apontar.

     É palavra por palavra o que o cabeçalho de `indicacao.ts` descreve: "o
     botão da tela cujo assunto inteiro é trazer alguém era o único caminho do
     app que NÃO trazia".

     ⚠️ A página não fica sem convite: o `ConviteDoApp` do pé leva
     `linkDeIndicacao(codigo)`, que carrega a indicação. O que sai é o atalho
     que a perdia. */
  if (
    location.pathname.startsWith("/minha-conta") ||
    location.pathname.startsWith("/painel") ||
    location.pathname.startsWith("/auth") ||
    location.pathname.startsWith("/p/") ||
    location.pathname.startsWith("/preview-")
  )
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
