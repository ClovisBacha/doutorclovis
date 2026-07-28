import { createFileRoute } from "@tanstack/react-router";
import { GestacaoPath } from "@/components/gestacao-path";

/**
 * Bancada de design do JOGO (Caminho) — irmã da /preview-home.
 *
 * O jogo vive atrás do Supabase Auth, então conferir cor de semana, forma dos
 * nós e sobreposição exigia login. Aqui ele renderiza com dados fixos e o
 * Playwright mede a trilha inteira: distância entre bolinhas, arredondamento,
 * e quantas cores distintas aparecem.
 *
 * Não expõe nada: `profile` e `gest` são constantes de exemplo.
 */
export const Route = createFileRoute("/preview-jogo")({
  // `?tela=jogos` abre direto a tela das atividades do dia (o "game"), que na
  // conta real só se alcança tocando num nó da trilha — impossível de
  // fotografar sem isso. Aceita 1 e true: o router revalida depois de
  // serializar, e só entender "jogos" apagaria o parâmetro no segundo passe.
  validateSearch: (q: Record<string, unknown>) => ({ tela: String(q.tela ?? "") }),
  head: () => ({
    meta: [{ title: "Bancada do jogo" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewJogo,
});

function PreviewJogo() {
  const { tela } = Route.useSearch();
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-background">
      <GestacaoPath
        profile={{ baby_name: "Clovis" }}
        gest={{ weeks: 19, days: 6, totalDays: 139 }}
        quizPremium
        careMode={false}
        onOpenShop={() => {}}
        bancada={tela === "jogos" ? { jogos: true, saldo: 125, halves: 1 } : undefined}
      />
    </div>
  );
}
