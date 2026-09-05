import { createFileRoute } from "@tanstack/react-router";

import { ContracoesTab } from "@/components/contracoes-tab";

/**
 * BANCADA DO CRONÔMETRO DE CONTRAÇÕES.
 *
 * ⚠️ Esta era a tela clínica mais consequente do app SEM NENHUMA bancada — e é
 * onde o CLAUDE.md registra o defeito que silenciava o botão do 192: a leitura
 * falhando virava "ela não cronometrou nada", e o banner de análise, que é o
 * único lugar da tela com "Ligar 192 (SAMU)", vive atrás de duas contrações na
 * janela. Sem foto, o conserto disso nunca foi OLHADO.
 *
 * Os quatro estados que uma conta de teste não fabrica:
 *   `?estado=vazio`     — ela nunca cronometrou (o padrão)
 *   `?estado=instavel`  — a leitura falhou; o 192 tem de aparecer mesmo assim
 *   `?estado=parto`     — padrão de trabalho de parto (o caso vermelho)
 *   `?estado=curso`     — uma contração ABERTA, retomada do banco
 *   `?estado=normal`    — contrações espaçadas, sem alarme
 *
 * `?w=` é a semana: antes de 37 o padrão regular é PREMATURIDADE, e a análise
 * muda de texto por causa disso.
 */
export const Route = createFileRoute("/preview-contracoes")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e nunca `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, que aqui viraria uma
       gestante de zero semanas. É a armadilha que `preview-saude` documenta. */
    w: q.w == null || q.w === "" ? 34 : Number(q.w),
    estado: q.estado == null ? "vazio" : String(q.estado),
  }),
  head: () => ({
    meta: [{ title: "Bancada das contrações" }, { name: "robots", content: "noindex" }],
  }),
  component: Pagina,
});

/* ⚠️ Instantes CRAVADOS a partir de uma âncora fixa, nunca `Date.now()` no
   render: servidor e cliente calculam instantes diferentes e o texto derivado
   ("há 3 min") diverge — o React descarta a árvore. É o mismatch de hidratação
   que já derrubou este app inteiro uma vez. */
const ANCORA = new Date("2026-09-05T14:20:00-03:00").getTime();

function linha(minAtras: number, duracaoSeg: number | null, intensidade: number) {
  const inicio = new Date(ANCORA - minAtras * 60000);
  return {
    id: `c-${minAtras}`,
    started_at: inicio.toISOString(),
    ended_at:
      duracaoSeg == null ? null : new Date(inicio.getTime() + duracaoSeg * 1000).toISOString(),
    intensity: intensidade,
  };
}

function montar(estado: string) {
  if (estado === "instavel") return { contractions: [], instavel: true };
  if (estado === "parto")
    /* A cada ~4 min, 55 s cada — o padrão que a análise chama de trabalho de
       parto, e o único caminho que desenha "Ligar 192 (SAMU)". */
    return {
      contractions: [0, 4, 8, 12, 17, 21, 25].map((m, i) => linha(m, 50 + (i % 3) * 5, 3)),
    };
  if (estado === "curso")
    return { contractions: [linha(0, null, 2), linha(9, 45, 2), linha(19, 40, 2)] };
  if (estado === "normal")
    return { contractions: [linha(5, 35, 1), linha(35, 30, 1), linha(70, 28, 2)] };
  return { contractions: [] };
}

function Pagina() {
  const { w, estado } = Route.useSearch();
  return (
    <div className="fixed inset-0 z-[50] overflow-y-auto bg-background px-4 py-5">
      <p className="mb-1 font-serif text-xl">Contrações</p>
      <p className="mb-4 text-xs text-muted-foreground">
        estado: {estado} · semana {Number.isFinite(w) ? w : "—"}
      </p>
      <ContracoesTab weeks={Number.isFinite(w) ? w : null} bancada={montar(estado)} />
    </div>
  );
}
