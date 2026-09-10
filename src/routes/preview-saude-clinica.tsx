/**
 * BANCADA DA SAÚDE DA FILA CLÍNICA.
 *
 * ⚠️ Os dois estados que importam só nascem de um banco em que o SQL foi rodado
 * fora de ordem — e o segundo é o CASO REAL de hoje: a view existe, as doze
 * fontes respondem verde, e ela é anterior aos campos `forca`/`duracao_min`.
 * Sem bancada, o alarme mais importante do admin ficaria sem ninguém nunca ter
 * olhado.
 *
 * `?estado=ok` (padrão) · `?estado=fora` (a EPDS fora da view) ·
 * `?estado=campovelho` (**as doze fontes verdes e a view velha**) ·
 * `?estado=semcoluna` (falta o APLICAR_ da coluna de origem) ·
 * `?estado=semview` · `?estado=vazio` (tudo indeterminado) · `?estado=falhou`
 */
import { createFileRoute } from "@tanstack/react-router";

import { SaudeClinicaTab } from "@/components/saude-clinica-tab";
import {
  CAMPOS_CLINICOS,
  FONTES_CLINICAS,
  type EstadoDoCampo,
  type SaudeClinica,
} from "@/lib/saude-clinica.functions";

export const Route = createFileRoute("/preview-saude-clinica")({
  validateSearch: (q: Record<string, unknown>) => ({
    estado: q.estado == null ? "ok" : String(q.estado),
  }),
  component: Pagina,
});

function montarCampos(estado: string, viewExiste: boolean): EstadoDoCampo[] {
  return CAMPOS_CLINICOS.map((c): EstadoDoCampo => {
    const base = { ...c, sqlDaColuna: c.sqlDaColuna as string | null };
    if (estado === "vazio")
      return { ...base, estado: "indeterminado", linhasQuePodem: 0, linhasComOCampo: 0 };
    if (!viewExiste)
      return { ...base, estado: "ilegivel", linhasQuePodem: 92, linhasComOCampo: null };
    /* ⚠️ Só a `forca` fica sem coluna: ela é a única que nasce num `APLICAR_`
       PRÓPRIO, e é justamente essa distinção que a tela existe para mostrar. */
    if (estado === "semcoluna" && c.campo === "forca")
      return { ...base, estado: "coluna_ausente", linhasQuePodem: null, linhasComOCampo: null };
    if (estado === "campovelho")
      return { ...base, estado: "fora_da_view", linhasQuePodem: 92, linhasComOCampo: 0 };
    return { ...base, estado: "ok", linhasQuePodem: 92, linhasComOCampo: 88 };
  });
}

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
  const campos = montarCampos(estado, viewExiste);
  return {
    ok: true,
    viewExiste,
    fontes,
    foraDaView: fontes.filter((f) => f.estado === "fora_da_view").length,
    ausentes: 0,
    campos,
    camposForaDaView: campos.filter((c) => c.estado === "fora_da_view").length,
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
