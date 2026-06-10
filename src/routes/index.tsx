import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  Baby,
  BookOpen,
  BrainCircuit,
  Calendar,
  Clock,
  Heart,
  HeartPulse,
  MessageSquare,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import heroImg from "@/assets/hero-pregnancy.jpg";
import portrait from "@/assets/dr-clovis-portrait.jpg";
import { AnimatedCounter } from "@/components/animated-counter";
import { BabyEvolution } from "@/components/baby-evolution";
import { Reveal } from "@/components/reveal";
import { Magnetic, Parallax, SpotlightCard, TiltCard } from "@/components/motion-fx";
import { TechGrid, FloatingOrbs, Particles, ShimmerText } from "@/components/tech-fx";
import { TestimonialsSection } from "@/components/testimonials-section";

export const Route = createFileRoute("/")({
  head: () => {
    return {
      meta: [
        { title: "Obstétrica by Dr. Clóvis — App de Gestação e Saúde da Mulher" },
        {
          name: "description",
          content:
            "Acompanhe sua gestação semana a semana, converse com IA especializada, agende consultas e muito mais. Desenvolvido com Dr. Clóvis Bacha.",
        },
        { property: "og:title", content: "Obstétrica by Dr. Clóvis" },
        {
          property: "og:description",
          content: "O app completo para acompanhar sua gestação com segurança e cuidado.",
        },
      ],
    };
  },
  component: Index,
});

const APP_FEATURES = [
  {
    icon: Baby,
    title: "Gestação semana a semana",
    text: "Acompanhe o desenvolvimento do bebê, exames programados e marcos importantes da gravidez.",
  },
  {
    icon: BrainCircuit,
    title: "Chat com IA especializada",
    text: "Tire dúvidas a qualquer hora com nossa IA treinada em obstetrícia e ginecologia de alto risco.",
  },
  {
    icon: Calendar,
    title: "Agendamento integrado",
    text: "Solicite consultas, acompanhe horários e receba lembretes da sua equipe médica.",
  },
  {
    icon: Activity,
    title: "Monitoramento da saúde",
    text: "Registre peso, pressão, batimentos do bebê e sintomas. Visualize sua evolução em gráficos.",
  },
  {
    icon: Heart,
    title: "Ciclo menstrual e preventivos",
    text: "Controle seu ciclo, receba previsões e lembretes para exames preventivos do calendário FEBRASGO.",
  },
  {
    icon: Users,
    title: "Modo acompanhante",
    text: "Inclua seu parceiro ou familiar para que todos estejam preparados para o grande momento.",
  },
  {
    icon: BookOpen,
    title: "Escola do bebê",
    text: "Módulos educativos sobre amamentação, cuidados neonatais, parto e muito mais.",
  },
  {
    icon: MessageSquare,
    title: "Diário e perguntas",
    text: "Registre seus sentimentos, anote dúvidas para a consulta e mantenha um histórico completo.",
  },
  {
    icon: ShieldCheck,
    title: "Alertas de segurança",
    text: "Triagem inteligente de sintomas com orientação rápida sobre quando buscar atendimento urgente.",
  },
];

