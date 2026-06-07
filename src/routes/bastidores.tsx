import { createFileRoute, Link } from "@tanstack/react-router";
import bastidores from "@/assets/bastidores.jpg";
import { Activity, Baby, Brain, HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/bastidores")({
  head: () => ({
    meta: [
      { title: "Gestação de Alto Risco — O trabalho do Dr. Clóvis" },
      { name: "description", content: "Como funciona o acompanhamento de gestações de alto risco: protocolos, exames, equipe e bastidores do consultório." },
      { property: "og:title", content: "Bastidores — Gestação de Alto Risco" },
      { property: "og:description", content: "Como funciona, na prática, o cuidado em gestações complexas." },
    ],
  }),
  component: BastidoresPage,
});

const condicoes = [
  { icon: Activity, title: "Hipertensão gestacional", text: "Monitoramento contínuo da pressão e prevenção de pré-eclâmpsia." },
  { icon: Baby, title: "Diabetes gestacional", text: "Controle glicêmico, plano alimentar individual e ajuste de protocolo." },
  { icon: Brain, title: "Malformações fetais", text: "Avaliação ecográfica especializada e plano multidisciplinar." },
  { icon: HeartHandshake, title: "Gemelares e prematuridade", text: "Vigilância semanal e suporte para reduzir riscos do parto pré-termo." },
];

function BastidoresPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Bastidores</p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl md:text-5xl">
          O cuidado por trás de uma gestação de alto risco.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Cada paciente recebe um plano único. Conheça os bastidores do consultório, os protocolos que orientam as decisões clínicas e por que o acompanhamento próximo faz diferença.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 md:grid-cols-2">
        <img src={bastidores} alt="Médico revisando ultrassom" loading="lazy" width={1400} height={1000} className="aspect-[5/4] w-full rounded-[2rem] object-cover shadow-[var(--shadow-card)]" />
        <div>
          <h2 className="font-serif text-3xl">Quando uma gestação é considerada de alto risco?</h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Sempre que existem fatores que aumentam a chance de complicações para a mãe ou para o bebê — idade materna, doenças prévias, intercorrências em gestações anteriores, condições do bebê, entre outras. O acompanhamento próximo, com exames e ajustes frequentes, reduz substancialmente os riscos.
          </p>
        </div>
      </section>

      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-serif text-3xl">Principais condições acompanhadas</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {condicoes.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <Icon className="h-7 w-7 text-primary" />
                <p className="mt-4 font-serif text-xl">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-serif text-3xl">Como funciona o acompanhamento</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            { n: "01", t: "Avaliação inicial", d: "Conversa cuidadosa, histórico clínico e exames de base." },
            { n: "02", t: "Plano individual", d: "Frequência de consultas, exames e cuidados adaptados ao seu caso." },
            { n: "03", t: "Acompanhamento contínuo", d: "Equipe disponível para dúvidas, ajustes e suporte até o pós-parto." },
          ].map((s) => (
            <li key={s.n} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <span className="font-serif text-3xl text-primary">{s.n}</span>
              <p className="mt-3 font-serif text-xl">{s.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Link to="/agendamento" className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90">
            Quero ser acompanhada
          </Link>
        </div>
      </section>
    </>
  );
}