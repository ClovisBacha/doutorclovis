import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/motion-fx";

export const Route = createFileRoute("/mitos")({
  head: () => ({
    meta: [
      { title: "Mitos x Verdades na gestação — Obstétrica" },
      {
        name: "description",
        content: "Desfazendo crenças comuns sobre a gestação com base em evidências científicas.",
      },
    ],
  }),
  component: MitosPage,
});

const cards = [
  {
    afirma: "Grávida não pode pintar o cabelo",
    verdade: false,
    exp: "Tinturas sem amônia podem ser usadas com segurança a partir do 2º trimestre.",
  },
  {
    afirma: "Dor no pé da barriga é sempre normal",
    verdade: false,
    exp: "Pode ser estiramento, mas dor intensa ou persistente precisa ser avaliada imediatamente.",
  },
  {
    afirma: "Posso fazer exercícios na gestação",
    verdade: true,
    exp: "Atividade física regular e supervisionada reduz complicações e melhora o parto.",
  },
  {
    afirma: "Coração acelerado prejudica o bebê",
    verdade: false,
    exp: "É natural o coração materno bater mais rápido — o volume sanguíneo aumenta até 50%.",
  },
  {
    afirma: "Posso voar de avião grávida",
    verdade: true,
    exp: "Sim, até 36 semanas em gestação de baixo risco. Hidrate-se bem durante o voo.",
  },
  {
    afirma: "Azia define se o bebê terá cabelo",
    verdade: false,
    exp: "Pura coincidência. A azia é causada por relaxamento do esfíncter esofágico.",
  },
  {
    afirma: "Cesárea é mais segura que parto normal",
    verdade: false,
    exp: "Cada caso tem sua indicação. Parto normal, quando possível, traz vantagens à mãe e ao bebê.",
  },
  {
    afirma: "Café é totalmente proibido",
    verdade: false,
    exp: "Até 200 mg de cafeína por dia (≈1 xícara) é considerado seguro.",
  },
  {
    afirma: "Devo comer por dois",
    verdade: false,
    exp: "O aumento calórico recomendado é de apenas 300 kcal/dia no 2º e 3º trimestre.",
  },
];

// FAQPage — faz o Google exibir estas perguntas já expandidas no resultado da
// busca ("resultado rico"). Derivado do mesmo array acima para nunca divergir.
const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: cards.map((c) => ({
    "@type": "Question",
    name: `${c.afirma}: mito ou verdade?`,
    acceptedAnswer: {
      "@type": "Answer",
      text: `${c.verdade ? "Verdade" : "Mito"}. ${c.exp}`,
    },
  })),
};

function MitosPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <Reveal variant="blur">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Educativo</p>
      </Reveal>
      <Reveal variant="up" delay={60}>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl">Mitos x Verdades</h1>
      </Reveal>
      <Reveal variant="up" delay={120}>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Crenças populares revisadas à luz da medicina baseada em evidências.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <Reveal key={c.afirma} variant="up" delay={i * 65}>
            <SpotlightCard className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  c.verdade ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                }`}
              >
                {c.verdade ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </div>
              <p className="mt-4 font-serif text-lg text-foreground">"{c.afirma}"</p>
              <p
                className={`mt-2 text-xs font-semibold uppercase tracking-wider ${
                  c.verdade ? "text-primary" : "text-destructive"
                }`}
              >
                {c.verdade ? "Verdade" : "Mito"}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.exp}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
