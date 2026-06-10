import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Baby, HeartPulse, Stethoscope } from "lucide-react";
import { AppCtaBanner } from "@/components/app-cta-banner";
import { DOCTOR } from "@/lib/doctor.config";
import { Reveal } from "@/components/reveal";
import { SpotlightCard, Magnetic } from "@/components/motion-fx";

export const Route = createFileRoute("/gestacao")({
  head: () => {
    return {
      meta: [
        { title: "Sua gestação semana a semana — Obstétrica by Dr. Clóvis" },
        {
          name: "description",
          content:
            "Linha do tempo da gestação e conteúdo educativo por trimestre, com orientação especializada do Dr. Clóvis Bacha.",
        },
        { property: "og:title", content: "Sua gestação semana a semana" },
        { property: "og:description", content: "Linha do tempo e conteúdo por trimestre." },
      ],
    };
  },
  component: GestacaoPage,
});

const semanas = [
  {
    sem: "4–8",
    titulo: "Confirmação e primeiros exames",
    texto: "Beta-hCG, ultrassom transvaginal e início do ácido fólico.",
  },
  {
    sem: "9–13",
    titulo: "1º trimestre — translucência nucal",
    texto: "Avaliação morfológica precoce e rastreio de cromossomopatias.",
  },
  {
    sem: "14–20",
    titulo: "Início do 2º trimestre",
    texto: "Sexagem, exames laboratoriais e acompanhamento de pressão e glicemia.",
  },
  {
    sem: "20–24",
    titulo: "Morfológico de 2º trimestre",
    texto: "Avaliação detalhada da anatomia fetal e do colo uterino.",
  },
  {
    sem: "24–28",
    titulo: "Teste de tolerância à glicose",
    texto: "Rastreamento de diabetes gestacional e ajuste nutricional.",
  },
  {
    sem: "28–34",
    titulo: "Acompanhamento intensivo",
    texto: "Ultrassom de crescimento, dopplervelocimetria quando indicado.",
  },
  {
    sem: "34–37",
    titulo: "Preparação para o parto",
    texto: "Plano de parto, avaliação de via de parto e maturidade fetal.",
  },
  {
    sem: "37–40+",
    titulo: "Termo e nascimento",
    texto: "Monitorização semanal, cardiotocografia e definição da indução se necessário.",
  },
];

const trimestres = [
  {
    nome: "1º Trimestre",
    icon: HeartPulse,
    bullets: [
      "Náuseas e cansaço: o que é normal e o que merece avaliação",
      "Alimentação, suplementação e atividade física segura",
      "Riscos comuns e quando procurar atendimento imediato",
    ],
  },
  {
    nome: "2º Trimestre",
    icon: Stethoscope,
    bullets: [
      "Exames morfológicos e o que eles revelam",
      "Diabetes gestacional: prevenção e manejo",
      "Saúde emocional e preparação para a chegada do bebê",
    ],
  },
  {
    nome: "3º Trimestre",
    icon: Baby,
    bullets: [
      "Sinais de trabalho de parto e quando ir para a maternidade",
      "Plano de parto: o que decidir com seu médico",
      "Pós-parto: amamentação, recuperação e cuidados imediatos",
    ],
  },
];

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: DOCTOR.siteUrl },
    {
      "@type": "ListItem",
      position: 2,
      name: "Gestação semana a semana",
      item: `${DOCTOR.siteUrl}/gestacao`,
    },
  ],
};

function GestacaoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <Reveal variant="blur">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Sua gestação
          </p>
        </Reveal>
        <Reveal variant="up" delay={60}>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">
            Da concepção ao parto, semana a semana.
          </h1>
        </Reveal>
        <Reveal variant="up" delay={120}>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Um guia visual com os principais marcos e exames de uma gestação acompanhada. Cada caso
            é único — esta linha do tempo é informativa e não substitui a avaliação clínica.
          </p>
        </Reveal>
      </section>

      {/* Linha do tempo */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Reveal variant="up">
            <h2 className="font-serif text-3xl">Linha do tempo</h2>
          </Reveal>
          <ol className="mt-10 space-y-6">
            {semanas.map((s, i) => (
              <Reveal key={s.sem} variant="left" delay={i * 55}>
                <li className="grid gap-3 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:grid-cols-[140px_1fr]">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Semanas
                    </p>
                    <p className="font-serif text-3xl text-primary">{s.sem}</p>
                  </div>
                  <div>
                    <p className="font-serif text-xl text-foreground">{s.titulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.texto}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Conteúdo por trimestre */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal variant="up">
          <h2 className="font-serif text-3xl">Conteúdo por trimestre</h2>
        </Reveal>
        <Reveal variant="up" delay={60}>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Conteúdo educativo curado pelo Dr. Clóvis para cada fase da gestação.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {trimestres.map(({ nome, icon: Icon, bullets }, i) => (
            <Reveal key={nome} variant="up" delay={i * 100}>
              <SpotlightCard className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <Icon className="h-7 w-7 text-primary" />
                <h3 className="mt-3 font-serif text-2xl">{nome}</h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  {bullets.map((b) => (
                    <li key={b} className="border-l-2 border-primary/40 pl-3">
                      {b}
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>

        <Reveal variant="up" delay={200}>
          <div className="mt-12 rounded-2xl bg-[var(--gradient-warm)] p-8 text-center">
            <p className="font-serif text-2xl text-foreground">Quer conversar sobre a sua fase?</p>
            <Magnetic>
              <Link
                to="/agendamento"
                className="press mt-4 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
              >
                Agendar consulta
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </section>

      <AppCtaBanner />
    </>
  );
}
