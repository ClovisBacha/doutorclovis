import { createFileRoute } from "@tanstack/react-router";
import { SessaoDoCasal } from "@/components/sessao-do-casal";

/**
 * Bancada da SESSÃO PARA DOIS.
 *
 * A tela vive atrás do login, dentro da meditação, e leva dez minutos para
 * mostrar os quatro desenhos — os dois últimos só aparecem depois do sétimo
 * bloco. Sem bancada, conferir a figura da mão no sacro exigia sentar e ouvir
 * a sessão inteira.
 *
 * Sem dado nenhum: a tela não lê conta, perfil, nem banco.
 */
export const Route = createFileRoute("/preview-casal")({
  head: () => ({
    meta: [{ title: "Bancada do casal" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewCasal,
});

function PreviewCasal() {
  return <SessaoDoCasal aoSair={() => history.back()} />;
}
