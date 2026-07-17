import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Baby, Building2, Hand, Printer, ScanFace, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Reveal } from "@/components/reveal";
import { SpotlightCard } from "@/components/motion-fx";
import { submitExperienceLead } from "@/lib/experiencia.functions";

export const Route = createFileRoute("/experiencia")({
  head: () => ({
    meta: [
      { title: "Experiência Perinatal 3D — toque o rostinho antes de nascer | Obstétrica" },
      {
        name: "description",
        content:
          "Do ultrassom 3D à escultura real: imprimimos a face do seu bebê em 3D para você tocar, guardar e emoldurar. Em clínicas parceiras de Belo Horizonte, com curadoria médica.",
      },
      { property: "og:title", content: "Toque o rostinho do seu bebê antes de nascer" },
      {
        property: "og:description",
        content: "A face do seu bebê, do ultrassom 3D para as suas mãos.",
      },
    ],
  }),
  component: ExperienciaPage,
});

const passos = [
  {
    icon: ScanFace,
    titulo: "Ultrassom 3D/4D",
    texto:
      "Você faz o ultrassom em uma clínica parceira, com toda a qualidade do exame de rotina — o mesmo exame vira a matéria-prima da experiência.",
  },
  {
    icon: Printer,
    titulo: "Impressão 3D da face",
    texto:
      "Transformamos a imagem em uma escultura física do rostinho do bebê, com curadoria do obstetra para fidelidade e delicadeza.",
  },
  {
    icon: Hand,
    titulo: "O primeiro toque",
    texto:
      "Você (e o papai, e os avós) tocam o rostinho antes do nascimento. É a parte que emociona — 9 em cada 10 famílias se surpreendem.",
  },
  {
    icon: Baby,
    titulo: "Para sempre com você",
    texto:
      "A escultura fica de lembrança: na estante, no quarto do bebê, no chá revelação. Um registro que nenhuma foto substitui.",
  },
];

function ExperienciaPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center md:py-24">
        <Reveal variant="up">
          <p className="glass-chip text-xs font-bold uppercase tracking-[0.22em] text-primary">
            Experiência Perinatal 3D
          </p>
          <h1 className="mt-4 font-serif text-4xl font-extrabold leading-tight md:text-5xl">
            Toque o rostinho do seu bebê antes de ele nascer.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Do ultrassom 3D para as suas mãos: uma escultura real da face do seu bebê, feita com
            curadoria médica em clínicas parceiras. Uma lembrança que a família toca, guarda e nunca
            esquece.
          </p>
          <a
            href="#quero-viver"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Quero viver essa experiência 💗
          </a>
        </Reveal>
      </section>

      {/* Como funciona */}
      <section className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <Reveal variant="up">
            <h2 className="text-center font-serif text-3xl">Como funciona</h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {passos.map((p, i) => (
              <Reveal key={p.titulo} variant="up" delay={i * 80}>
                <SpotlightCard className="flex h-full gap-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-lg font-bold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p.icon className="h-6 w-6 text-primary" />
                    <h3 className="mt-2 font-serif text-xl">{p.titulo}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
          <Reveal variant="up" delay={200}>
            <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center">
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" /> Em breve
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Visualização do bebê em óculos 3D, face impressa integrada a bebês reborn e a linha
                de cuidados <strong>Obstétrica</strong> com curadoria do seu médico para a gestação.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Formulário gestante */}
      <section id="quero-viver" className="mx-auto max-w-xl scroll-mt-20 px-5 py-16">
        <Reveal variant="up">
          <h2 className="text-center font-serif text-3xl">Quero viver a experiência</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Deixe seu contato e nossa equipe agenda com você na clínica parceira mais próxima.
          </p>
        </Reveal>
        <LeadForm kind="gestante" />
      </section>

      {/* Clínicas parceiras */}
      <section className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-xl px-5 py-16">
          <Reveal variant="up">
            <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <Building2 className="h-4 w-4" /> Para clínicas de imagem
            </p>
            <h2 className="mt-3 text-center font-serif text-3xl">Seja uma clínica parceira</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Ofereça a Experiência Perinatal 3D dentro da sua clínica: o exame é seu, a experiência
              é nossa, e cada indicação gera participação para a clínica. Sem custo de implantação.
            </p>
          </Reveal>
          <LeadForm kind="clinica" />
        </div>
      </section>
    </>
  );
}

function LeadForm({ kind }: { kind: "gestante" | "clinica" }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Belo Horizonte");
  const [weeks, setWeeks] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      // Atribuição de parceria: /experiencia?clinica=CODIGO marca qual clínica
      // indicou esta família (base da participação por indicação).
      const clinicRef =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("clinica")
          : null;
      const res = await submitExperienceLead({
        data: {
          kind,
          name,
          phone,
          email: email || null,
          city: city || null,
          weeks: kind === "gestante" && weeks ? Number(weeks) : null,
          clinicName: kind === "clinica" ? clinicName || name : null,
          clinicRef: clinicRef || null,
          message: message || null,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Falha de conexão — tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <p className="text-4xl">💗</p>
        <p className="mt-3 font-serif text-2xl">Recebemos seu contato!</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {kind === "gestante"
            ? "Nossa equipe vai falar com você pelo WhatsApp para agendar a sua experiência."
            : "Nossa equipe vai falar com você para apresentar o modelo de parceria."}
        </p>
      </div>
    );
  }

  const input =
    "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <form onSubmit={submit} className="mt-8 space-y-3">
      {kind === "clinica" && (
        <input
          required
          value={clinicName}
          onChange={(e) => setClinicName(e.target.value)}
          placeholder="Nome da clínica *"
          className={input}
        />
      )}
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={kind === "gestante" ? "Seu nome *" : "Nome do responsável *"}
        className={input}
      />
      <input
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="WhatsApp com DDD *"
        className={input}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-mail (opcional)"
        className={input}
      />
      <div className="flex gap-3">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Cidade"
          className={input}
        />
        {kind === "gestante" && (
          <input
            type="number"
            min={1}
            max={42}
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
            placeholder="Semanas"
            className={`${input} max-w-[110px]`}
          />
        )}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          kind === "gestante"
            ? "Alguma dúvida ou pedido especial? (opcional)"
            : "Conte um pouco sobre a clínica (opcional)"
        }
        rows={3}
        className={input}
      />
      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {sending
          ? "Enviando…"
          : kind === "gestante"
            ? "Quero tocar o rostinho do meu bebê 💗"
            : "Quero ser clínica parceira"}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Usamos seu contato só para este atendimento (LGPD).
      </p>
    </form>
  );
}
