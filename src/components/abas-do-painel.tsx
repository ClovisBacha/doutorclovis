import { useEffect, useRef } from "react";
import {
  GRUPOS,
  type ChaveDeGrupo,
  type PanelTab,
  grupoDe,
  abaDeEntradaDoGrupo,
  somaDoGrupo,
} from "@/lib/abas-do-painel";

/**
 * AS DUAS FITAS — cinco grupos em cima, as telas do grupo embaixo.
 *
 * ─── O QUE ESTA TELA RESOLVE ────────────────────────────────────────────────
 *
 * Eram quinze abas numa fita rolável de uma linha. Num monitor a nona já
 * aparecia cortada; num celular a última ficava mil pixels à direita. O médico
 * não descobria o que existe — precisava lembrar de rolar.
 *
 * ─── AS TRÊS COISAS QUE PODIAM SUMIR NA FUSÃO ───────────────────────────────
 *
 * 1. **O contador.** O número em "Perguntas" é o que faz o médico ir até lá.
 *    Empurrada para dentro de Cérebro, a bolinha sumiria da fita e a fusão
 *    passaria a esconder o trabalho que ela devia revelar. Aqui o número sobe
 *    para o grupo (`somaDoGrupo`) E fica na filha, dizendo lá dentro ONDE ele
 *    está.
 *
 * 2. **O segundo nível quando é um só.** Um grupo com uma filha só não mostra
 *    a segunda fita: seria uma linha inteira de tela para repetir o nome que
 *    já está selecionado logo acima.
 *
 * 3. **A posição.** A segunda fita rola sozinha até a aba ativa, porque muitas
 *    trocas são programáticas (um cartão do Painel manda para Exames) e ele
 *    chegava numa tela cujo indicador estava fora do campo de visão.
 */

export function AbasDoPainel({
  aba,
  onEscolher,
  contadores = {},
  className = "",
}: {
  aba: PanelTab;
  onEscolher: (aba: PanelTab) => void;
  /** Quanto trabalho espera em cada tela. O grupo mostra a soma das filhas. */
  contadores?: Partial<Record<PanelTab, number>>;
  className?: string;
}) {
  const grupoAtivo = grupoDe(aba);
  const grupo = GRUPOS.find((g) => g.chave === grupoAtivo) ?? null;

  return (
    <div className={className}>
      {/* ── Primeira fita: os cinco ── */}
      <div
        role="tablist"
        aria-label="Áreas do painel"
        /* ─── O ESPAÇO ENTRE OS GRUPOS É PARTE DA FITA ────────────────────
           `gap-1` com `px-4` em cada botão empilhava cinco rótulos quase
           encostados: o que separava um do outro era a palavra, não o espaço, e
           lida de relance a fita parecia uma frase. O ar foi para o GAP e saiu
           do padding, então a fita não ficou mais larga — só ficou legível.
           Pedido do dono: "aumenta o espaçamento entre o cérebro, o pacientes,
           agenda, painel, ferramentas". */
        className="flex snap-x gap-5 overflow-x-auto border-b border-border sm:gap-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {GRUPOS.map((g) => {
          const total = somaDoGrupo(g.chave, contadores);
          const ativo = g.chave === grupoAtivo;
          return (
            <button
              key={g.chave}
              role="tab"
              aria-selected={ativo}
              onClick={() => onEscolher(abaDeEntradaDoGrupo(g.chave))}
              className={`shrink-0 snap-start whitespace-nowrap border-b-2 px-0.5 py-2.5 text-[15px] font-medium transition-colors ${
                ativo
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-primary"
              }`}
            >
              {g.rotulo}
              {total > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                  {total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Segunda fita: as telas do grupo ── */}
      {grupo && grupo.filhas.length > 1 && (
        <SegundaFita
          chave={grupo.chave}
          filhas={grupo.filhas}
          aba={aba}
          contadores={contadores}
          onEscolher={onEscolher}
        />
      )}
    </div>
  );
}

function SegundaFita({
  chave,
  filhas,
  aba,
  contadores,
  onEscolher,
}: {
  chave: ChaveDeGrupo;
  filhas: readonly PanelTab[];
  aba: PanelTab;
  contadores: Partial<Record<PanelTab, number>>;
  onEscolher: (aba: PanelTab) => void;
}) {
  const fita = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Partial<Record<PanelTab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const el = refs.current[aba];
    if (!el || !fita.current) return;
    /* Só na horizontal: `block: "nearest"` percorreria os ancestrais roláveis
       e puxaria a PÁGINA junto, tirando do campo de visão o cartão que o
       médico acabou de tocar para chegar aqui. */
    el.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [aba]);

  return (
    <div
      ref={fita}
      role="tablist"
      aria-label="Telas desta área"
      /* `key` no grupo: trocar de grupo remonta a fita, senão o efeito de
         rolagem herdaria a posição da fita anterior. */
      key={chave}
      className="mt-2 flex snap-x gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {filhas.map((f) => {
        const n = contadores[f] ?? 0;
        const ativo = f === aba;
        return (
          <button
            key={f}
            role="tab"
            aria-selected={ativo}
            ref={(el) => {
              refs.current[f] = el;
            }}
            onClick={() => onEscolher(f)}
            className={`shrink-0 snap-start whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              ativo
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
            }`}
          >
            {f}
            {n > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
