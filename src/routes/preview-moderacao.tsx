import { createFileRoute } from "@tanstack/react-router";
import { FilaDeDenuncias } from "@/components/fila-de-denuncias";
import { NumerosDaComunidade } from "@/components/numeros-da-comunidade";

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
 *   /preview-moderacao?ficha=1    → a ficha de moderação de uma conta
 *   /preview-moderacao?ficha=1&suspensa=1 → a conta já suspensa (o desfazer)
 *   /preview-moderacao?instavel=1 → ⚠️ os números ilegíveis: "—", nunca 0.
 *                                    Zero AFIRMA que a aba morreu.
 *
 * ⚠️ As datas são CRAVADAS, nunca `Date.now()`: servidor e cliente calculariam
 * instantes diferentes e o texto derivado divergiria na virada do minuto — o
 * mismatch de hidratação que já derrubou este app.
 */
export const Route = createFileRoute("/preview-moderacao")({
  component: Pagina,
  validateSearch: (q: Record<string, unknown>) => ({
    falhou: q.falhou == null ? 0 : Number(q.falhou),
    instavel: q.instavel == null ? 0 : Number(q.instavel),
    ficha: q.ficha == null ? 0 : Number(q.ficha),
    suspensa: q.suspensa == null ? 0 : Number(q.suspensa),
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
  const { falhou, vazio, instavel, ficha, suspensa } = Route.useSearch();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-[15px] font-semibold">Bancada · fila de moderação</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        ?falhou=1 · ?vazio=1 — a tela real do painel, com dado fabricado.
      </p>
      {/* ⚠️ Os números entram na MESMA bancada: eles moram ao lado da fila no
          painel, e olhar um sem o outro esconde a relação entre "a aba está
          movimentada" e "a fila cresceu". */}
      <NumerosDaComunidade
        bancada={
          instavel === 1
            ? {
                publicacoes: null,
                publicacoesNaSemana: null,
                storiesNaSemana: null,
                comentariosNaSemana: null,
                perfisPublicos: null,
                denunciasNaSemana: null,
              }
            : {
                publicacoes: 1284,
                publicacoesNaSemana: 37,
                storiesNaSemana: 62,
                comentariosNaSemana: 118,
                perfisPublicos: 214,
                denunciasNaSemana: vazio === 1 ? 0 : 6,
              }
        }
      />

      <FilaDeDenuncias
        bancada={{
          falhou: falhou === 1,
          /* ⚠️ A ficha vem do servidor — sem injetá-la aqui ela nunca desenha,
             e a bancada aprovaria uma fila sem o histórico que decide entre
             "avisar" e "remover". */
          ficha:
            ficha === 1
              ? {
                  nome: "Ana Paula",
                  emCuidado: false,
                  pausada: false,
                  publica: true,
                  suspensa: suspensa === 1,
                  desde: "2026-03-14T10:00:00Z",
                  abertas: 1,
                  total: 4,
                  porDesfecho: { removido: 1, avisado: 1, sem_acao: 1 },
                  historico: [
                    {
                      alvo: "comentario",
                      motivo: "saude",
                      trecho: "comigo foi assim, não precisa ir no pronto-socorro",
                      quando: "2026-08-26T21:00:00Z",
                      desfecho: null,
                      resolvida: false,
                    },
                    {
                      alvo: "post",
                      motivo: "saude",
                      trecho: "parei o remédio por conta e melhorou",
                      quando: "2026-08-12T10:00:00Z",
                      desfecho: "removido",
                      resolvida: true,
                    },
                    {
                      alvo: "comentario",
                      motivo: "outro",
                      trecho: "que exagero, isso é normal",
                      quando: "2026-07-30T10:00:00Z",
                      desfecho: "avisado",
                      resolvida: true,
                    },
                    {
                      alvo: "perfil",
                      motivo: "spam",
                      trecho: null,
                      quando: "2026-07-02T10:00:00Z",
                      desfecho: "sem_acao",
                      resolvida: true,
                    },
                  ],
                }
              : undefined,
          rede: vazio === 1 || falhou === 1 ? [] : (REDE as never),
          caixinha: vazio === 1 || falhou === 1 ? [] : (CAIXINHA as never),
        }}
      />
    </div>
  );
}
