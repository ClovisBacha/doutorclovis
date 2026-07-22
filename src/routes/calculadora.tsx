import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppCtaBanner } from "@/components/app-cta-banner";

export const Route = createFileRoute("/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadoras obstétricas — Obstétrica" },
      {
        name: "description",
        content:
          "Calculadoras clínicas para gestação: idade gestacional, biometria fetal (peso estimado Hadlock), e rastreio de pré-eclâmpsia.",
      },
    ],
  }),
  component: CalcPage,
});

/* ------------------------------------------------------------------ */
/* Tab types                                                            */
/* ------------------------------------------------------------------ */

type Tab = "ig" | "biometria" | "preeclampsia";

/* ------------------------------------------------------------------ */
/* Intergrowth-21 EFW centiles (grams) by gestational week             */
/* ------------------------------------------------------------------ */

const IG_EFW: Record<number, { p3: number; p10: number; p50: number; p90: number; p97: number }> = {
  20: { p3: 231, p10: 263, p50: 344, p90: 465, p97: 543 },
  21: { p3: 281, p10: 320, p50: 416, p90: 564, p97: 657 },
  22: { p3: 333, p10: 380, p50: 495, p90: 670, p97: 784 },
  23: { p3: 391, p10: 447, p50: 584, p90: 791, p97: 927 },
  24: { p3: 455, p10: 521, p50: 679, p90: 921, p97: 1082 },
  25: { p3: 525, p10: 602, p50: 780, p90: 1060, p97: 1248 },
  26: { p3: 601, p10: 689, p50: 887, p90: 1208, p97: 1426 },
  27: { p3: 682, p10: 782, p50: 1001, p90: 1364, p97: 1614 },
  28: { p3: 768, p10: 881, p50: 1122, p90: 1527, p97: 1811 },
  29: { p3: 858, p10: 985, p50: 1250, p90: 1698, p97: 2015 },
  30: { p3: 952, p10: 1093, p50: 1384, p90: 1875, p97: 2225 },
  31: { p3: 1048, p10: 1204, p50: 1523, p90: 2057, p97: 2440 },
  32: { p3: 1146, p10: 1317, p50: 1665, p90: 2243, p97: 2658 },
  33: { p3: 1244, p10: 1430, p50: 1810, p90: 2432, p97: 2878 },
  34: { p3: 1341, p10: 1542, p50: 1955, p90: 2621, p97: 3096 },
  35: { p3: 1436, p10: 1652, p50: 2100, p90: 2808, p97: 3312 },
  36: { p3: 1527, p10: 1758, p50: 2243, p90: 2990, p97: 3521 },
  37: { p3: 1613, p10: 1858, p50: 2381, p90: 3165, p97: 3722 },
  38: { p3: 1692, p10: 1950, p50: 2513, p90: 3330, p97: 3911 },
  39: { p3: 1762, p10: 2031, p50: 2638, p90: 3483, p97: 4088 },
  40: { p3: 1821, p10: 2101, p50: 2754, p90: 3622, p97: 4248 },
  41: { p3: 1867, p10: 2156, p50: 2855, p90: 3743, p97: 4391 },
};

function efwPercentileCategory(
  efw: number,
  week: number,
): { label: string; color: string; percentile: string } {
  const row = IG_EFW[Math.round(week)];
  if (!row)
    return {
      label: "Semana fora do intervalo de referência",
      color: "text-muted-foreground",
      percentile: "—",
    };

  if (efw < row.p3)
    return {
      label: "Abaixo do 3º percentil — RCIU grave",
      color: "text-destructive",
      percentile: "< p3",
    };
  if (efw < row.p10)
    return {
      label: "Entre 3º–10º percentil — RCIU leve/moderado",
      color: "text-amber-600",
      percentile: "p3–p10",
    };
  if (efw <= row.p90)
    return { label: "Adequado para a IG (AIG)", color: "text-emerald-600", percentile: "p10–p90" };
  if (efw <= row.p97)
    return {
      label: "Entre 90º–97º percentil — GIG leve",
      color: "text-amber-600",
      percentile: "p90–p97",
    };
  return {
    label: "Acima do 97º percentil — GIG grave",
    color: "text-destructive",
    percentile: "> p97",
  };
}

