import { createFileRoute } from "@tanstack/react-router";
import { FilaDeDenuncias } from "@/components/fila-de-denuncias";

/**
 * BANCADA DA FILA DE MODERAÇÃO.
 *
 * ⚠️ **É a tela de maior consequência do painel, e nunca teve bancada.** Ela
 * decide o que sai do ar e o que volta para quem denunciou — e olhá-la exigia
 * uma denúncia de verdade, feita por outra conta, numa base com `ADMIN_EMAILS`
 * configurado. Ou seja: ninguém olhava.
 *
 *   /preview-moderacao            → as duas filas, com os sete alvos
 *   /preview-moderacao?falhou=1   → ⚠️ o estado que mais importa: não consegui
 *                                    ler. "Está tudo limpo" é a frase mais
 *                                    perigosa que uma fila pode dizer errado.
 *   /preview-moderacao?vazio=1    → nada a olhar
 *
 * ⚠️ As datas são CRAVADAS, nunca `Date.now()`: servidor e cliente calculariam
 * instantes diferentes e o texto derivado divergiria na virada do minuto — o
 * mismatch de hidratação que já derrubou este app.
 */
export const Route = createFileRoute("/preview-moderacao")({
  component: Pagina,
  validateSearch: (q: Record<string, unknown>) => ({
    falhou: q.falhou == null ? 0 : Number(q.falhou),
    vazio: q.vazio == null ? 0 : Number(q.vazio),
  }),
});

const REDE = [
  {
    id: "d1",
    alvo: "comentario" as const,
    denunciadaId: "u1",
    denunciadaNome: "Ana Paula",
    motivo: "saude",
    trecho: "comigo foi assim, não precisa ir no pronto-socorro, isso passa sozinho",
    quando: "2026-08-26T21:00:00Z",
    reincidencias: 3,
  },
  {
    id: "d2",
    alvo: "mensagem" as const,
    denunciadaId: "u2",
    denunciadaNome: "Perfil sem foto",
    motivo: "assedio",
    trecho: "me manda mais foto da sua barriga",
    quando: "2026-08-26T18:00:00Z",
    reincidencias: 1,
  },
  {
    id: "d3",
    alvo: "post" as const,
    denunciadaId: "u3",
    denunciadaNome: "Loja Bem Nascer",
    motivo: "spam",
    trecho: "PROMOÇÃO imperdível de enxoval, chama no direto!!",
    quando: "2026-08-25T12:00:00Z",
    reincidencias: 2,
  },
  {
    id: "d4",
    alvo: "perfil" as const,
    denunciadaId: "u4",
    denunciadaNome: "Dra. Fake",
    motivo: "imagem",
    trecho: null,
    quando: "2026-08-24T09:00:00Z",
    reincidencias: 1,
  },
  {
    id: "d5",
    alvo: "story" as const,
    denunciadaId: "u5",
    denunciadaNome: "Bruna",
    motivo: "outro",
    trecho: "(story com foto)",
    quando: "2026-08-23T09:00:00Z",
    reincidencias: 1,
  },
];

const CAIXINHA = [
  {
    id: "p1",
    texto: "toma buscopan que resolve, comigo funcionou",
    quando: "2026-08-26T20:00:00Z",
  },
];

function Pagina() {
  const { falhou, vazio } = Route.useSearch();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-[15px] font-semibold">Bancada · fila de moderação</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        ?falhou=1 · ?vazio=1 — a tela real do painel, com dado fabricado.
      </p>
      <FilaDeDenuncias
        bancada={{
          falhou: falhou === 1,
          rede: vazio === 1 || falhou === 1 ? [] : (REDE as never),
          caixinha: vazio === 1 || falhou === 1 ? [] : (CAIXINHA as never),
        }}
      />
    </div>
  );
}
