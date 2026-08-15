import { createFileRoute } from "@tanstack/react-router";
import { LojaSementinhas } from "@/components/loja-sementinhas";

/**
 * Bancada da LOJA DE SEMENTINHAS.
 *
 * A tela só abre para quem está logada, tocando no saldo dentro do Caminho — e
 * o layout inteiro foi reconstruído a partir de uma imagem do dono, que pediu
 * que ficasse "exatamente dessa forma". Conferir isso numa conta de verdade
 * exigiria entrar, ir ao jogo e tocar no número; e a comparação lado a lado
 * com a referência, que é o que decide se ficou igual, seria impossível.
 *
 * ⚠️ O `saldo` é o único número que vem do servidor nesta tela. Aqui ele é
 * cravado — o resto (pacotes, bônus, preço) sai de `pacotes-sementinhas.ts`,
 * que é a mesma fonte da produção. A bancada não fabrica preço.
 *
 * Parâmetros:
 *   `?saldo=118`  o número da pílula do topo (o da referência é 118)
 */
export const Route = createFileRoute("/preview-loja-sementinhas")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e não `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, e a pílula sumiria
       do topo. Quinta vez que esta armadilha aparece no repo. */
    saldo: q.saldo == null ? 118 : Number(q.saldo),
  }),
  head: () => ({
    meta: [{ title: "Bancada da loja de Sementinhas" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewLoja,
});

function PreviewLoja() {
  const { saldo } = Route.useSearch();
  return <LojaSementinhas aberto onFechar={() => {}} saldo={saldo} />;
}
