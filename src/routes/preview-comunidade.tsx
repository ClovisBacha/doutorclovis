/**
 * BANCADA DA COMUNIDADE — a aba sem conta e sem banco.
 *
 * Endereços:
 *   /preview-comunidade           → as portas SEM novidade (o estado de quem
 *                                   acabou de chegar)
 *   /preview-comunidade?vivo=1    → com o estado real de cada porta — é o que
 *                                   diferencia esta aba de um menu
 *   /preview-comunidade?ilegivel=1 → ⚠️ o caso que mais importa: uma porta que
 *                                   NÃO PÔDE ser lida. Ela não pode mostrar
 *                                   "0" — zero afirmaria que não há nada, e a
 *                                   paciente deixaria de abrir onde havia.
 *   /preview-comunidade?luto=1    → Modo Cuidado (sem "Nome do bebê")
 */
import { createFileRoute } from "@tanstack/react-router";
import { ComunidadeTab } from "@/components/comunidade";

export const Route = createFileRoute("/preview-comunidade")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `q.luto == null` e NÃO `=== undefined`: o router serializa e revalida,
       e na segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    luto: q.luto == null ? false : !!q.luto,
    vivo: q.vivo == null ? false : !!q.vivo,
    ilegivel: q.ilegivel == null ? false : !!q.ilegivel,
  }),
});

function Bancada() {
  const { luto, vivo, ilegivel } = Route.useSearch();

  /* ⚠️ A bancada injeta o DADO nas mesmas props da produção, nunca o desenho —
     é a régua da casa. E o `?ilegivel=1` fabrica o estado que nenhuma conta de
     teste produz: uma leitura que falhou. */
  const estado = ilegivel
    ? {
        cha: { quantas: null },
        amigas: { quantas: 4, frase: "4 amigas com você" },
        album: { quantas: null },
      }
    : vivo
      ? {
          cha: { quantas: 3, frase: "3 presentes reservados" },
          amigas: { quantas: 4, frase: "4 amigas com você" },
          album: { quantas: 12, frase: "12 fotos no álbum" },
          nome: { quantas: 7, frase: "7 sugestões de nome" },
          acompanhante: { quantas: 1, frase: "1 convite ativo" },
        }
      : {};

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <ComunidadeTab
        careMode={luto}
        bancada={estado}
        onAbrir={(d, s) => alert(`abriria: ${d}${s ? ` → ${s}` : ""}`)}
      />
    </div>
  );
}
