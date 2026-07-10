import { createFileRoute } from "@tanstack/react-router";
import { Quote, Star } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/motion-fx";

export const Route = createFileRoute("/depoimentos")({
  head: () => ({
    meta: [
      { title: "Depoimentos de pacientes — Obstétrica" },
      {
        name: "description",
        content:
          "Relatos reais de pacientes acompanhadas pelo Dr. Clóvis Bacha em gestações de alto risco.",
      },
      { property: "og:title", content: "Depoimentos — Obstétrica" },
      {
        property: "og:description",
        content: "Experiências de pacientes durante o pré-natal e a gestação de alto risco.",
      },
    ],
  }),
  component: DepoimentosPage,
});

const reviews = [
  {
    name: "Marina S.",
    city: "Belo Horizonte · MG",
    text: "Tive pré-eclâmpsia na primeira gestação. O Dr. Clóvis me acompanhou semanalmente, com calma e firmeza. Cheguei ao parto segura e meu bebê nasceu bem.",
  },
  {
    name: "Juliana R.",
    city: "São Paulo · SP",
    text: "Gestação gemelar, com muito medo. O doutor me explicava cada exame com paciência. A escuta dele faz a diferença que qualquer mãe precisa.",
  },
  {
    name: "Ana Carolina M.",
    city: "Rio de Janeiro · RJ",
    text: "Diabetes gestacional descoberta tarde. Em duas semanas com o protocolo do Dr. Clóvis estávamos com tudo sob controle. Profissional excepcional.",
  },
  {
    name: "Fernanda L.",
    city: "Curitiba · PR",
    text: "Já indiquei para várias amigas. Atendimento humano de verdade, sem pressa e sem rodeios — exatamente o que esperamos de um médico.",
  },
  {
    name: "Camila T.",
    city: "Salvador · BA",
    text: "Após uma perda, voltei a engravidar com receio. O acolhimento foi essencial. Hoje tenho um menino lindo e saudável.",
  },
  {
    name: "Patrícia A.",
    city: "Goiânia · GO",
    text: "Equipe sempre disponível, respostas rápidas, exames acompanhados pelo próprio doutor. Recomendo sem reservas.",
  },
];

function DepoimentosPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <Reveal variant="blur">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Depoimentos
          </p>
        </Reveal>
        <Reveal variant="up" delay={60}>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl md:text-5xl">
            Histórias reais de quem foi acompanhada.
          </h1>
        </Reveal>
        <Reveal variant="up" delay={120}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Cada gestação é única — e cada depoimento abaixo é de uma paciente que confiou no Dr.
            Clóvis em momentos delicados.
          </p>
        </Reveal>
      </section>

      {/* Cards */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal key={r.name} variant="up" delay={i * 80}>
              <SpotlightCard className="relative flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <Quote className="h-7 w-7 text-primary/40" />
                <p className="mt-3 flex-1 text-base leading-relaxed text-foreground">"{r.text}"</p>
                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                  <div>
                    <p className="font-serif text-lg text-primary">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.city}</p>
                  </div>
                  <div className="flex gap-0.5 text-primary">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
