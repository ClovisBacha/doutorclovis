import { createFileRoute } from "@tanstack/react-router";
import { MovementBlock } from "@/components/gestacao-path";

/**
 * Bancada do EXERCÍCIO.
 *
 * A tela vive atrás do login, dentro da folha do dia. `?w=` finge a semana
 * gestacional — e a semana muda a sessão inteira: com 38 os movimentos de chão
 * somem e entra a preparação de parto; com `?pos=1` entram o diafragma e o
 * transverso, e some tudo que é de gestante.
 *
 * Sem dado nenhum: a tela não lê conta, perfil, nem banco.
 */
export const Route = createFileRoute("/preview-exercicio")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e não `=== undefined`: o router revalida e na segunda
       passada chega `null` — `Number(null)` é 0, e a tela abriria como uma
       gestante de zero semanas. Mesma armadilha de `preview-saude`. */
    w: q.w == null ? 24 : Number(q.w),
    pos: q.pos === true || String(q.pos ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada do exercício" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewExercicio,
});

function PreviewExercicio() {
  const { w, pos } = Route.useSearch();
  return (
    <div className="fixed inset-0 z-[50] bg-background">
      <MovementBlock
        day={w * 7}
        semana={w}
        posParto={pos}
        canEarn={false}
        alreadyDone={false}
        onEarn={() => {}}
        aoSair={() => history.back()}
      />
    </div>
  );
}
