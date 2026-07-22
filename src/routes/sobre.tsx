import { createFileRoute, Link } from "@tanstack/react-router";
import portrait from "@/assets/dr-clovis-portrait.jpg";
import { DOCTOR } from "@/lib/doctor.config";
import { Reveal } from "@/components/reveal";
import { TiltCard, SpotlightCard } from "@/components/motion-fx";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre nós — Como o Obstétrica nasceu" },
      {
        name: "description",
        content:
          "A história do Obstétrica: por que o app existe, como foi construído dentro de um consultório de gestação de alto risco e o que ele quer mudar no pré-natal.",
      },
      { property: "og:title", content: "Sobre nós — Obstétrica" },
      {
        property: "og:description",
        content: "Por que o Obstétrica existe e como ele foi construído.",
      },
    ],
  }),
  component: SobrePage,
});

/* A página Sobre nós é o ÚNICO lugar do site onde o fundador aparece pelo
   nome — em todas as outras superfícies a identidade é a do médico associado
   de cada paciente (config DOCTOR) ou neutra. */

const objetivos = [
  {
    emoji: "🤝",
    title: "Cuidado que não termina na consulta",
    desc: "A gestante passa 30 minutos por mês no consultório e 43.000 minutos fora dele. O app existe para o médico estar presente — com segurança — nesses outros minutos.",
  },
  {
    emoji: "🎓",
    title: "Educação que ela quer fazer",
    desc: "Informação confiável não pode ser um PDF esquecido. A jornada transforma o pré-natal em fases, desafios diários e lições com quiz — no ritmo de cada semana.",
  },
  {
    emoji: "🧠",
    title: "A voz do próprio médico, 24h",
    desc: "A IA do app não inventa conduta: ela responde com as orientações que o próprio obstetra da paciente validou. À meia-noite, a resposta é a que ele daria.",
  },
  {
    emoji: "🔒",
    title: "Dados de saúde levados a sério",
    desc: "Criptografia, isolamento por paciente (RLS), LGPD. Dados de saúde nunca treinam modelos de IA e nunca são vendidos.",
  },
];

const linhaDoTempo = [
  {
    fase: "A inquietação",
    texto:
      "Dentro de um consultório de gestação de alto risco, as mesmas perguntas chegavam pelo WhatsApp toda noite — e a resposta certa não podia esperar a próxima consulta.",
  },
  {
    fase: "O protótipo",
    texto:
      "As orientações que o médico repetia todos os dias viraram um app simples: semana a semana, sinais de alerta e o diário da gestante — testado com pacientes reais.",
  },
  {
    fase: "O app completo",
    texto:
      "A jornada gamificada, as lições com quiz, o monitoramento de peso e pressão, o contador de chutes, a teleconsulta e a IA treinada nas respostas do médico.",
  },
  {
    fase: "A plataforma",
    texto:
      "O que funcionou para um consultório virou produto para qualquer obstetra: cada médico com o seu painel, a sua IA e as suas pacientes — com o seu nome na frente.",
  },
];

const valores = [
  "Evidência científica antes de tendência",
  "O médico no centro — a tecnologia assiste, não substitui",
  "Sem promessa vazia: só vendemos o que o produto faz",
  "Linguagem acolhedora, nunca alarmista",
  "Privacidade como padrão, não como opção",
];

const formacaoResumo = [
  "Graduação em Medicina e Residência em Ginecologia e Obstetrícia",
  "Especialização em Medicina Fetal e Ultrassonografia Obstétrica",
  "Título de Especialista — FEBRASGO",
  "Pós-graduação em Gestação de Alto Risco",
  "Membro da SBMF e da ISUOG",
];

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: DOCTOR.siteUrl },
    { "@type": "ListItem", position: 2, name: "Sobre nós", item: `${DOCTOR.siteUrl}/sobre` },
  ],
};

// Dado estruturado do médico — é o que o Google usa quando alguém pesquisa o
// nome dele (painel de conhecimento, resultado com foto/especialidade).
const physician = {
  "@context": "https://schema.org",
  "@type": "Physician",
  name: DOCTOR.name,
  medicalSpecialty: "Gynecologic",
  description: `${DOCTOR.title} — ${DOCTOR.specialty}.`,
  url: `${DOCTOR.siteUrl}/sobre`,
  image: `${DOCTOR.siteUrl}/og.png`,
  telephone: DOCTOR.whatsappDisplay,
  email: DOCTOR.email,
  sameAs: [DOCTOR.instagram],
  knowsAbout: [
    "Gestação de alto risco",
    "Pré-natal",
    "Medicina fetal",
    "Ultrassonografia obstétrica",
    "Ginecologia",
    "Obstetrícia",
  ],
};

function SobrePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(physician) }}
      />

      {/* Hero — a razão de existir */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center md:py-24">
        <Reveal variant="up">
          <p className="glass-chip text-xs font-bold uppercase tracking-[0.22em] text-primary">
            Sobre nós
          </p>
          <h1 className="mt-4 font-serif text-4xl font-extrabold leading-tight md:text-5xl">
            O Obstétrica nasceu dentro de um consultório — não de uma startup.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Todo dia, gestantes saíam da consulta cuidadas e voltavam para casa com um mês inteiro
            de dúvidas pela frente. Este app existe para fechar esse vão: levar o cuidado do
            consultório para todos os dias da gestação.
          </p>
        </Reveal>
      </section>

      {/* A história — linha do tempo da construção */}
      <section className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-4xl px-5 py-16">
          <Reveal variant="up">
            <h2 className="text-center font-serif text-3xl">Como o app foi construído</h2>
          </Reveal>
          <div className="mt-10 space-y-6">
            {linhaDoTempo.map((etapa, i) => (
              <Reveal key={etapa.fase} variant="left" delay={i * 90}>
                <div className="flex gap-5 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-lg font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-serif text-xl">{etapa.fase}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {etapa.texto}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Objetivos */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <Reveal variant="up">
          <h2 className="text-center font-serif text-3xl">O que o Obstétrica quer mudar</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {objetivos.map((o, i) => (
            <Reveal key={o.title} variant="up" delay={i * 80}>
              <SpotlightCard className="h-full rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <p className="text-3xl">{o.emoji}</p>
                <h3 className="mt-3 font-serif text-xl">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.desc}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* O fundador — o único lugar do site com o nome */}
      <section className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-[1fr_1.3fr]">
          <Reveal variant="left">
            <TiltCard max={4}>
              <img
                src={portrait}
                alt="Dr. Clóvis Bacha, fundador do Obstétrica"
                width={1024}
                height={1024}
                className="aspect-square w-full rounded-[2rem] object-cover shadow-[var(--shadow-card)]"
              />
            </TiltCard>
          </Reveal>
          <Reveal variant="right" delay={120}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Quem construiu
              </p>
              <h2 className="mt-3 font-serif text-3xl md:text-4xl">Dr. Clóvis Bacha</h2>
              <p className="mt-2 text-sm uppercase tracking-wider text-muted-foreground">
                Ginecologista e Obstetra · {DOCTOR.crm}
              </p>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                Há mais de 20 anos dedicado à saúde da mulher, com atuação central em gestação de
                alto risco — mais de 5.000 gestações acompanhadas. Criou o Obstétrica para que cada
                paciente tivesse ao lado, todos os dias, o mesmo cuidado que recebe no consultório.
              </p>
              <ul className="mt-5 space-y-2">
                {formacaoResumo.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm italic text-muted-foreground">
                "Cada gestação tem sua própria história. Cuidar de quem espera é tão importante
                quanto cuidar de quem chega."
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Valores */}
      <section className="mx-auto max-w-4xl px-5 py-16">
        <Reveal variant="up">
          <h2 className="text-center font-serif text-3xl">No que a gente acredita</h2>
        </Reveal>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {valores.map((v, i) => (
            <Reveal key={v} variant="up" delay={i * 60}>
              <SpotlightCard className="rounded-xl border border-border bg-card px-4 py-3.5 text-sm text-foreground shadow-[var(--shadow-card)]">
                💛 {v}
              </SpotlightCard>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* CTA final */}
      <section className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <Reveal variant="up">
            <h2 className="font-serif text-3xl">Faça parte dessa história</h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Se você está esperando um bebê — ou cuida de quem espera — o Obstétrica foi feito para
              você.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/auth"
                className="press rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-float)]"
              >
                Criar meu perfil grátis
              </Link>
              <Link
                to="/medicos"
                className="press rounded-full border border-border bg-card px-6 py-3.5 text-sm font-medium hover:border-primary hover:text-primary"
              >
                Sou médico → conhecer a plataforma
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
