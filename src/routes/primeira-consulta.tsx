import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Clock, FileText, MessageCircle, Shield } from "lucide-react";
import { Reveal } from "@/components/reveal";
import { SpotlightCard, Magnetic } from "@/components/motion-fx";

export const Route = createFileRoute("/primeira-consulta")({
  head: () => {
    return {
      meta: [
        { title: "Primeira consulta — o que esperar | Dr. Clóvis Bacha" },
        {
          name: "description",
          content:
            "Guia passo a passo da sua primeira consulta com o Dr. Clóvis Bacha: o que levar, duração, e como funciona o acolhimento.",
        },
        { property: "og:title", content: "Primeira consulta — o que esperar" },
        { property: "og:description", content: "Guia passo a passo da sua primeira visita." },
      ],
    };
  },
  component: PrimeiraConsultaPage,
});

const passos = [
  {
    num: "01",
    titulo: "Acolhimento",
    texto: "Você é recebida pela equipe, sem pressa. Café, água e ambiente calmo enquanto aguarda.",
  },
  {
    num: "02",
    titulo: "Conversa inicial",
    texto:
      "Conversamos sobre seu histórico, suas dúvidas e seus objetivos antes de qualquer exame.",
  },
  {
    num: "03",
    titulo: "Exame clínico",
    texto: "Avaliação ginecológica e obstétrica com explicação de cada passo.",
  },
  {
    num: "04",
    titulo: "Ultrassonografia",
    texto: "Quando indicada, realizada no próprio consultório com imagens compartilhadas com você.",
  },
  {
    num: "05",
    titulo: "Plano de cuidado",
    texto:
      "Saímos juntos com um plano claro: exames, próxima consulta e o canal direto com a equipe.",
  },
];

const trazer = [
  "Documento de identidade e carteirinha do convênio (se houver)",
  "Exames anteriores recentes (impressos ou em PDF)",
  "Lista de medicações em uso, incluindo vitaminas",
  "Lista de dúvidas — toda pergunta é bem-vinda",
];

function PrimeiraConsultaPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <Reveal variant="blur">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Sua primeira visita
          </p>
        </Reveal>
        <Reveal variant="up" delay={60}>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">
            O que esperar da sua primeira consulta.
          </h1>
        </Reveal>
        <Reveal variant="up" delay={120}>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            A primeira consulta é, antes de tudo, uma conversa. Aqui está exatamente como ela
            acontece — para que você chegue tranquila.
          </p>
        </Reveal>

        {/* Info cards */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            { icon: Clock, label: "Duração", value: "60 minutos" },
            { icon: MessageCircle, label: "Retorno", value: "Em até 24h úteis" },
            { icon: Shield, label: "Sigilo", value: "Total e absoluto" },
            { icon: FileText, label: "Material", value: "Plano por escrito" },
          ].map(({ icon: Icon, label, value }, i) => (
            <Reveal key={label} variant="scale" delay={180 + i * 70}>
              <SpotlightCard className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                <Icon className="h-6 w-6 text-primary" />
                <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="font-serif text-xl text-foreground">{value}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Passo a passo */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Reveal variant="up">
            <h2 className="font-serif text-3xl">Passo a passo</h2>
          </Reveal>
          <ol className="mt-10 space-y-5">
            {passos.map((p, i) => (
              <Reveal key={p.num} variant="left" delay={i * 90}>
                <li className="flex gap-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                  <span className="font-serif text-4xl text-primary">{p.num}</span>
                  <div>
                    <p className="font-serif text-xl text-foreground">{p.titulo}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* O que trazer + CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <Reveal variant="up">
              <h2 className="font-serif text-3xl">O que trazer</h2>
            </Reveal>
            <ul className="mt-6 space-y-3">
              {trazer.map((t, i) => (
                <Reveal key={t} variant="left" delay={i * 70}>
                  <li className="border-l-2 border-primary/40 pl-4 text-foreground">{t}</li>
                </Reveal>
              ))}
            </ul>
          </div>

          <Reveal variant="right" delay={100}>
            <div className="rounded-2xl bg-[var(--gradient-warm)] p-8">
              <p className="font-serif text-2xl text-foreground">Não sabe se é o momento certo?</p>
              <p className="mt-3 text-muted-foreground">
                Mande uma mensagem rápida pelo WhatsApp ou solicite seu horário — respondemos em até
                24h úteis.
              </p>
              <Magnetic>
                <Link
                  to="/agendamento"
                  className="press mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
                >
                  Agendar consulta
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
