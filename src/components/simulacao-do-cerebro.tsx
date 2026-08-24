import { useEffect, useRef, useState } from "react";
import {
  AVISO_DA_SIMULACAO,
  CASOS_SIMULADOS,
  ROTULO_DO_VEREDICTO,
  type CasoSimulado,
} from "@/lib/simulacao-do-cerebro";

/**
 * A SIMULAÇÃO — o médico vê o cérebro trabalhando antes de assinar.
 *
 * Substitui o teste ao vivo no plano Free (decisão do dono, ago/2026). Custa
 * zero: nenhuma chamada de modelo, tudo texto local de `simulacao-do-cerebro`.
 *
 * ─── O QUE ELA MOSTRA, E POR QUE NESTA ORDEM ────────────────────────────────
 *
 * A dúvida de quem vende um cérebro de IA a um médico nunca é “ele responde?”.
 * É “ele responde ERRADO?”. Por isso a simulação não é uma vitrine de respostas
 * bonitas: ela mostra os três comportamentos, e dois deles são o cérebro se
 * RECUSANDO a responder. O que convence um obstetra é ver a IA se calar diante
 * de um pedido de receita — não vê-la falar bem sobre enjoo.
 *
 * Mostra também a coluna “no seu painel”: a metade que nenhum concorrente
 * mostra, porque é onde a dúvida vira aprendizado e o produto deixa de ser um
 * chat genérico.
 */

const TEMAS = {
  escuro: {
    caixa: "border-white/15 bg-white/[0.06] backdrop-blur-xl",
    chip: "border-white/15 bg-white/[0.04] text-white/70 hover:border-white/35 hover:text-white",
    chipAtivo: "border-white/60 bg-white/15 text-white",
    balaoDela: "bg-white/90 text-neutral-900",
    balaoDele: "border border-white/12 bg-white/[0.05] text-white/85",
    titulo: "text-white",
    apoio: "text-white/60",
    fraco: "text-white/45",
    painel: "border-white/10 bg-white/[0.03] text-white/60",
  },
  claro: {
    caixa: "border-primary/25 bg-card",
    chip: "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
    chipAtivo: "border-primary bg-primary/10 text-foreground",
    balaoDela: "bg-primary/10 text-foreground",
    balaoDele: "border border-border bg-background text-foreground",
    titulo: "text-foreground",
    apoio: "text-muted-foreground",
    fraco: "text-muted-foreground",
    painel: "border-border bg-muted/40 text-muted-foreground",
  },
} as const;

/** A batida antes da resposta. Curta: é teatro suficiente para a resposta
    parecer pensada, e curta o bastante para não irritar quem clicar em cinco. */
const PAUSA_MS = 620;

export function SimulacaoDoCerebro({
  tema = "escuro",
  className = "",
}: {
  tema?: keyof typeof TEMAS;
  className?: string;
}) {
  const t = TEMAS[tema];
  const [caso, setCaso] = useState<CasoSimulado>(CASOS_SIMULADOS[0]);
  const [pensando, setPensando] = useState(false);
  /* O timer precisa morrer com o componente: sem isto, clicar e sair da aba
     deixa um `setState` mirando um componente desmontado. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function escolher(c: CasoSimulado) {
    if (c.id === caso.id) return;
    if (timer.current) clearTimeout(timer.current);
    setCaso(c);
    setPensando(true);
    timer.current = setTimeout(() => setPensando(false), PAUSA_MS);
  }

  const v = ROTULO_DO_VEREDICTO[caso.veredicto];

  return (
    <div className={`rounded-3xl border p-5 sm:p-6 ${t.caixa} ${className}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${t.fraco}`}>
        Simulação · não gasta mensagem
      </p>
      <p className={`mt-2 font-serif text-xl sm:text-2xl ${t.titulo}`}>
        Veja o cérebro decidir — inclusive quando ele não responde
      </p>
      <p className={`mt-1.5 text-sm leading-relaxed ${t.apoio}`}>
        Escolha o que uma paciente perguntaria às duas da manhã.
      </p>

      {/* ── As perguntas ── */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Perguntas de exemplo">
        {CASOS_SIMULADOS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => escolher(c)}
            aria-pressed={c.id === caso.id}
            className={`rounded-full border px-3.5 py-1.5 text-left text-xs font-medium transition-colors ${
              c.id === caso.id ? t.chipAtivo : t.chip
            }`}
          >
            {c.pergunta}
          </button>
        ))}
      </div>

      {/* ── A conversa ── */}
      <div className="mt-5 space-y-3">
        <div className="flex justify-end">
          <p
            className={`max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm ${t.balaoDela}`}
          >
            {caso.pergunta}
          </p>
        </div>

        {/* `aria-live` porque a resposta troca sozinha depois da pausa: sem
            isto, quem usa leitor de tela clica no chip e não ouve nada. */}
        <div className="flex justify-start" aria-live="polite">
          <div
            className={`max-w-[92%] rounded-2xl rounded-bl-sm px-3.5 py-3 text-sm ${t.balaoDele}`}
          >
            {pensando ? (
              <span className="flex gap-1 py-1" aria-label="pensando">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-50"
                    style={{ animationDelay: `${i * 160}ms` }}
                  />
                ))}
              </span>
            ) : (
              <>
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">
                  <span aria-hidden>{v.emoji}</span> {v.titulo}
                </span>
                <p className="leading-relaxed">{caso.resposta}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── A metade que ninguém mostra ── */}
      <div className={`mt-4 rounded-2xl border px-3.5 py-3 text-xs leading-relaxed ${t.painel}`}>
        <span className="font-semibold">No seu painel:</span> {caso.noPainel}
        <span className="mt-1 block opacity-80">{v.explica}</span>
      </div>

      <p className={`mt-3 text-[11px] leading-relaxed ${t.fraco}`}>{AVISO_DA_SIMULACAO}</p>
    </div>
  );
}
