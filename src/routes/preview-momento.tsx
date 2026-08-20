/**
 * BANCADA DO "COMPARTILHE ESSA VITÓRIA".
 *
 * O cartão só nasce de uma conquista real — fechar as cinco estrelas, chegar
 * ao 12º troféu, segurar 41 dias de chama. Sem esta bancada, olhar o desenho
 * de cada momento exigiria conquistá-lo numa conta de verdade, um por um. É
 * exatamente como uma tela passa meses sem ninguém nunca ter olhado para ela.
 *
 *   /preview-momento                    → o troféu (o caso comum)
 *   /preview-momento?especie=chama&n=41 → a sequência
 *   /preview-momento?luto=1             → o Modo Cuidado: nada aparece
 *   /preview-momento?tudo=1             → os oito cartões, um do lado do outro
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CompartilharMomento } from "@/components/compartilhar-momento";
import { momentoDe, type EspecieDeMomento } from "@/lib/momento";
import { momentoComoDataUrl } from "@/lib/share-card";

const ESPECIES: EspecieDeMomento[] = [
  "semana",
  "cinco_estrelas",
  "trofeu",
  "chama",
  "conquista",
  "marco_gratidao",
  "album_semana",
  "aula",
];

export const Route = createFileRoute("/preview-momento")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    especie: q.especie == null ? "trofeu" : String(q.especie),
    n: q.n == null ? 12 : Number(q.n),
    luto: q.luto == null ? false : !!q.luto,
    tudo: q.tudo == null ? false : !!q.tudo,
  }),
});

function rotuloDe(e: EspecieDeMomento): string | null {
  if (e === "aula") return "nutrição";
  if (e === "conquista") return "Primeira semana no app";
  return null;
}

function Bancada() {
  const { especie, n, luto, tudo } = Route.useSearch();
  const lista = tudo ? ESPECIES : [(especie as EspecieDeMomento) ?? "trofeu"];

  return (
    <div className="mx-auto max-w-md space-y-8 px-5 py-10">
      <header>
        <h1 className="font-serif text-2xl">Compartilhe essa vitória</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O cartão é desenhado no aparelho, em canvas — sem servidor e sem biblioteca.{" "}
          {luto && <strong>Modo Cuidado ligado: nada deve aparecer.</strong>}
        </p>
      </header>

      {lista.map((e) => {
        const m = momentoDe({
          especie: e,
          numero: n,
          rotulo: rotuloDe(e),
          emCuidado: luto,
        });
        return (
          <section key={e} className="space-y-3 border-t border-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {e}
            </p>
            {m ? (
              <>
                <PreviaDoCartao chave={`${e}-${n}-${luto}`} momento={m} />
                <div className="flex justify-center">
                  <CompartilharMomento
                    momento={m}
                    nomeDaMae="Marina"
                    aoPublicarNaComunidade={() => console.log("iria para o compositor", m)}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum cartão — <code>momentoDe</code> devolveu <code>null</code>.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * O cartão desenhado de verdade, em tamanho reduzido.
 *
 * ⚠️ Ele é gerado NO CLIENTE, depois da montagem: `momentoComoDataUrl` toca em
 * `document`, e chamá-lo no corpo do render daria mismatch de hidratação — o
 * mesmo defeito que `location.origin` no render já custou aqui.
 */
function PreviaDoCartao({
  chave,
  momento,
}: {
  chave: string;
  momento: Parameters<typeof momentoComoDataUrl>[0];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const feito = useRef("");
  useEffect(() => {
    if (feito.current === chave) return;
    feito.current = chave;
    setUrl(momentoComoDataUrl(momento, { motherName: "Marina" }));
  }, [chave, momento]);
  if (!url) return <div className="skeleton aspect-[1080/1350] w-full rounded-2xl" />;
  return <img src={url} alt="" className="w-full rounded-2xl border border-border" />;
}