function Index() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <TechGrid />
        <FloatingOrbs />
        <Particles density={28} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 md:grid-cols-[1.05fr_1fr] md:pt-24 md:pb-28">
          <div>
            <Reveal variant="blur">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                <Sparkles className="h-3 w-3 animate-[sparkle_2.4s_ease-in-out_infinite]" />
                App de gestação · Saúde da mulher
              </p>
            </Reveal>
            <Reveal variant="up" delay={120}>
              <h1 className="mt-4 font-serif text-4xl leading-[1.05] text-foreground md:text-6xl">
                Sua gestação acompanhada com{" "}
                <ShimmerText className="not-italic">presença</ShimmerText> e tecnologia.
              </h1>
            </Reveal>
            <Reveal variant="up" delay={240}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Obstétrica é o app criado com o Dr. Clóvis Bacha para você acompanhar sua gestação
                semana a semana, monitorar sua saúde, tirar dúvidas com IA e muito mais.
              </p>
            </Reveal>
            <Reveal variant="up" delay={360}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <Link
                    to="/auth"
                    className="press group relative block overflow-hidden rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)]"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Smartphone className="h-4 w-4" /> Entrar no App
                    </span>
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  </Link>
                </Magnetic>
                <Link
                  to="/agendamento"
                  className="press rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Agendar consulta
                </Link>
              </div>
            </Reveal>
            <Reveal variant="fade" delay={480}>
              <div className="mt-8 inline-flex items-center gap-3 rounded-full glass px-4 py-2 text-sm text-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <Clock className="h-4 w-4 text-primary" />
                <span>Acesso imediato após o cadastro</span>
              </div>
            </Reveal>
          </div>
          <Reveal variant="scale" delay={200} className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-[var(--gradient-warm)] blur-xl opacity-60 gradient-animated" />
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-tr from-primary/40 via-transparent to-accent/40 opacity-70 blur-md" />
            <TiltCard className="relative rounded-[2rem]" max={5}>
              <img
                src={heroImg}
                alt="Mulher grávida com as mãos no ventre"
                width={1600}
                height={1200}
                className="relative aspect-[4/5] w-full rounded-[2rem] object-cover shadow-[var(--shadow-soft)]"
              />
              <div className="absolute -left-3 top-6 glass rounded-2xl px-3 py-2 text-xs shadow-[var(--shadow-card)] animate-[floatY_6s_ease-in-out_infinite]">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-primary" />
                  <span className="font-medium">140 bpm</span>
                </div>
                <p className="text-[10px] text-muted-foreground">batimentos do bebê</p>
              </div>
              <div className="absolute -right-3 bottom-8 glass rounded-2xl px-3 py-2 text-xs shadow-[var(--shadow-card)] animate-[floatY_7.5s_ease-in-out_infinite_reverse]">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <span className="font-medium">24 semanas</span>
                </div>
                <p className="text-[10px] text-muted-foreground">sua gestação hoje</p>
              </div>
            </TiltCard>
          </Reveal>
        </div>
      </section>

      {/* Funcionalidades do app */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Reveal variant="up">
            <div className="mb-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                O que o app oferece
              </p>
              <h2 className="mt-3 font-serif text-3xl md:text-4xl">
                Tudo que você precisa em um só lugar.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Do pré-natal ao pós-parto, passando pelo ciclo menstrual e cuidados preventivos — o
                Obstétrica é seu parceiro de saúde.
              </p>
            </div>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {APP_FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} variant="up" delay={(i % 3) * 80}>
                <SpotlightCard className="group h-full rounded-2xl border border-border bg-card p-5 transition-all duration-500 [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-card)]">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-110 group-hover:-rotate-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-3 font-medium text-foreground">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
          <Reveal variant="up" delay={200}>
            <div className="mt-10 text-center">
              <Magnetic>
                <Link
                  to="/auth"
                  className="press inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)]"
                >
                  <Smartphone className="h-4 w-4" /> Criar conta gratuita
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Números */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <Reveal variant="up">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Em números
            </p>
            <h2 className="mt-3 font-serif text-3xl md:text-4xl">A experiência por trás do app.</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          {[
            { v: 4000, s: "+", l: "partos acompanhados" },
            { v: 20, s: "+", l: "anos de experiência" },
            { v: 1200, s: "+", l: "casos de alto risco" },
            { v: 98, s: "%", l: "de satisfação" },
          ].map((n, i) => (
            <Reveal key={n.l} variant="scale" delay={i * 110}>
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)] hover-lift">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
                <p className="relative font-serif text-5xl text-primary">
                  <AnimatedCounter value={n.v} suffix={n.s} />
                </p>
                <p className="relative mt-2 text-sm text-muted-foreground">{n.l}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Evolução do bebê — feature demo */}
      <BabyEvolution />

      {/* O médico por trás do app */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-[1fr_1.1fr]">
        <Reveal variant="left">
          <Parallax speed={0.05}>
            <TiltCard className="relative rounded-[2rem]" max={4}>
              <img
                src={portrait}
                alt="Dr. Clóvis Bacha"
                loading="lazy"
                width={1024}
                height={1024}
                className="aspect-square w-full rounded-[2rem] object-cover shadow-[var(--shadow-card)]"
              />
            </TiltCard>
          </Parallax>
        </Reveal>
        <div>
          <Reveal variant="up">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              O especialista
            </p>
            <h2 className="mt-3 font-serif text-3xl md:text-4xl">
              Dr. Clóvis Bacha, ginecologista e obstetra de alto risco.
            </h2>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Com mais de 20 anos de prática especializada em gestações complexas — diabetes
              gestacional, hipertensão, gemelaridade e malformações fetais — o Dr. Clóvis
              desenvolveu o Obstétrica para que cada paciente tenha ao seu lado o mesmo cuidado que
              recebe no consultório, a qualquer momento.
            </p>
          </Reveal>
          <Reveal variant="up" delay={220}>
            <div className="mt-6 flex flex-wrap gap-2">
              {["CRM-MG ativo", "FEBRASGO", "Medicina Fetal", "Ultrassonografia Obstétrica"].map(
                (tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground transition-colors duration-300 hover:border-primary/40 hover:text-primary"
                  >
                    {tag}
                  </span>
                ),
              )}
            </div>
            <Link
              to="/sobre"
              className="group mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4"
            >
              Ver currículo completo{" "}
              <span className="transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover:translate-x-1">
                →
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Depoimentos */}
      <TestimonialsSection />

      {/* CTA final */}
      <section className="relative overflow-hidden bg-[var(--gradient-primary)] text-primary-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[10%] h-64 w-64 rounded-full bg-white/10 blur-3xl animate-[floatY_10s_ease-in-out_infinite]"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between">
          <Reveal variant="up">
            <h2 className="font-serif text-3xl md:text-4xl">Pronta para começar?</h2>
            <p className="mt-2 max-w-xl opacity-90">
              Crie sua conta gratuitamente e tenha acesso imediato a todas as funcionalidades do
              app.
            </p>
          </Reveal>
          <Reveal variant="up" delay={140}>
            <div className="flex flex-wrap gap-3">
              <Magnetic>
                <Link
                  to="/auth"
                  className="press flex items-center gap-2 rounded-full bg-background px-6 py-3 text-sm font-medium text-primary shadow-lg shadow-black/10"
                >
                  <Smartphone className="h-4 w-4" /> Entrar no App
                </Link>
              </Magnetic>
              <Link
                to="/agendamento"
                className="press rounded-full border border-primary-foreground/30 px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-white/10"
              >
                Agendar consulta
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
