import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import {
  Activity,
  Baby,
  BookOpen,
  BrainCircuit,
  Calendar,
  CloudSun,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import portrait from "@/assets/dr-clovis-portrait.jpg";
import { AnimatedCounter } from "@/components/animated-counter";
import { BabyEvolution } from "@/components/baby-evolution";
import { Reveal } from "@/components/reveal";
import { Magnetic, SpotlightCard } from "@/components/motion-fx";
import { ShimmerText } from "@/components/tech-fx";
import { TestimonialsSection } from "@/components/testimonials-section";
import { SkyCanvas, useWeatherSky } from "@/components/weather-sky";
import {
  AppChatMockupScreen,
  AppHomeMockupScreen,
  AppJogoMockupScreen,
  AppSaudeMockupScreen,
  PhoneFrame,
} from "@/components/app-phone-mockup";
import { FootprintTrail } from "@/components/footprint-trail";
import { BrainShowcase } from "@/components/brain-showcase";
import { setHeroDark } from "@/components/hero-theme";

export const Route = createFileRoute("/")({
  head: () => {
    return {
      meta: [
        { title: "Obstétrica — App de Gestação e Saúde da Mulher" },
        {
          name: "description",
          content:
            "O app que acompanha sua gestação semana a semana: clima em tempo real, IA obstétrica 24h, monitoramento de saúde, teleconsulta e o cuidado do seu médico.",
        },
        { property: "og:title", content: "Obstétrica — o app da sua gestação" },
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
    text: "Desenvolvimento do bebê, tamanho, peso e os exames de cada fase — atualizado todo dia.",
  },
  {
    icon: CloudSun,
    title: "Clima em tempo real",
    text: "A tela do app muda com o céu da sua cidade e sugere cuidados para gestantes conforme o tempo.",
  },
  {
    icon: BrainCircuit,
    title: "IA obstétrica 24h",
    text: "Dúvida às 3h da manhã? A IA treinada em obstetrícia responde na hora, com triagem de sintomas.",
  },
  {
    icon: Video,
    title: "Teleconsulta integrada",
    text: "Consultas por vídeo com o seu médico sem sair do app — link automático no seu e-mail.",
  },
  {
    icon: Activity,
    title: "Monitoramento completo",
    text: "Peso, pressão, chutes do bebê e sintomas em gráficos que o médico acompanha de perto.",
  },
  {
    icon: Calendar,
    title: "Agendamento integrado",
    text: "Solicite consultas, receba confirmação e lembretes direto no app.",
  },
  {
    icon: Users,
    title: "Modo acompanhante",
    text: "Inclua parceiro ou familiar para que todos vivam a gestação junto com você.",
  },
  {
    icon: BookOpen,
    title: "Escola do bebê",
    text: "Módulos sobre amamentação, cuidados neonatais, parto e pós-parto.",
  },
  {
    icon: ShieldCheck,
    title: "Alertas de segurança",
    text: "Triagem inteligente avisa quando um sintoma merece atenção médica urgente.",
  },
];

const SHOWCASE = [
  {
    badge: "Chat IA",
    title: "Fale a qualquer hora com a IA do seu médico",
    text: "Dúvida às 3h da manhã? Converse a qualquer momento com uma inteligência artificial treinada nas respostas que o seu próprio obstetra já validou — como se ele respondesse por você, na hora, sem esperar a próxima consulta.",
    bullets: [
      "Disponível 24h, todos os dias",
      "Respostas no estilo e nas condutas do seu médico",
      "Triagem de sintomas e alerta quando é sério",
    ],
    screen: "chat" as const,
  },
  {
    badge: "Jornada diária",
    title: "Cuidar virou um jogo que ela quer jogar todo dia",
    text: "As 40 semanas viram um caminho de fases com desafios diários: abrir o baú do dia, colecionar a figurinha da fruta, manter a chama acesa. Cada desafio é uma orientação médica real — beber água, contar os chutes, agendar o exame da semana.",
    bullets: [
      "Desafios diários com orientação médica",
      "Álbum de figurinhas semana a semana",
      "Sequência de dias estilo Duolingo",
    ],
    screen: "jogo" as const,
  },
  {
    badge: "Saúde",
    title: "Seus números, acompanhados de perto",
    text: "Registre peso, pressão e os chutes do bebê. O app monta os gráficos e o seu médico acompanha tudo do painel — sua consulta começa antes de você chegar.",
    bullets: [
      "Gráficos de evolução automáticos",
      "Contador de chutes do bebê",
      "Médico vê tudo antes da consulta",
    ],
    screen: "saude" as const,
  },
];

const PERIODS = [
  { key: "manha", label: "Amanhecer", emoji: "🌅" },
  { key: "dia", label: "Tarde", emoji: "☀️" },
  { key: "entardecer", label: "Entardecer", emoji: "🌇" },
  { key: "noite", label: "Noite", emoji: "🌙" },
] as const;

function Index() {
  const [periodOverride, setPeriodOverride] = useState<
    "manha" | "dia" | "entardecer" | "noite" | null
  >(null);
  const sky = useWeatherSky(periodOverride);
  const heroText = sky.isDark ? "text-white" : "text-foreground";
  const heroMuted = sky.isDark ? "text-white/70" : "text-muted-foreground";

  // Publica se o hero está escuro → header troca a logo (branca no escuro).
  useEffect(() => {
    setHeroDark(sky.isDark);
    return () => setHeroDark(false);
  }, [sky.isDark]);

  return (
    <>
      {/* ── Hero: céu dinâmico + telefone ─────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          marginTop: "calc(-73px - var(--safe-top))",
          paddingTop: "calc(73px + var(--safe-top))",
        }}
      >
        <SkyCanvas sky={sky} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pt-6 pb-24 md:gap-10 md:grid-cols-[1.1fr_1fr] md:pt-20 md:pb-32">
          {/* Painel Liquid Glass atrás do texto do hero: refrata o céu vivo e
              garante contraste do texto em qualquer clima/hora do dia. */}
          <div className="liquid-glass rounded-[2rem] p-6 md:p-9">
            <Reveal variant="blur">
              <p
                className={`glass-chip text-[11px] font-bold uppercase tracking-[0.22em] ${
                  sky.isDark ? "text-white" : "text-primary"
                }`}
              >
                <Sparkles className="h-3 w-3 animate-[sparkle_2.4s_ease-in-out_infinite]" />O app da
                sua gestação
              </p>
            </Reveal>
            <Reveal variant="up" delay={120}>
              <h1
                className={`mt-4 font-serif text-3xl font-extrabold leading-[1.08] tracking-tight md:text-6xl ${heroText}`}
              >
                A gestação inteira <ShimmerText className="not-italic">no seu bolso</ShimmerText>.
              </h1>
            </Reveal>
            <Reveal variant="up" delay={240}>
              <p
                className={`mt-4 max-w-lg text-base leading-relaxed md:mt-6 md:text-lg ${heroMuted}`}
              >
                Acompanhamento semana a semana, IA obstétrica 24h, teleconsulta e monitoramento de
                saúde — criado por especialistas em gestação de alto risco.
              </p>
            </Reveal>
            <Reveal variant="up" delay={360}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <Link
                    to="/auth"
                    className="press group relative block overflow-hidden rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-float)]"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Smartphone className="h-4 w-4" /> Criar meu perfil grátis
                    </span>
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  </Link>
                </Magnetic>
                <Link
                  to="/agendamento"
                  className={`press rounded-full px-6 py-3.5 text-sm font-medium backdrop-blur-md transition-colors ${
                    sky.isDark
                      ? "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                      : "border border-border bg-white/70 text-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  Agendar consulta
                </Link>
              </div>
            </Reveal>
            {/* selo de clima ao vivo — prova do diferencial (desktop) */}
            <Reveal variant="fade" delay={500} className="hidden md:block">
              <div
                className={`mt-8 inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm backdrop-blur-md ${
                  sky.isDark
                    ? "border border-white/20 bg-white/10 text-white/90"
                    : "border border-border/60 bg-white/70 text-foreground"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {sky.weather ? (
                  <span>
                    {sky.weather.emoji} {sky.weather.temp}°C · {sky.weather.condition} — este céu é
                    o clima real de agora, como no app
                  </span>
                ) : (
                  <span>☁️ Este céu muda com o clima real — como dentro do app</span>
                )}
              </div>
            </Reveal>
            {/* Seletor dos 4 períodos — experimente o céu de cada hora do dia (desktop) */}
            <Reveal variant="fade" delay={620} className="hidden md:block">
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`text-xs ${heroMuted}`}>Experimente:</span>
                {PERIODS.map((p) => {
                  const active = periodOverride === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setPeriodOverride(active ? null : p.key)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-all ${
                        active
                          ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)] scale-105"
                          : sky.isDark
                            ? "border border-white/20 bg-white/10 text-white/80 hover:bg-white/20"
                            : "border border-border/60 bg-white/60 text-muted-foreground hover:text-primary"
                      }`}
                    >
                      {p.emoji} {p.label}
                    </button>
                  );
                })}
              </div>
            </Reveal>
          </div>

          {/* Telefone flutuante — o app dentro dele acompanha o céu do site.
              No celular ele vem PRIMEIRO: a visitante vê o perfil da gestante
              antes de qualquer texto, com a chamada para criar o dela. */}
          <Reveal
            variant="scale"
            delay={250}
            className="order-first relative flex flex-col items-center md:order-none"
          >
            <div className="animate-[phoneFloat_7s_ease-in-out_infinite] scale-[0.88] -mb-2 md:scale-100 md:mb-0">
              <PhoneFrame>
                <AppHomeMockupScreen period={sky.period} />
              </PhoneFrame>
            </div>
            <p
              className={`mt-1 text-center text-sm font-medium md:hidden ${
                sky.isDark ? "text-white/85" : "text-foreground/75"
              }`}
            >
              👆 Assim é o seu perfil de gestação — crie o seu em 1 minuto
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Segundo Cérebro: o produto mais forte, em destaque ──────── */}
      <BrainShowcase />

      {/* ── Por dentro do app: 3 telas em destaque ─────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <Reveal variant="up">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <p className="glass-chip text-xs font-bold uppercase tracking-[0.22em] text-primary">
              Por dentro do app
            </p>
            <h2 className="mt-3 font-serif text-3xl md:text-5xl">
              Tecnologia que sente o seu momento.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Cada tela foi desenhada com médicos obstetras para a rotina real de uma gestante — do
              positivo ao pós-parto.
            </p>
          </div>
        </Reveal>

        <div className="space-y-8 md:space-y-12">
          {SHOWCASE.map((item, i) => (
            <Fragment key={item.badge}>
              {i > 0 && <FootprintTrail dir={i % 2 === 1 ? "ltr" : "rtl"} count={8} />}
              <div
                className={`grid items-center gap-10 md:grid-cols-2 ${
                  i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <Reveal variant={i % 2 === 1 ? "left" : "up"} className="flex justify-center">
                  <PhoneFrame tilt={i % 2 === 1 ? "right" : "left"}>
                    {item.screen === "chat" && <AppChatMockupScreen />}
                    {item.screen === "jogo" && <AppJogoMockupScreen />}
                    {item.screen === "saude" && <AppSaudeMockupScreen />}
                  </PhoneFrame>
                </Reveal>
                <Reveal variant="up" delay={120}>
                  <span className="glass-chip text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                    {item.badge}
                  </span>
                  <h3 className="mt-4 font-serif text-2xl md:text-4xl">{item.title}</h3>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    {item.text}
                  </p>
                  <ul className="mt-6 space-y-2.5">
                    {item.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2.5 text-sm text-foreground">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          ✓
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>
            </Fragment>
          ))}
        </div>
      </section>

      {/* ── Funcionalidades em grade ───────────────────────────────── */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <Reveal variant="up">
            <div className="mb-10 max-w-2xl">
              <p className="glass-chip text-xs font-bold uppercase tracking-[0.22em] text-primary">
                Tudo que o app faz
              </p>
              <h2 className="mt-3 font-serif text-3xl md:text-4xl">
                Um pré-natal completo, na palma da mão.
              </h2>
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

      {/* ── Números ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <Reveal variant="up">
          <div className="max-w-2xl">
            <p className="glass-chip text-xs font-bold uppercase tracking-[0.22em] text-primary">
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
              <div className="shine relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-center shadow-[var(--shadow-card)] hover-lift">
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

      {/* ── O médico por trás do app ───────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-[1fr_1.1fr]">
        <Reveal variant="left">
          <div className="relative">
            <div className="absolute -inset-3 rounded-[2.3rem] bg-gradient-to-tr from-primary/20 via-transparent to-accent/30 blur-lg" />
            <img
              src={portrait}
              alt="O obstetra fundador da plataforma"
              loading="lazy"
              width={1024}
              height={1024}
              className="relative aspect-square w-full rounded-[2rem] object-cover shadow-[var(--shadow-card)]"
            />
          </div>
        </Reveal>
        <div>
          <Reveal variant="up">
            <p className="glass-chip text-xs font-bold uppercase tracking-[0.22em] text-primary">
              O especialista
            </p>
            <h2 className="mt-3 font-serif text-3xl md:text-4xl">
              Feito por quem vive a obstetrícia todos os dias.
            </h2>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Criado por um ginecologista e obstetra com mais de 20 anos de prática em gestações
              complexas — diabetes gestacional, hipertensão, gemelaridade e malformações fetais —
              para que cada paciente tenha ao seu lado o mesmo cuidado que recebe no consultório do
              seu médico, a qualquer momento.
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
              Conhecer nossa história{" "}
              <span className="transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover:translate-x-1">
                →
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Depoimentos */}
      <TestimonialsSection />

      {/* ── CTA final ──────────────────────────────────────────────── */}
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
                  className="press glow-cta flex items-center gap-2 rounded-full bg-background px-6 py-3 text-sm font-medium text-primary shadow-lg shadow-black/10"
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
