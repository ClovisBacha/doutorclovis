import { createFileRoute } from "@tanstack/react-router";
import { MapaDoApp } from "@/components/mapa-do-app";

/**
 * Bancada de "Tudo o que o app faz" — a folha do ☰ que lista o mapa do app.
 *
 * `?luto=1` o Modo Cuidado (somem as funções da chegada do bebê) ·
 * `?w=38` a semana (abre o Pós-parto) · `?abertas=saude,chutes,diario` o que
 * ela já abriu (perde o selo "novo para você").
 */
export const Route = createFileRoute("/preview-mapa")({
  validateSearch: (s: Record<string, unknown>) => ({
    luto: s.luto === true || String(s.luto ?? "") === "1",
    w: s.w == null ? 20 : Number(s.w) || 20,
    abertas: String(s.abertas ?? ""),
  }),
  component: PreviewMapa,
});

function PreviewMapa() {
  const { luto, w, abertas } = Route.useSearch();
  const visitadas = new Set(abertas.split(",").filter(Boolean));
  return (
    <div className="min-h-screen bg-background">
      <MapaDoApp
        careMode={luto}
        weeks={w}
        visitadas={visitadas}
        onNavegar={(t, sub) => alert(`abriria: ${t}${sub ? " → " + sub : ""}`)}
        onFechar={() => {}}
      />
    </div>
  );
}
