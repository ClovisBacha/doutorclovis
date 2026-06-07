import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/tamanho-real")({
  head: () => ({
    meta: [
      { title: "Tamanho real do bebê na tela — Dr. Clóvis Bacha" },
      { name: "description", content: "Veja o tamanho real do seu bebê na tela do celular, calibrado com um cartão de crédito." },
      { property: "og:title", content: "Tamanho real do bebê" },
      { property: "og:description", content: "Calibre a tela e visualize o bebê em escala real." },
    ],
  }),
  component: TamanhoRealPage,
});

const tamanhos = [
  { mes: 1, cm: 0.4 }, { mes: 2, cm: 1.6 }, { mes: 3, cm: 7.4 },
  { mes: 4, cm: 13 }, { mes: 5, cm: 19 }, { mes: 6, cm: 32 },
  { mes: 7, cm: 38 }, { mes: 8, cm: 45 }, { mes: 9, cm: 50 },
];

// Cartão padrão ISO/IEC 7810 ID-1: 85.6mm largura
const CARD_CM = 8.56;

function TamanhoRealPage() {
  // pxPerCm calibrado pelo usuário
  const [pxPerCm, setPxPerCm] = useState(38); // chute inicial razoável
  const [cardWidthPx, setCardWidthPx] = useState(325);
  const [mes, setMes] = useState(5);

  function recalibrar(px: number) {
    setCardWidthPx(px);
    setPxPerCm(px / CARD_CM);
  }

  const cm = tamanhos[mes - 1].cm;
  const sizePx = Math.min(cm * pxPerCm, 800);

  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Visualização real</p>
      <h1 className="mt-3 font-serif text-4xl">Tamanho real do bebê na sua tela</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Calibre a tela colocando um cartão de crédito sobre o retângulo abaixo e ajustando até encaixar perfeitamente. Depois, escolha o mês e veja o bebê em tamanho real.
      </p>

      <div className="mt-10 rounded-3xl border border-border bg-card p-6">
        <p className="text-sm font-medium">1. Calibre com um cartão (8,56 cm)</p>
        <div className="mt-4 rounded-xl bg-secondary p-4">
          <div
            className="rounded-md bg-primary/30 ring-2 ring-primary"
            style={{ width: `${cardWidthPx}px`, height: `${cardWidthPx / 1.586}px` }}
          />
        </div>
        <input
          type="range"
          min={180}
          max={500}
          value={cardWidthPx}
          onChange={(e) => recalibrar(Number(e.target.value))}
          className="mt-4 w-full"
        />
        <p className="mt-1 text-xs text-muted-foreground">Largura: {cardWidthPx}px ({pxPerCm.toFixed(1)} px/cm)</p>
      </div>

      <div className="mt-8 rounded-3xl border border-border bg-card p-6">
        <p className="text-sm font-medium">2. Escolha o mês</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tamanhos.map((t) => (
            <button
              key={t.mes}
              onClick={() => setMes(t.mes)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                mes === t.mes ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
              }`}
            >
              Mês {t.mes}
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl bg-[var(--gradient-warm)] p-6">
          <div
            className="rounded-full bg-primary/30 ring-2 ring-primary"
            style={{ width: `${sizePx}px`, height: `${sizePx}px`, maxWidth: "100%" }}
          />
          <p className="mt-4 font-serif text-2xl text-primary">{cm} cm</p>
          <p className="text-sm text-muted-foreground">Tamanho aproximado no mês {mes}</p>
        </div>
      </div>
    </section>
  );
}