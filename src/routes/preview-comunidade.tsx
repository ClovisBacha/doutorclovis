/**
 * BANCADA DA COMUNIDADE — a aba sem conta e sem banco.
 *
 * Endereços:
 *   /preview-comunidade          → as portas
 *   /preview-comunidade?luto=1   → Modo Cuidado (sem "Nome do bebê")
 */
import { createFileRoute } from "@tanstack/react-router";
import { ComunidadeTab } from "@/components/comunidade";

export const Route = createFileRoute("/preview-comunidade")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `q.luto == null` e NÃO `=== undefined`: o router serializa e revalida,
       e na segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    luto: q.luto == null ? false : !!q.luto,
  }),
});

function Bancada() {
  const { luto } = Route.useSearch();
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <ComunidadeTab
        careMode={luto}
        onAbrir={(d, s) => alert(`abriria: ${d}${s ? ` → ${s}` : ""}`)}
      />
    </div>
  );
}
