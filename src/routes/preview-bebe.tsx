import { createFileRoute } from "@tanstack/react-router";
import { BondingBlock } from "@/components/gestacao-path";
import type { Periodo } from "@/lib/frases-do-mascote";

/**
 * Bancada do BEBÊ (a carta de 1 minuto).
 *
 * A tela vive atrás do login, e duas coisas que mudaram nela são impossíveis
 * de fotografar sem forçar: o rastro de leitura (`localStorage`) e a faixa do
 * dia (o relógio). Com a bancada, dá pra olhar as 30 cartas por fase — inclusive
 * a virada mais importante: gestação × pós-parto NUNCA compartilham cartas.
 *
 * Parâmetros:
 *   `?w=20`        semana gestacional — escolhe t1/t2/t3
 *   `?pos=1`       pós-parto (ignora `w`)
 *   `?dia=3`       gira a carta dentro do poço da fase (`dia % n`)
 *   `?nome=Helena` nome do bebê — some o `{bebe}` das cartas. Sem parâmetro,
 *                  cai no padrão "meu amor".
 *   `?luto=1`      Modo Cuidado
 *   `?fase=done`   abre já no final (senão começa em `intro`)
 *   `?periodo=noite` força a faixa do dia na fala da bolha
 *   `?leitura=1`   força "Você leu esta carta há 2 semanas." na tela de abertura
 */
export const Route = createFileRoute("/preview-bebe")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e não `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0. Mesma armadilha de
       `preview-gratidao`, `preview-saude` e `preview-jogo`. */
    w: q.w == null ? 20 : Number(q.w),
    dia: q.dia == null ? 3 : Number(q.dia),
    pos: q.pos === true || String(q.pos ?? "") === "1",
    nome: q.nome == null ? "" : String(q.nome),
    luto: q.luto === true || String(q.luto ?? "") === "1",
    fase: (["intro", "active", "done"] as const).includes(String(q.fase ?? "") as never)
      ? (String(q.fase) as "intro" | "active" | "done")
      : ("intro" as const),
    periodo: (["madrugada", "manha", "tarde", "noite"] as const).includes(
      String(q.periodo ?? "") as never,
    )
      ? (String(q.periodo) as Periodo)
      : undefined,
    leitura: q.leitura === true || String(q.leitura ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada do bebê" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewBebe,
});

function PreviewBebe() {
  const { w, dia, pos, nome, luto, fase, periodo, leitura } = Route.useSearch();

  return (
    <div className="fixed inset-0 z-[50] bg-background">
      <BondingBlock
        day={dia}
        semana={w}
        posParto={pos}
        babyName={nome || null}
        careMode={luto}
        canEarn={false}
        alreadyDone={false}
        onEarn={() => {}}
        aoSair={() => history.back()}
        bancada={{
          fase,
          periodo,
          fraseDeLeitura: leitura ? "Você leu esta carta há 2 semanas." : undefined,
        }}
      />
      <p className="pointer-events-none fixed bottom-2 left-0 right-0 z-[60] text-center text-[10px] text-foreground/30">
        bancada · {pos ? "pós-parto" : `semana ${w}`} · dia {dia}
      </p>
    </div>
  );
}
