import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Navigation } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/hospitais")({
  head: () => ({
    meta: [
      { title: "Hospitais e maternidades — Obstétrica by Dr. Clóvis" },
      { name: "description", content: "Maternidades e hospitais conveniados, com rota e tempo de trajeto a partir do seu endereço." },
      { property: "og:title", content: "Hospitais conveniados" },
      { property: "og:description", content: "Encontre rotas até as maternidades atendidas pelo Dr. Clóvis Bacha." },
    ],
  }),
  component: HospitaisPage,
});

const hospitais = [
  { nome: "Hospital Vila da Serra", end: "Alameda da Serra, 500 - Nova Lima, MG", obs: "UTI neonatal de alta complexidade" },
  { nome: "Hospital Mater Dei Santo Agostinho", end: "Av. do Contorno, 9000 - Belo Horizonte, MG", obs: "Referência em obstetrícia" },
  { nome: "Hospital Sofia Feldman", end: "Rua Maranhão, 1631 - Belo Horizonte, MG", obs: "Humanização do parto" },
  { nome: "Maternidade Octaviano Neves", end: "Av. do Contorno, 4747 - Belo Horizonte, MG", obs: "Tradição em GO" },
];

function HospitaisPage() {
  const [origem, setOrigem] = useState("");

  function rota(end: string) {
    const o = origem.trim();
    const url = o
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(end)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(end)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Onde nascem os nossos bebês</p>
      <h1 className="mt-3 font-serif text-4xl">Maternidades e hospitais</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Saber o caminho com antecedência reduz a ansiedade. Digite seu endereço ou CEP e veja a rota até cada maternidade.
      </p>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row">
        <MapPin className="h-5 w-5 text-primary" />
        <input
          type="text"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          placeholder="Seu endereço ou CEP (ex: 30130-010)"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {hospitais.map((h) => (
          <div key={h.nome} className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <p className="font-serif text-xl text-primary">{h.nome}</p>
            <p className="mt-2 text-sm text-muted-foreground">{h.end}</p>
            <p className="mt-2 text-xs text-foreground/80">{h.obs}</p>
            <button
              type="button"
              onClick={() => rota(h.end)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              <Navigation className="h-4 w-4" /> Ver rota
            </button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        * Sempre confirme a maternidade da sua escolha com a equipe na consulta. Cobertura pode variar por convênio.
      </p>
    </section>
  );
}