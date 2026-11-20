import { createFileRoute } from "@tanstack/react-router";

import { AvisosDoApp } from "@/components/avisos-do-app";

/**
 * Bancada dos AVISOS DO APP — os quatro estados do consentimento de push.
 *
 * ⚠️ **O estado que mais importa aqui nunca tinha existido**: até set/2026 não
 * havia como desligar os avisos, e `unsubscribeFromPush` estava escrita com
 * zero chamadores. Parar de receber só era possível pelas Configurações do
 * sistema — que silenciam o app INTEIRO, levando junto a confirmação da
 * consulta e o lembrete de 24h.
 *
 * ⚠️ **E nenhum dos quatro era fotografável.** O bloco vivia dentro de
 * `minha-conta.tsx`, atrás do login, e o estado depende de uma permissão que
 * só o SISTEMA concede: para ver o cartão verde era preciso uma conta real com
 * push autorizado; para ver o desligado, tocar num botão que não existia.
 *
 * `?estado=ativo` · `desligado` · `bloqueado` · `nunca`.
 */
export const Route = createFileRoute("/preview-avisos")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ Uma STRING com valor padrão, e não booleanos soltos: o router
       serializa e revalida, e `Number(true)` já custou três voltas neste
       repositório. */
    estado: String(q.estado ?? "ativo"),
  }),
  head: () => ({
    meta: [{ title: "Bancada dos avisos" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewAvisos,
});

const ESTADOS: Record<string, { permissao: string; desligados: boolean }> = {
  ativo: { permissao: "granted", desligados: false },
  desligado: { permissao: "granted", desligados: true },
  bloqueado: { permissao: "denied", desligados: false },
  nunca: { permissao: "default", desligados: false },
};

function PreviewAvisos() {
  const { estado } = Route.useSearch();
  const b = ESTADOS[estado] ?? ESTADOS.ativo;
  return (
    <div className="mx-auto max-w-lg space-y-4 p-5">
      <p className="text-xs text-muted-foreground">
        Bancada · estado <span className="font-semibold">{estado}</span> · os controles falam com o
        servidor, então aqui eles só desenham.
      </p>
      <AvisosDoApp bancada={b} />
    </div>
  );
}
