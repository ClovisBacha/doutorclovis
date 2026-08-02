import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bolha } from "@/components/bolha";

/**
 * Bancada da bolha — o compasso da respiração e os quatro humores, lado a lado.
 *
 * Existe porque verificar a bolha pela rota do jogo custa cinco cliques e um
 * portão de humor, e porque o que ela faz na respiração é MEDÍVEL: o teste lê a
 * matriz do `transform` computado a cada meio segundo e confere que inspirar
 * cresce, segurar segura e expirar encolhe. Foi assim que este componente foi
 * conferido — 0,902 → 1,160 na inspiração, 1,160 fixo no segurar, 1,140 →
 * 0,921 na expiração.
 *
 * O `noindex` acompanha o `Disallow: /preview-` do robots.txt: a rota é
 * pública, e o robots.txt só vale para quem o lê.
 */
export const Route = createFileRoute("/preview-bolha")({
  component: Preview,
  head: () => ({
    meta: [{ title: "Bancada da bolha" }, { name: "robots", content: "noindex" }],
  }),
});

const CICLO = [
  { fase: "in" as const, dur: 4000 },
  { fase: "hold" as const, dur: 4000 },
  { fase: "out" as const, dur: 6000 },
];

function Preview() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setI((n) => (n + 1) % CICLO.length), CICLO[i].dur);
    return () => clearTimeout(t);
  }, [i]);
  const atual = CICLO[i];
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-sky-50">
      <div data-testid="fase" className="text-sm font-bold text-sky-700">
        {atual.fase}
      </div>
      <Bolha
        tamanho={140}
        humor="dormindo"
        flutua={false}
        respiro={{ fase: atual.fase, duracaoMs: atual.dur }}
      />
      <div className="flex gap-8">
        <Bolha tamanho={80} humor="feliz" />
        <Bolha tamanho={80} humor="comemorando" />
        <Bolha tamanho={80} humor="dormindo" />
        <Bolha tamanho={80} humor="preocupada" />
      </div>
    </div>
  );
}
