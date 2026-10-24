/**
 * O desenho do texto leve (ver `src/lib/texto-leve.ts`): negrito e lista, em
 * nós de React — nunca HTML. Sem marca nenhuma o texto sai como string, que é
 * exatamente o caminho que a bolha sempre teve.
 *
 * ⚠️ `leading-relaxed` vai em CADA `<p>` e `<li>`, nunca só no pai: há regra
 * base de `p` no projeto, e regra de elemento vence valor herdado.
 */
import { Fragment } from "react";

import { blocosDe, temMarcas, type Trecho } from "@/lib/texto-leve";

function Linha({ trechos }: { trechos: Trecho[] }) {
  return (
    <>
      {trechos.map((t, k) =>
        t.negrito ? (
          <strong key={k} className="font-semibold">
            {t.texto}
          </strong>
        ) : (
          <Fragment key={k}>{t.texto}</Fragment>
        ),
      )}
    </>
  );
}

export function TextoLeve({ texto }: { texto: string }) {
  if (!temMarcas(texto)) return <>{texto}</>;
  const blocos = blocosDe(texto);
  return (
    <div className="space-y-2">
      {blocos.map((b, i) =>
        b.tipo === "paragrafo" ? (
          <p key={i} className="leading-relaxed">
            {b.linhas.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && "\n"}
                <Linha trechos={l} />
              </Fragment>
            ))}
          </p>
        ) : b.ordenada ? (
          <ol key={i} className="list-decimal space-y-1 pl-5">
            {b.itens.map((it, j) => (
              <li key={j} className="leading-relaxed">
                <Linha trechos={it} />
              </li>
            ))}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-lime-700">
            {b.itens.map((it, j) => (
              <li key={j} className="leading-relaxed">
                <Linha trechos={it} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
