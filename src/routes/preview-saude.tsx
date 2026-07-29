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
  head: () => ({
    meta: [{ title: "Bancada da Saúde" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewSaude,
});

function PreviewSaude() {
  return (
    <div className="fixed inset-0 z-[50] overflow-y-auto bg-background px-4 py-5">
      <p className="mb-4 font-serif text-xl">Sua saúde</p>
      <HubSaude onAbrir={() => {}} />
    </div>
  );
}
