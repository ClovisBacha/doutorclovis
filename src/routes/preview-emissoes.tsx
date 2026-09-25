/**
 * BANCADA DO "JÁ ENVIADO PARA ELA".
 *
 * ⚠️ Nenhum destes estados se fabrica olhando o painel: exigem um médico com
 * paciente vinculada e emissões de meses diferentes — e, no caso que mais
 * importa, uma leitura falhando no meio.
 */
import { createFileRoute } from "@tanstack/react-router";

import { EmissoesDaPaciente } from "@/components/emissoes-da-paciente";
import type { Emissao } from "@/lib/clinical.functions";

const e = (o: Partial<Emissao> & { id: string }): Emissao => ({
  user_id: "p1",
  paciente: "Marina Costa",
  kind: "exame",
  titulo: "",
  conteudo: "",
  nota: null,
  cumprido_em: null,
  created_at: "2026-08-01T10:00:00Z",
  ...o,
});

const ALGUMAS: Emissao[] = [
  e({
    id: "1",
    kind: "prescricao",
    titulo: "Hipertensão gestacional",
    conteudo: "Metildopa 250 mg — 1 comprimido de 8/8h\nRetorno em 7 dias",
    created_at: "2026-08-20T14:00:00Z",
  }),
  e({
    id: "2",
    kind: "exame",
    titulo: "Terceiro trimestre",
    conteudo: "Hemograma\nGlicemia de jejum\nUrina tipo 1\nCultura de urina",
    nota: "Trazer na próxima consulta.",
    cumprido_em: "2026-08-24T09:00:00Z",
    created_at: "2026-08-12T09:30:00Z",
  }),
  e({
    id: "3",
    kind: "exame",
    titulo: "Rastreio de diabetes gestacional",
    conteudo: "TOTG 75 g (0, 60 e 120 min)",
    created_at: "2026-07-05T08:00:00Z",
  }),
];

export const Route = createFileRoute("/preview-emissoes")({
  validateSearch: (q: Record<string, unknown>) => ({
    estado: typeof q.estado === "string" ? q.estado : "algumas",
  }),
  component: Bancada,
});

function Bancada() {
  const { estado } = Route.useSearch();
  const muitas = Array.from({ length: 12 }, (_, i) =>
    e({ id: `m${i}`, titulo: `Pedido ${i + 1}`, conteudo: "Hemograma" }),
  );
  return (
    <div className="min-h-screen bg-background p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        /preview-emissoes?estado=algumas · muitas · vazio · degradado · falhou · carregando
      </p>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">Marina Costa · 32 semanas</p>
        <EmissoesDaPaciente
          pacienteId="p1"
          tokenFn={async () => "bancada"}
          bancada={{
            emissoes: estado === "vazio" ? [] : estado === "muitas" ? muitas : ALGUMAS,
            estado:
              estado === "falhou" ? "falhou" : estado === "carregando" ? "carregando" : "pronto",
            degradado: estado === "degradado",
          }}
        />
      </div>
    </div>
  );
}
