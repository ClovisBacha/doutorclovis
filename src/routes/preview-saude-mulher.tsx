import { createFileRoute } from "@tanstack/react-router";

import { SaudeMulherHub } from "@/components/saude-mulher";
import type { MenstrualCycle, PreventiveReminder } from "@/lib/saudefeminina.functions";

/**
 * BANCADA DA SAÚDE DA MULHER — ciclo menstrual e preventivos.
 *
 * ⚠️ É a metade da grade da Saúde que **some por nove meses**: numa conta de
 * gestante ela não existe (`mostrarSaudeDaMulher` só a mostra sem gestação ou
 * a partir da 36ª semana). O anel de fases e o calendário só nascem com ciclos
 * gravados, o atraso de um preventivo só aparece com data antiga, e as faixas
 * de "não consegui ler" só nascem de uma falha de rede — nenhum desses estados
 * se fabrica numa conta de teste.
 *
 * Os estados:
 *   `?tela=ciclo`        — o anel e o calendário (o padrão)
 *   `?tela=preventivos`  — a lista, com um exame ATRASADO e um em dia
 *   `?estado=vazio`      — ela nunca registrou nada
 *   `?estado=instavel`   — ⚠️ a leitura falhou: "nenhum ciclo registrado" faz
 *                            ela informar uma DUM errada ao médico, e "nunca
 *                            registrado" zera o atraso de um preventivo
 *   `?gestante=1`        — ⚠️ na gestação a PREVISÃO do ciclo fica pausada: o
 *                            anel some e o histórico fica
 */
export const Route = createFileRoute("/preview-saude-mulher")({
  validateSearch: (q: Record<string, unknown>) => ({
    tela: q.tela == null ? "ciclo" : String(q.tela),
    estado: q.estado == null ? "normal" : String(q.estado),
    gestante: q.gestante == null ? false : Boolean(q.gestante),
  }),
  head: () => ({
    meta: [{ title: "Bancada da saúde da mulher" }, { name: "robots", content: "noindex" }],
  }),
  component: Pagina,
});

/* ⚠️ Datas CRAVADAS, nunca `Date.now()` no render: servidor e cliente calculam
   instantes diferentes e o texto derivado ("em 16 dias") diverge — o React
   descarta a árvore. */
const HOJE = Date.parse("2026-09-05T12:00:00-03:00");
function dia(atras: number): string {
  return new Date(HOJE - atras * 86400000).toISOString().slice(0, 10);
}

/* Quatro ciclos de ~28 dias: é o que destrava o anel de fases, a média e a
   previsão do próximo período. */
const CICLOS: MenstrualCycle[] = [
  { atras: 12, dur: 5 },
  { atras: 40, dur: 5 },
  { atras: 68, dur: 6 },
  { atras: 97, dur: 5 },
].map((c, i) => ({
  id: `c${i}`,
  user_id: "b",
  start_date: dia(c.atras),
  end_date: dia(c.atras - c.dur),
  flow_intensity: i === 2 ? "intenso" : "normal",
  symptoms: i === 0 ? ["colica", "cansaco"] : [],
  notes: null,
  created_at: dia(c.atras),
}));

/* Um exame ATRASADO (Papanicolau de dois anos atrás, com frequência anual) e
   um em dia — sem os dois lado a lado não dá para conferir a diferença. */
const PREVENTIVOS: PreventiveReminder[] = [
  {
    id: "p1",
    user_id: "b",
    exam_key: "papanicolau",
    last_done_date: dia(760),
    notes: "Feito na clínica do bairro",
  },
  { id: "p2", user_id: "b", exam_key: "mamografia", last_done_date: dia(120), notes: null },
];

function Pagina() {
  const { tela, estado, gestante } = Route.useSearch();

  const bancada =
    estado === "instavel"
      ? { cycles: [], reminders: [], instavel: true }
      : estado === "vazio"
        ? { cycles: [], reminders: [] }
        : { cycles: CICLOS, reminders: PREVENTIVOS };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <p className="mb-4 text-xs text-muted-foreground">
        Bancada · <strong>{tela}</strong> · estado <strong>{estado}</strong>
        {gestante ? " · gestante (previsão pausada)" : ""}
      </p>
      <SaudeMulherHub
        weeks={gestante ? 38 : null}
        initialSub={tela === "preventivos" ? "preventivos" : "ciclo"}
        bancada={bancada}
      />
    </div>
  );
}
