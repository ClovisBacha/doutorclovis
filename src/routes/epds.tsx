import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppCtaBanner } from "@/components/app-cta-banner";
import { supabase } from "@/integrations/supabase/client";
import { saveEpdsLog } from "@/lib/epds.functions";

export const Route = createFileRoute("/epds")({
  head: () => ({
    meta: [
      { title: "Rastreio de Depressão Pós-Parto (EPDS) — Obstétrica" },
      {
        name: "description",
        content:
          "Escala de Edinburgh (EPDS) para rastreio de depressão pós-parto. Ferramenta validada, gratuita, 10 perguntas, resultado imediato.",
      },
    ],
  }),
  component: EpdsPage,
});

/* ------------------------------------------------------------------ */
/* EPDS data                                                            */
/* ------------------------------------------------------------------ */

interface EpdsQuestion {
  number: number;
  text: string;
  options: { label: string; score: number }[];
}

const QUESTIONS: EpdsQuestion[] = [
  {
    number: 1,
    text: "Tenho sido capaz de rir e ver o lado engraçado das coisas:",
    options: [
      { label: "Tanto quanto antes", score: 0 },
      { label: "Não tanto quanto antes", score: 1 },
      { label: "Definitivamente menos do que antes", score: 2 },
      { label: "Não consigo de jeito nenhum", score: 3 },
    ],
  },
  {
    number: 2,
    text: "Tenho esperado as coisas boas com prazer:",
    options: [
      { label: "Tanto quanto antes", score: 0 },
      { label: "Um pouco menos do que de costume", score: 1 },
      { label: "Definitivamente menos do que de costume", score: 2 },
      { label: "Quase nunca", score: 3 },
    ],
  },
  {
    number: 3,
    text: "Tenho me culpado sem necessidade quando as coisas dão errado:",
    options: [
      { label: "Sim, na maioria das vezes", score: 3 },
      { label: "Sim, às vezes", score: 2 },
      { label: "Raramente", score: 1 },
      { label: "Não, nunca", score: 0 },
    ],
  },
  {
    number: 4,
    text: "Tenho me sentido ansiosa ou preocupada sem uma boa razão:",
    options: [
      { label: "Não, de forma alguma", score: 0 },
      { label: "Quase nunca", score: 1 },
      { label: "Sim, às vezes", score: 2 },
      { label: "Sim, com muita frequência", score: 3 },
    ],
  },
  {
    number: 5,
    text: "Tenho me sentido assustada ou em pânico sem uma boa razão:",
    options: [
      { label: "Sim, com muita frequência", score: 3 },
      { label: "Sim, às vezes", score: 2 },
      { label: "Raramente", score: 1 },
      { label: "Não, nunca", score: 0 },
    ],
  },
  {
    number: 6,
    text: "As coisas têm me oprimido / sobrecarregado:",
    options: [
      { label: "Sim, na maioria das vezes não consigo me controlar", score: 3 },
      { label: "Sim, às vezes não me controlo tão bem quanto antes", score: 2 },
      { label: "Não, na maioria das vezes consigo lidar bem", score: 1 },
      { label: "Não, consigo controlar tão bem quanto sempre", score: 0 },
    ],
  },
  {
    number: 7,
    text: "Tenho me sentido tão infeliz que tenho dormido mal:",
    options: [
      { label: "Sim, na maioria das vezes", score: 3 },
      { label: "Sim, às vezes", score: 2 },
      { label: "Raramente", score: 1 },
      { label: "Não, nunca", score: 0 },
    ],
  },
  {
    number: 8,
    text: "Tenho me sentido triste ou profundamente infeliz:",
    options: [
      { label: "Sim, na maior parte do tempo", score: 3 },
      { label: "Sim, com bastante frequência", score: 2 },
      { label: "Raramente", score: 1 },
      { label: "Não, nunca", score: 0 },
    ],
  },
  {
    number: 9,
    text: "Tenho me sentido tão infeliz que choro:",
    options: [
      { label: "Sim, na maior parte do tempo", score: 3 },
      { label: "Sim, com bastante frequência", score: 2 },
      { label: "Somente às vezes", score: 1 },
      { label: "Não, nunca", score: 0 },
    ],
  },
  {
    number: 10,
    text: "Tenho tido pensamentos de me machucar:",
    options: [
      { label: "Sim, com bastante frequência", score: 3 },
      { label: "Às vezes", score: 2 },
      { label: "Raramente", score: 1 },
      { label: "Nunca", score: 0 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Interpretation                                                       */
/* ------------------------------------------------------------------ */

function interpret(score: number, q10Score: number) {
  if (q10Score > 0) {
    return {
      level: "urgente",
      title: "Atenção imediata necessária",
      desc: "A paciente relatou pensamentos de se machucar (questão 10). Independente do escore total, encaminhamento imediato a serviço de saúde mental é necessário.",
      color: "border-destructive bg-destructive/5",
      textColor: "text-destructive",
      badge: "bg-destructive text-destructive-foreground",
    };
  }
  if (score >= 13) {
    return {
      level: "alto",
      title: "Rastreio positivo — encaminhamento recomendado",
      desc: "Escore ≥ 13 indica provável depressão pós-parto. Avaliação clínica aprofundada e encaminhamento a saúde mental são recomendados com urgência.",
      color: "border-destructive/40 bg-destructive/5",
      textColor: "text-destructive",
      badge: "bg-destructive text-destructive-foreground",
    };
  }
  if (score >= 10) {
    return {
      level: "moderado",
      title: "Investigação adicional recomendada",
      desc: "Escore entre 10–12 indica risco elevado. Conversa clínica mais aprofundada, suporte e reavaliação em 2–4 semanas são indicados.",
      color: "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20",
      textColor: "text-amber-700 dark:text-amber-400",
      badge: "bg-amber-500 text-white",
    };
  }
  return {
    level: "baixo",
    title: "Rastreio negativo",
    desc: "Escore < 10 indica baixo risco no momento. Repetir o rastreio nas consultas de 6 semanas, 3 e 6 meses pós-parto.",
    color: "border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/20",
    textColor: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-500 text-white",
  };
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

function EpdsPage() {
  const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
  const [submitted, setSubmitted] = useState(false);
  const [period, setPeriod] = useState<"prenatal" | "postpartum">("postpartum");

  const allAnswered = answers.every((a) => a !== null);
  const totalScore = answers.reduce<number>((s, a) => s + (a ?? 0), 0);
  const q10Score = answers[9] ?? 0;
  const result = submitted ? interpret(totalScore, q10Score) : null;

  const answered = answers.filter((a) => a !== null).length;
  const progressPct = (answered / 10) * 100;

  function setAnswer(qi: number, score: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[qi] = score;
      return next;
    });
  }

  function reset() {
    setAnswers(Array(10).fill(null));
    setSubmitted(false);
  }

  return (
    <section className="mx-auto max-w-2xl px-5 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Rastreio validado
      </p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">Escala de Edinburgh</h1>
      <p className="mt-4 text-muted-foreground">
        A EPDS (Edinburgh Postnatal Depression Scale) é o instrumento mais utilizado no Brasil e no
        mundo para rastreio de depressão perinatal — no pré-natal e até 12 meses após o parto.
      </p>

      {/* Period selector */}
      {!submitted && (
        <div className="mt-8 flex gap-2">
          <button
            onClick={() => setPeriod("postpartum")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              period === "postpartum"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Pós-parto
          </button>
          <button
            onClick={() => setPeriod("prenatal")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              period === "prenatal"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Pré-natal
          </button>
        </div>
      )}

      {!submitted ? (
        <div className="mt-6 space-y-5">
          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{answered} de 10 perguntas respondidas</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <p className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Responda como se sentiu <strong>nas últimas 7 dias</strong>, não apenas hoje. Não há
            respostas certas ou erradas.
          </p>

          {QUESTIONS.map((q, qi) => (
            <div key={q.number} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium text-foreground">
                <span className="mr-2 text-primary font-semibold">{q.number}.</span>
                {q.text}
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === opt.score;
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-200 ${
                        selected
                          ? "border-primary/50 bg-primary/5 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q${q.number}`}
                        checked={selected}
                        onChange={() => setAnswer(qi, opt.score)}
                        className="accent-primary"
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            disabled={!allAnswered}
            onClick={() => {
              setSubmitted(true);
              // Logada → grava na conta e alerta o médico se positivo.
              // Fire-and-forget: anônima ou falha de rede não afetam o resultado.
              void (async () => {
                try {
                  const { data: s } = await supabase.auth.getSession();
                  if (!s.session?.access_token) return;
                  const level = interpret(totalScore, q10Score).level as
                    | "baixo"
                    | "moderado"
                    | "alto"
                    | "urgente";
                  await saveEpdsLog({
                    data: {
                      accessToken: s.session.access_token,
                      score: totalScore,
                      q10Score,
                      level,
                    },
                  });
                } catch {
                  /* melhor esforço */
                }
              })();
            }}
            className="w-full rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:shadow-[var(--shadow-soft)] active:scale-[0.98]"
          >
            {allAnswered
              ? "Ver resultado"
              : `Responda todas as ${10 - answered} perguntas restantes`}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Score card */}
          <div className={`rounded-3xl border p-6 ${result!.color}`}>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${result!.badge}`}
              >
                {period === "prenatal" ? "Pré-natal" : "Pós-parto"}
              </span>
              <span className="text-xs text-muted-foreground">Escala de Edinburgh (EPDS)</span>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <p className={`font-serif text-6xl font-bold ${result!.textColor}`}>{totalScore}</p>
              <p className="mb-1 text-sm text-muted-foreground">/ 30 pontos</p>
            </div>
            <p className={`mt-2 text-lg font-semibold ${result!.textColor}`}>{result!.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{result!.desc}</p>
          </div>

          {/* Score breakdown */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Respostas por questão
            </p>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {answers.map((a, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">Q{i + 1}</span>
                  <span
                    className={`rounded-lg w-8 h-8 flex items-center justify-center text-sm font-semibold ${
                      (a ?? 0) >= 2
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {a}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Scale interpretation */}
          <div className="rounded-2xl bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-semibold text-foreground">Interpretação do escore EPDS</p>
            <div className="space-y-1 text-muted-foreground">
              <p>
                <span className="text-emerald-600 font-medium">0–9:</span> Rastreio negativo
              </p>
              <p>
                <span className="text-amber-600 font-medium">10–12:</span> Investigação adicional
                recomendada
              </p>
              <p>
                <span className="text-destructive font-medium">≥ 13:</span> Provável depressão —
                encaminhamento indicado
              </p>
              <p>
                <span className="text-destructive font-medium">Q10 &gt; 0:</span> Pensamentos de
                auto-lesão — avaliação imediata
              </p>
            </div>
          </div>

          {/* Resources */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Se precisar de apoio agora</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="tel:188"
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-foreground hover:bg-muted/40 transition-colors"
              >
                <span className="text-lg">📞</span>
                <div>
                  <p className="font-medium">CVV — 188</p>
                  <p className="text-xs text-muted-foreground">Gratuito, 24h</p>
                </div>
              </a>
              <a
                href="https://alma.org.br"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm text-foreground hover:bg-muted/40 transition-colors"
              >
                <span className="text-lg">💚</span>
                <div>
                  <p className="font-medium">ALMA — Maternidade e Saúde Mental</p>
                  <p className="text-xs text-muted-foreground">alma.org.br</p>
                </div>
              </a>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 rounded-2xl border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
            >
              Refazer o rastreio
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-2xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm hover:shadow-[var(--shadow-soft)] transition-all active:scale-[0.98]"
            >
              Imprimir / salvar PDF
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            EPDS — Cox JL, Holden JM, Sagovsky R (1987). Validação brasileira: Santos MF et al.
            (1999). Esta ferramenta é um instrumento de rastreio, não de diagnóstico. A
            interpretação clínica é responsabilidade do profissional de saúde.
          </p>
        </div>
      )}

      <AppCtaBanner />
    </section>
  );
}
