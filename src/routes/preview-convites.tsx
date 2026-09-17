/**
 * BANCADA DOS CONVITES PREMIUM DO MÉDICO.
 *
 * ⚠️ Esta tela nunca existiu, e os estados que mais importam não se fabricam
 * numa conta de teste: a cota ESGOTADA exige gastar vinte e cinco convites de
 * um ano de Premium cada, e a contagem ILEGÍVEL exige derrubar uma consulta do
 * banco no meio da leitura.
 *
 * ⚠️ E ela injeta o DADO nos mesmos estados da produção, nunca o desenho — é a
 * lição do `?streak=41`, que cravava o número e deixava o saldo vir de uma
 * jornada vazia.
 */
import { createFileRoute } from "@tanstack/react-router";

import { ConvitesDoMedico } from "@/components/convites-do-medico";
import type { InviteInfo } from "@/lib/invites.functions";

type Estado = "normal" | "esgotada" | "ilegivel" | "semplano" | "falhou" | "carregando";

const FABRICADAS: Record<string, InviteInfo> = {
  normal: { eligible: true, limit: 25, used: 3, remaining: 22 },
  esgotada: { eligible: true, limit: 25, used: 25, remaining: 0 },
  ilegivel: { eligible: true, limit: 25, used: 0, remaining: 0, usedIlegivel: true },
  semplano: { eligible: false, limit: 0, used: 0, remaining: 0 },
};

export const Route = createFileRoute("/preview-convites")({
  validateSearch: (q: Record<string, unknown>) => ({
    estado: (typeof q.estado === "string" ? q.estado : "normal") as Estado,
  }),
  component: Bancada,
});

function Bancada() {
  const { estado } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        /preview-convites?estado=normal · esgotada · ilegivel · semplano · falhou · carregando
      </p>
      <div className="mx-auto max-w-md">
        <ConvitesDoMedico
          tokenFn={async () => "bancada"}
          bancada={{
            info: FABRICADAS[estado] ?? null,
            estado:
              estado === "falhou" ? "falhou" : estado === "carregando" ? "carregando" : "pronto",
          }}
        />
      </div>
    </div>
  );
}
