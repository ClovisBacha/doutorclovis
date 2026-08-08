import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/motion-fx";
import { PricingGlass, type PricingGlassTier } from "@/components/ui/pricing-glass";
import { EscadaDeMensagens } from "@/components/escada-mensagens";
import {
  DEGRAUS_DESTAQUE,
  descontoVsEntrada,
  gestantesAtendidas,
  precoDe,
} from "@/lib/planos-medico";

export const Route = createFileRoute("/medicos")({
  head: () => ({
    meta: [
      {
        title: "Para Médicos — Plataforma de Gestão para Obstetras e Ginecologistas",
      },
      {
        name: "description",
        content:
          "Uma IA treinada nas suas respostas atende suas pacientes 24h, no app e no WhatsApp. Feita por obstetra para obstetras. Sem contrato anual.",
      },
    ],
  }),
  component: MedicosPage,
});

// Não há plano ANUAL: a escada tem um Price graduado só, mensal — mostrar um
// preço anual sem Price atrás dele seria a tela prometer o que o checkout não
// cobra.
/**
 * Os cartões da escada.
 *
 * `monthly` NÃO é escrito à mão: sai de `precoDe`, a mesma função que o
 * checkout usa e que o teste trava contra as camadas do Stripe. Um número
 * digitado aqui seria a segunda tabela de preços — e é assim que a tela promete
 * um valor e a fatura cobra outro.
 *
 * São três cartões e dez degraus: o resto vive no seletor logo acima deles
 * (`EscadaDeMensagens`), onde o médico arrasta e vê preço, desconto e gestantes
 * mudarem ao vivo.
 *
 * Regra de ouro dos planos: cada bullet é algo que o produto FAZ hoje (ou é
 * entregue com implantação assistida, e diz isso). Nada de promessa vaga,
 * número inventado ou recurso de roadmap vendido como pronto.
 */
const [ENTRADA, MEIO, TOPO] = DEGRAUS_DESTAQUE;
const reais = (centavos: number) => centavos / 100;

