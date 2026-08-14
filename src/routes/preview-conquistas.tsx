import { createFileRoute } from "@tanstack/react-router";
import { ConquistasTab } from "@/routes/_authenticated/minha-conta";
import { CONQUISTAS } from "@/lib/conquistas";

/**
 * Bancada das CONQUISTAS.
 *
 * A aba busca do servidor e concede na hora: para ver uma épica com a moldura
 * dourada numa conta de verdade seria preciso meditar trinta vezes. Sem
 * bancada, a raridade que o dono pediu só se conferiria em produção, meses
 * depois — e foi exatamente por telas assim serem impossíveis de olhar que a
 * aba ficou com dezoito conquistas de um app que já tinha o dobro de coisas.
 *
 * Parâmetros:
 *   `?quantas=12`  quantas desbloquear (a partir do começo da lista)
 *   `?tudo=1`      desbloqueia todas — o caso que mostra as três molduras
 *   `?luto=1`      Modo Cuidado (a aba inteira dá lugar ao silêncio)
 */
export const Route = createFileRoute("/preview-conquistas")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e não `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0. Quarta vez que esta
       armadilha aparece no repo (ver `preview-bebe`, `preview-saude`,
       `preview-jogo`). */
    quantas: q.quantas == null ? 14 : Number(q.quantas),
    tudo: q.tudo === true || String(q.tudo ?? "") === "1",
    luto: q.luto === true || String(q.luto ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada das conquistas" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewConquistas,
});

function PreviewConquistas() {
  const { quantas, tudo, luto } = Route.useSearch();
  const n = tudo ? CONQUISTAS.length : Math.max(0, Math.min(CONQUISTAS.length, quantas));
  return (
    <div className="fixed inset-0 z-[50] overflow-y-auto bg-background px-5 py-6">
      <ConquistasTab
        careMode={luto}
        bancada={{ desbloqueadas: CONQUISTAS.slice(0, n).map((c) => c.key) }}
      />
    </div>
  );
}
