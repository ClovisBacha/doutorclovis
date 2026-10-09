import { createFileRoute } from "@tanstack/react-router";
import { ConquistasTab } from "@/components/conquistas-tab";
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
 *   `?resgatar=3`  três com prêmio esperando o toque (o cartão que pulsa)
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
    /* `?resgatar=3` deixa as três primeiras desbloqueadas SEM prêmio pago —
       o estado que pulsa e pede o toque. Ele só existe entre desbloquear e
       resgatar, então numa conta de verdade seria preciso conquistar algo e
       correr até a aba antes de tocar. */
    resgatar: q.resgatar == null ? 0 : Number(q.resgatar),
  }),
  head: () => ({
    meta: [{ title: "Bancada das conquistas" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewConquistas,
});

function PreviewConquistas() {
  const { quantas, tudo, luto, resgatar } = Route.useSearch();
  const n = tudo ? CONQUISTAS.length : Math.max(0, Math.min(CONQUISTAS.length, quantas));
  const pendentes = Math.max(0, Math.min(n, resgatar));
  return (
    <div className="fixed inset-0 z-[50] overflow-y-auto bg-background px-5 py-6">
      <ConquistasTab
        careMode={luto}
        bancada={{
          desbloqueadas: CONQUISTAS.slice(0, n).map((c) => c.key),
          /* As `pendentes` PRIMEIRAS ficam de fora das resgatadas. */
          resgatadas: CONQUISTAS.slice(pendentes, n).map((c) => c.key),
        }}
      />
    </div>
  );
}
