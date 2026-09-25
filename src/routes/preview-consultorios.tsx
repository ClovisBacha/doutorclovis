/**
 * BANCADA DOS CONSULTÓRIOS DO MÉDICO.
 *
 * ⚠️ Nenhum destes estados se fabrica numa conta de teste: exigem um médico com
 * dois consultórios cadastrados, uma paciente vinculada a ele, e — para o caso
 * que mais importa — uma leitura falhando no meio.
 */
import { createFileRoute } from "@tanstack/react-router";

import { ConsultoriosDoMedico } from "@/components/consultorios-do-medico";
import type { DoctorAddress } from "@/lib/doctor-addresses.functions";

const base = (o: Partial<DoctorAddress>): DoctorAddress => ({
  id: o.id ?? "1",
  label: o.label ?? "",
  street: o.street ?? "",
  city: o.city ?? "",
  state: o.state ?? "",
  zip: o.zip ?? "",
  phone: o.phone ?? "",
  notes: o.notes ?? "",
  is_primary: o.is_primary ?? false,
  position: o.position ?? 0,
});

const DOIS: DoctorAddress[] = [
  base({
    id: "b",
    label: "Clínica Sul",
    street: "Av. Nossa Senhora de Copacabana, 1200 — sala 402",
    city: "Rio de Janeiro",
    state: "rj",
    zip: "22070-011",
    phone: "(21) 3222-1188",
    notes: "Quintas, 14h às 19h",
    position: 2,
  }),
  base({
    id: "a",
    label: "Consultório Centro",
    street: "Rua da Assembleia, 10 — 18º andar",
    city: "Rio de Janeiro",
    state: "rj",
    zip: "20011-901",
    phone: "(21) 3030-4040",
    notes: "Segundas e quartas, 8h às 12h",
    is_primary: true,
    position: 1,
  }),
];

export const Route = createFileRoute("/preview-consultorios")({
  validateSearch: (q: Record<string, unknown>) => ({
    estado: typeof q.estado === "string" ? q.estado : "dois",
  }),
  component: Bancada,
});

function Bancada() {
  const { estado } = Route.useSearch();
  const enderecos =
    estado === "um"
      ? [DOIS[1]]
      : estado === "vazio"
        ? []
        : estado === "magro"
          ? [base({ id: "c", label: "Consultório", city: "Niterói", state: "rj" })]
          : DOIS;
  return (
    <div className="min-h-screen bg-background p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        /preview-consultorios?estado=dois · um · magro · vazio · falhou · carregando
      </p>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Meu obstetra
        </p>
        <h2 className="mt-1 font-serif text-2xl text-foreground">Dr. Clóvis Bacha</h2>
        <ConsultoriosDoMedico
          doctorId="00000000-0000-0000-0000-000000000000"
          bancada={{
            enderecos,
            estado:
              estado === "falhou" ? "falhou" : estado === "carregando" ? "carregando" : "pronto",
          }}
        />
      </div>
    </div>
  );
}
