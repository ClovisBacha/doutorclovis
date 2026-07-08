import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/motion-fx";

export const Route = createFileRoute("/medicos")({
  head: () => ({
    meta: [
      {
        title: "Para Médicos — Plataforma de Gestão para Obstetras e Ginecologistas",
      },
      {
        name: "description",
        content:
          "Agendamento inteligente, agente de IA no WhatsApp e cobrança PIX integrada. A plataforma feita por obstetra para obstetras. Sem contrato anual.",
      },
    ],
  }),
  component: MedicosPage,
});

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "R$ 0",
    period: "/sempre",
    highlight: false,
    desc: "Para testar sem compromisso — sem cartão, sem prazo",
    features: [
      "Agenda online + confirmações",
      "App de pré-natal para a paciente",
      "Prontuário gestacional simplificado",
      "Calculadoras clínicas (DPP, biometria)",
      "Até 5 pacientes ativas",
      "Sem Segundo Cérebro de IA",
      "Sem agente de WhatsApp",
    ],
    cta: "Criar conta grátis",
  },
  {
    key: "starter",
    name: "Starter",
    price: "R$ 197",
    period: "/mês",
    highlight: false,
    desc: "Para o médico solo que quer modernizar o consultório",
    features: [
      "Tudo do Free, sem limite de pacientes*",
      "🧠 Segundo Cérebro no chat do app",
      "Confirmações automáticas por WhatsApp",
      "Cobrança PIX integrada",
      "📊 Biometria fetal + percentil Intergrowth-21",
      "🩺 EPDS digital (rastreio depressão perinatal)",
      "🩸 Protocolo DMG + calculadora de insulina",
      "🫀 Rastreio de risco pré-eclâmpsia (ACOG/SBH)",
      "Exportação .ics (Google / Apple Calendar)",
      "*até 50 pacientes ativas/mês",
    ],
    cta: "Começar grátis por 14 dias",
  },
  {
    key: "pro",
    name: "Pro",
    price: "R$ 347",
    period: "/mês",
    highlight: true,
    desc: "Agente IA no WhatsApp + gestão completa",
    features: [
      "Tudo do Starter",
      "🤖 Agente IA 24h no WhatsApp (não só no app)",
      "Segundo Cérebro sem limite de treino",
      "Triagem automática de pacientes",
      "Lembretes automáticos de consulta (reduz falta em até 38%)",
      "Dashboard com FAQ inteligente e risco de abandono",
      "Cobrança e recibo digital",
      "Bloqueio de agenda e férias",
      "Pacientes ilimitadas",
      "Suporte prioritário",
    ],
    cta: "Assinar Pro",
  },
  {
    key: "enterprise",
    name: "Clínica",
    price: "R$ 597",
    period: "/mês",
    highlight: false,
    desc: "Para clínicas com múltiplos profissionais",
    features: [
      "Tudo do Pro, vários médicos numa conta só",
      "Cada médico com o seu próprio Segundo Cérebro",
      "Painel consolidado: pacientes e uso de IA por médico",
      "Integração com sistemas legados (TISS/TUSS)",
      "SLA de uptime garantido",
      "Gerente de conta dedicado",
    ],
    cta: "Falar com a equipe",
  },
];

const PAIN_POINTS = [
  {
    icon: "😤",
    problem: "Contrato anual preso",
    solution: "Sem fidelidade obrigatória. Cancele quando quiser, sem multa.",
  },
  {
    icon: "📵",
    problem: "WhatsApp virou recepção",
    solution: "O agente IA responde, agenda e confirma 24h/dia. Você fica com o que importa.",
  },
  {
    icon: "💸",
    problem: "Perda de R$ 4k/mês com faltas",
    solution: "Lembretes automáticos reduzem no-show em até 38%. ROI no primeiro mês.",
  },
  {
    icon: "🗂️",
    problem: "Prontuário genérico",
    solution: "Formulários específicos para pré-natal, DUM, ultrassom e alto risco.",
  },
  {
    icon: "💳",
    problem: "Taxa de cartão de 3–4%",
    solution: "PIX nativo sem taxas. Recibo digital automático após confirmação.",
  },
  {
    icon: "📊",
    problem: "Sem visão do consultório",
    solution: "Dashboard com taxa de ocupação, inadimplência e engajamento das pacientes.",
  },
];

