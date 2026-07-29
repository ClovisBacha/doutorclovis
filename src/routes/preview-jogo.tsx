import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { GestacaoPath, lsSet } from "@/components/gestacao-path";
import { SKIN_KEY } from "@/lib/trilha-skins";

/**
 * Bancada de design do JOGO (Caminho) — irmã da /preview-home.
 *
 * O jogo vive atrás do Supabase Auth, então conferir cor de semana, forma dos
 * nós e sobreposição exigia login. Aqui ele renderiza com dados fixos e o
 * Playwright mede a trilha inteira: distância entre bolinhas, arredondamento,
 * e quantas cores distintas aparecem.
 *
 * Não expõe nada: `profile` e `gest` são constantes de exemplo.
 */
export const Route = createFileRoute("/preview-jogo")({
  // `?tela=jogos` abre direto a tela das atividades do dia (o "game"), que na
  // conta real só se alcança tocando num nó da trilha — impossível de
  // fotografar sem isso. Aceita 1 e true: o router revalida depois de
  // serializar, e só entender "jogos" apagaria o parâmetro no segundo passe.
  // `?bebe=Helena` troca o nome. Existe para PROVAR que a saudação lê o nome
  // do bebê do perfil e não tem "Clovis" preso em lugar nenhum da tela.
  // `?pele=trilha-jardim` equipa uma pele de bolinha — a única forma de
  // fotografar a trilha com pele sem ter comprado o item numa conta real.
  validateSearch: (q: Record<string, unknown>) => ({
    tela: String(q.tela ?? ""),
    bebe: String(q.bebe ?? "Clovis"),
    pele: String(q.pele ?? ""),
    // `?dia=142` move a jornada de dia. Os três movimentos do dia giram por
    // `dia % 9`, então sem isto metade das poses da figura nunca aparece numa
    // foto — e é justamente a metade (quatro apoios, borboleta) que o desenho
    // precisa provar que desenha certo.
    dia: Number(q.dia ?? 139),
  }),
  head: () => ({
    meta: [{ title: "Bancada do jogo" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewJogo,
});

function PreviewJogo() {
  const { tela, bebe, pele, dia } = Route.useSearch();
  useEffect(() => {
    if (!pele) return;
    lsSet(SKIN_KEY, pele);
    /* O efeito do filho roda ANTES do do pai (filhos montam primeiro), então
       o `GestacaoPath` já leu o storage vazio quando esta linha grava. O
       evento é o que faz ele reler — o mesmo caminho que a loja usa. */
    window.dispatchEvent(new CustomEvent("dc-skin-trocada", { detail: pele }));
  }, [pele]);
  /* z-50 e não z-75: a tela de atividades vai por portal para o <body> em
     z-60, e um invólucro de bancada em z-75 a cobria — o teste escondendo
     justamente o que ele deveria fotografar. 50 ainda cobre o cabeçalho
     público, que é para o que este invólucro existe. */
  return (
    <div className="fixed inset-0 z-[50] overflow-y-auto bg-background">
      <GestacaoPath
        profile={{ baby_name: bebe }}
        gest={{ weeks: Math.floor(dia / 7), days: dia % 7, totalDays: dia }}
        quizPremium
        careMode={false}
        onOpenShop={() => {}}
        bancada={
          tela === "jogos"
            ? {
                jogos: true,
                saldo: 125,
                halves: 1,
                enfeites: ["🌻", "🧸", "🌙", "🦋", "🌿", "⭐", "🐣", "🌸", "🕯️"],
              }
            : undefined
        }
      />
    </div>
  );
}
