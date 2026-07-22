import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ListChecks, MessageSquare, Backpack } from "lucide-react";

export const Route = createFileRoute("/modo-acompanhante")({
  head: () => ({
    meta: [
      { title: "Modo Acompanhante — Guia para parceiros | Obstétrica" },
      {
        name: "description",
        content:
          "Um guia prático para quem acompanha a gestante: o que fazer em cada fase, o que dizer no parto e a mala do acompanhante.",
      },
      { property: "og:title", content: "Modo Acompanhante" },
      {
        property: "og:description",
        content: "Conteúdo escrito para pais, parceiros e acompanhantes.",
      },
    ],
  }),
  component: ModoAcompanhante,
});

const fases = [
  {
    fase: "1º trimestre",
    o_que_fazer:
      "Esteja presente em consultas e exames. Assuma tarefas que envolvem cheiros fortes (lixo, cozinha).",
    o_que_dizer: "‘Como você está hoje? O que posso fazer agora?’",
  },
  {
    fase: "2º trimestre",
    o_que_fazer: "Acompanhe o morfológico. Comece a planejar enxoval e quarto juntos.",
    o_que_dizer: "‘Eu também já amo esse bebê.’",
  },
  {
    fase: "3º trimestre",
    o_que_fazer: "Treine o trajeto até a maternidade. Mantenha o tanque cheio e a mala pronta.",
    o_que_dizer: "‘Estou com você. Respira comigo.’",
  },
  {
    fase: "Trabalho de parto",
    o_que_fazer: "Cronometrar contrações. Ofereça água, massagem lombar, ambiente calmo.",
    o_que_dizer: "Frases curtas e firmes: ‘Você consegue. Estou aqui.’",
  },
];

const mala = [
  "Carregador de celular (cabo longo)",
  "Lanches leves e garrafa d'água",
  "Muda de roupa confortável",
  "Chinelo e meias",
  "Documentos da gestante + seus",
  "Câmera ou celular com bateria cheia",
  "Travesseiro pequeno",
  "Higiene pessoal básica",
];

function ModoAcompanhante() {
  return (
    <>
      <section className="border-b border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-4xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Para quem acompanha
          </p>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">Modo Acompanhante</h1>
          <p className="mt-5 max-w-2xl text-muted-foreground">
            Pai, parceira, mãe, irmã, amiga: o seu papel é grande. Aqui está um guia prático para
            você apoiar de verdade — sem achismo, sem ansiedade.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h2 className="font-serif text-2xl">O que fazer e o que dizer em cada fase</h2>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {fases.map((f) => (
            <div
              key={f.fase}
              className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
            >
              <p className="font-serif text-xl text-primary">{f.fase}</p>
              <p className="mt-3 text-sm">
                <strong className="text-foreground">Faça: </strong>
                <span className="text-muted-foreground">{f.o_que_fazer}</span>
              </p>
              <p className="mt-2 text-sm">
                <strong className="text-foreground">Diga: </strong>
                <span className="text-muted-foreground">{f.o_que_dizer}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-4xl px-5 py-16">
          <div className="flex items-center gap-3">
            <Backpack className="h-6 w-6 text-primary" />
            <h2 className="font-serif text-2xl">A sua mala (do acompanhante)</h2>
          </div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {mala.map((m) => (
              <li
                key={m}
                className="flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"
              >
                <ListChecks className="mt-0.5 h-4 w-4 text-primary" /> <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16">
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-8">
          <Heart className="h-6 w-6 text-primary" />
          <p className="mt-3 font-serif text-2xl">Lei do Acompanhante</p>
          <p className="mt-2 text-sm text-muted-foreground">
            No Brasil (Lei 11.108/2005), toda gestante tem direito a um acompanhante de sua escolha
            durante todo o trabalho de parto, parto e pós-parto imediato — inclusive no SUS e em
            planos privados.
          </p>
          <Link
            to="/agendamento"
            className="mt-5 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
          >
            Conhecer o consultório juntos
          </Link>
        </div>
      </section>
    </>
  );
}
