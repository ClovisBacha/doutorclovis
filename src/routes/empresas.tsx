import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { submitCorporateLead } from "@/lib/corporativo.functions";
import { DOCTOR } from "@/lib/doctor.config";
import { PricingGlass, type PricingGlassTier } from "@/components/ui/pricing-glass";

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: "Benefício Corporativo — Obstétrica" },
      {
        name: "description",
        content:
          "Ofereça acompanhamento pré-natal de excelência como benefício para suas funcionárias grávidas.",
      },
    ],
  }),
  component: EmpresasPage,
});

const PLANS = [
  {
    key: "basico",
    name: "Básico",
    price: "R$ 500/mês",
    seats: "até 10 funcionárias",
    color: "border-border",
    features: [
      "Portal completo de pré-natal",
      "Acompanhamento semana a semana",
      "Diário, saúde e checklist",
      "Chat com IA obstétrica",
      "Suporte por e-mail",
    ],
  },
  {
    key: "standard",
    name: "Standard",
    price: "R$ 1.500/mês",
    seats: "até 50 funcionárias",
    color: "border-primary",
    highlight: true,
    features: [
      "Tudo do Básico",
      "Escola do Bebê (12 módulos)",
      "Portal da família / álbum",
      "Pós-parto e marcos do bebê",
      "Relatórios de engajamento (em breve)",
      "Suporte prioritário",
    ],
  },
  {
    key: "premium",
    name: "Premium",
    price: "R$ 2.500/mês",
    seats: "até 100 funcionárias",
    color: "border-amber-400",
    features: [
      "Tudo do Standard",
      "Consultas particulares com desconto",
      "Teleconsulta dedicada",
      "Dashboard de saúde para RH (em breve)",
      "Relatório de Alta Pré-natal (em breve)",
      "Gerente de conta dedicado",
    ],
  },
];

const EMPLOYEE_OPTIONS = [
  "1–50 funcionários",
  "51–200 funcionários",
  "201–500 funcionários",
  "500+ funcionários",
];

function EmpresasPage() {
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    employeeCount: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName || !form.contactName || !form.contactEmail) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitCorporateLead({
        data: {
          companyName: form.companyName,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone || null,
          employeeCount: form.employeeCount || null,
          message: form.message || null,
        },
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(res.error ?? "Erro ao enviar. Tente novamente.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background py-24 px-5">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary mb-6">
            Benefício Corporativo
          </div>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight">
            Cuide de quem cuida da empresa
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Ofereça às suas funcionárias grávidas o acompanhamento pré-natal mais completo do
            Brasil, com tecnologia e a expertise de especialistas em gestação de alto risco.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#contato"
              className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Solicitar demonstração grátis
            </a>
            <a
              href="#planos"
              className="rounded-full border border-border px-8 py-3 text-sm font-semibold hover:border-primary hover:text-primary"
            >
              Ver planos
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-5">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-serif text-3xl text-center mb-12">
            Por que oferecer este benefício?
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                emoji: "💛",
                title: "Retenção de talentos",
                desc: "Funcionárias que se sentem cuidadas permanecem. A taxa de retorno pós-licença aumenta com suporte médico de qualidade.",
              },
              {
                emoji: "🏥",
                title: "Menos absenteísmo",
                desc: "Gestantes acompanhadas têm menos complicações e intercorrências, reduzindo ausências não planejadas.",
              },
              {
                emoji: "📊",
                title: "ROI mensurável",
                desc: "Relatórios de engajamento e uso para o RH acompanhar o programa das funcionárias gestantes (em desenvolvimento).",
              },
              {
                emoji: "⚕️",
                title: "Médico especialista",
                desc: "Cada gestante é acompanhada pelo próprio obstetra, com o suporte de especialistas em gestação de alto risco.",
              },
              {
                emoji: "📱",
                title: "Tecnologia completa",
                desc: "Portal web + mobile com diário, saúde, checklists, escola do bebê, IA obstétrica e muito mais.",
              },
              {
                emoji: "🤝",
                title: "Sem burocracia",
                desc: "Ativação em minutos: a empresa recebe um código de acesso e as funcionárias se cadastram sozinhas.",
              },
            ].map((b) => (
              <div key={b.title} className="rounded-2xl border border-border bg-card p-6">
                <p className="text-3xl mb-3">{b.emoji}</p>
                <h3 className="font-semibold mb-2">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section
        id="planos"
        className="relative overflow-hidden px-5 py-24 text-white"
        style={{
          background: "radial-gradient(120% 90% at 50% 0%, #2a151a 0%, #1a0e12 45%, #120a0d 100%)",
        }}
      >
        <div className="relative z-10 mx-auto max-w-6xl">
          <h2 className="mb-3 text-center font-serif text-3xl text-white">Planos</h2>
          <p className="mb-4 text-center text-white/60">
            Preços mensais com faturamento anual. Todos os planos incluem onboarding gratuito.
          </p>
          {(() => {
            const glassTiers: PricingGlassTier[] = PLANS.map((plan) => {
              const match = plan.price.match(/R\$\s*([\d.]+)/);
              return {
                name: plan.name,
                tagline: plan.seats,
                price: match ? match[1] : plan.price,
                period: "/mês",
                isPopular: !!plan.highlight,
                features: plan.features,
                ctaLabel: "Contratar",
                ctaHref: "#contato",
              };
            });
            return <PricingGlass tiers={glassTiers} />;
          })()}
          <p className="mt-8 text-center text-xs text-white/50">
            Precisa de mais vagas ou plano personalizado? Entre em contato — temos soluções sob
            medida.
          </p>
        </div>
      </section>

      {/* Contact form */}
      <section id="contato" className="py-20 px-5 bg-secondary/20">
        <div className="mx-auto max-w-xl">
          <h2 className="font-serif text-3xl text-center mb-3">Solicitar demonstração</h2>
          <p className="text-center text-sm text-muted-foreground mb-8">
            Nossa equipe entra em contato em até 24 horas úteis com uma proposta personalizada.
          </p>

          {submitted ? (
            <div className="rounded-3xl border border-green-200 bg-green-50 p-10 text-center">
              <p className="text-4xl mb-4">🎉</p>
              <h3 className="font-serif text-xl font-semibold mb-2">Recebemos seu contato!</h3>
              <p className="text-sm text-green-700">
                Em até 24 horas úteis nossa equipe entrará em contato com a proposta para{" "}
                {form.companyName}.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-border bg-card p-8 space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nome da empresa *</label>
                  <input
                    required
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                    placeholder="Acme S.A."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Seu nome *</label>
                  <input
                    required
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                    placeholder="Maria Silva"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">E-mail corporativo *</label>
                  <input
                    required
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                    placeholder="maria@empresa.com.br"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Telefone / WhatsApp</label>
                  <input
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                    placeholder="(11) 9 9999-9999"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Tamanho da empresa</label>
                <select
                  value={form.employeeCount}
                  onChange={(e) => setForm({ ...form, employeeCount: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                >
                  <option value="">Selecione…</option>
                  {EMPLOYEE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Mensagem (opcional)</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={3}
                  placeholder="Conte um pouco sobre sua necessidade…"
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={
                  submitting || !form.companyName || !form.contactName || !form.contactEmail
                }
                className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {submitting ? "Enviando…" : "Solicitar demonstração gratuita"}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                Seus dados são tratados com confidencialidade. Sem spam.
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
