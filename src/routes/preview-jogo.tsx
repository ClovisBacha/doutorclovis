import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { GestacaoPath, lsSet } from "@/components/gestacao-path";
import { SKIN_KEY } from "@/lib/trilha-skins";
import { nomeDoMedico } from "@/lib/nome-do-medico";

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
    /* ⚠️ O MODO CUIDADO NÃO ERA FOTOGRAFÁVEL AQUI. São 124 ocorrências de
       `careMode` em `gestacao-path.tsx` — a chama sumindo da fita, o confete,
       a camada de clima, a tela de nascimento, os toasts de figurinha — e a
       bancada cravava `careMode={false}`. As bancadas irmãs (conquistas,
       gratidão, bebê, meditação) todas têm `?luto=1`; justamente a trilha,
       que é a que mais gates tem, era a única sem.
       Foi por essa falta que a bolha `apaixonado` atravessou o luto por
       semanas — o defeito só apareceu pela bancada do Bebê. */
    luto: q.luto == null ? false : Boolean(q.luto),
    bebe: String(q.bebe ?? "Clovis"),
    pele: String(q.pele ?? ""),
    // `?dia=142` move a jornada de dia. Os três movimentos do dia giram por
    // `dia % 9`, então sem isto metade das poses da figura nunca aparece numa
    // foto — e é justamente a metade (quatro apoios, borboleta) que o desenho
    // precisa provar que desenha certo.
    dia: Number(q.dia ?? 139),
    /* `?feitos=0..6` finge o progresso do dia. É o que decide o placar de
       estrelas E o recado da bolha: com o dia começado o balão fala do meio do
       caminho e as frases de hora nem entram no bolo, então sem este parâmetro
       não havia como fotografar a tela de abertura nem as frases de madrugada,
       manhã, tarde e noite. Fica em 1 por padrão, que era o valor cravado. */
    feitos: Math.max(0, Math.min(6, Number(q.feitos ?? 1))),
    /* `?premium=1` só para fotografar a tela liberada. Fora disso a bancada
       mostra o que uma visitante sem assinatura veria. */
    premium: q.premium === "1" || q.premium === true,
    /* `?presente=100` abre o aviso de "alguém te mandou Sementinhas".
       Ele só nasce de uma linha real do ledger, então sem isto conferir o
       desenho exigiria um médico logado presenteando uma paciente logada —
       e foi por essa tela ser impossível de olhar que ela passou tanto tempo
       simplesmente não existindo. `?de=amiga` troca o remetente. */
    presente: Math.max(0, Number(q.presente ?? 0)),
    de: q.de === "amiga" ? ("amiga" as const) : ("medico" as const),
    /* Vazio de propósito no padrão: prova o caso do vínculo encerrado, em que
       o título cai para "O seu médico" em vez de um espaço em branco. */
    quem: String(q.quem ?? ""),
    /* `?streak=7` acende a chama da sequência. Ela só arde com dias fechados
       de verdade, então sem isto o desenho da animação só se confere numa
       conta com semanas de uso — que é como uma animação entra no app sem
       ninguém nunca ter olhado para ela rodando. */
    streak: Math.max(0, Number(q.streak ?? 0)),
    /* `?trofeus=12` põe número no contador do topo; `?trofeuNovo=12` abre a
       comemoração inteira. Ela só nasce de um dia de cinco estrelas fechado
       agora, então sem isto os 5 segundos de animação só se conferem tendo
       feito as cinco atividades — que é como uma animação entra no app sem
       ninguém nunca ter olhado para ela rodando. */
    trofeus: Math.max(0, Number(q.trofeus ?? 0)),
    trofeuNovo: Math.max(0, Number(q.trofeuNovo ?? 0)),
    /* `?amigas=137` mostra o contador da fita, inclusive acima de 99 para
       conferir o `99+` sem precisar de 137 contas de verdade. */
    amigas: Math.max(0, Number(q.amigas ?? 0)),
    /* `?anim=check|estrela|cinco` abre a tela das atividades JÁ COM uma das
       três animações de conquista rodando. Elas só nascem no instante em que
       uma atividade acaba de ser feita, então conferir o desenho exigia fazer
       a atividade numa conta de verdade e ainda acertar os dois segundos em
       que a animação existe. É como uma animação entra no app sem ninguém
       nunca ter olhado para ela rodando — a chama e o troféu já custaram essa
       lição duas vezes.
       Implica `tela=jogos`: as três moram dentro da folha do dia. */
    anim:
      q.anim === "check" || q.anim === "estrela" || q.anim === "cinco"
        ? (q.anim as "check" | "estrela" | "cinco")
        : undefined,
    /* `?clima=clima-petalas,clima-folhas` desenha a camada "No ar" (o tipo de
       item novo) sem conta e sem compra. Ela só aparece quando a paciente
       comprou um `clima` E o colocou na trilha, então sem isto o desenho só
       se confere numa conta premium com o item pago — que é como uma animação
       entra no app sem ninguém nunca ter olhado para ela rodando. */
    clima: String(q.clima ?? ""),
  }),
  head: () => ({
    meta: [{ title: "Bancada do jogo" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewJogo,
});

function PreviewJogo() {
  const {
    tela,
    luto,
    bebe,
    pele,
    dia,
    premium,
    feitos,
    presente,
    de,
    quem,
    streak,
    trofeus,
    trofeuNovo,
    amigas,
    anim,
    clima,
  } = Route.useSearch();
  /* Vírgula, e nunca repetição do parâmetro: o `validateSearch` devolve string
     (o router serializa e revalida, e `q.clima` chega como string nas duas
     passadas — a mesma armadilha que `?notif=` e `?w=` documentam aqui). */
  const climaIds = clima
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
        /**
         * A bancada NÃO libera o conteúdo pago.
         *
         * Esta rota é pública — não está sob `_authenticated` e o robots.txt
         * não a bloqueia; a única proteção era a meta `noindex`. Com
         * `quizPremium` cravado, qualquer pessoa com o link abria as 294 aulas
         * variando `?dia=`, que é exatamente o que a assinatura vende.
         *
         * Para conferir o visual do portão de premium, use `?premium=1` — o
         * que a bancada precisa mostrar é a TELA, e o padrão passa a ser o que
         * uma visitante de verdade veria.
         */
        quizPremium={premium}
        careMode={luto}
        onOpenShop={() => {}}
        bancada={
          tela === "jogos" ||
          !!anim ||
          presente > 0 ||
          streak > 0 ||
          trofeus > 0 ||
          trofeuNovo > 0 ||
          amigas > 0 ||
          climaIds.length > 0
            ? {
                /* `?anim=` implica a tela das atividades: as três animações
                   moram dentro da folha do dia, e sem ela a bancada abriria a
                   trilha com o parâmetro sem efeito nenhum. */
                jogos: tela === "jogos" || !!anim,
                anim,
                streak: streak > 0 ? streak : undefined,
                trofeus: trofeus > 0 ? trofeus : undefined,
                trofeuNovo: trofeuNovo > 0 ? trofeuNovo : undefined,
                amigas: amigas > 0 ? amigas : undefined,
                clima: climaIds.length > 0 ? climaIds : undefined,
                saldo: 125,
                halves: feitos,
                enfeites: ["🌻", "🧸", "🌙", "🦋", "🌿", "⭐", "🐣", "🌸", "🕯️"],
                presente:
                  presente > 0
                    ? {
                        quantidade: presente,
                        /* Data fixa: a chave do "já vi" é o instante, e uma
                           data de agora faria a foto marcar visto e a segunda
                           rodada do Playwright fotografar tela vazia. */
                        quando: "2026-08-11T12:00:00.000Z",
                        de,
                        /* A MESMA régua do servidor, e não o texto cru da URL:
                           uma bancada que mostra "Dr. Clóvis Bacha" enquanto a
                           produção mostra "Dr. Clóvis" é um instrumento que
                           mente — e o defeito que ela existe para pegar é
                           exatamente um de nome. */
                        nome: de === "medico" ? nomeDoMedico(quem) : quem || null,
                      }
                    : undefined,
              }
            : undefined
        }
      />
    </div>
  );
}
