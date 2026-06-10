import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";

export const Route = createFileRoute("/cards")({
  head: () => ({
    meta: [
      { title: "Cards da gestação — compartilhe seu momento | Dr. Clóvis Bacha" },
      {
        name: "description",
        content:
          "Crie um card lindo da semana da sua gestação para compartilhar no Instagram ou WhatsApp.",
      },
      { property: "og:title", content: "Cards da gestação" },
      { property: "og:description", content: "Personalize e compartilhe sua semana gestacional." },
    ],
  }),
  component: CardsPage,
});

const marcos: Record<number, string> = {
  6: "Primeiro batimento",
  8: "Forma de feijão 🌱",
  12: "Saiu do 1º trimestre 🎉",
  16: "Já dá pra saber o sexo",
  20: "Metade do caminho 💛",
  24: "Viabilidade ✨",
  28: "Reta final começa",
  32: "Quase lá",
  37: "Bebê a termo 👶",
  40: "Hora de nascer 💖",
};

function CardsPage() {
  const [semana, setSemana] = useState(20);
  const [nome, setNome] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const marco = marcos[semana] ?? "Mais uma semana de amor";

  async function compartilhar() {
    const text = `${semana} semanas! ${marco} ${nome ? `— ${nome}` : ""}\nAcompanhamento com Dr. Clóvis Bacha`;
    const url = typeof window !== "undefined" ? window.location.origin : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Minha gestação", text, url });
      } catch {
        /* ignore */
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert("Texto copiado!");
    }
  }

  async function baixar() {
    if (!ref.current) return;
    // Usa SVG → PNG via canvas
    const el = ref.current;
    const w = el.offsetWidth,
      h = el.offsetHeight;
    const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${el.outerHTML}</div></foreignObject></svg>`;
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestacao-${semana}sem.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    /* hydrate */
  }, []);

  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Para compartilhar
      </p>
      <h1 className="mt-3 font-serif text-4xl">Cards da sua gestação</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Gere um cartão lindo para postar no Instagram, status do WhatsApp ou enviar à família.
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium">Semana gestacional: {semana}</label>
            <input
              type="range"
              min={4}
              max={40}
              value={semana}
              onChange={(e) => setSemana(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Nome (opcional)</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Maria & João"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={compartilhar}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Share2 className="h-4 w-4" /> Compartilhar
            </button>
            <button
              onClick={baixar}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium"
            >
              <Download className="h-4 w-4" /> Baixar
            </button>
          </div>
        </div>

        <div
          ref={ref}
          className="aspect-[4/5] rounded-[2rem] p-8 text-center shadow-[var(--shadow-soft)]"
          style={{
            background: "var(--gradient-primary)",
            color: "hsl(var(--primary-foreground, 0 0% 100%))",
          }}
        >
          <div className="flex h-full flex-col justify-between text-primary-foreground">
            <p className="text-xs uppercase tracking-[0.3em] opacity-80">Gestação</p>
            <div>
              <p className="font-serif text-7xl leading-none">{semana}</p>
              <p className="mt-1 text-sm uppercase tracking-[0.2em] opacity-80">semanas</p>
              <p className="mt-6 font-serif text-2xl">{marco}</p>
              {nome && <p className="mt-4 text-sm opacity-90">{nome}</p>}
            </div>
            <p className="text-xs opacity-80">Dr. Clóvis Bacha · Alto Risco</p>
          </div>
        </div>
      </div>
    </section>
  );
}
