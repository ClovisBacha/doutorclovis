/**
 * BANCADA DA FAIXA DE CONVITE.
 *
 * A faixa só aparece quando há um código de indicação REAL na visita, e o
 * código só existe numa conta de verdade — então, sem esta bancada, conferir
 * o desenho exigiria criar duas contas e mandar um convite. É exatamente como
 * uma tela passa meses sem ninguém nunca ter olhado para ela.
 *
 *   /preview-convite                → amiga com foto (o caso comum)
 *   /preview-convite?foto=0         → amiga sem foto (a inicial no círculo)
 *   /preview-convite?tipo=criadora  → a frase que não finge intimidade
 *   /preview-convite?nome=Ana       → outro nome
 */
import { createFileRoute } from "@tanstack/react-router";
import { FaixaDeConvite } from "@/components/faixa-de-convite";

export const Route = createFileRoute("/preview-convite")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    tipo: q.tipo == null ? "amiga" : String(q.tipo),
    nome: q.nome == null ? "Marina" : String(q.nome),
    foto: q.foto == null ? 1 : Number(q.foto),
  }),
});

/** Uma foto de mentira, sem arquivo: 1px de cor esticado. */
const FOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#e9b8c4"/><circle cx="48" cy="38" r="16" fill="#fff" opacity=".85"/><ellipse cx="48" cy="78" rx="26" ry="20" fill="#fff" opacity=".85"/></svg>`,
  );

function Bancada() {
  const { tipo, nome, foto } = Route.useSearch();
  const quem = {
    nome,
    avatarUrl: foto === 0 ? null : FOTO,
    tipo: tipo === "criadora" ? ("criadora" as const) : ("amiga" as const),
  };

  return (
    <div className="mx-auto max-w-md space-y-6 px-5 py-10">
      <h1 className="font-serif text-2xl">Faixa de convite</h1>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sobre fundo claro (a tela do /auth)
        </p>
        <FaixaDeConvite bancada={quem} />
      </section>

      <section className="space-y-2 rounded-3xl bg-[#1b1533] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Sobre a madrugada (o hero da landing)
        </p>
        <FaixaDeConvite bancada={quem} escura />
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Sem código na visita a faixa não desenha nada — é por isso que ela vive dentro de um{" "}
        <code>empty:hidden</code> nos dois pontos de uso.
      </p>
    </div>
  );
}
