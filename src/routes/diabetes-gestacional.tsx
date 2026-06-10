import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppCtaBanner } from "@/components/app-cta-banner";

export const Route = createFileRoute("/diabetes-gestacional")({
  head: () => ({
    meta: [
      { title: "Diabetes Gestacional — Protocolo e Calculadoras — Obstétrica by Dr. Clóvis" },
      {
        name: "description",
        content:
          "Protocolo completo de diabetes mellitus gestacional: critérios diagnósticos TOTG 75g, metas glicêmicas, calculadora de IMC pré-gestacional e classificação de risco.",
      },
    ],
  }),
  component: DmgPage,
});

/* ------------------------------------------------------------------ */
/* Reference data                                                       */
/* ------------------------------------------------------------------ */

const TOTG_CRITERIA = [
  { tempo: "Jejum", valor: "≥ 92 mg/dL", notas: "IADPSG / SBD 2022" },
  { tempo: "1 hora", valor: "≥ 180 mg/dL", notas: "IADPSG / SBD 2022" },
  { tempo: "2 horas", valor: "≥ 153 mg/dL", notas: "IADPSG / SBD 2022" },
];

const GLUCOSE_TARGETS = [
  { momento: "Jejum (pré-prandial)", meta: "< 95 mg/dL", ideal: "70–95 mg/dL" },
  { momento: "1h pós-prandial", meta: "< 140 mg/dL", ideal: "< 140 mg/dL" },
  { momento: "2h pós-prandial", meta: "< 120 mg/dL", ideal: "< 120 mg/dL" },
  { momento: "Ao deitar", meta: "< 120 mg/dL", ideal: "100–120 mg/dL" },
  { momento: "Hb A1c", meta: "< 6%", ideal: "≤ 5,5%" },
];

const RED_FLAGS = [
  "Poliúria e polidipsia persistentes",
  "Cetonúria intensa",
  "Glicemia > 250 mg/dL em jejum",
  "Vômitos que impeçam alimentação",
  "Hipoglicemia recorrente (< 60 mg/dL)",
  "Hidrâmnio de instalação rápida",
];

/* ------------------------------------------------------------------ */
/* Calculadora IMC pré-gestacional + ganho de peso IOM                 */
/* ------------------------------------------------------------------ */

function calcGanhoPeso(imc: number) {
  if (imc < 18.5) return { cat: "Baixo peso", min: 12.5, max: 18 };
  if (imc < 25) return { cat: "Peso adequado", min: 11.5, max: 16 };
  if (imc < 30) return { cat: "Sobrepeso", min: 7, max: 11.5 };
  return { cat: "Obesidade", min: 5, max: 9 };
}

/* ------------------------------------------------------------------ */
/* Insulin dose calculator                                              */
/* Uses: 0.3–0.5 UI/kg/day (1st trim), 0.5–0.7 (2nd), 0.7–1.0 (3rd)  */
/* ------------------------------------------------------------------ */

function calcInsulin(weight: number, ig: number) {
  let base: number;
  let range: string;
  if (ig < 14) {
    base = weight * 0.4;
    range = "0,3–0,5 UI/kg/dia";
  } else if (ig < 28) {
    base = weight * 0.6;
    range = "0,5–0,7 UI/kg/dia";
  } else {
    base = weight * 0.85;
    range = "0,7–1,0 UI/kg/dia";
  }

  const total = Math.round(base);
  const basalDose = Math.round(total * 0.5);
  const bolusPerMeal = Math.round((total * 0.5) / 3);

  return { total, basalDose, bolusPerMeal, range };
}

/* ------------------------------------------------------------------ */
/* Risk score                                                           */
/* ------------------------------------------------------------------ */

const RISK_FACTORS = [
  { id: "age35", label: "Idade ≥ 35 anos" },
  { id: "obesity", label: "IMC pré-gestacional ≥ 30" },
  { id: "overweight", label: "IMC pré-gestacional 25–29,9 (sobrepeso)" },
  { id: "family_dm", label: "Parente de 1º grau com DM2" },
  { id: "prev_gdm", label: "DMG em gestação anterior" },
  { id: "prev_macro", label: "Filho anterior macrossômico (≥ 4 kg)" },
  { id: "pcos", label: "Síndrome dos ovários policísticos (SOP)" },
  { id: "ht", label: "Hipertensão arterial crônica" },
  { id: "prev_loss", label: "Perdas gestacionais de repetição" },
  { id: "afro", label: "Raça negra ou hispânica" },
];

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

