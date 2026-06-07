import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Clock, FileText, MessageCircle, Shield } from "lucide-react";

export const Route = createFileRoute("/primeira-consulta")({
  head: () => {
    return {
      meta: [
        { title: "Primeira consulta — o que esperar | Dr. Clóvis Bacha" },
        { name: "description", content: "Guia passo a passo da sua primeira consulta com o Dr. Clóvis Bacha: o que levar, duração, e como funciona o acolhimento." },
        { property: "og:title", content: "Primeira consulta — o que esperar" },
        { property: "og:description", content: "Guia passo a passo da sua primeira visita." },
      ],
    };
  },
  component: PrimeiraConsultaPage,
});

const passos = [
  { num: "01", titulo: "Acolhimento", texto: "Você é recebida pela equipe, sem pressa. Café, água e ambiente calmo enquanto aguarda." },
  { num: "02", titulo: "Conversa inicial", texto: "Conversamos sobre seu histórico, suas dúvidas e seus objetivos antes de qualquer exame." },
  { num: "03", titulo: "Exame clínico", texto: "Avaliação ginecológica e obstétrica com explicação de cada passo." },
  { num: "04", titulo: "Ultrassonografia", texto: "Quando indicada, realizada no próprio consultório com imagens compartilhadas com você." },
  { num: "05", titulo: "Plano de cuidado", texto: "Saímos juntos com um plano claro: exames, próxima consulta e o canal direto com a equipe." },
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
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Sua primeira visita</p>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl">O que esperar da sua primeira consulta.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          A primeira consulta é, antes de tudo, uma conversa. Aqui está exatamente como ela acontece — para que você chegue tranquila.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            { icon: Clock, label: "Duração", value: "60 minutos" },
            { icon: MessageCircle, label: "Retorno", value: "Em até 24h úteis" },
            { icon: Shield, label: "Sigilo", value: "Total e absoluto" },
            { icon: FileText, label: "Material", value: "Plano por escrito" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <Icon className="h-6 w-6 text-primary" />
              <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="font-serif text-xl text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-serif text-3xl">Passo a passo</h2>
          <ol className="mt-10 space-y-5">
            {passos.map((p) => (
              <li key={p.num} className="flex gap-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <span className="font-serif text-4xl text-primary">{p.num}</span>
                <div>
                  <p className="font-serif text-xl text-foreground">{p.titulo}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-3xl">O que trazer</h2>
            <ul className="mt-6 space-y-3">
              {trazer.map((t) => (
                <li key={t} className="border-l-2 border-primary/40 pl-4 text-foreground">{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-[var(--gradient-warm)] p-8">
            <p className="font-serif text-2xl text-foreground">Não sabe se é o momento certo?</p>
            <p className="mt-3 text-muted-foreground">Mande uma mensagem rápida pelo WhatsApp ou solicite seu horário — respondemos em até 24h úteis.</p>
            <Link to="/agendamento" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Agendar consulta</Link>
          </div>
        </div>
      </section>
    </>
  );
}