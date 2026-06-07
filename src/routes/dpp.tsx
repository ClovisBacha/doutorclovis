import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/dpp")({
  head: () => ({
    meta: [
      { title: "Previsão da DPP com faixa probabilística — Dr. Clóvis Bacha" },
      { name: "description", content: "Estimativa probabilística da data provável do parto baseada em DUM, ciclo e USG." },
      { property: "og:title", content: "Previsão da DPP" },
      { property: "og:description", content: "Distribuição probabilística da data do parto." },
    ],
  }),
  component: DppPage,
});

function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function DppPage() {
  const [dum, setDum] = useState("");
  const [ciclo, setCiclo] = useState(28);
  const [usgSemanas, setUsgSemanas] = useState<number | "">("");
  const [usgData, setUsgData] = useState("");

  const result = useMemo(() => {
    if (!dum) return null;
    const base = new Date(dum);
    // Naegele ajustada pelo ciclo
    let dpp = addDays(base, 280 + (ciclo - 28));
    if (usgSemanas && usgData) {
      const u = new Date(usgData);
      const idadeUsgDias = Number(usgSemanas) * 7;
      const concepcaoEstim = addDays(u, -idadeUsgDias);
      dpp = addDays(concepcaoEstim, 280);
    }
    // Distribuição: 70% entre -7/+7 dias, 95% entre -14/+14
    const ms = dpp.getTime();
    const buckets = [-14, -10, -7, -3, 0, 3, 7, 10, 14].map((d) => {
      const dist = Math.abs(d);
      // densidade aproximada (gaussiana simplificada, sigma ≈ 8)
      const p = Math.exp(-(dist * dist) / (2 * 8 * 8));
      return { dia: d, date: new Date(ms + d * 86400000), p };
    });
    const max = Math.max(...buckets.map((b) => b.p));
    return { dpp, buckets: buckets.map((b) => ({ ...b, h: (b.p / max) * 100 })) };
  }, [dum, ciclo, usgSemanas, usgData]);

  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Previsão científica</p>
      <h1 className="mt-3 font-serif text-4xl">Quando seu bebê deve nascer?</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Apenas 5% dos bebês nascem exatamente na DPP. Veja a faixa real de probabilidade combinando DUM, duração do ciclo e (se houver) USG.
      </p>

      <div className="mt-8 grid gap-5 rounded-3xl border border-border bg-card p-6 md:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">DUM (1º dia da última menstruação)</span>
          <input type="date" value={dum} onChange={(e) => setDum(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="font-medium">Duração do ciclo: {ciclo} dias</span>
          <input type="range" min={21} max={40} value={ciclo} onChange={(e) => setCiclo(Number(e.target.value))} className="mt-3 w-full" />
        </label>
        <label className="text-sm">
          <span className="font-medium">USG — semanas (opcional)</span>
          <input type="number" step="0.1" value={usgSemanas} onChange={(e) => setUsgSemanas(e.target.value ? Number(e.target.value) : "")} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="font-medium">USG — data do exame</span>
          <input type="date" value={usgData} onChange={(e) => setUsgData(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
        </label>
      </div>

      {result && (
        <div className="mt-8 rounded-3xl border border-primary/20 bg-primary/5 p-8">
          <p className="text-sm text-muted-foreground">Data mais provável</p>
          <p className="mt-1 font-serif text-4xl text-primary">{fmt(result.dpp)}</p>
          <p className="mt-4 text-sm text-foreground">
            Faixa de 95% de confiança: <strong>{fmt(result.buckets[0].date)}</strong> a <strong>{fmt(result.buckets[result.buckets.length - 1].date)}</strong>
          </p>

          <div className="mt-6 flex items-end justify-between gap-2">
            {result.buckets.map((b) => (
              <div key={b.dia} className="flex flex-1 flex-col items-center">
                <div className="w-full rounded-t-md bg-primary" style={{ height: `${b.h * 1.2 + 10}px`, opacity: 0.4 + b.p * 0.6 }} />
                <p className="mt-2 text-[10px] text-muted-foreground">{b.dia > 0 ? `+${b.dia}` : b.dia}d</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            * Estimativa estatística. Apenas a avaliação clínica do Dr. Clóvis confirma a melhor janela para o parto.
          </p>
        </div>
      )}
    </section>
  );
}