const PLANS = [
  {
    key: "free",
    name: "Free",
    tagline: "Organize o consultório",
    monthly: 0,
    isFrom: false,
    perSuffix: "",
    highlight: false,
    desc: "A plataforma de gestão inteira, de graça e para sempre. Saia do caderno e do zap pessoal.",
    features: [
      "👩‍🍼 Pacientes ILIMITADAS — sem teto, como nos planos pagos",
      "App de pré-natal completo para as suas pacientes",
      "Consultas, pré-consulta digital e prontuário num lugar só",
      "Ferramentas clínicas: biometria, EPDS, DMG, pré-eclâmpsia",
      "Só não tem a IA respondendo pela sua voz — é isso que os pagos abrem",
    ],
    cta: "Criar conta grátis",
  },
  {
    key: "mensagens_entrada",
    mensagens: ENTRADA,
    name: "Consultório",
    tagline: "A sua IA atendendo",
    monthly: reais(precoDe(ENTRADA)),
    isFrom: false,
    perSuffix: "",
    highlight: false,
    desc: "Uma IA treinada nas SUAS respostas atende suas pacientes no app — você para de repetir as mesmas orientações.",
    features: [
      `💬 ${ENTRADA} mensagens de IA por mês · cerca de ${gestantesAtendidas(ENTRADA)} gestantes`,
      "👩‍🍼 Pacientes ILIMITADAS — o teto é de mensagens, não de gente",
      "IA com as suas respostas, 24h no app",
      "Pré-consulta digital + monitoramento (peso, pressão, chutes)",
    ],
    cta: `Começar por R$ ${reais(precoDe(ENTRADA)).toFixed(2).replace(".", ",")}`,
  },
  {
    key: "mensagens_meio",
    mensagens: MEIO,
    name: "Movimento",
    tagline: "Para quem já tem volume",
    monthly: reais(precoDe(MEIO)),
    isFrom: false,
    perSuffix: "",
    highlight: true,
    desc: "O mesmo produto inteiro, com muito mais conversa — e a mensagem mais barata a cada degrau que você sobe.",
    features: [
      `💬 ${MEIO.toLocaleString("pt-BR")} mensagens por mês · ${descontoVsEntrada(MEIO)}% mais barata cada uma`,
      `👩‍🍼 Cerca de ${gestantesAtendidas(MEIO)} gestantes ativas · pacientes ilimitadas`,
      "Dashboard do consultório: dúvidas frequentes e engajamento",
      "🎚️ Qualquer número entre os degraus, no seletor acima",
    ],
    cta: "Assinar Movimento",
  },
  {
    key: "mensagens_topo",
    mensagens: TOPO,
    name: "Alto risco",
    tagline: "Conversa o dia inteiro",
    monthly: reais(precoDe(TOPO)),
    isFrom: false,
    perSuffix: "",
    highlight: false,
    desc: "Para quem acompanha gestação de alto risco: a paciente pergunta quando precisa, e a mensagem chega ao preço mais baixo da escada.",
    features: [
      `💬 ${TOPO.toLocaleString("pt-BR")} mensagens por mês · ${descontoVsEntrada(TOPO)}% mais barata cada uma`,
      `👩‍🍼 Cerca de ${gestantesAtendidas(TOPO)} gestantes ativas · triagem de urgência com SAMU/UPA`,
      "💬 IA atende e agenda no WhatsApp (implantação assistida)",
      "🎚️ Qualquer número entre os degraus, no seletor acima",
    ],
    cta: "Assinar Alto risco",
  },
  {
    key: "enterprise",
    name: "Clínica",
    tagline: "Para clínicas e grupos",
    monthly: 0,
    customPrice: "Sob consulta",
    isFrom: false,
    perSuffix: "",
    highlight: false,
    desc: "A clínica inteira num painel só: vários médicos, cada um com o próprio Segundo Cérebro — operados individualmente. Preço personalizado pelo tamanho da sua equipe.",
    features: [
      "🏥 Painel da clínica: opere o cérebro de cada médico individualmente",
      `💬 Acima de ${TOPO.toLocaleString("pt-BR")} mensagens/mês, o volume é contratado — não tabelado`,
      "📊 Relatório mensal por médico (cobertura e satisfação da IA)",
      "👤 Gerente dedicado + onboarding e migração assistidos",
    ],
    cta: "Pedir orçamento",
  },
];

// As dores levantadas das reclamações reais dos concorrentes (Reclame Aqui:
// Doctoralia, iClinic, Feegow, Amplimed) — cada uma vira uma promessa nossa.
const PAIN_POINTS = [
  {
    icon: "🔒",
    problem: '"Fui preso num contrato de 12 meses e não consigo cancelar"',
    solution: "Aqui não há fidelidade. Cancela num clique, sem multa, sem ligar para ninguém.",
  },
  {
    icon: "🐌",
    problem: '"Abri chamado no suporte e a resposta demorou semanas"',
    solution: "Suporte com gente de verdade, resposta no mesmo dia. Você nunca fica na mão.",
  },
  {
    icon: "🎣",
    problem: '"Prometeram pacientes que nunca vieram — propaganda enganosa"',
    solution:
      "Nada de promessa vazia: comece grátis e veja o valor com as suas pacientes antes de pagar.",
  },
  {
    icon: "💸",
    problem: "Perda de milhares por mês com faltas",
    solution:
      "A IA confirma a consulta e lembra a paciente no canal onde ela já está — menos cadeira vazia.",
  },
  {
    icon: "📵",
    problem: "WhatsApp virou recepção 24h",
    solution: "A IA responde, agenda e tria por você — no canal onde a paciente já está.",
  },
  {
    icon: "💳",
    problem: "Taxa de cartão comendo o faturamento",
    solution: "Consultas particulares pagas por PIX, direto na sua chave — sem taxa de cartão.",
  },
];

