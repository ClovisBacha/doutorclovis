import { createFileRoute } from "@tanstack/react-router";
import { SonsParaDormir } from "@/components/sons-para-dormir";

/**
 * Bancada dos SONS PARA DORMIR.
 *
 * A tela vive atrás do login, dentro da meditação, e o som dela é RENDERIZADO
 * na hora — nada disso dá para conferir sem entrar numa conta e tocar num
 * botão às três da manhã. É a mesma razão de existirem as bancadas da chama e
 * do troféu: sem elas, uma animação (ou, aqui, um áudio de trinta segundos que
 * vai tocar a noite inteira) entra no app sem ninguém nunca ter olhado.
 *
 * Sem dado nenhum: a tela não lê conta, perfil, nem banco.
 */
export const Route = createFileRoute("/preview-sons")({
  head: () => ({
    meta: [{ title: "Bancada dos sons" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewSons,
});

function PreviewSons() {
  return <SonsParaDormir aoFechar={() => history.back()} />;
}
