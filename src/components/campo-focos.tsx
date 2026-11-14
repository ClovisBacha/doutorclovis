/**
 * Focos de atuação — vários, não um.
 *
 * Um obstetra atende alto risco E parto humanizado E endometriose. Com um campo
 * só ele escolhe um e some das buscas dos outros dois: a paciente que procura
 * "endometriose" não encontra quem trata endometriose. É a forma mais cara de
 * perder um match, porque ninguém percebe que aconteceu.
 *
 * Chips e não uma lista de caixinhas: são rótulos curtos, e o que importa é ver
 * de relance quais estão ligados. O teto de 8 é deliberado — quem marca tudo não
 * está dizendo no que é bom, está dizendo que não escolheu, e um card com quinze
 * etiquetas não ajuda ninguém a decidir.
 */

import { useState } from "react";
import { ESPECIALIDADES_MEDICO } from "@/lib/medico-opcoes";

const TETO = 8;

export function CampoFocos({
  valor,
  onChange,
  principal,
  classeInput,
  classeLabel,
}: {
  valor: string[];
  onChange: (v: string[]) => void;
  /** O foco principal (`specialty`): entra marcado e não sai daqui. */
  principal?: string;
  classeInput: string;
  classeLabel: string;
}) {
  const [outro, setOutro] = useState("");
  /* O principal aparece na lista mesmo se não for uma das opções curadas —
     senão o médico que digitou "Gestação gemelar" no campo acima não vê o
     próprio foco aqui e acha que sumiu. */
  const opcoes = [
    ...(principal && !ESPECIALIDADES_MEDICO.includes(principal as never) ? [principal] : []),
    ...ESPECIALIDADES_MEDICO,
    ...valor.filter((v) => !ESPECIALIDADES_MEDICO.includes(v as never) && v !== principal),
  ];
  const cheio = valor.length >= TETO;

  function alternar(f: string) {
    if (valor.includes(f)) onChange(valor.filter((x) => x !== f));
    else if (!cheio) onChange([...valor, f]);
  }

  return (
    <div>
      <label className={classeLabel}>Também atendo</label>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        Marque tudo o que você atende de fato — cada um é uma busca em que você aparece. Até {TETO}.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {opcoes.map((f) => {
          const on = valor.includes(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => alternar(f)}
              aria-pressed={on}
              disabled={!on && cheio}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : cheio
                    ? "border-border text-muted-foreground/40"
                    : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {on ? "✓ " : ""}
              {f}
            </button>
          );
        })}
      </div>

      {!cheio && (
        <div className="mt-2 flex gap-2">
          <input
            value={outro}
            onChange={(e) => setOutro(e.target.value)}
            onKeyDown={(e) => {
              // Enter adiciona sem enviar o formulário inteiro — num form, a
              // tecla Enter num input submete, e aqui isso seria um desastre.
              if (e.key === "Enter") {
                e.preventDefault();
                const v = outro.trim();
                if (v && !valor.includes(v)) onChange([...valor, v]);
                setOutro("");
              }
            }}
            placeholder="Outro foco — ex.: Gestação gemelar"
            className={`${classeInput} mt-0`}
          />
          <button
            type="button"
            onClick={() => {
              const v = outro.trim();
              if (v && !valor.includes(v)) onChange([...valor, v]);
              setOutro("");
            }}
            className="shrink-0 rounded-xl border border-primary/40 px-4 text-sm font-medium text-primary"
          >
            Adicionar
          </button>
        </div>
      )}
      {cheio && (
        <p className="mt-2 text-xs text-amber-700">
          Oito é o limite. Um card com etiqueta demais não ajuda ela a decidir — tire um para pôr
          outro.
        </p>
      )}
    </div>
  );
}
