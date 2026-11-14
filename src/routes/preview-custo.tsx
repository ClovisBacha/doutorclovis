/**
 * BANCADA DA ABA DE CUSTO — os quatro estados que o banco não fabrica.
 *
 * `?estado=normal` (padrão) · `?estado=semprecos` (modelo não cadastrado) ·
 * `?estado=truncado` · `?estado=degradado` · `?estado=vazio` · `?estado=falhou`
 */
import { createFileRoute } from "@tanstack/react-router";

import { CustoTab } from "@/components/custo-da-plataforma-tab";
import { resumirCusto } from "@/lib/custo-da-plataforma";
import type { CustoDaPlataforma } from "@/lib/custo.functions";

export const Route = createFileRoute("/preview-custo")({
  /* ⚠️ `q.estado == null` e não `=== undefined`: o router serializa e revalida,
     e na segunda passada chega `null` — a armadilha que `preview-saude` e
     `preview-jogo` já documentam. */
  validateSearch: (q: Record<string, unknown>) => ({
    estado: q.estado == null ? "normal" : String(q.estado),
  }),
  component: Pagina,
});

const LINHAS = [
  {
    modelo: "gemini-2.5-flash",
    input_tokens: 412_000,
    output_tokens: 38_000,
    canal: "app",
    especie: "chat",
  },
  {
    modelo: "gemini-2.5-flash",
    input_tokens: 88_000,
    output_tokens: 6_100,
    canal: "suporte",
    especie: "chat",
  },
  {
    modelo: "gemini-2.5-pro",
    input_tokens: 51_000,
    output_tokens: 9_400,
    canal: "app",
    especie: "memoria",
  },
  {
    modelo: "text-embedding-004",
    input_tokens: 220_000,
    output_tokens: 0,
    canal: "app",
    especie: "embedding",
  },
  {
    modelo: "gemini-2.5-flash",
    input_tokens: 12_000,
    output_tokens: 900,
    canal: "diario",
    especie: "chat",
  },
];

function montar(estado: string): CustoDaPlataforma | "falhou" {
  if (estado === "falhou") return "falhou";
  const linhas =
    estado === "vazio"
      ? []
      : estado === "semprecos"
        ? [
            ...LINHAS,
            {
              modelo: "modelo-novo-sem-preco",
              input_tokens: 90_000,
              output_tokens: 40_000,
              canal: "app",
              especie: "chat",
            },
          ]
        : LINHAS;
  const resumo = resumirCusto(linhas);
  return {
    ok: true,
    dias: 30,
    desde: "2026-07-29T00:00:00.000Z",
    resumo,
    custoDoMesAteAgoraCentavos: resumo.centavos * 0.7,
    projecaoDoMesCentavos: resumo.centavos * 1.4,
    porMedico:
      estado === "vazio"
        ? []
        : [
            { nome: "Dr. Clóvis Bacha", centavos: resumo.centavos * 0.62, chamadas: 3 },
            { nome: "Dra. Marina Costa", centavos: resumo.centavos * 0.24, chamadas: 1 },
          ],
    truncado: estado === "truncado",
    precoConferidoEm: "2026-08",
    dolar: 5.5,
    degradado: estado === "degradado",
  };
}

function Pagina() {
  const { estado } = Route.useSearch();
  return (
    <div className="mx-auto max-w-3xl p-4">
      <CustoTab bancada={montar(estado)} />
    </div>
  );
}