type Tab = "protocolo" | "calculadora" | "insulina";

function DmgPage() {
  const [tab, setTab] = useState<Tab>("protocolo");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [ig, setIg] = useState("");
  const [insulinWeight, setInsulinWeight] = useState("");
  const [insulinIg, setInsulinIg] = useState("");

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const pesoN = parseFloat(peso);
  const alturaM = parseFloat(altura) / 100;
  const imc = pesoN > 0 && alturaM > 0 ? pesoN / (alturaM * alturaM) : null;
  const ganho = imc ? calcGanhoPeso(imc) : null;

  const insulinResult =
    parseFloat(insulinWeight) > 0 && parseFloat(insulinIg) > 0
      ? calcInsulin(parseFloat(insulinWeight), parseFloat(insulinIg))
      : null;

  const riskCount = selected.size;
  const highRisk = selected.has("prev_gdm") || selected.has("prev_macro") || riskCount >= 3;

  const TABS: { id: Tab; label: string }[] = [
    { id: "protocolo", label: "Protocolo & Metas" },
    { id: "calculadora", label: "IMC & Ganho de Peso" },
    { id: "insulina", label: "Dose de Insulina" },
  ];

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Protocolo clínico
      </p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">Diabetes Gestacional</h1>
      <p className="mt-4 text-muted-foreground">
        Critérios diagnósticos IADPSG/SBD 2022, metas glicêmicas, rastreio de risco e suporte para
        cálculo de dose de insulina.
      </p>

      {/* Tabs */}
      <div className="mt-10 flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8 space-y-8">
        {/* ---- PROTOCOLO ---- */}
        {tab === "protocolo" && (
          <>
            {/* Risk checklist */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                Fatores de risco para DMG — rastreio universal no 1º trimestre e TOTG entre 24–28
                semanas
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {RISK_FACTORS.map((f) => (
                  <label
                    key={f.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-150 ${
                      selected.has(f.id)
                        ? "border-primary/40 bg-primary/5 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(f.id)}
                      onChange={() => toggle(f.id)}
                      className="accent-primary"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              {riskCount > 0 && (
                <div
                  className={`mt-4 rounded-2xl border p-4 text-sm ${highRisk ? "border-destructive/30 bg-destructive/5" : "border-amber-300/40 bg-amber-50/50"}`}
                >
                  <p
                    className={`font-semibold ${highRisk ? "text-destructive" : "text-amber-700"}`}
                  >
                    {highRisk
                      ? "Alto risco — considere TOTG precoce (1º trimestre)"
                      : "Risco moderado"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {riskCount} fator{riskCount > 1 ? "es" : ""} presente{riskCount > 1 ? "s" : ""}.{" "}
                    {highRisk
                      ? "Solicite glicemia de jejum ainda no 1º trimestre. Repita o TOTG 75g entre 24–28 semanas."
                      : "Realize TOTG 75g entre 24–28 semanas conforme protocolo padrão."}
                  </p>
                </div>
              )}
            </div>

            {/* TOTG criteria */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                Critérios diagnósticos — TOTG 75g (IADPSG / SBD 2022)
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Diagnóstico confirmado com <strong>1 ou mais</strong> valores alterados:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 text-left font-medium text-muted-foreground">Tempo</th>
                      <th className="pb-2 text-left font-medium text-muted-foreground">
                        Valor diagnóstico
                      </th>
                      <th className="pb-2 text-left font-medium text-muted-foreground">
                        Referência
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOTG_CRITERIA.map((c, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2.5 font-medium text-foreground">{c.tempo}</td>
                        <td className="py-2.5 text-destructive font-semibold">{c.valor}</td>
                        <td className="py-2.5 text-muted-foreground text-xs">{c.notas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Glicemia de jejum isolada ≥ 126 mg/dL confirma DM pré-gestacional. Entre 92–125
                mg/dL em jejum = DMG.
              </p>
            </div>

            {/* Glucose targets */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                Metas glicêmicas durante a gestação (SBD 2022)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 text-left font-medium text-muted-foreground">Momento</th>
                      <th className="pb-2 text-left font-medium text-muted-foreground">Meta</th>
                      <th className="pb-2 text-left font-medium text-muted-foreground">
                        Alvo ideal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {GLUCOSE_TARGETS.map((g, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2.5 font-medium text-foreground">{g.momento}</td>
                        <td className="py-2.5 text-foreground">{g.meta}</td>
                        <td className="py-2.5 text-emerald-600 font-medium">{g.ideal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Red flags */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                Sinais de alerta — encaminhar urgência
              </p>
              <ul className="space-y-1">
                {RED_FLAGS.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-0.5 text-destructive">⚠</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* ---- IMC ---- */}
        {tab === "calculadora" && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Calcule o IMC pré-gestacional e o ganho de peso recomendado (IOM 2009).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Peso pré-gestacional (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="ex: 68"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Altura (cm)
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="ex: 165"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {imc && ganho && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-primary/10 p-5 text-center">
                  <p className="text-xs uppercase tracking-wider text-primary">
                    IMC pré-gestacional
                  </p>
                  <p className="mt-2 font-serif text-3xl text-primary">{imc.toFixed(1)}</p>
                  <p className="mt-1 text-sm text-primary/80">{ganho.cat}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Ganho de peso recomendado
                  </p>
                  <p className="mt-2 font-serif text-3xl text-foreground">
                    {ganho.min}–{ganho.max} kg
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">IOM 2009 (gestação única)</p>
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">
                Referência: IOM (Institute of Medicine) 2009
              </p>
              <p>Baixo peso (&lt;18,5): +12,5–18 kg | Adequado (18,5–24,9): +11,5–16 kg</p>
              <p>Sobrepeso (25–29,9): +7–11,5 kg | Obesidade (≥30): +5–9 kg</p>
              <p>Gestações gemelares: acrescentar 4,5–8 kg conforme IMC.</p>
            </div>
          </div>
        )}

        {/* ---- INSULINA ---- */}
        {tab === "insulina" && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-amber-50/60 border border-amber-200/60 p-4 text-sm text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/30 dark:text-amber-300">
              ⚠️ Este cálculo é uma estimativa inicial orientada pelas diretrizes SBD 2022. A dose
              deve ser ajustada individualmente pelo médico com base no perfil glicêmico da
              paciente.
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Peso atual (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="ex: 72"
                  value={insulinWeight}
                  onChange={(e) => setInsulinWeight(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  IG atual (semanas)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="42"
                  placeholder="ex: 28"
                  value={insulinIg}
                  onChange={(e) => setInsulinIg(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {insulinResult && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-primary/10 p-5 text-center">
                    <p className="text-xs uppercase tracking-wider text-primary">Dose total/dia</p>
                    <p className="mt-2 font-serif text-3xl text-primary">
                      {insulinResult.total} UI
                    </p>
                    <p className="mt-1 text-xs text-primary/70">{insulinResult.range}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5 text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      NPH basal (50%)
                    </p>
                    <p className="mt-2 font-serif text-2xl text-foreground">
                      {insulinResult.basalDose} UI
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">geralmente ao deitar</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5 text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Regular/rápida/refeição
                    </p>
                    <p className="mt-2 font-serif text-2xl text-foreground">
                      {insulinResult.bolusPerMeal} UI
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      antes de cada refeição (×3)
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Esquema 50/50 (basal-bolus)</p>
                  <p>
                    50% dose total = NPH ao deitar (basal) | 50% = Regular ou análogo rápido nas
                    refeições
                  </p>
                  <p>
                    Iniciar com dose baixa (0,3 UI/kg/dia) e titular conforme perfil de 7 pontos da
                    paciente.
                  </p>
                  <p>
                    Hipoglicemia &lt; 60 mg/dL → reduzir dose em 10–20%. Ajuste a cada 2–3 dias.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AppCtaBanner />
    </section>
  );
}
