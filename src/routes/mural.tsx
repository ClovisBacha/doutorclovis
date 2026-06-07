import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/mural")({
  head: () => ({
    meta: [
      { title: "Mural dos bebês — Dr. Clóvis Bacha" },
      { name: "description", content: "Galeria de bebês nascidos sob nossos cuidados. Compartilhada com autorização das famílias." },
    ],
  }),
  component: MuralPage,
});

const bebes = [
  { nome: "Helena", data: "Mar/2026", msg: "Nossa pequena guerreira chegou bem!" },
  { nome: "Bento", data: "Fev/2026", msg: "Gratidão a toda a equipe." },
  { nome: "Maitê", data: "Jan/2026", msg: "Cuidado humano do início ao fim." },
  { nome: "Theo", data: "Dez/2025", msg: "Acompanhamento impecável." },
  { nome: "Lara", data: "Nov/2025", msg: "Confiança total na conduta." },
  { nome: "Heitor", data: "Out/2025", msg: "Gestação tranquila apesar do risco." },
  { nome: "Aurora", data: "Set/2025", msg: "Time que se torna família." },
  { nome: "Davi", data: "Ago/2025", msg: "Toda dúvida respondida com paciência." },
  { nome: "Liz", data: "Jul/2025", msg: "Recomendo de olhos fechados." },
  { nome: "Miguel", data: "Jun/2025", msg: "Senti-me segura em cada passo." },
  { nome: "Cecília", data: "Mai/2025", msg: "Doutor presente sempre." },
  { nome: "Arthur", data: "Abr/2025", msg: "Atenção que faz diferença." },
];

const cores = [
  "from-rose-100 to-rose-200",
  "from-amber-100 to-amber-200",
  "from-sky-100 to-sky-200",
  "from-emerald-100 to-emerald-200",
  "from-violet-100 to-violet-200",
  "from-orange-100 to-orange-200",
];

function MuralPage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Histórias reais</p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">Mural dos nossos bebês</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Cada rostinho aqui é uma história de amor e cuidado. Publicado com a autorização das famílias.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {bebes.map((b, i) => (
          <figure
            key={b.nome}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
          >
            <div className={`flex aspect-square items-center justify-center bg-gradient-to-br ${cores[i % cores.length]}`}>
              <Heart className="h-12 w-12 text-primary/60" fill="currentColor" />
            </div>
            <figcaption className="p-4">
              <p className="font-serif text-xl text-foreground">{b.nome}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{b.data}</p>
              <p className="mt-2 text-sm italic text-muted-foreground">"{b.msg}"</p>
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Quer que seu bebê apareça aqui? Envie a foto pelo WhatsApp após o parto com autorização de uso.
      </p>
    </section>
  );
}
