import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Heart, Pause, Play } from "lucide-react";
import { AppCtaBanner } from "@/components/app-cta-banner";

export const Route = createFileRoute("/batimentos")({
  head: () => ({
    meta: [
      { title: "Som do coração do bebê — Obstétrica by Dr. Clóvis" },
      { name: "description", content: "Ouça uma simulação dos batimentos cardíacos do bebê em cada trimestre da gestação." },
      { property: "og:title", content: "Som do coração do bebê" },
      { property: "og:description", content: "Simulação dos batimentos cardíacos fetais por trimestre." },
    ],
  }),
  component: BatimentosPage,
});

const trimestres = [
  { label: "1º trimestre", bpm: 160, semanas: "6-13s", desc: "Batimentos rápidos, aceleram rapidamente nas primeiras semanas." },
  { label: "2º trimestre", bpm: 145, semanas: "14-27s", desc: "Ritmo se estabiliza. É quando ouvimos com facilidade no Doppler." },
  { label: "3º trimestre", bpm: 135, semanas: "28-40s", desc: "Tende a se aproximar do ritmo do recém-nascido." },
];

function BatimentosPage() {
  const [active, setActive] = useState<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => stop(), []);

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setActive(null);
  }

  function beat(ctx: AudioContext, when: number, freq: number, gainPeak: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gainPeak, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    osc.connect(g).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.2);
  }

  function play(i: number) {
    stop();
    const bpm = trimestres[i].bpm;
    const interval = 60000 / bpm;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    ctxRef.current = ctx;
    setActive(i);
    const tick = () => {
      const t = ctx.currentTime;
      beat(ctx, t, 70, 0.6); // lub
      beat(ctx, t + 0.14, 55, 0.4); // dub
    };
    tick();
    timerRef.current = setInterval(tick, interval);
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Som do coração</p>
      <h1 className="mt-3 font-serif text-4xl">Ouça os batimentos do bebê</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Uma simulação suave do ritmo cardíaco fetal em cada trimestre. O som real é ouvido no Doppler a partir da 10ª-12ª semana.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {trimestres.map((t, i) => (
          <div key={t.label} className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <Heart className={`h-8 w-8 text-primary ${active === i ? "animate-pulse" : ""}`} />
            <p className="mt-3 font-serif text-2xl">{t.label}</p>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.semanas}</p>
            <p className="mt-3 font-serif text-3xl text-primary">{t.bpm} <span className="text-sm text-muted-foreground">bpm</span></p>
            <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
            <button
              type="button"
              onClick={() => (active === i ? stop() : play(i))}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {active === i ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Ouvir</>}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        * Simulação educativa via síntese de áudio. Não substitui a ausculta clínica.
      </p>
      <AppCtaBanner />
    </section>
  );
}