import { createFileRoute } from "@tanstack/react-router";

import { HealthTab, type HealthLog } from "@/components/health-tab";

/**
 * BANCADA DE PESO, PRESSÃO E GLICEMIA.
 *
 * ⚠️ É a tela mais clínica do app da paciente — é por `health_logs` que os
 * números que ela mede em casa chegam ao painel do médico, e é o único lugar
 * com CONDUTA sobre a pressão (a `vozDaPaciente` do último valor grave). E ela
 * não era fotografável: os gráficos só existem com dois pontos, a curva do IOM
 * só aparece com peso pré-gestacional e altura no perfil, e a faixa de "não
 * consegui atualizar" só nasce de uma falha de rede.
 *
 * Os estados:
 *   `?estado=vazio`     — ela nunca registrou (o padrão)
 *   `?estado=instavel`  — a leitura falhou e NÃO havia nada na tela
 *   `?estado=parcial`   — ⚠️ a leitura falhou COM dados à mostra: é o caso que
 *                          mais engana, porque ela acabou de salvar e o número
 *                          novo não aparece
 *   `?estado=normal`    — histórico com gráficos, tudo dentro da faixa
 *   `?estado=grave`     — uma pressão de 165/105: a conduta tem de estar lá
 *   `?estado=semperfil` — sem altura nem peso pré-gestacional (sem curva IOM)
 */
export const Route = createFileRoute("/preview-saude-registros")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e nunca `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0. */
    w: q.w == null || q.w === "" ? 28 : Number(q.w),
    estado: q.estado == null ? "vazio" : String(q.estado),
  }),
  head: () => ({
    meta: [{ title: "Bancada dos registros" }, { name: "robots", content: "noindex" }],
  }),
  component: Pagina,
});

/* ⚠️ Datas CRAVADAS, nunca `Date.now()` no render: servidor e cliente calculam
   instantes diferentes e o texto derivado diverge — o React descarta a árvore. */
function dia(atras: number): string {
  const base = Date.parse("2026-09-05T12:00:00-03:00");
  return new Date(base - atras * 86400000).toISOString().slice(0, 10);
}

function log(i: number, peso: number, sis: number, dia_: number, gli?: number): HealthLog {
  return {
    id: `l${i}`,
    log_date: dia(i * 7),
    weight_kg: peso,
    systolic: sis,
    diastolic: dia_,
    glucose_mg_dl: gli ?? null,
    spo2: null,
    heart_rate_bpm: null,
    steps: null,
    sleep_hours: null,
    notes: null,
  };
}

/* Do mais novo para o mais velho — é a ordem em que a consulta devolve. */
const NORMAL: HealthLog[] = [
  log(0, 68.4, 118, 76, 92),
  log(1, 68.0, 116, 74),
  log(2, 67.6, 120, 78, 88),
  log(3, 67.1, 114, 72),
  log(4, 66.5, 118, 76),
];

const GRAVE: HealthLog[] = [log(0, 69.2, 165, 105, 148), ...NORMAL.slice(1)];

function Pagina() {
  const { w, estado } = Route.useSearch();

  const bancada =
    estado === "instavel"
      ? { logs: [], instavel: true }
      : estado === "parcial"
        ? { logs: NORMAL, instavel: true }
        : estado === "grave"
          ? { logs: GRAVE }
          : estado === "normal" || estado === "semperfil"
            ? { logs: NORMAL }
            : { logs: [] };

  /* O perfil com altura e peso pré-gestacional é o que destrava a curva do
     IOM — sem ele o gráfico de ganho não existe, e esse é um estado real. */
  const perfil =
    estado === "semperfil"
      ? ({
          id: "b",
          display_name: "Ana",
          baby_name: null,
          lmp_date: null,
          due_date: null,
          reference_date: null,
          reference_weeks: null,
          reference_days: null,
        } as never)
      : ({
          id: "b",
          display_name: "Ana",
          baby_name: "Helena",
          lmp_date: null,
          due_date: null,
          reference_date: null,
          reference_weeks: null,
          reference_days: null,
          height_cm: 165,
          pre_pregnancy_weight_kg: 62,
        } as never);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <p className="mb-4 text-xs text-muted-foreground">
        Bancada · estado <strong>{estado}</strong> · semana <strong>{w}</strong>
      </p>
      <HealthTab
        gest={{ weeks: w, days: 0, totalDays: w * 7 } as never}
        profile={perfil}
        onNavigate={() => {}}
        bancada={bancada}
      />
    </div>
  );
}
