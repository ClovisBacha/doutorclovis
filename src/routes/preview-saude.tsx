import { createFileRoute } from "@tanstack/react-router";
import { HubSaude } from "@/routes/_authenticated/minha-conta";

/**
 * Bancada de design do HUB DA SAÚDE — irmã da /preview-jogo.
 *
 * A grade só existe atrás do login, e o que importa nela é medida: se os
 * quadrados são mesmo quadrados em telas estreitas, se os seis cabem sem
 * rolagem infinita e se os rótulos não quebram feio. Aqui o Playwright mede
 * isso sem conta nenhuma. Não expõe dado algum: a grade é estática.
 */
export const Route = createFileRoute("/preview-saude")({
  /* `?w=20` é a semana gestacional, e ela MUDA a grade: "Saúde da mulher" sai
     de cena durante a gestação e volta a partir da 36ª (ver
     `mostrarSaudeDaMulher`). Sem este parâmetro a bancada só saberia
     fotografar um dos dois estados — e o que ela existe para pegar é
     justamente a grade mudando de tamanho. `?w=` vazio = sem gestação. */
  /* ⚠️ `q.w == null` (dois iguais) e não `=== undefined`: o router SERIALIZA o
     valor e revalida o resultado, então na segunda passada o que chega aqui é
     `null`, não `undefined` — e `Number(null)` é **0**. Com o `===`, abrir a
     bancada sem parâmetro nenhum acabava em `?w=0`, e a grade escondia "Saúde
     da mulher" como se fosse uma gestante de zero semanas. É a mesma armadilha
     que `preview-jogo` documenta para `?tela=`. */
  validateSearch: (q: Record<string, unknown>) => ({
    w: q.w == null || q.w === "" ? null : Number(q.w),
    dados: q.dados == null ? 0 : Number(q.dados),
    /* `?cabecalhos=1`: os cinco cabeçalhos de sub-tela no lugar da grade. */
    cabecalhos: q.cabecalhos === "1" || q.cabecalhos === 1 || q.cabecalhos === true,
  }),
  head: () => ({
    meta: [{ title: "Bancada da Saúde" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewSaude,
});

function PreviewSaude() {
  const { w, dados, cabecalhos } = Route.useSearch();
  return (
    <div className="fixed inset-0 z-[50] overflow-y-auto bg-background px-4 py-5">
      <p className="mb-4 font-serif text-xl">Sua saúde</p>
      <HubSaude
        onAbrir={() => {}}
        cabecalhos={cabecalhos}
        weeks={Number.isFinite(w) ? (w as number) : null}
        bancada={
          dados === 2
            ? /* ⚠️ O caso do dado VELHO: passado o prazo o número SOME e o bloco
                 volta ao rótulo — o dono não quer "quando" escrito, e um número
                 de cinco meses atrás não pode se passar por atual. */
              { Saúde: null, chutes: null, contracoes: null }
            : dados
              ? {
                  Saúde: { valor: "68,4 kg", legenda: "pressão 118/76" },
                  chutes: { valor: "12", legenda: "chutes" },
                  contracoes: { valor: "2", legenda: "contrações" },
                }
              : undefined
        }
      />
    </div>
  );
}
