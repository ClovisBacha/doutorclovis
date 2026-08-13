import { createFileRoute } from "@tanstack/react-router";
import { MeditationBlock } from "@/components/gestacao-path";

/**
 * Bancada da MEDITAÇÃO.
 *
 * Nasceu de um defeito difícil de olhar: a paciente relatou uma frase do
 * fechamento ("Vamos voltar devagar...") que apareceu na tela e não foi
 * falada. `MeditationBlock` não busca nada do servidor para renderizar a
 * sessão em si — `log` vem do `localStorage` e o plano é montado no cliente
 * — então dá para abrir a sessão inteira, do relógio ao sheet de sons, sem
 * conta nenhuma. A recompensa (Sementinha) simplesmente não é concedida sem
 * sessão, que é degradação aceitável aqui.
 *
 * Sem parâmetro nenhum: abre no `day` 20, fora do Modo Cuidado. `?w=` muda o
 * dia gestacional (usado só para a fase do acolhimento); `?luto=1` liga o
 * Modo Cuidado, para conferir que a cara da bolha nunca comemora lá dentro.
 */
export const Route = createFileRoute("/preview-meditacao")({
  validateSearch: (q: Record<string, unknown>) => ({
    w: q.w == null ? 20 : Number(q.w),
    luto: q.luto === true || String(q.luto ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada da meditação" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewMeditacao,
});

function PreviewMeditacao() {
  const { w, luto } = Route.useSearch();
  return (
    <div className="fixed inset-0 z-[50] bg-background">
      <MeditationBlock
        day={w * 7}
        careMode={luto}
        canEarn={false}
        alreadyDone={false}
        onEarn={() => {}}
        aoSair={() => history.back()}
      />
    </div>
  );
}
