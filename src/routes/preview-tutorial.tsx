import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppBottomNav, type BottomSection } from "@/components/app-mobile-shell";
import { TutorialDaBolha } from "@/components/tutorial-da-bolha";

/**
 * Bancada do TUTORIAL do bebê bolha.
 *
 * Ele só roda no PRIMEIRO acesso de uma conta de paciente — o que significa
 * que, sem esta rota, conferir os sete cartões exigiria criar uma conta nova a
 * cada ajuste de texto, ou limpar o `localStorage` na mão. Foi por telas assim
 * serem difíceis de olhar que animações entraram neste app sem ninguém nunca
 * as ter visto rodando.
 *
 * Renderiza o tutorial JUNTO com a barra de baixo de verdade: o que precisa ser
 * conferido não é o cartão sozinho, é o holofote — o véu apagando a tela
 * enquanto a barra segue acesa, e o anel pulsando no ícone certo a cada passo.
 *
 * `?nome=Ana` prova a abertura com nome; sem o parâmetro, prova que a vírgula
 * não fica órfã.
 */
export const Route = createFileRoute("/preview-tutorial")({
  validateSearch: (q: Record<string, unknown>) => ({
    nome: q.nome == null ? "" : String(q.nome),
    /* `?escura=1` põe a barra no vidro escuro, que é como ela aparece na home
       de noite — quando boa parte dos primeiros acessos acontece. */
    escura: q.escura === true || String(q.escura ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada do tutorial" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewTutorial,
});

function PreviewTutorial() {
  const { nome, escura } = Route.useSearch();
  const [destaque, setDestaque] = useState<BottomSection | "sos" | null>(null);
  const [aberto, setAberto] = useState(true);
  return (
    <div
      className="fixed inset-0 z-[30] overflow-hidden"
      style={{
        background: escura
          ? "linear-gradient(180deg,#0b1150,#3b2f7a)"
          : "linear-gradient(180deg,#0244e4,#7fd4ff)",
      }}
    >
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-white/90 px-5 py-2 text-sm font-semibold"
        >
          Rodar de novo
        </button>
      )}
      {aberto && (
        <TutorialDaBolha
          nome={nome || null}
          onPasso={(d) => setDestaque(d as BottomSection | "sos" | null)}
          onFechar={() => setAberto(false)}
        />
      )}
      <AppBottomNav
        activeSection="home"
        onSelect={() => {}}
        onEmergency={() => {}}
        escura={escura}
        destaque={destaque}
      />
    </div>
  );
}
