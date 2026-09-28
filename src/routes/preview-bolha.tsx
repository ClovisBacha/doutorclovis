import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bolha, type BolhaHandle, type Humor } from "@/components/bolha";

/**
 * Bancada da bolha — o compasso da respiração, os quatro humores e as quatro
 * ações, todos alcançáveis num clique.
 *
 * Existe porque verificar a bolha pela rota do jogo custa cinco cliques e um
 * portão de humor, e porque o que ela faz é MEDÍVEL: o teste lê a matriz do
 * `transform` computado quadro a quadro e confere o compasso da respiração, a
 * antecipação do pulo e o amortecimento dos quiques.
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

const HUMORES: Humor[] = [
  "feliz",
  "comemorando",
  "dormindo",
  "orgulhosa",
  "surpresa",
  "estudiosa",
  "exercicio",
  "apaixonado",
];

function Preview() {
  const [i, setI] = useState(0);
  const [humor, setHumor] = useState<Humor>("feliz");
  const palco = useRef<BolhaHandle>(null);

  useEffect(() => {
    const t = setTimeout(() => setI((n) => (n + 1) % CICLO.length), CICLO[i].dur);
    return () => clearTimeout(t);
  }, [i]);

  const atual = CICLO[i];
  const acoes = [
    ["pular", () => palco.current?.pular()],
    ["negar", () => palco.current?.negar()],
    ["chegar", () => palco.current?.chegar()],
    ["chamar", () => palco.current?.chamar()],
  ] as const;

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-sky-50 py-10">
      <section className="flex flex-col items-center gap-4">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Ações</p>
        <div data-testid="palco" className="flex h-44 items-end">
          <Bolha ref={palco} tamanho={120} humor={humor} />
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {acoes.map(([nome, fn]) => (
            <button
              key={nome}
              data-testid={`acao-${nome}`}
              onClick={fn}
              className="rounded-full bg-sky-700 px-4 py-2 text-sm font-bold text-white"
            >
              {nome}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {HUMORES.map((h) => (
            <button
              key={h}
              onClick={() => setHumor(h)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                humor === h ? "bg-sky-700 text-white" : "border border-sky-300 text-sky-700"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Respiração</p>
        <div data-testid="fase" className="text-sm font-bold text-sky-700">
          {atual.fase}
        </div>
        <Bolha
          tamanho={120}
          humor="dormindo"
          flutua={false}
          respiro={{ fase: atual.fase, duracaoMs: atual.dur }}
        />
      </section>

      <section className="flex flex-col items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Humores</p>
        <div className="flex gap-8">
          {HUMORES.map((h) => (
            <Bolha key={h} tamanho={76} humor={h} />
          ))}
        </div>
      </section>
    </div>
  );
}
