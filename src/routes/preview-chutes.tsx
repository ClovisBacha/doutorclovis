import { createFileRoute } from "@tanstack/react-router";

import { KicksTab, type KickSession } from "@/components/kicks-tab";

/**
 * BANCADA DO CONTADOR DE MOVIMENTOS.
 *
 * ⚠️ Esta tela MEDE um dos nove sintomas VERMELHOS de `triage.ts` — redução de
 * movimentos fetais — e era a única das cinco que o coração abre sem NENHUMA
 * bancada. O estado que mais importa, "duas horas com quatro movimentos", pedia
 * uma conta de verdade e um dedo tocando por duas horas; foi por isso que a tela
 * passou meses anunciando "o ideal é sentir 10 em até 2 horas" sem fazer nada
 * quando o prazo passava.
 *
 * Os estados que uma conta de teste não fabrica:
 *   `?estado=vazio`     — ela nunca contou (o padrão)
 *   `?estado=instavel`  — a leitura falhou; NÃO pode virar "nunca registrou"
 *   `?estado=alerta`    — 2h05 com 4 movimentos: o caso vermelho, com o 192
 *   `?estado=contando`  — sessão em curso dentro do prazo, sem alarme
 *   `?estado=historico` — sessões anteriores, os três cartões
 *   `?estado=luto`      — Modo Cuidado
 *
 * `?w=` é a semana: antes da 28ª a contagem formal não começou, e a régua CALA.
 */
export const Route = createFileRoute("/preview-chutes")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e nunca `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, que aqui viraria uma
       gestante de zero semanas. É a armadilha que `preview-saude` documenta. */
    w: q.w == null || q.w === "" ? 32 : Number(q.w),
    estado: q.estado == null ? "vazio" : String(q.estado),
  }),
  head: () => ({
    meta: [{ title: "Bancada dos chutes" }, { name: "robots", content: "noindex" }],
  }),
  component: Pagina,
});

/* ⚠️ Instantes CRAVADOS a partir de uma âncora fixa, nunca `Date.now()` no
   render: servidor e cliente calculam instantes diferentes e o texto derivado
   diverge — o React descarta a árvore. Mesma regra da bancada das contrações. */
const ANCORA = new Date("2026-09-05T21:40:00-03:00").getTime();

function sessao(hMin: number, chutes: number, duracaoMin: number): KickSession {
  const ini = ANCORA - hMin * 60000;
  return {
    id: `s${hMin}`,
    started_at: new Date(ini).toISOString(),
    ended_at: new Date(ini + duracaoMin * 60000).toISOString(),
    kick_count: chutes,
  };
}

const HISTORICO: KickSession[] = [
  sessao(60 * 20, 10, 24),
  sessao(60 * 44, 10, 31),
  sessao(60 * 68, 10, 18),
  sessao(60 * 92, 7, 120),
];

function Pagina() {
  const { w, estado } = Route.useSearch();
  const luto = estado === "luto";

  const bancada =
    estado === "instavel"
      ? { history: [], instavel: true }
      : estado === "alerta"
        ? /* ⚠️ O estado que a tela existe para provar: passou das duas horas com
             menos de dez. O aviso e o 192 têm de estar na tela. */
          { history: HISTORICO, ativa: { count: 4, minutos: 125 } }
        : estado === "contando"
          ? { history: HISTORICO, ativa: { count: 3, minutos: 18 } }
          : estado === "historico"
            ? { history: HISTORICO }
            : { history: [] };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <p className="mb-4 text-xs text-muted-foreground">
        Bancada · estado <strong>{estado}</strong> · semana <strong>{w}</strong>
      </p>
      <KicksTab
        weeks={w}
        babyName="Helena"
        careMode={luto}
        onNavigate={() => {}}
        bancada={bancada}
      />
    </div>
  );
}
