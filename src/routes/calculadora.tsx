import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppCtaBanner } from "@/components/app-cta-banner";

export const Route = createFileRoute("/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadora gestacional — Dr. Clóvis Bacha" },
      { name: "description", content: "Calcule sua idade gestacional, data provável do parto e próximos exames a partir da DUM." },
    ],
  }),
  component: CalcPage,
});

function CalcPage() {
  const [dum, setDum] = useState("");

  const resultado = useMemo(() => {
    if (!dum) return null;
    const d = new Date(dum);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const dias = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 0 || dias > 320) return null;
    const semanas = Math.floor(dias / 7);
    const restDias = dias % 7;
    const dpp = new Date(d.getTime() + 280 * 24 * 60 * 60 * 1000);
    const trimestre = semanas < 14 ? "1º trimestre" : semanas < 28 ? "2º trimestre" : "3º trimestre";
    return {
      semanas,
      restDias,
      dpp: dpp.toLocaleDateString("pt-BR"),
      trimestre,
    };
  }, [dum]);

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Ferramenta</p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">Calculadora gestacional</h1>
      <p className="mt-4 text-muted-foreground">
        Informe a data da sua última menstruação (DUM) para descobrir a idade gestacional atual e a data provável do parto.
      </p>

      <div className="mt-10 rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <label className="text-sm font-medium text-foreground">Data da última menstruação</label>
        <input
          type="date"
          value={dum}
          onChange={(e) => setDum(e.target.value)}
          className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-base text-foreground focus:border-primary focus:outline-none"
        />

        {resultado && (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-primary/10 p-5 text-center">
              <p className="text-xs uppercase tracking-wider text-primary">Idade gestacional</p>
              <p className="mt-2 font-serif text-3xl text-primary">
                {resultado.semanas}s {resultado.restDias}d
              </p>
            </div>
            <div className="rounded-2xl bg-secondary p-5 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Trimestre</p>
              <p className="mt-2 font-serif text-2xl text-foreground">{resultado.trimestre}</p>
            </div>
            <div className="rounded-2xl bg-accent p-5 text-center">
              <p className="text-xs uppercase tracking-wider text-accent-foreground">Data provável do parto</p>
              <p className="mt-2 font-serif text-2xl text-accent-foreground">{resultado.dpp}</p>
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          * Estimativa baseada em ciclo regular de 28 dias. A confirmação clínica deve ser feita em consulta com ultrassom.
        </p>
      </div>
      <AppCtaBanner />
    </section>
  );
}
