import { createFileRoute } from "@tanstack/react-router";
import { MenuDaConta } from "@/components/menu-conta";

/**
 * Bancada de design do MENU DA CONTA — a folha que abre na silhueta do topo.
 *
 * Ela vive atrás do login e só aparece depois de um toque, o que a tornava
 * impossível de fotografar. O que importa medir aqui é altura: com oito linhas
 * a folha passa da tela num aparelho curto, e o item que some é o último —
 * "Sair". `?painel=1` inclui a linha de admin (a mais alta das configurações),
 * `?lidas=0` esconde o contador. Nenhum dado real: tudo constante.
 */
export const Route = createFileRoute("/preview-conta")({
  validateSearch: (q: Record<string, unknown>) => ({
    painel: q.painel === true || String(q.painel ?? "") === "1",
    lidas: Number(q.lidas ?? 3),
  }),
  head: () => ({
    meta: [{ title: "Bancada do menu da conta" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewConta,
});

function PreviewConta() {
  const { painel, lidas } = Route.useSearch();
  return (
    <div className="fixed inset-0 z-[50] bg-gradient-to-b from-sky-200 to-rose-100">
      <MenuDaConta
        nome="Clovis"
        saudacao="Boa noite"
        gest={{ weeks: 20, days: 6 }}
        naoLidas={lidas}
        mostrarPainel={painel}
        onNotificacoes={() => {}}
        onNavegar={() => {}}
        onSair={() => {}}
        onFechar={() => {}}
      />
    </div>
  );
}
