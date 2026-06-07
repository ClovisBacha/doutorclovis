import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartHandshake, Users, BookOpen, Phone, Shield, Sparkles } from "lucide-react";

export const Route = createFileRoute("/acompanhante")({
  head: () => ({
    meta: [
      { title: "Programa do Acompanhante — Dr. Clóvis Bacha" },
      { name: "description", content: "Orientações e suporte para parceiros, familiares e doulas que acompanham a gestação." },
    ],
  }),
  component: AcompanhantePage,
});

const beneficios = [
  { icon: Users, t: "Presença garantida", d: "Acompanhante em consultas, exames e no parto, conforme legislação." },
  { icon: BookOpen, t: "Material exclusivo", d: "Guia em PDF com o que esperar mês a mês e como apoiar a gestante." },
  { icon: Phone, t: "Canal direto", d: "WhatsApp dedicado para dúvidas do acompanhante entre consultas." },
  { icon: Shield, t: "Treinamento básico", d: "Sinais de alerta, como agir e quando chamar a equipe." },
  { icon: HeartHandshake, t: "Pós-parto", d: "Orientação sobre puerpério, amamentação e suporte emocional." },
  { icon: Sparkles, t: "Vínculo desde o início", d: "Práticas para fortalecer o laço com o bebê desde a gestação." },
];

function AcompanhantePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Programa exclusivo</p>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl">Você não vive isso sozinha.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Um programa pensado para incluir, preparar e empoderar quem caminha ao seu lado nessa jornada — parceiro, mãe, irmã, amiga ou doula.
        </p>
      </section>

      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-16 md:grid-cols-2 lg:grid-cols-3">
          {beneficios.map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <Icon className="h-7 w-7 text-primary" />
              <p className="mt-4 font-serif text-xl text-foreground">{t}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h2 className="font-serif text-3xl">Inclua seu acompanhante</h2>
        <p className="mt-4 text-muted-foreground">
          No momento do agendamento, sinalize a participação do acompanhante para receber o material e o convite ao grupo.
        </p>
        <Link
          to="/agendamento"
          className="mt-8 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-90"
        >
          Agendar consulta
        </Link>
      </section>
    </>
  );
}
