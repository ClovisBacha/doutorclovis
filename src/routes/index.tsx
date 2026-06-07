import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Calendar, Clock, HeartPulse, PlayCircle, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import heroImg from "@/assets/hero-pregnancy.jpg";
import portrait from "@/assets/dr-clovis-portrait.jpg";
import { AnimatedCounter } from "@/components/animated-counter";
import { BabyEvolution } from "@/components/baby-evolution";
import { Reveal } from "@/components/reveal";
import { TechGrid, FloatingOrbs, Particles, ShimmerText } from "@/components/tech-fx";
import { TestimonialsSection } from "@/components/testimonials-section";

export const Route = createFileRoute("/")({
  head: () => {
    return {
      meta: [
        { title: "Dr. Clóvis Bacha — Gestação de Alto Risco" },
        { name: "description", content: "Ginecologia e obstetrícia com foco em gestação de alto risco. Cuidado humanizado do pré-natal ao pós-parto." },
        { property: "og:title", content: "Dr. Clóvis Bacha — Gestação de Alto Risco" },
        { property: "og:description", content: "Cuidado humanizado em ginecologia e obstetrícia de alto risco." },
      ],
    };
  },
  component: Index,
});

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
                Ginecologia · Obstetrícia · Alto risco
              </p>
            </Reveal>
            <Reveal variant="up" delay={120}>
              <h1 className="mt-4 font-serif text-4xl leading-[1.05] text-foreground md:text-6xl">
                Cuidar de você e do seu bebê com{" "}
                <ShimmerText className="not-italic">presença</ShimmerText> e ciência.
              </h1>
            </Reveal>
            <Reveal variant="up" delay={240}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Dr. Clóvis Bacha acompanha gestações de alto risco há mais de duas décadas — unindo medicina baseada em evidências a um atendimento profundamente humano.
              </p>
            </Reveal>
            <Reveal variant="up" delay={360}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/agendamento"
                  className="group relative overflow-hidden rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5"
                >
                  <span className="relative z-10">Agendar consulta</span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </Link>
                <Link
                  to="/sobre"
                  className="rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Conheça o doutor
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
                <span>Retorno da equipe em <strong>até 24h úteis</strong></span>
              </div>
            </Reveal>
          </div>
          <Reveal variant="scale" delay={200} className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-[var(--gradient-warm)] blur-xl opacity-60 gradient-animated" />
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-tr from-primary/40 via-transparent to-accent/40 opacity-70 blur-md" />
            <img
              src={heroImg}
              alt="Mulher grávida com as mãos no ventre"
              width={1600}
              height={1200}
              className="relative aspect-[4/5] w-full rounded-[2rem] object-cover shadow-[var(--shadow-soft)]"
            />
            {/* floating badges */}
            <div className="absolute -left-3 top-6 glass rounded-2xl px-3 py-2 text-xs shadow-[var(--shadow-card)] animate-[floatY_6s_ease-in-out_infinite]">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                <span className="font-medium">140 bpm</span>
              </div>
              <p className="text-[10px] text-muted-foreground">batimentos do bebê</p>
            </div>
            <div className="absolute -right-3 bottom-8 glass rounded-2xl px-3 py-2 text-xs shadow-[var(--shadow-card)] animate-[floatY_7.5s_ease-in-out_infinite_reverse]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="font-medium">CRM-MG</span>
              </div>
              <p className="text-[10px] text-muted-foreground">médico certificado</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pilares */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-2 md:grid-cols-4">
          {([
            { icon: HeartPulse, title: "Alto risco", text: "Acompanhamento especializado em gestações complexas." },
            { icon: Stethoscope, title: "Pré-natal completo", text: "Da concepção ao pós-parto, com escuta atenta." },
            { icon: ShieldCheck, title: "Segurança", text: "Decisões guiadas por ciência e protocolos atuais." },
            { icon: Calendar, title: "Agilidade", text: "Agendamento simples e retorno rápido da equipe." },
          ]).map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} variant="up" delay={i * 90}>
              <div className="group rounded-2xl p-4 transition-colors hover:bg-card/60">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-transform group-hover:scale-110">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-3 font-serif text-xl text-foreground">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Números animados */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <Reveal variant="up">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Em números</p>
            <h2 className="mt-3 font-serif text-3xl md:text-4xl">Duas décadas dedicadas à vida.</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          {[
            { v: 4000, s: "+", l: "partos realizados" },
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

      {/* Evolução do bebê */}
      <BabyEvolution />

      {/* Timeline do doutor */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Trajetória</p>
          <h2 className="mt-3 font-serif text-3xl md:text-4xl">A formação por trás do cuidado.</h2>
          <p className="mt-3 text-muted-foreground">Mais de duas décadas de estudo contínuo e prática especializada.</p>
        </div>
        <ol className="relative mt-10 border-l-2 border-primary/30 pl-6">
          {[
            { ano: "1998", t: "Graduação em Medicina", d: "Universidade Federal" },
            { ano: "2001", t: "Residência em GO", d: "Hospital Universitário" },
            { ano: "2003", t: "Especialização em Medicina Fetal", d: "" },
            { ano: "2006", t: "Fellowship em Ultrassonografia Obstétrica", d: "" },
            { ano: "2008", t: "Título de Especialista", d: "FEBRASGO" },
            { ano: "2015", t: "Pós-graduação em Alto Risco", d: "" },
            { ano: "2019", t: "Dopplervelocimetria avançada", d: "ISUOG" },
            { ano: "2022", t: "Cardiotocografia computadorizada", d: "" },
          ].map((e) => (
            <li key={e.ano} className="relative mb-8 last:mb-0">
              <span className="absolute -left-[34px] flex h-5 w-5 items-center justify-center rounded-full bg-primary ring-4 ring-background" />
              <p className="font-serif text-2xl text-primary">{e.ano}</p>
              <p className="font-medium text-foreground">{e.t}</p>
              {e.d && <p className="text-sm text-muted-foreground">{e.d}</p>}
            </li>
          ))}
        </ol>
      </section>

      {/* Vídeo de boas-vindas */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]">
          <div className="group relative aspect-video overflow-hidden rounded-[2rem] bg-secondary shadow-[var(--shadow-card)]">
            <img src={portrait} alt="Dr. Clóvis Bacha — vídeo de boas-vindas" className="h-full w-full object-cover opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/20">
              <button
                type="button"
                aria-label="Reproduzir vídeo de boas-vindas"
                className="flex items-center gap-3 rounded-full bg-background/90 px-5 py-3 text-sm font-medium text-primary shadow-lg transition-transform group-hover:scale-105"
              >
                <PlayCircle className="h-6 w-6" />
                Mensagem do doutor
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Boas-vindas</p>
            <h2 className="mt-3 font-serif text-3xl md:text-4xl">Uma palavra do Dr. Clóvis antes da sua primeira consulta.</h2>
            <p className="mt-5 text-muted-foreground">
              Em pouco mais de um minuto, conheça a filosofia de cuidado que guia o consultório e o que esperar da sua jornada com a nossa equipe.
            </p>
            <Link to="/primeira-consulta" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-4">
              Como funciona a primeira consulta →
            </Link>
          </div>
        </div>
      </section>

      {/* Atalhos */}
      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-3">
          {([
            { to: "/gestacao", titulo: "Sua gestação semana a semana", texto: "Linha do tempo dos principais marcos e exames." },
            { to: "/batimentos", titulo: "Som do coração do bebê", texto: "Ouça uma simulação dos batimentos por trimestre." },
            { to: "/tamanho-real", titulo: "Tamanho real na tela", texto: "Calibre a tela e veja o bebê em escala real." },
            { to: "/dpp", titulo: "Previsão da DPP", texto: "Faixa probabilística da data do parto." },
            { to: "/modo-acompanhante", titulo: "Modo Acompanhante", texto: "Guia prático para parceiros e familiares." },
            { to: "/cards", titulo: "Cards da sua gestação", texto: "Crie e compartilhe sua semana." },
            { to: "/hospitais", titulo: "Hospitais e rotas", texto: "Veja o tempo até cada maternidade." },
            { to: "/lives", titulo: "Lives no Instagram", texto: "Próximos encontros gratuitos com o Dr." },
            { to: "/mural", titulo: "Mural dos bebês", texto: "Histórias reais de famílias acompanhadas." },
          ]).map((c, i) => (
            <Reveal key={c.to} variant="up" delay={(i % 3) * 100}>
              <Link
                to={c.to}
                className="group relative block overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
              >
                <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: "radial-gradient(400px circle at var(--mx,50%) var(--my,50%), color-mix(in oklab, var(--primary) 10%, transparent), transparent 60%)" }} />
                <p className="relative font-serif text-2xl text-foreground">{c.titulo}</p>
                <p className="relative mt-2 text-sm text-muted-foreground">{c.texto}</p>
                <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Saber mais
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Sobre breve */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 md:grid-cols-[1fr_1.1fr]">
        <img
          src={portrait}
          alt="Retrato do Dr. Clóvis Bacha"
          loading="lazy"
          width={1024}
          height={1024}
          className="aspect-square w-full rounded-[2rem] object-cover shadow-[var(--shadow-card)]"
        />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Sobre o doutor</p>
          <h2 className="mt-3 font-serif text-3xl md:text-4xl">Uma escuta antes de qualquer diagnóstico.</h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Formado em Ginecologia e Obstetrícia, com especialização em Medicina Fetal, o Dr. Clóvis dedica sua prática ao acompanhamento de gestações de alto risco — diabetes gestacional, hipertensão, gemelaridade, malformações fetais e prematuridade.
          </p>
          <Link to="/sobre" className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-4">
            Currículo completo →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <TestimonialsSection />

      {/* CTA */}
      <section className="bg-[var(--gradient-primary)] text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl">Pronta para o próximo passo?</h2>
            <p className="mt-2 max-w-xl opacity-90">Solicite seu horário e nossa equipe entra em contato para confirmar.</p>
          </div>
          <Link
            to="/agendamento"
            className="rounded-full bg-background px-6 py-3 text-sm font-medium text-primary transition-transform hover:-translate-y-0.5"
          >
            Agendar consulta
          </Link>
        </div>
      </section>
    </>
  );
}
