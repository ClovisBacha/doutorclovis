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
type Busca = { luto?: boolean };

export const Route = createFileRoute("/preview-sons")({
  validateSearch: (q: Record<string, unknown>): Busca => ({
    luto: q.luto === "1" || q.luto === true,
  }),
  head: () => ({
    meta: [{ title: "Bancada dos sons" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewSons,
});

function PreviewSons() {
  /* ⚠️ `?luto=1` é a única forma de fotografar a lista SEM "Coração do bebê" e
     "Ventre" — os dois únicos sons cujo nome afirma sobre uma gestação em
     curso. Sem a bancada, conferir isso exigiria ligar o Modo Cuidado numa
     conta real, que é o estado que ninguém quer ligar para testar. */
  const { luto } = Route.useSearch();
  return <SonsParaDormir aoFechar={() => history.back()} careMode={!!luto} />;
}
