import { useState } from "react";
import { BabyIllustration } from "@/components/baby-illustration";
import { babyForWeek, consultaForWeek, trimesterForWeek, WEEK_MAX, WEEK_MIN } from "@/lib/gestacao";

const TRIMESTRES = [
  { n: 1, label: "1º trimestre", semanas: "Sem. 4–13", from: 4, to: 13 },
  { n: 2, label: "2º trimestre", semanas: "Sem. 14–27", from: 14, to: 27 },
  { n: 3, label: "3º trimestre", semanas: "Sem. 28–42", from: 28, to: 42 },
] as const;

export function BabyEvolution() {
  const [week, setWeek] = useState(20);
  const baby = babyForWeek(week);
  const tri = trimesterForWeek(week);
  const consulta = consultaForWeek(week);

  const go = (w: number) => setWeek(Math.max(WEEK_MIN, Math.min(WEEK_MAX, w)));

  return (
    <section className="border-y border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            Semana a semana
          </p>
          <h2 className="mt-3 font-serif text-3xl md:text-4xl">
            Evolução do bebê e suas consultas
          </h2>
          <p className="mt-3 text-muted-foreground">
            Acompanhe o tamanho, o desenvolvimento e os exames obrigatórios em cada semana da
            gestação, da 4ª à 42ª.
          </p>
        </div>

        {/* Atalhos por trimestre */}
        <div className="flex flex-wrap gap-2">
          {TRIMESTRES.map((t) => (
            <button
              key={t.n}
              type="button"
              onClick={() => go(t.from === 4 ? 8 : t.from)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                tri === t.n
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "border border-border bg-card text-muted-foreground hover:text-primary"
              }`}
            >
              {t.label}
              <span className="ml-2 hidden text-xs opacity-80 sm:inline">{t.semanas}</span>
            </button>
          ))}
        </div>

        {/* Seletor de semana */}
        <div className="mt-6 rounded-3xl card-material p-5 md:p-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => go(week - 1)}
              disabled={week <= WEEK_MIN}
              aria-label="Semana anterior"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-lg text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              –
            </button>

            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-2xl text-foreground">
                  Semana {week}
                  <span className="ml-2 text-sm font-sans text-muted-foreground">
                    de {WEEK_MAX}
                  </span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {tri}º trimestre
                </span>
              </div>
              <input
                type="range"
                min={WEEK_MIN}
                max={WEEK_MAX}
                value={week}
                onChange={(e) => go(Number(e.target.value))}
                aria-label="Selecionar semana de gestação"
                className="mt-3 w-full accent-[oklch(0.5_0.11_18)]"
              />
            </div>

            <button
              type="button"
              onClick={() => go(week + 1)}
              disabled={week >= WEEK_MAX}
              aria-label="Próxima semana"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-lg text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        {/* Card principal */}
        <div className="mt-6 grid gap-6 rounded-3xl card-material p-6 md:grid-cols-[1fr_1.4fr] md:p-10">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-[var(--gradient-warm)] p-6 text-center">
            <BabyIllustration week={week} />
            <div className="mt-4 grid w-full grid-cols-2 gap-3">
              <div className="rounded-xl bg-card/70 px-3 py-2">
                <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Tamanho
                </p>
                <p className="font-serif text-lg text-primary">{baby.size}</p>
              </div>
              <div className="rounded-xl bg-card/70 px-3 py-2">
                <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
                  Peso
                </p>
                <p className="font-serif text-lg text-primary">{baby.weight}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Comparável a: {baby.fruit}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Desenvolvimento nesta semana</p>
            <h3 className="mt-1 font-serif text-2xl text-foreground">Semana {week}</h3>
            <p className="mt-4 text-base leading-relaxed text-foreground">{baby.desc}</p>
            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Consulta / exame nesta fase
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{consulta}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
