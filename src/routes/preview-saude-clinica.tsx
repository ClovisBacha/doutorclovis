/**
 * BANCADA DA SAÚDE DA FILA CLÍNICA.
 *
 * ⚠️ O estado que importa — uma fonte com dado FORA da view — só nasce de um
 * banco em que o SQL foi rodado fora de ordem. Sem bancada, o alarme mais
 * importante do admin ficaria sem ninguém nunca ter olhado.
 *
 * `?estado=ok` (padrão) · `?estado=fora` (a EPDS fora da view) · `?estado=semview`
 * · `?estado=vazio` (tudo indeterminado) · `?estado=falhou`
 */
import { createFileRoute } from "@tanstack/react-router";

import { SaudeClinicaTab } from "@/components/saude-clinica-tab";
import { FONTES_CLINICAS, type SaudeClinica } from "@/lib/saude-clinica.functions";

export const Route = createFileRoute("/preview-saude-clinica")({
  validateSearch: (q: Record<string, unknown>) => ({
    estado: q.estado == null ? "ok" : String(q.estado),
  }),
  component: Pagina,
});

function montar(estado: string): SaudeClinica | "falhou" {
  if (estado === "falhou") return "falhou";
  const viewExiste = estado !== "semview";
  const fontes = FONTES_CLINICAS.map((f, i) => {
    if (estado === "vazio")
      return { ...f, estado: "indeterminado" as const, linhasNaTabela: 0, linhasNaView: 0 };
    if (!viewExiste)
      return { ...f, estado: "ilegivel" as const, linhasNaTabela: 40 + i, linhasNaView: null };
    /* A EPDS é a que fica de fora — é o caso real: `epds_logs` nasceu num
       APLICAR_ posterior ao da view. */
    if (estado === "fora" && f.tabela === "epds_logs")
      return { ...f, estado: "fora_da_view" as const, linhasNaTabela: 37, linhasNaView: 0 };
    if (i > 8)
      return { ...f, estado: "indeterminado" as const, linhasNaTabela: 0, linhasNaView: 0 };
    return { ...f, estado: "ok" as const, linhasNaTabela: 40 + i * 13, linhasNaView: 40 + i * 13 };
  });
  return {
    ok: true,
    viewExiste,
    fontes,
    foraDaView: fontes.filter((f) => f.estado === "fora_da_view").length,
    ausentes: 0,
  };
}

function Pagina() {
  const { estado } = Route.useSearch();
  return (
    <div className="mx-auto max-w-3xl p-4">
      <SaudeClinicaTab bancada={montar(estado)} />
    </div>
  );
}
