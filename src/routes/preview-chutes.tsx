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
 *   `?estado=instavel-historico` — a recarga falhou COM histórico em mãos
 *   `?estado=alerta`    — 2h05 com 4 movimentos: o caso vermelho, com o 192
 *   `?estado=contando`  — sessão em curso dentro do prazo, sem alarme
 *   `?estado=historico` — sessões anteriores, os três cartões
 *   `?estado=serie`     — doze contagens: o gráfico com a faixa do "seu normal"
 *   `?estado=luto`      — Modo Cuidado
 *
 * ⚠️ `?w=` é a semana. Antes da 26ª a tela não fala de contagem (SOGC 2023);
 * o PISO NUMÉRICO continua em 28. E `?w=` VAZIO é um estado de verdade: é a
 * gestante sem DUM, para quem a régua NÃO pode calar — era falha aberta no
 * eixo que mais importa, e é impossível de fotografar sem este parâmetro.
 */
export const Route = createFileRoute("/preview-chutes")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e nunca `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, que aqui viraria uma
       gestante de zero semanas. É a armadilha que `preview-saude` documenta. */
    w: q.w == null ? 32 : q.w === "" ? null : Number(q.w),
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

/* Doze contagens de verdade: mediana em ~11 min, com uma noite de 34 que é o
   ponto que a faixa existe para deixar visível. */
const SERIE: KickSession[] = [
  [60 * 24 * 12, 10, 9],
  [60 * 24 * 11, 10, 12],
  [60 * 24 * 10, 10, 10],
  [60 * 24 * 9, 10, 13],
  [60 * 24 * 8, 10, 11],
  [60 * 24 * 7, 10, 8],
  [60 * 24 * 6, 10, 12],
  [60 * 24 * 5, 10, 10],
  [60 * 24 * 4, 10, 14],
  [60 * 24 * 3, 10, 11],
  [60 * 24 * 2, 10, 9],
  [60 * 24 * 1, 10, 34],
].map(([h, c, d]) => sessao(h, c, d));

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
      : estado === "instavel-historico"
        ? /* ⚠️ A recarga que falha COM histórico em mãos: sem este estado, a
             faixa discreta que diz "a sua contagem foi salva" não teria como
             ser fotografada — e ela é o conserto de uma leitura que fazia a
             paciente gravar duas vezes. */
          { history: HISTORICO, instavel: true }
        : estado === "alerta"
          ? /* ⚠️ O estado que a tela existe para provar: passou das duas horas com
             menos de dez. O aviso e o 192 têm de estar na tela. */
            { history: HISTORICO, ativa: { count: 4, minutos: 125 } }
          : estado === "contando"
            ? { history: HISTORICO, ativa: { count: 3, minutos: 18 } }
            : estado === "historico"
              ? { history: HISTORICO }
              : estado === "serie"
                ? { history: SERIE }
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