/* Hadlock 1985 — 4 parâmetros (BPD, HC, AC, FL em cm) */
function hadlock4(bpd: number, hc: number, ac: number, fl: number): number {
  const log =
    1.3596 + 0.0064 * hc + 0.0424 * ac + 0.174 * fl + 0.00061 * bpd * ac - 0.00386 * ac * fl;
  return Math.round(Math.pow(10, log));
}

/* Hadlock 1984 — 2 parâmetros (AC, FL em cm) quando BPD/HC não disponíveis */
function hadlock2(ac: number, fl: number): number {
  const log = 1.304 + 0.05281 * ac + 0.1938 * fl - 0.004 * ac * fl;
  return Math.round(Math.pow(10, log));
}

/* ------------------------------------------------------------------ */
/* Tab: Idade Gestacional                                               */
/* ------------------------------------------------------------------ */

function TabIG() {
  const [dum, setDum] = useState("");

  const r = useMemo(() => {
    if (!dum) return null;
    const d = new Date(dum + "T00:00:00");
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const dias = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (dias < 0 || dias > 320) return null;
    const semanas = Math.floor(dias / 7);
    const restDias = dias % 7;
    const dpp = new Date(d.getTime() + 280 * 86400000);
    const trimestre =
      semanas < 14 ? "1º trimestre" : semanas < 28 ? "2º trimestre" : "3º trimestre";
    const diasAtePartum = Math.max(0, Math.ceil((dpp.getTime() - now.getTime()) / 86400000));
    return { semanas, restDias, dpp: dpp.toLocaleDateString("pt-BR"), trimestre, diasAtePartum };
  }, [dum]);

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-foreground">
          Data da última menstruação (DUM)
        </label>
        <input
          type="date"
          value={dum}
          onChange={(e) => setDum(e.target.value)}
          className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-3 text-base text-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {r && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResultCard
              label="Idade gestacional"
              value={`${r.semanas}s ${r.restDias}d`}
              sub="semanas + dias"
              accent
            />
            <ResultCard label="Trimestre" value={r.trimestre} sub="período atual" />
            <ResultCard label="Data provável do parto" value={r.dpp} sub="regra de Naegele" />
            <ResultCard
              label="Dias até o parto"
              value={r.diasAtePartum > 0 ? `${r.diasAtePartum} dias` : "Pós-data"}
              sub="estimativa"
            />
          </div>

          <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Próximo exame recomendado: </span>
            {consultaForWeek(r.semanas)}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        * Baseado em ciclo regular de 28 dias (Regra de Naegele). Para datação por ultrassom, use o
        campo IG corrigida no app da paciente.
      </p>
    </div>
  );
}

function consultaForWeek(week: number): string {
  if (week <= 8)
    return "1ª consulta pré-natal: confirmação, exames de sangue/urina e ácido fólico.";
  if (week <= 10) return "Ultrassom inicial para datação e avaliação do saco gestacional.";
  if (week <= 13) return "Translucência nucal (11s0d–13s6d) + bioquímica do 1º trimestre.";
  if (week <= 17) return "Consulta mensal + exames de rotina (sangue e urina).";
  if (week <= 22) return "Ultrassom morfológico do 2º trimestre — exame fundamental.";
  if (week <= 27) return "TOTG 75g (rastreio de diabetes gestacional) — entre 24–28 semanas.";
  if (week <= 31) return "Consulta quinzenal. Avaliação de crescimento e bem-estar fetal.";
  if (week <= 35) return "Ultrassom de crescimento + Doppler quando indicado.";
  return "Consulta semanal. Cardiotocografia e planejamento do parto.";
}

/* ------------------------------------------------------------------ */
/* Tab: Biometria Fetal                                                 */
/* ------------------------------------------------------------------ */

