/**
 * BANCADA DA PESQUISA.
 *
 * ⚠️ Ela só aparece para quem tem 14+ dias de conta, não respondeu nos últimos
 * 90 dias e não está em Modo Cuidado — três condições que, juntas, tornam a
 * tela impossível de olhar sem esperar duas semanas por uma conta de teste.
 */
import { createFileRoute } from "@tanstack/react-router";

import { PesquisaNps } from "@/components/pesquisa-nps";

export const Route = createFileRoute("/preview-nps")({
  validateSearch: (q: Record<string, unknown>) => ({
    fase: typeof q.fase === "string" ? q.fase : "perguntando",
    nota: q.nota == null ? null : Number(q.nota),
  }),
  component: Bancada,
});

function Bancada() {
  const { fase, nota } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        /preview-nps?fase=perguntando · enviando · obrigada · quieto — e &nota=9 para ver o
        comentário e o botão de enviar
      </p>
      <div className="mx-auto max-w-md">
        <PesquisaNps
          tokenFn={async () => "bancada"}
          careMode={false}
          bancada={{
            fase: fase as "quieto" | "perguntando" | "enviando" | "obrigada",
            nota: nota == null || Number.isNaN(nota) ? undefined : nota,
          }}
        />
        {fase === "quieto" && (
          <p className="text-sm text-muted-foreground">
            (nada — é o estado normal de quem já respondeu, adiou, ou está em Modo Cuidado)
          </p>
        )}
      </div>
    </div>
  );
}
