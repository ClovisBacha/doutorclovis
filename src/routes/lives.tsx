import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Instagram } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/lives")({
  head: () => ({
    meta: [
      { title: "Lives e encontros com Dr. Clóvis Bacha" },
      {
        name: "description",
        content:
          "Próximas lives no Instagram, calendário de encontros gratuitos e gravações anteriores.",
      },
      { property: "og:title", content: "Lives e encontros" },
      { property: "og:description", content: "Participe das lives gratuitas no Instagram." },
    ],
  }),
  component: LivesPage,
});

const proximaLive = {
  titulo: "Sangramento no início da gestação: quando se preocupar",
  data: "2026-06-20T20:00:00-03:00",
  link: "https://instagram.com/drclovisbacha",
};

const anteriores = [
  { titulo: "Diabetes gestacional sem mistérios", data: "Mai/26" },
  { titulo: "Pré-eclâmpsia: sinais que ninguém te conta", data: "Abr/26" },
  { titulo: "Vacinas seguras na gestação", data: "Mar/26" },
];

function LivesPage() {
  const [restante, setRestante] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = new Date(proximaLive.data).getTime() - Date.now();
      if (diff <= 0) return setRestante("Estamos ao vivo!");
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      setRestante(`${d}d ${h}h ${m}min`);
    };
    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, []);

  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Encontros gratuitos
      </p>
      <h1 className="mt-3 font-serif text-4xl">Lives no Instagram</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Uma vez por mês, o Dr. Clóvis abre uma conversa ao vivo para tirar dúvidas reais. Gratuito,
        sem inscrição.
      </p>

      <div className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-8">
        <CalendarClock className="h-6 w-6 text-primary" />
        <p className="mt-3 text-xs uppercase tracking-[0.22em] text-primary">Próxima live</p>
        <p className="mt-2 font-serif text-2xl">{proximaLive.titulo}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {new Date(proximaLive.data).toLocaleString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <p className="mt-4 font-serif text-3xl text-primary">{restante}</p>
        <a
          href={proximaLive.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          <Instagram className="h-4 w-4" /> Ativar lembrete no Instagram
        </a>
      </div>

      <div className="mt-12">
        <h2 className="font-serif text-2xl">Lives anteriores</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {anteriores.map((a) => (
            <a
              key={a.titulo}
              href={proximaLive.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-transform hover:-translate-y-1"
            >
              <Instagram className="h-5 w-5 text-primary" />
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {a.data}
              </p>
              <p className="mt-1 font-serif text-lg">{a.titulo}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
