import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ChatbotWidget } from "@/components/chatbot-widget";
import { DOCTOR } from "@/lib/doctor.config";
import { Toaster } from "@/components/ui/sonner";
import { ScrollProgress } from "@/components/motion-fx";
import { PublicBottomNav } from "@/components/public-bottom-nav";
import { ehPedacoQueSumiu } from "@/lib/pedaco-que-sumiu";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Obstétrica",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  description:
    "App de acompanhamento gestacional: jornada semana a semana, IA obstétrica treinada pelo seu médico, monitoramento de saúde e teleconsulta.",
  url: DOCTOR.siteUrl,
  sameAs: [DOCTOR.instagram],
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
};

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-serif text-8xl text-primary/30">404</p>
        <h1 className="mt-4 font-serif text-2xl text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Recarrega UMA vez por sessão — sem isto, um erro de rede vira laço de F5. */
const CHAVE_RECARGA = "dc-recarreguei-por-pedaco-antigo";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { location } = useRouterState();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  /* ⚠️ **A recarga acontece SOZINHA**, e não atrás de um botão. Quem abriu o
     app não tem por que saber o que é um "pedaço do aplicativo": para ela isso
     é o app não abrir. Uma vez por sessão (`sessionStorage`), porque um erro de
     rede de verdade viraria laço de recarga — e aí a tela de erro, que é o
     último recurso, deixaria de aparecer. */
  useEffect(() => {
    if (typeof window === "undefined" || !ehPedacoQueSumiu(error)) return;
    try {
      if (sessionStorage.getItem(CHAVE_RECARGA)) return;
      sessionStorage.setItem(CHAVE_RECARGA, "1");
    } catch {
      /* modo privado: recarrega assim mesmo, uma vez — o `catch` só impede o
         `sessionStorage` de derrubar a recuperação. */
    }
    window.location.reload();
  }, [error]);

  /**
   * ⚠️ **QUEM ESTAVA NO APP NÃO É DEVOLVIDA AO SITE.**
   *
   * A saída era `href="/"` para todo mundo, e no app instalado isso é a pior
   * coisa que a tela de erro pode fazer: a paciente toca em "voltar" e cai numa
   * página institucional, com cabeçalho, rodapé e botão de "Criar minha conta" —
   * como se o app tivesse desaparecido e ela fosse uma visitante. Pedido do
   * dono, com todas as letras: "não é pra mais voltar para o site".
   *
   * Do app, a saída é o próprio app; se a sessão for o problema, `/auth` é quem
   * resolve, e é para lá que `_authenticated` a mandaria de qualquer forma.
   */
  const noApp =
    location.pathname.startsWith("/minha-conta") || location.pathname.startsWith("/painel");
  const saida = noApp ? "/auth" : "/";

  /* ⚠️ Nome + mensagem + PÁGINA, e a pilha por último. A página é o que diz
     em qual tela aconteceu — sem ela, "TypeError: undefined" não localiza
     nada. A pilha vem no fim porque em produção ela é minificada e vale
     menos que as três primeiras linhas. */
  const detalhe = [
    `${error?.name ?? "Error"}: ${error?.message ?? "(sem mensagem)"}`,
    `em ${location.pathname}`,
    error?.stack ? `\n${error.stack}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-foreground">
          {ehPedacoQueSumiu(error) ? "Atualizando o app…" : "Algo deu errado"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ehPedacoQueSumiu(error)
            ? "Saiu uma versão nova enquanto você estava aqui. Estou recarregando — se não voltar sozinho, toque em Tentar novamente."
            : `Ocorreu um erro inesperado. Tente novamente${
                noApp ? " ou entre de novo na sua conta." : " ou volte para o início."
              }`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Tentar novamente
          </button>
          <a
            href={saida}
            className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {noApp ? "Entrar na minha conta" : "Ir para o início"}
          </a>
        </div>

        {/* ⚠️ **O DETALHE DO ERRO PRECISA SER ALCANÇÁVEL, e não estava.**
            A tela dizia "erro inesperado" e mandava o motivo para o
            `console.error` — que num iPhone, dentro do app instalado, não
            existe para ninguém. Três rodadas de conserto foram gastas
            DEDUZINDO qual era o erro a partir de capturas de tela, porque a
            única testemunha era a paciente e a tela não deixava ela contar.

            Fica RECOLHIDO: quem abre o app não quer ler pilha de execução, e
            um erro cru na cara de uma gestante é ruído assustador. Mas quem
            precisa dele — ela mandando um print para o consultório, o médico
            no painel — alcança em um toque. */}
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-center text-xs text-muted-foreground">
            Ver detalhes do erro
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted/60 p-3 text-[11px] leading-snug text-muted-foreground">
            {detalhe}
          </pre>
          <button
            type="button"
            onClick={() => {
              try {
                void navigator.clipboard?.writeText(detalhe);
              } catch {
                /* sem área de transferência: o texto está aí para ler */
              }
            }}
            className="mt-2 w-full rounded-full border border-border px-4 py-2 text-xs font-medium"
          >
            Copiar
          </button>
        </details>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Obstétrica — App de Gestação e Saúde da Mulher" },
      {
        name: "description",
        content:
          "Acompanhe sua gestação semana a semana, converse com IA especializada, agende consultas e muito mais. Desenvolvido com especialistas em gestação de alto risco.",
      },
      { name: "author", content: "Obstétrica" },
      // Cor da barra do sistema (Android/PWA): terracota no claro; combina com
      // o fundo escuro no modo escuro. O fallback sem media cobre navegadores
      // que não suportam theme-color por media query.
      { name: "theme-color", content: "#a8574a" },
      { name: "theme-color", content: "#0f1115", media: "(prefers-color-scheme: dark)" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Obstétrica" },
      { name: "msapplication-TileColor", content: "#a8574a" },
      { property: "og:title", content: "Obstétrica" },
      {
        property: "og:description",
        content: "O app completo para acompanhar sua gestação com segurança e cuidado.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:url", content: DOCTOR.siteUrl },
      { property: "og:image", content: `${DOCTOR.siteUrl}/og.png` },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Obstétrica" },
      {
        name: "twitter:description",
        content: "Acompanhe sua gestação semana a semana com o app Obstétrica.",
      },
      { name: "twitter:image", content: `${DOCTOR.siteUrl}/og.png` },
      {
        name: "robots",
        content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Nunito:wght@700;800&family=Inter:wght@300;400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Nunito:wght@700;800&family=Inter:wght@300;400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SiteShell />
    </QueryClientProvider>
  );
}

function CanonicalLink() {
  const { location } = useRouterState();
  const canonical = `${DOCTOR.siteUrl}${location.pathname}`;
  return <link rel="canonical" href={canonical} />;
}

function useSWRegistration() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
}

/**
 * Afiliados (influenciadores): qualquer página aberta com ?ref=CODIGO guarda
 * o código por 90 dias — no checkout do Premium ele vira atribuição e comissão.
 * Primeiro código vence (não deixa um link posterior roubar a indicação).
 */
function useAffiliateCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (!ref || !/^[a-zA-Z0-9_-]{3,24}$/.test(ref)) return;
      const KEY = "obst_ref";
      const existing = localStorage.getItem(KEY);
      if (existing) {
        const parsed = JSON.parse(existing) as { code?: string; at?: number };
        if (parsed?.code && Date.now() - (parsed.at ?? 0) < 90 * 86400000) return;
      }
      localStorage.setItem(KEY, JSON.stringify({ code: ref.toUpperCase(), at: Date.now() }));
    } catch {
      /* storage indisponível — sem atribuição */
    }
  }, []);
}

/** Lê o código de afiliado válido (≤90 dias) guardado no navegador. */
export function storedAffiliateCode(): string | null {
  try {
    const raw = localStorage.getItem("obst_ref");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; at?: number };
    if (!parsed?.code || Date.now() - (parsed.at ?? 0) > 90 * 86400000) return null;
    return parsed.code;
  } catch {
    return null;
  }
}

/**
 * Indicação entre pacientes: qualquer página aberta com ?amiga=CODIGO guarda o
 * código por 60 dias — na 1ª visita logada vira a atribuição da indicação.
 * Primeiro código vence (não deixa um link posterior roubar a indicação).
 */
function useReferralCapture() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("amiga");
      if (!code || !/^[a-zA-Z0-9]{3,12}$/.test(code)) return;
      const KEY = "obst_amiga";
      const existing = localStorage.getItem(KEY);
      if (existing) {
        const parsed = JSON.parse(existing) as { code?: string; at?: number };
        if (parsed?.code && Date.now() - (parsed.at ?? 0) < 60 * 86400000) return;
      }
      localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
    } catch {
      /* storage indisponível — sem atribuição */
    }
  }, []);
}

/** Lê o código de indicação de amiga (≤60 dias) guardado no navegador. */
export function storedReferralCode(): string | null {
  try {
    const raw = localStorage.getItem("obst_amiga");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; at?: number };
    if (!parsed?.code || Date.now() - (parsed.at ?? 0) > 60 * 86400000) return null;
    return parsed.code;
  } catch {
    return null;
  }
}

/**
 * Limpa o código da influenciadora depois de atribuído.
 *
 * ⚠️ SÓ QUANDO O SERVIDOR CONFIRMA que não precisa repetir. Ele é o único
 * rastro da indicação até a paciente confirmar o e-mail e o perfil existir —
 * apagar antes disso faz a influenciadora perder a venda em silêncio, e a
 * paciente perder o bônus sem nunca saber que havia um.
 */
export function clearStoredAffiliateCode(): void {
  try {
    localStorage.removeItem("obst_ref");
  } catch {
    /* ignore */
  }
}

/** Limpa o código de indicação após a atribuição (evita re-tentar sempre). */
export function clearStoredReferralCode(): void {
  try {
    localStorage.removeItem("obst_amiga");
  } catch {
    /* ignore */
  }
}

// Captura o evento beforeinstallprompt para mostrar banner customizado depois
let deferredInstallPrompt: Event | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent("pwa-installable"));
  });
}

export function triggerPWAInstall() {
  if (!deferredInstallPrompt) return false;
  (deferredInstallPrompt as BeforeInstallPromptEvent).prompt();
  deferredInstallPrompt = null;
  return true;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

function useScrollToTop() {
  const { location } = useRouterState();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
}

function SiteShell() {
  useSWRegistration();
  useAffiliateCapture();
  useReferralCapture();
  useScrollToTop();
  const { location } = useRouterState();
  /* O app da paciente e o painel do médico têm cabeçalho, navegação e rodapé
     próprios. O shell público por cima disso empilhava duas marcas e dois ☰:
     a paciente via a faixa "Obstetrica" com o menu do SITE logo acima do menu
     do APP, dentro da própria tela do bebê.
     A barra pública, o chatbot e o WhatsApp já se escondiam sozinhos aqui —
     cabeçalho e rodapé eram os dois que faltavam. A regra passa a morar num
     lugar só, em vez de repetida dentro de cada componente. */
  const semChromePublico =
    location.pathname.startsWith("/minha-conta") || location.pathname.startsWith("/painel");
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Pular para o conteúdo principal
      </a>
      <CanonicalLink />
      {!semChromePublico && (
        <div className="chrome-publico print:hidden">
          <ScrollProgress />
          <SiteHeader />
        </div>
      )}
      <main id="main-content" className="flex-1 pb-[72px] md:pb-0">
        <Outlet />
      </main>
      {!semChromePublico && (
        <div className="chrome-publico print:hidden">
          <SiteFooter />
        </div>
      )}
      <div className="chrome-publico print:hidden">
        <ChatbotWidget />
      </div>
      <div className="print:hidden">
        {/* O botão flutuante de WhatsApp saiu.
            Ele levava TODO visitante da plataforma para o número pessoal de um
            médico específico, cravado no código — numa página onde a paciente
            deveria estar escolhendo o obstetra dela no diretório. Além disso,
            a medição no iPhone mostrou o botão inteiramente atrás do banner de
            instalação: inclicável desde sempre. O contato de cada médico vive
            no perfil dele. */}
      </div>
      <div className="chrome-publico print:hidden">
        <PublicBottomNav />
      </div>
      <Toaster position="bottom-right" richColors mobileOffset={{ bottom: 96 }} />
      <PWAInstallBanner />
    </div>
  );
}

function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Só mostra uma vez
    if (localStorage.getItem("pwa-banner-dismissed")) return;

    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(navigator as unknown as { standalone?: boolean }).standalone;
    const isAndroid = window.matchMedia("(max-width: 768px)").matches && !ios;

    if (ios) {
      // iOS: mostra instruções de "Adicionar à Tela Inicial"
      setIsIOS(true);
      const t = setTimeout(() => setVisible(true), 4000);
      return () => clearTimeout(t);
    }

    if (isAndroid) {
      // Android: espera o beforeinstallprompt
      const handler = () => {
        const t = setTimeout(() => setVisible(true), 3000);
        return () => clearTimeout(t);
      };
      window.addEventListener("pwa-installable", handler, { once: true });
      return () => window.removeEventListener("pwa-installable", handler);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem("pwa-banner-dismissed", "1");
  };

  const install = () => {
    if (!isIOS) triggerPWAInstall();
    dismiss();
  };

  if (!visible) return null;

  /**
   * O banner sobe para cima da barra "Entrar no app" em vez de flutuar sobre
   * o conteúdo.
   *
   * A medição no iPhone mostrou três camadas fixas ocupando de 678 a 844 —
   * 19,7% da tela, permanentemente. O botão do WhatsApp ficava INTEIRO atrás
   * deste banner, inclicável, e a legenda do hero era cortada ao meio. Ao
   * longo da rolagem o par decapitava títulos e um CTA por completo.
   */
  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-sm animate-[slideUp_0.4s_ease-out] rounded-2xl bg-primary p-4 shadow-[0_8px_32px_rgba(0,0,0,0.25)] md:bottom-6">
      <div className="flex items-start gap-3">
        <img
          src="/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-xl"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary-foreground">Instalar o app</p>
          {isIOS ? (
            <p className="mt-0.5 text-xs text-primary-foreground/80">
              Toque em <strong>compartilhar</strong> ↑ e depois em{" "}
              <strong>"Adicionar à Tela Início"</strong>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-primary-foreground/80">
              Acesse o Obstétrica diretamente da tela inicial, como um app nativo.
            </p>
          )}
          {!isIOS && (
            <button
              onClick={install}
              className="mt-2 rounded-full bg-primary-foreground px-4 py-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-90"
            >
              Instalar agora
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="shrink-0 text-primary-foreground/60 hover:text-primary-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