const TESTIMONIALS = [
  {
    name: "Dr. Clóvis Bacha",
    role: "Ginecologista e Obstetra — Criador da plataforma",
    text: "Construí essa ferramenta porque não encontrei nada no mercado focado nas necessidades reais de uma gestação de alto risco. O agente IA respondeu mais de 200 mensagens de WhatsApp na primeira semana, liberando horas do meu dia.",
    avatar: "CB",
  },
];

const FAQS = [
  {
    q: "Preciso de conta no WhatsApp Business?",
    a: "Sim. Você precisará de um número dedicado e um App no Meta for Developers. Nossa equipe te auxilia na configuração em até 48h — o processo leva cerca de 20 minutos.",
  },
  {
    q: "O agente IA dá diagnóstico ou conduta médica?",
    a: "Não. O agente é treinado para agendar, responder dúvidas administrativas e orientar emergências ao SAMU/UPA. Toda conduta clínica permanece exclusivamente sua.",
  },
  {
    q: "Meus dados e os das pacientes ficam seguros?",
    a: "Sim. Usamos Supabase com criptografia em repouso, Row Level Security por paciente, e estamos em conformidade com a LGPD. Dados de saúde nunca são usados para treinar modelos de IA.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim, sem multa e sem carência. Você pode exportar todos os seus dados antes de cancelar.",
  },
  {
    q: "Funciona com meu sistema atual (iClinic, Feegow)?",
    a: "Na versão Clínica oferecemos integrações via API. Para Starter e Pro, a plataforma funciona de forma independente — a migração de dados pode ser feita com ajuda da nossa equipe.",
  },
  {
    q: "Quantas pacientes posso ter?",
    a: "Starter: até 50 pacientes ativas/mês. Pro e Clínica: ilimitadas.",
  },
];

