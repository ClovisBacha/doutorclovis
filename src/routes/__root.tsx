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
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ChatbotWidget } from "@/components/chatbot-widget";
import { WhatsAppFloating } from "@/components/whatsapp-button";
import { DOCTOR } from "@/lib/doctor.config";
import { Toaster } from "@/components/ui/sonner";
import { ScrollProgress } from "@/components/motion-fx";
import { PublicBottomNav } from "@/components/public-bottom-nav";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Physician",
  name: "Dr. Clóvis Bacha",
  description:
    "Ginecologista e Obstetra especialista em Gestação de Alto Risco. Mais de 20 anos de prática clínica acompanhando gestações de baixo e alto risco.",
  medicalSpecialty: ["https://schema.org/Obstetrics", "https://schema.org/MidwiferyOrWomenSHealth"],
  url: DOCTOR.siteUrl,
  sameAs: [DOCTOR.instagram],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Obstétrica by Dr. Clóvis — App de Saúde Gestacional",
    url: DOCTOR.siteUrl,
  },
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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ocorreu um erro inesperado. Tente novamente ou volte para o início.
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
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Obstétrica by Dr. Clóvis — App de Gestação e Saúde da Mulher" },
      {
        name: "description",
        content:
          "Acompanhe sua gestação semana a semana, converse com IA especializada, agende consultas e muito mais. Desenvolvido com Dr. Clóvis Bacha, especialista em gestação de alto risco.",
      },
      { name: "author", content: "Dr. Clóvis Bacha" },
      { name: "theme-color", content: "#8b5147" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Obstétrica" },
      { property: "og:title", content: "Obstétrica by Dr. Clóvis" },
      {
        property: "og:description",
        content: "O app completo para acompanhar sua gestação com segurança e cuidado.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:url", content: DOCTOR.siteUrl },
      { property: "og:image", content: `${DOCTOR.siteUrl}/og.svg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Obstétrica by Dr. Clóvis" },
      {
        name: "twitter:description",
        content:
          "Acompanhe sua gestação semana a semana com o app desenvolvido pelo Dr. Clóvis Bacha.",
      },
      { name: "twitter:image", content: `${DOCTOR.siteUrl}/og.svg` },
      {
        name: "robots",
        content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "preload",
        as: "style",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap",
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

function useScrollToTop() {
  const { location } = useRouterState();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
}

function SiteShell() {
  useSWRegistration();
  useScrollToTop();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Pular para o conteúdo principal
      </a>
      <CanonicalLink />
      <div className="print:hidden">
        <ScrollProgress />
        <SiteHeader />
      </div>
      <main id="main-content" className="flex-1 pb-[72px] md:pb-0">
        <Outlet />
      </main>
      <div className="print:hidden">
        <SiteFooter />
      </div>
      <div className="print:hidden">
        <ChatbotWidget />
      </div>
      <div className="print:hidden">
        <WhatsAppFloating />
      </div>
      <div className="print:hidden">
        <PublicBottomNav />
      </div>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
