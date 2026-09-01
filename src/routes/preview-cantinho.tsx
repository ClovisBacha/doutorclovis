import { createFileRoute } from "@tanstack/react-router";
import { CantinhoTab } from "@/components/cantinho-tab";
import { CANTINHO_ITEMS } from "@/lib/cantinho";

/**
 * ⚠️ A BANCADA DA ABA DOS ITENS DO JOGO — e ela não existia.
 *
 * O Cantinho é a vitrine dos 111 enfeites, e desenhar a grade exige uma sessão
 * com saldo e itens comprados. Resultado: **a aba que o dono aponta como a mais
 * feia do app nunca tinha sido fotografada por ninguém.**
 *
 * Sem ela, redesenhar esta tela seria trabalhar às cegas — exatamente o defeito
 * que a skill `/tela` existe para impedir ("se você não consegue verificar, não
 * entregue"). Ela vem ANTES de qualquer arte nova.
 *
 * `?luto=1` mostra o Modo Cuidado · `?saldo=` muda a carteira ·
 * `?vazio=1` a paciente que ainda não comprou nada.
 */
export const Route = createFileRoute("/preview-cantinho")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null`, e nunca `=== undefined`: o router serializa e revalida, e
       na segunda passada chega `null` — `Number(null)` é 0. Armadilha que o
       CLAUDE.md documenta em `preview-saude` e `preview-jogo`. */
    saldo: q.saldo == null ? 420 : Number(q.saldo),
    luto: q.luto === "1" || q.luto === true,
    vazio: q.vazio === "1" || q.vazio === true,
    trofeus: q.trofeus == null ? 12 : Number(q.trofeus),
  }),
});

function Bancada() {
  const { saldo, luto, vazio, trofeus } = Route.useSearch();
  /* Alguns comprados de categorias diferentes, para a grade mostrar os DOIS
     estados que ela tem — "Meus itens" e a vitrine com preço. */
  const comprados = vazio
    ? []
    : CANTINHO_ITEMS.filter((i) => !i.premium)
        .slice(0, 6)
        .map((i) => i.id);
  return (
    <div className="mx-auto max-w-md p-4">
      <CantinhoTab careMode={luto} bancada={{ saldo, owned: comprados, premium: true, trofeus }} />
    </div>
  );
}