function MedicosPage() {
  const [leadForm, setLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    specialty: "Ginecologia e Obstetrícia",
    city: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!leadForm.name || !leadForm.email) return;
    setSubmitting(true);
    await (supabase as any).from("doctor_leads").insert({
      name: leadForm.name,
      email: leadForm.email,
      phone: leadForm.phone || null,
      specialty: leadForm.specialty || null,
      city: leadForm.city || null,
      message: leadForm.message || null,
    });
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <main className="bg-background text-foreground">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[var(--gradient-warm)] px-6 py-24 md:py-36">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Para obstetras e ginecologistas
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-4 font-serif text-4xl leading-tight md:text-6xl">
              Seu consultório no <span className="text-primary">piloto automático</span>
            </h1>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Agente de IA 24h no WhatsApp que agenda, confirma e cobra. Portal pré-natal para suas
              pacientes. Sem contrato anual. Feito por obstetra, para obstetras.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <a
                href="#planos"
                className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
              >
                Ver planos
              </a>
              <a
                href="#contato"
                className="rounded-full border border-primary/40 bg-background/70 px-8 py-3.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
              >
                Falar com a equipe
              </a>
            </div>
          </Reveal>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { value: "38%", label: "Menos faltas" },
            { value: "24h", label: "Agendamento automático" },
            { value: "R$ 0", label: "Taxa no PIX" },
            { value: "14 dias", label: "Grátis para testar" },
          ].map((s) => (
            <Reveal key={s.label}>
              <div className="rounded-2xl border border-primary/10 bg-card/80 p-4 text-center shadow-sm backdrop-blur">
                <p className="font-serif text-2xl font-bold text-primary">{s.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Pain points → Solutions ────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-center font-serif text-3xl md:text-4xl">
              Problemas que você conhece bem
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
              Pesquisamos as principais reclamações de médicos com os softwares atuais. Cada dor
              virou uma funcionalidade.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PAIN_POINTS.map((p, i) => (
              <Reveal key={p.problem} delay={i * 0.06}>
                <SpotlightCard className="rounded-2xl border border-border bg-card p-6">
                  <p className="text-2xl">{p.icon}</p>
                  <p className="mt-3 font-medium text-muted-foreground line-through">{p.problem}</p>
                  <p className="mt-1 text-sm text-foreground">{p.solution}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── WhatsApp Agent Feature ─────────────────────────────── */}
      <section className="bg-[var(--gradient-warm)] px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <Reveal>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                  Destaque do Pro
                </p>
                <h2 className="mt-3 font-serif text-3xl md:text-4xl">
                  Agente de IA no WhatsApp que trabalha enquanto você dorme
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Pacientes enviam mensagem a qualquer hora. O agente responde em segundos, coleta
                  nome e motivo, verifica disponibilidade e registra o pedido de agendamento — tudo
                  sem intervenção humana.
                </p>
                <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="font-medium text-foreground">
                    🧠 → 🤖 Qual a diferença do Segundo Cérebro?
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    O Segundo Cérebro é o <strong>manual</strong> — o que ele sabe responder, do seu
                    jeito. O Agente de WhatsApp é <strong>quem atende</strong> com esse manual na
                    mão, 24h, no canal onde a paciente já está — sem ela precisar abrir o app.
                  </p>
                </div>
                <ul className="mt-6 space-y-3 text-sm">
                  {[
                    "Responde dúvidas frequentes (exames, preparo, convênio)",
                    "Coleta dados e cria pedido de agendamento no painel",
                    "Envia confirmação e lembrete 24h antes",
                    "Detecta urgências e orienta SAMU / UPA",
                    "LGPD compliant — opt-in explícito, dados criptografados",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Mock conversation */}
            <Reveal delay={0.1}>
              <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Exemplo de conversa
                </p>
                <div className="space-y-3">
                  {[
                    {
                      from: "patient",
                      text: "Oi, gostaria de marcar consulta com o Dr. Clóvis",
                      time: "23:14",
                    },
                    {
                      from: "agent",
                      text: "Olá! Sou a assistente virtual do Dr. Clóvis Bacha 👋 Com quem estou falando?",
                      time: "23:14",
                    },
                    { from: "patient", text: "Ana Lima", time: "23:15" },
                    {
                      from: "agent",
                      text: "Prazer, Ana! Qual o motivo da consulta? (ex: pré-natal, 2ª opinião, rotina)",
                      time: "23:15",
                    },
                    { from: "patient", text: "Pré-natal, estou com 8 semanas", time: "23:16" },
                    {
                      from: "agent",
                      text: "Que notícia linda! 🌸 Qual período prefere — manhã ou tarde? E tem alguma data preferida?",
                      time: "23:16",
                    },
                    { from: "patient", text: "Manhã, semana que vem", time: "23:17" },
                    {
                      from: "agent",
                      text: "Perfeito, Ana! Registrei: Pré-natal às 8 semanas, manhã, semana de 16/06. Nossa equipe confirma o horário em até 2h. ✅",
                      time: "23:17",
                    },
                  ].map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.from === "agent" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          msg.from === "agent"
                            ? "rounded-tl-sm bg-secondary text-foreground"
                            : "rounded-tr-sm bg-primary text-primary-foreground"
                        }`}
                      >
                        <p>{msg.text}</p>
                        <p
                          className={`mt-0.5 text-right text-[10px] ${msg.from === "agent" ? "text-muted-foreground" : "text-primary-foreground/70"}`}
                        >
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Segundo Cérebro — IA treinada na voz do médico ─────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                Segundo Cérebro
              </p>
              <h2 className="mt-3 font-serif text-3xl md:text-4xl">
                Uma IA que responde como <em>você</em> responderia
              </h2>
              <p className="mt-4 text-muted-foreground">
                Quantas vezes você já respondeu &ldquo;posso tomar dipirona?&rdquo; ou &ldquo;enjoo
                até quando é normal?&rdquo;. Centenas. O Segundo Cérebro aprende com as{" "}
                <strong>suas</strong> respostas, o <strong>seu</strong> jeito de acolher e as{" "}
                <strong>suas</strong> condutas — e passa a responder as próximas mil por você, do
                jeito que você responderia. A paciente sente que foi o médico dela que cuidou. E
                foi: com a sua voz, multiplicada.
              </p>
              <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left text-sm">
                <p className="font-medium text-foreground">📖 Pense nele como o seu manual</p>
                <p className="mt-1 text-muted-foreground">
                  Você escreve <strong>uma vez</strong>: seu jeito de falar, suas respostas de
                  sempre. Dois &ldquo;atendentes&rdquo; consultam esse manual para responder por
                  você: o <strong>Chat do app</strong> (tira dúvida) e o{" "}
                  <strong>Agente de WhatsApp</strong> (tira dúvida <em>e também</em> agenda, avisa
                  urgência — exclusivo do plano Pro). O manual é o mesmo; o que muda é quem atende e
                  onde.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Comparação: IA genérica × Segundo Cérebro */}
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-3xl border border-border bg-card p-6 opacity-75">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  🤖 IA genérica
                </p>
                <div className="mt-4 rounded-2xl rounded-tl-sm bg-secondary p-3.5 text-sm leading-relaxed text-muted-foreground">
                  &ldquo;Consulte um profissional de saúde. Analgésicos podem ter contraindicações
                  na gravidez. Não posso fornecer aconselhamento médico.&rdquo;
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Fria, evasiva, sem vínculo. A paciente sai e pergunta no Google.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="h-full rounded-3xl border-2 border-primary/30 bg-card p-6 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    🧠 Seu Segundo Cérebro
                  </p>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                    ✓ no seu estilo
                  </span>
                </div>
                <div className="mt-4 rounded-2xl rounded-tl-sm bg-primary/8 p-3.5 text-sm leading-relaxed text-foreground">
                  &ldquo;Pode ficar tranquila, Ana 🌸 Dipirona é liberada na gestação, como sempre
                  oriento: até 1g de 6/6h se precisar. Se a dor de cabeça vier forte ou com visão
                  embaçada, aí quero te ver — me chama que encaixamos você.&rdquo;
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  A sua conduta, o seu tom, o seu emoji. A paciente foi acolhida — por você.
                </p>
              </div>
            </Reveal>
          </div>

          {/* Como ele aprende — o loop em 3 passos */}
          <Reveal delay={0.15}>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  n: "1",
                  title: "Você responde uma vez",
                  text: "Suas orientações, áudios de consulta transcritos e respostas às perguntas das pacientes viram a base de conhecimento — com o seu vocabulário e as suas condutas.",
                },
                {
                  n: "2",
                  title: "O cérebro aprende o seu jeito",
                  text: "A IA é treinada para reproduzir o seu tom: como você acalma, como você explica, quando você chama para o consultório. Você revisa e aprova — cada aprovação o deixa mais parecido com você.",
                },
                {
                  n: "3",
                  title: "Ele responde as próximas mil",
                  text: "Disponível 24h no app e no WhatsApp. O que você validou, ele responde na hora; o que é caso novo ou sinal de alerta, ele encaminha para você — nunca inventa conduta.",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <p className="mt-3 font-medium">{s.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Fecho de convencimento */}
          <Reveal delay={0.2}>
            <div className="mt-10 rounded-3xl bg-[var(--gradient-primary)] p-8 text-center text-primary-foreground">
              <p className="font-serif text-xl md:text-2xl">
                Seu conhecimento atende uma paciente por vez.
                <br className="hidden md:block" /> Seu Segundo Cérebro atende todas — ao mesmo
                tempo.
              </p>
              <p className="mx-auto mt-3 max-w-2xl text-sm opacity-90">
                Enquanto concorrentes usam chatbots genéricos, suas pacientes conversam com a sua
                experiência clínica. É o tipo de diferencial que não dá para copiar: só existe um
                médico com as suas respostas.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Clinical Tools ────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Exclusivo para GO
            </p>
            <h2 className="mt-3 text-center font-serif text-3xl md:text-4xl">
              Ferramentas clínicas que você não encontra em nenhum outro sistema
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Calculadoras e protocolos específicos para obstetrícia e ginecologia — integrados ao
              prontuário, não num app separado.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "⚖️",
                title: "Biometria Fetal",
                desc: "Peso fetal estimado (Hadlock) + percentil Intergrowth-21 em segundos. Sem calculadora física.",
                badge: "Todo dia",
                link: "/calculadora",
              },
              {
                icon: "🧠",
                title: "EPDS Digital",
                desc: "Escala de Edinburgh para rastreio de depressão perinatal. A paciente preenche no celular antes da consulta.",
                badge: "SUS exige",
                link: "/epds",
              },
              {
                icon: "🩸",
                title: "Protocolo DMG",
                desc: "Critérios TOTG 75g, metas glicêmicas SBD 2022, calculadora de dose de insulina e ganho de peso IOM.",
                badge: "18% das gestantes",
                link: "/diabetes-gestacional",
              },
              {
                icon: "🫀",
                title: "Risco Pré-eclâmpsia",
                desc: "Checklist ACOG/SBH com recomendação automática de aspirina profilática (150 mg). Nenhum fator esquecido.",
                badge: "Prevenção",
                link: "/calculadora",
              },
            ].map((tool, i) => (
              <Reveal key={tool.title} delay={i * 0.06}>
                <a
                  href={tool.link}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
                >
                  <span className="text-3xl">{tool.icon}</span>
                  <span className="mt-3 inline-block self-start rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {tool.badge}
                  </span>
                  <p className="mt-2 font-semibold text-foreground group-hover:text-primary transition-colors">
                    {tool.title}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {tool.desc}
                  </p>
                </a>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-6 md:p-8">
              <div className="grid gap-6 md:grid-cols-2 md:items-center">
                <div>
                  <p className="font-semibold text-foreground text-lg">Por que isso importa?</p>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    A revisão de biometria fetal durante ultrassom consome{" "}
                    <strong className="text-foreground">5–10 minutos</strong> buscando tabelas. O
                    EPDS em papel precisa ser pontuado manualmente. O protocolo de DM gestacional é
                    consultado em PDF separado.
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Com essas ferramentas integradas, estimamos{" "}
                    <strong className="text-foreground">40–60 minutos salvos por dia</strong> de
                    consulta — tempo que volta para seus pacientes.
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Biometria fetal por USG", saved: "5–10 min salvos/consulta" },
                    { label: "EPDS manual pontuado", saved: "8 min salvos/paciente" },
                    { label: "Protocolo DMG consultado", saved: "3–5 min salvos/consulta" },
                    { label: "Checklist pré-eclâmpsia", saved: "Zero fatores esquecidos" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl bg-background/80 px-4 py-3 text-sm"
                    >
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium text-primary">{item.saved}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────── */}
      <section id="planos" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="text-center font-serif text-3xl md:text-4xl">
              Preços transparentes, sem surpresas
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
              Sem contrato anual. Sem taxa de implantação. Cancele quando quiser.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.key} delay={i * 0.07}>
                <div
                  className={`relative flex h-full flex-col rounded-3xl border p-6 shadow-[var(--shadow-card)] ${
                    plan.highlight ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-0.5 text-xs font-bold text-primary-foreground">
                      Mais popular
                    </span>
                  )}
                  <p className="text-sm font-semibold uppercase tracking-widest text-primary">
                    {plan.name}
                  </p>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="font-serif text-4xl font-bold">{plan.price}</span>
                    <span className="mb-1 text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 text-primary">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={plan.key === "enterprise" ? "#contato" : "/medicos/cadastro"}
                    className={`mt-8 block rounded-full py-3 text-center text-sm font-semibold transition ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-primary/40 text-primary hover:bg-primary/5"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <p className="mt-8 text-center text-xs text-muted-foreground">
              Todos os planos incluem 14 dias grátis sem cartão de crédito. · Planos em BRL,
              cobrados mensalmente. · WhatsApp Business API requer conta Meta Business (grátis até
              1.000 conversas/mês).
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────── */}
      <section className="bg-[var(--gradient-warm)] px-6 py-16">
        <div className="mx-auto max-w-3xl">
          {TESTIMONIALS.map((t) => (
            <Reveal key={t.name}>
              <blockquote className="rounded-3xl border border-primary/20 bg-card p-8 text-center shadow-[var(--shadow-card)]">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary font-serif text-xl text-primary-foreground">
                  {t.avatar}
                </div>
                <p className="font-serif text-xl leading-relaxed text-foreground">"{t.text}"</p>
                <p className="mt-4 text-sm font-semibold text-primary">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-center font-serif text-3xl">Perguntas frequentes</h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 0.04}>
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-medium hover:bg-secondary/40"
                  >
                    <span>{faq.q}</span>
                    <span
                      className={`ml-4 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                    >
                      ▾
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="border-t border-border px-6 pb-5 pt-3 text-sm text-muted-foreground">
                      {faq.a}
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Lead form / CTA ───────────────────────────────────── */}
      <section id="contato" className="bg-[var(--gradient-warm)] px-6 py-20">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <h2 className="text-center font-serif text-3xl md:text-4xl">Comece hoje mesmo</h2>
            <p className="mx-auto mt-3 text-center text-muted-foreground">
              Preencha o formulário e nossa equipe entra em contato em até 24h para configurar sua
              conta gratuitamente.
            </p>
          </Reveal>

          {submitted ? (
            <Reveal>
              <div className="mt-10 rounded-3xl border border-primary/20 bg-card p-10 text-center">
                <p className="text-4xl">🎉</p>
                <p className="mt-4 font-serif text-2xl">Recebemos seu contato!</p>
                <p className="mt-2 text-muted-foreground">
                  Nossa equipe entrará em contato em até 24h para agendar uma demonstração
                  personalizada.
                </p>
              </div>
            </Reveal>
          ) : (
            <Reveal delay={0.08}>
              <form
                onSubmit={submitLead}
                className="mt-10 space-y-4 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Nome completo *
                    </label>
                    <input
                      required
                      value={leadForm.name}
                      onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                      placeholder="Dr. João Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      E-mail *
                    </label>
                    <input
                      required
                      type="email"
                      value={leadForm.email}
                      onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                      placeholder="dr.joao@consultorio.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={leadForm.phone}
                      onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                      placeholder="(31) 9 9999-9999"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Cidade
                    </label>
                    <input
                      value={leadForm.city}
                      onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                      placeholder="Belo Horizonte"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Especialidade
                  </label>
                  <select
                    value={leadForm.specialty}
                    onChange={(e) => setLeadForm({ ...leadForm, specialty: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option>Ginecologia e Obstetrícia</option>
                    <option>Obstetrícia</option>
                    <option>Ginecologia</option>
                    <option>Medicina Fetal</option>
                    <option>Medicina da Mulher</option>
                    <option>Outra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    O que você quer resolver? (opcional)
                  </label>
                  <textarea
                    value={leadForm.message}
                    onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })}
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary resize-none"
                    placeholder="Ex: quero automatizar o WhatsApp e reduzir faltas..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Enviando..." : "Solicitar demonstração gratuita →"}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Sem spam. Sem compromisso. Retorno em até 24h.
                </p>
              </form>
            </Reveal>
          )}
        </div>
      </section>
    </main>
  );
}