function TabBiometria() {
  const [ig, setIg] = useState("");
  const [bpd, setBpd] = useState("");
  const [hc, setHc] = useState("");
  const [ac, setAc] = useState("");
  const [fl, setFl] = useState("");

  const r = useMemo(() => {
    const acN = parseFloat(ac);
    const flN = parseFloat(fl);
    if (!acN || !flN || acN <= 0 || flN <= 0) return null;

    const bpdN = parseFloat(bpd);
    const hcN = parseFloat(hc);
    const igN = parseFloat(ig);

    const use4 = bpdN > 0 && hcN > 0;
    const efw = use4 ? hadlock4(bpdN, hcN, acN, flN) : hadlock2(acN, flN);
    const formula = use4
      ? "Hadlock 4 parâmetros (BPD + HC + AC + FL)"
      : "Hadlock 2 parâmetros (AC + FL)";

    const percData = igN >= 20 && igN <= 41 ? efwPercentileCategory(efw, igN) : null;

    return { efw, formula, percData };
  }, [ig, bpd, hc, ac, fl]);

  const inputCls =
    "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none placeholder:text-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            IG atual (semanas)
          </label>
          <input
            type="number"
            min="20"
            max="42"
            step="1"
            placeholder="ex: 32"
            value={ig}
            onChange={(e) => setIg(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            DBP / BPD (cm)
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="ex: 8.2"
            value={bpd}
            onChange={(e) => setBpd(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            CC / HC (cm)
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="ex: 29.4"
            value={hc}
            onChange={(e) => setHc(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            CA / AC (cm) *
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="ex: 28.4"
            value={ac}
            onChange={(e) => setAc(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            CF / FL (cm) *
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="ex: 6.2"
            value={fl}
            onChange={(e) => setFl(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        * Campos obrigatórios. BPD e HC opcionais (melhoram precisão).
      </p>

      {r && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultCard
              label="Peso Fetal Estimado (PFE)"
              value={`${r.efw.toLocaleString("pt-BR")} g`}
              sub={r.formula}
              accent
            />
            {r.percData ? (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Percentil (Intergrowth-21)
                </p>
                <p className={`mt-2 text-lg font-semibold ${r.percData.color}`}>
                  {r.percData.percentile}
                </p>
                <p className={`mt-1 text-sm ${r.percData.color}`}>{r.percData.label}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/40 p-5 flex items-center">
                <p className="text-sm text-muted-foreground">
                  Informe a IG (20–41 sem) para ver o percentil.
                </p>
              </div>
            )}
          </div>

          {r.percData && (
            <div className="rounded-2xl bg-muted/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Referência — Intergrowth-21 para a semana informada
              </p>
              {IG_EFW[Math.round(parseFloat(ig))] && (
                <div className="flex flex-wrap gap-3 text-sm">
                  {(["p3", "p10", "p50", "p90", "p97"] as const).map((p) => (
                    <span key={p} className="rounded-lg bg-background px-3 py-1">
                      <span className="font-medium">{p}</span>:{" "}
                      {IG_EFW[Math.round(parseFloat(ig))][p].toLocaleString("pt-BR")} g
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Fórmulas de Hadlock et al. (1984, 1985). Curvas Intergrowth-21 (Papageorghiou et al., 2014).
        Uso clínico exclusivo — confirmar com avaliação presencial.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Risco Pré-eclâmpsia                                             */
/* ------------------------------------------------------------------ */

const HIGH_RISK = [
  { id: "prev_pe", label: "Pré-eclâmpsia em gestação anterior" },
  { id: "multifetal", label: "Gestação gemelar ou múltipla" },
  { id: "has", label: "Hipertensão arterial crônica" },
  { id: "dm", label: "Diabetes mellitus tipo 1 ou 2" },
  { id: "renal", label: "Doença renal crônica" },
  { id: "autoimune", label: "Doenças autoimunes (LES, SAF, esclerodermia)" },
];

const MOD_RISK = [
  { id: "nullipara", label: "Nulípara" },
  { id: "obese", label: "IMC ≥ 30 antes da gestação" },
  { id: "fam_hist", label: "Histórico familiar de pré-eclâmpsia (mãe/irmã)" },
  { id: "prev_sga", label: "Gestação anterior com PIG / resultado adverso" },
  { id: "age35", label: "Idade ≥ 35 anos" },
  { id: "interval10", label: "Intervalo intergestacional ≥ 10 anos" },
  { id: "afro", label: "Raça negra" },
  { id: "ivf", label: "Fertilização in vitro (FIV)" },
];

function TabPreeclampsia() {
  const [highSelected, setHighSelected] = useState<Set<string>>(new Set());
  const [modSelected, setModSelected] = useState<Set<string>>(new Set());

  const toggleHigh = (id: string) =>
    setHighSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleMod = (id: string) =>
    setModSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const hasHighRisk = highSelected.size >= 1;
  const hasModRisk = modSelected.size >= 2;
  const aspirinIndicated = hasHighRisk || hasModRisk;

  const riskLevel = hasHighRisk ? "alto" : hasModRisk ? "moderado" : "baixo";

  const riskColors: Record<string, string> = {
    alto: "border-destructive/30 bg-destructive/5",
    moderado: "border-amber-300/40 bg-amber-50/50",
    baixo: "border-emerald-300/40 bg-emerald-50/50",
  };

  const riskTextColors: Record<string, string> = {
    alto: "text-destructive",
    moderado: "text-amber-700",
    baixo: "text-emerald-700",
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Rastreio clínico baseado nos critérios <strong>ACOG 2019 / SBH 2022</strong>. Marque os
        fatores presentes na paciente.
      </p>

      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">
          Fatores de alto risco (1 fator → indicar AAS)
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {HIGH_RISK.map((f) => (
            <CheckCard
              key={f.id}
              id={f.id}
              label={f.label}
              checked={highSelected.has(f.id)}
              onChange={() => toggleHigh(f.id)}
              accentColor="destructive"
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">
          Fatores de risco moderado (≥ 2 fatores → indicar AAS)
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {MOD_RISK.map((f) => (
            <CheckCard
              key={f.id}
              id={f.id}
              label={f.label}
              checked={modSelected.has(f.id)}
              onChange={() => toggleMod(f.id)}
              accentColor="amber"
            />
          ))}
        </div>
      </div>

      {(highSelected.size > 0 || modSelected.size > 0) && (
        <div
          className={`rounded-2xl border p-5 transition-all duration-300 ${riskColors[riskLevel] ?? riskColors.baixo}`}
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Resultado</p>
          <p className={`mt-1 text-xl font-semibold ${riskTextColors[riskLevel]}`}>
            Risco {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} de Pré-eclâmpsia
          </p>

          {aspirinIndicated ? (
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-medium text-foreground">✅ AAS (aspirina) indicada</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                <li>
                  <strong>Dose:</strong> 150 mg/dia (ou 100–162 mg conforme protocolo local)
                </li>
                <li>
                  <strong>Início:</strong> entre 11 e 16 semanas (ideal ≤ 16s)
                </li>
                <li>
                  <strong>Duração:</strong> até 36 semanas (ou parto se antes)
                </li>
                <li>Suplementar cálcio 1–2 g/dia se ingesta baixa</li>
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum fator de risco suficiente para indicar AAS profilática. Manter acompanhamento
              pré-natal padrão.
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Rastreio complementar de 1º trimestre (FMF)</p>
        <p>
          Para rastreio combinado com MAP, Doppler uterino (UtA-PI) e PlGF/PAPP-A, use o software da
          Fetal Medicine Foundation (fetalmedicine.org). Esta calculadora avalia apenas os fatores
          clínicos ACOG/SBH.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function ResultCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 text-center ${accent ? "bg-primary/10" : "border border-border bg-card"}`}
    >
      <p
        className={`text-xs uppercase tracking-wider ${accent ? "text-primary" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p className={`mt-2 font-serif text-2xl ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CheckCard({
  id,
  label,
  checked,
  onChange,
  accentColor,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  accentColor: "destructive" | "amber";
}) {
  const checkedCls =
    accentColor === "destructive"
      ? "border-destructive/40 bg-destructive/5"
      : "border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/30";

  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-all duration-200 hover:bg-muted/40 ${checked ? checkedCls : "border-border bg-background"}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-primary"
      />
      <span className="text-foreground leading-snug">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: "ig", label: "Idade Gestacional", short: "Idade Gest." },
  { id: "biometria", label: "Biometria Fetal", short: "Biometria" },
  { id: "preeclampsia", label: "Risco Pré-eclâmpsia", short: "Pré-eclâmpsia" },
];

function CalcPage() {
  const [tab, setTab] = useState<Tab>("ig");

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
        Ferramentas clínicas
      </p>
      <h1 className="mt-3 font-serif text-4xl md:text-5xl">Calculadoras obstétricas</h1>
      <p className="mt-4 text-muted-foreground">
        Três ferramentas para o dia a dia do pré-natal: idade gestacional, biometria fetal pelo
        método Hadlock, e rastreio clínico de pré-eclâmpsia.
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
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.short}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="mt-5 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] md:p-8">
        {tab === "ig" && <TabIG />}
        {tab === "biometria" && <TabBiometria />}
        {tab === "preeclampsia" && <TabPreeclampsia />}
      </div>

      <AppCtaBanner />
    </section>
  );
}
