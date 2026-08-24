/**
 * /presente/<token> — a lista de presentes vista pela AMIGA.
 *
 * Sem conta, sem login. O token prova o vínculo, e ele é PRÓPRIO desta lista —
 * nunca o de `companion_invites`, que abre também o painel de SOS da paciente.
 *
 * ⚠️ Quando a lista não está disponível — token errado, lista fechada, ou a
 * dona em Modo Cuidado — a tela diz UMA frase e nada mais. Não conta o motivo,
 * não põe emoji de luto, não sugere nada. Contar a perda dela para o grupo de
 * WhatsApp da família inteira é o app tomando a decisão mais íntima que existe
 * no lugar dela.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListaDePresentesPublica } from "@/components/lista-de-presentes-publica";
import { ConviteDoApp } from "@/components/convite-do-app";
import type { ListaPublica } from "@/lib/presentes.functions";

export const Route = createFileRoute("/presente/$token")({
  component: Pagina,
});

function Pagina() {
  const { token } = Route.useParams();
  const [lista, setLista] = useState<ListaPublica | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { listaPorToken } = await import("@/lib/presentes.functions");
        const r = await listaPorToken({ data: { token } });
        if (!vivo) return;
        setLista(r.ok ? r.lista : null);
      } catch {
        if (vivo) setLista(null);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token]);

  if (carregando) {
    return (
      <div className="mx-auto max-w-md space-y-3 px-4 py-10">
        <div className="skeleton mx-auto h-8 w-48 rounded-xl" />
        <div className="skeleton h-40 rounded-3xl" />
        <div className="skeleton h-24 rounded-2xl" />
      </div>
    );
  }

  if (!lista) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="text-base text-muted-foreground">
          Esta lista não está disponível no momento.
        </p>
      </div>
    );
  }

  return (
    <>
      <ListaDePresentesPublica token={token} lista={lista} />
      {/* ⚠️ DEPOIS da lista inteira, e nunca no meio — ver `convite-do-app.ts`.
          A página é a festa dela; o convite é uma linha no pé. */}
      <div className="mx-auto max-w-md px-4 pb-10">
        <ConviteDoApp onde="presentes" codigo={lista.codigoDeConvite ?? null} />
      </div>
    </>
  );
}