const TESTIMONIALS = [
  {
    name: "O obstetra fundador",
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
    q: "O Segundo Cérebro dá diagnóstico ou conduta médica?",
    a: "Não. Ele só responde o que você já validou (suas respostas de sempre) e, no Nível 2 (Pro), também agenda e orienta emergências ao SAMU/UPA. Qualquer coisa nova ou fora do que você ensinou, ele encaminha para você — nunca inventa conduta.",
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
    a: "A plataforma funciona de forma independente do seu sistema atual — você pode usar os dois em paralelo. A migração de dados é feita com a ajuda da nossa equipe; integrações diretas são avaliadas caso a caso no Pro Equipe.",
  },
  {
    q: "Existe limite de mensagens da IA?",
    a: "Existe, e é justamente o que você contrata: o plano é medido em mensagens de IA por mês (150, 1.350, 11.100 — ou qualquer número entre eles, no seletor acima). Quanto mais você contrata, mais barata fica a mensagem: de 20 centavos na entrada a 9 centavos no topo, com o desconto subindo seis pontos a cada degrau. Se o mês acabar antes da cota, a paciente não fica sem resposta nem sem saída: ela é avisada de que o limite é DA PLATAFORMA (nunca seu) e recebe o caminho direto até você. E urgência nunca tem cota — sinal de alarme é sempre respondido e sempre encaminhado.",
  },
  {
    q: "Quantas pacientes posso ter?",
    a: "Quantas você quiser — não há teto de pacientes em nenhum plano, nem no Free. Esse limite existia e foi retirado: cobrar por cabeça punia justamente quem traz mais gestantes para a plataforma. O que você dimensiona é o volume de conversa com a IA, que é o que realmente custa. Uma paciente que não usa o chat não custa nada.",
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
  // Convite de PACIENTE (?convite=CODIGO): guarda por 90 dias e mostra o
  // banner de +15% — o desconto real entra no checkout, via Stripe.
  const [patientInvite, setPatientInvite] = useState<string | null>(null);
  useEffect(() => {
    try {
      const KEY = "obst_doc_invite";
      const code = new URLSearchParams(window.location.search).get("convite");
      if (code && /^[a-zA-Z0-9]{6,12}$/.test(code)) {
        localStorage.setItem(KEY, JSON.stringify({ code: code.toUpperCase(), at: Date.now() }));
        setPatientInvite(code.toUpperCase());
        return;
      }
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { code?: string; at?: number };
        if (parsed?.code && Date.now() - (parsed.at ?? 0) < 90 * 86400000)
          setPatientInvite(parsed.code);
      }
    } catch {
      /* sem storage, sem banner */
    }
  }, []);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!leadForm.name || !leadForm.email) return;
    setSubmitting(true);
    // Nunca engolir o erro: um lead perdido em silêncio é um cliente perdido.
    const { error } = await (supabase as any).from("doctor_leads").insert({
      name: leadForm.name,
      email: leadForm.email,
      phone: leadForm.phone || null,
      specialty: leadForm.specialty || null,
      city: leadForm.city || null,
      message: leadForm.message || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não conseguimos enviar seu contato. Tente de novo ou chame no WhatsApp.");
      return;
    }
    setSubmitted(true);
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
              Uma IA treinada com as <strong>suas</strong> respostas atende suas pacientes 24h,
              agenda e reduz as faltas. Comece de graça — você só paga quando ver valor. Feito por
              obstetra, para obstetras.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <a
                href="/medicos/cadastro"
                className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
              >
                Começar grátis
              </a>
              <a
                href="#planos"
                className="rounded-full border border-primary/40 bg-background/70 px-8 py-3.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
              >
                Ver planos
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.26}>
            <p className="mt-4 text-xs text-muted-foreground">
              Grátis para sempre no plano inicial · sem cartão de crédito · cancele quando quiser
            </p>
          </Reveal>
        </div>

        {/* Garantias — cada uma responde à maior dor dos concorrentes */}
        <div className="mx-auto mt-16 grid max-w-3xl gap-4 sm:grid-cols-3">
          {[
            {
              icon: "🔓",
              title: "Sem fidelidade",
              text: "Cancele quando quiser, num clique. Nunca vamos te prender por 12 meses.",
            },
            {
              icon: "🎁",
              title: "Grátis para começar",
              text: "Teste com pacientes de verdade. Só cobra quando o valor for seu.",
            },
            {
              icon: "⚡",
              title: "Suporte no mesmo dia",
              text: "Gente de verdade responde rápido. Sem ticket que some por semanas.",
            },
          ].map((g) => (
            <Reveal key={g.title}>
              <div className="h-full rounded-2xl border border-primary/15 bg-card/80 p-5 text-left shadow-sm backdrop-blur">
                <p className="text-2xl">{g.icon}</p>
                <p className="mt-2 font-semibold">{g.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{g.text}</p>
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

      {/* ── Segundo Cérebro — UM produto, dois alcances ─────────── */}
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

          {/* Onde ele atende — o MESMO cérebro, dois alcances (não dois produtos) */}
          <Reveal delay={0.12}>
            <div className="mt-14">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                Um cérebro só, dois alcances
              </p>
              <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
                Você treina <strong>uma vez</strong>. Onde ele atende depende só do seu plano — é o
                mesmo cérebro ficando mais presente, não um segundo recurso para aprender.
              </p>
              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <div className="rounded-3xl border border-border bg-card p-6">
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                    Nível 1 · a partir de R$ 29,90
                  </span>
                  <p className="mt-4 text-3xl">📱</p>
                  <p className="mt-2 font-serif text-xl">Atende dentro do app</p>
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">✓</span>Responde dúvidas 24h, com o seu
                      jeito
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">✓</span>Encaminha para você o que não
                      sabe
                    </li>
                  </ul>
                </div>
                <div className="relative rounded-3xl border-2 border-primary/30 bg-primary/5 p-6 shadow-[var(--shadow-card)]">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Nível 2 · a partir de R$ 205,40
                  </span>
                  <p className="mt-4 text-3xl">📱 + 💬</p>
                  <p className="mt-2 font-serif text-xl">Atende também no WhatsApp</p>
                  <ul className="mt-4 space-y-2 text-sm text-foreground">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">✓</span>Tudo do Nível 1, onde a paciente
                      já está
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">✓</span>Agenda consulta sozinho, sem
                      você abrir o painel
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">✓</span>Detecta urgência e orienta
                      SAMU/UPA
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">✓</span>LGPD compliant — opt-in
                      explícito
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Mock conversation — o Nível 2 em ação */}
          <Reveal delay={0.16}>
            <div className="mx-auto mt-8 max-w-md rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                O Nível 2 em ação, no WhatsApp
              </p>
              <div className="space-y-3">
                {[
                  {
                    from: "patient",
                    text: "Oi, gostaria de marcar uma consulta com a Dra. Ana",
                    time: "23:14",
                  },
                  {
                    from: "agent",
                    text: "Olá! Sou a assistente virtual da Dra. Ana 👋 Com quem estou falando?",
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
      <section
        id="planos"
        className="relative overflow-hidden px-6 py-24 text-white"
        style={{
          background: "radial-gradient(120% 90% at 50% 0%, #2a151a 0%, #1a0e12 45%, #120a0d 100%)",
        }}
      >
        <div className="relative z-10 mx-auto max-w-6xl">
          <Reveal>
            <h2 className="text-center font-serif text-3xl text-white md:text-4xl">
              Escolha pelo que quer tirar do seu prato
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-white/60">
              Sem contrato, sem taxa de implantação, sem fidelidade. Suba ou desça de plano quando
              quiser — cancele num clique.
            </p>
            {patientInvite && (
              <p className="mx-auto mt-4 w-fit rounded-full border border-emerald-300/40 bg-emerald-400/10 px-5 py-2 text-center text-sm font-semibold text-emerald-200">
                🎁 Convite de paciente ativo: <strong>+15% de desconto adicional</strong> em
                qualquer plano, para sempre — aplicado automaticamente no checkout.
              </p>
            )}
          </Reveal>

          {/* ─── O SELETOR, ANTES DOS CARTÕES ──────────────────────────────
              Os cartões mostram três degraus; a escada tem dez. Sem isto, quem
              queria 1.250 mensagens não via o preço em lugar nenhum antes de
              abrir o Stripe — e o meio da escada é exatamente onde ela foi
              desenhada para levar a pessoa. */}
          <Reveal>
            <EscadaDeMensagens
              className="mt-8"
              onEscolher={(mensagens) => {
                /* Carrega a quantidade para o cadastro; de lá ela segue para o
                   checkout. Sem isto o botão do seletor levaria a pessoa para
                   um fluxo que esquece o número que ela acabou de escolher. */
                window.location.href = `/medicos/cadastro?mensagens=${mensagens}`;
              }}
            />
          </Reveal>

          {(() => {
            /* ─── SEM ALTERNADOR ANUAL, E ISSO É CORREÇÃO ────────────────────
               A escada de mensagens é MENSAL: existe um Price graduado só, e
               nenhum Price anual atrás dele. O alternador continuava mostrando
               "25% OFF no anual" sobre os preços novos — ou seja, a tela
               anunciava um valor que o checkout não tem como cobrar.

               É o defeito que esta base já perseguiu quatro vezes com outro
               nome: duas tabelas de preço para a mesma compra. Aqui a segunda
               tabela era uma multiplicação na hora de renderizar.

               Sem fidelidade continua valendo, e é o que a nota diz. */
            const glassTiers: PricingGlassTier[] = PLANS.map((plan) => {
              const customPrice = (plan as { customPrice?: string }).customPrice;
              const shown = plan.monthly;
              return {
                name: plan.name,
                tagline: plan.tagline,
                price: shown % 1 === 0 ? String(shown) : shown.toFixed(2).replace(".", ","),
                customPrice,
                // O sufixo por assento (ex.: "/médico") vai para a nota — inline,
                // ao lado do número de 60px, estouraria o card estreito.
                period: plan.monthly === 0 ? "/sempre" : "/mês",
                fromPrefix: plan.isFrom,
                footnote: customPrice
                  ? "orçamento pelo tamanho da equipe"
                  : plan.monthly === 0
                    ? "grátis, para sempre"
                    : "por mês · sem fidelidade, cancele quando quiser",
                isPopular: plan.highlight,
                features: plan.features,
                ctaLabel: plan.cta,
                /* O cartão leva a quantidade DELE — senão os três botões caem
                   no mesmo cadastro sem número e o degrau escolhido se perde. */
                ctaHref:
                  plan.key === "enterprise"
                    ? "#contato"
                    : "mensagens" in plan
                      ? `/medicos/cadastro?mensagens=${(plan as { mensagens: number }).mensagens}`
                      : "/medicos/cadastro",
              };
            });
            return (
              <PricingGlass
                className="mt-8"
                tiers={glassTiers}
                toggleNote="🎚️ Qualquer número entre os degraus: use o seletor acima, ou ajuste no próprio checkout."
              />
            );
          })()}

          <Reveal>
            <p className="mt-10 text-center text-xs text-white/50">
              Valores em BRL. · O WhatsApp usa a conta Meta Business do próprio médico (grátis até
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
                    <ChevronDown
                      aria-hidden
                      className={`ml-4 h-4 w-4 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                    />
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
