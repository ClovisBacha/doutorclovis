import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Instagram } from "lucide-react";
import { useEffect, useState } from "react";
import { DOCTOR } from "@/lib/doctor.config";
import { listLivesPublic } from "@/lib/lives.functions";

export const Route = createFileRoute("/lives")({
  head: () => ({
    meta: [
      { title: "Lives e encontros — Obstétrica" },
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
  link: DOCTOR.instagram,
};

const anteriores = [
  { titulo: "Diabetes gestacional sem mistérios", data: "Mai/26" },
  { titulo: "Pré-eclâmpsia: sinais que ninguém te conta", data: "Abr/26" },
  { titulo: "Vacinas seguras na gestação", data: "Mar/26" },
];

type LiveStatus = "countdown" | "ao_vivo" | "encerrada";

function LivesPage() {
  const [timeLeft, setTimeLeft] = useState("");
  const [status, setStatus] = useState<LiveStatus>("countdown");
  // Lives do banco (gerenciadas no painel). Se a tabela não existir ou vier
  // vazia, mantém o conteúdo estático como fallback.
  const [next, setNext] = useState<{ titulo: string; data: string; link: string }>(proximaLive);
  const [past, setPast] =
    useState<{ titulo: string; data: string; link?: string | null }[]>(anteriores);

  useEffect(() => {
    (async () => {
      try {
        const res = await listLivesPublic();
        if (!res.ok || res.lives.length === 0) return;
        const now = Date.now();
        const withDate = res.lives.filter((l) => l.scheduled_at);
        // Próxima: a futura mais próxima; sem futura, a mais recente.
        const futures = withDate
          .filter((l) => new Date(l.scheduled_at as string).getTime() > now)
          .sort(
            (a, b) =>
              new Date(a.scheduled_at as string).getTime() -
              new Date(b.scheduled_at as string).getTime(),
          );
        const nextLive = futures[0] ?? withDate[0];
        if (nextLive) {
          setNext({
            titulo: nextLive.title,
            data: nextLive.scheduled_at as string,
            link: nextLive.link || DOCTOR.instagram,
          });
        }
        const pastLives = res.lives
          .filter((l) => l.id !== nextLive?.id)
          .slice(0, 6)
          .map((l) => ({
            titulo: l.title,
            data: l.scheduled_at
              ? new Date(l.scheduled_at).toLocaleDateString("pt-BR", {
                  month: "short",
                  year: "2-digit",
                })
              : "—",
            link: l.link,
          }));
        if (pastLives.length > 0) setPast(pastLives);
      } catch {
        /* fallback estático já está na tela */
      }
    })();
  }, []);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(next.data).getTime() - Date.now();
      if (diff > 0) {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff / 3600000) % 24);
        const m = Math.floor((diff / 60000) % 60);
        setTimeLeft(`${d}d ${h}h ${m}min`);
        setStatus("countdown");
      } else if (diff > -2 * 3600 * 1000) {
        setStatus("ao_vivo");
      } else {
        setStatus("encerrada");
      }
    };
    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, [next.data]);

  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Encontros gratuitos
      </p>
      <h1 className="mt-3 font-serif text-4xl">Lives no Instagram</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Uma vez por mês, o seu médico abre uma conversa ao vivo para tirar dúvidas reais. Gratuito,
        sem inscrição.
      </p>

      <div className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-8">
        <CalendarClock className="h-6 w-6 text-primary" />
        <p className="mt-3 text-xs uppercase tracking-[0.22em] text-primary">Próxima live</p>
        <p className="mt-2 font-serif text-2xl">{next.titulo}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {new Date(next.data).toLocaleString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        {status === "countdown" && (
          <p className="mt-4 font-serif text-3xl text-primary">{timeLeft}</p>
        )}
        {status === "ao_vivo" && (
          <p className="mt-4 inline-flex items-center gap-2 font-serif text-2xl text-red-500">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            Estamos ao vivo agora!
          </p>
        )}
        {status === "encerrada" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Esta live já foi encerrada. Confira o perfil do Instagram para o replay.
          </p>
        )}
        <a
          href={next.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          <Instagram className="h-4 w-4" />
          {status === "ao_vivo"
            ? "Entrar na live"
            : status === "encerrada"
              ? "Ver no Instagram"
              : "Ativar lembrete no Instagram"}
        </a>
      </div>

      <div className="mt-12">
        <h2 className="font-serif text-2xl">Lives anteriores</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {past.map((a) => (
            <a
              key={a.titulo}
              href={a.link || next.link}
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
