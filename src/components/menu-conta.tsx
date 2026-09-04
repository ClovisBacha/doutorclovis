import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CircleHelp,
  CreditCard,
  Heart,
  IdCard,
  Map,
  ShieldAlert,
  Sparkles,
  Sprout,
  Inbox,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  ShoppingBag,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AppTab } from "@/components/app-mobile-shell";
import { useVoltar } from "@/lib/use-voltar";

/**
 * O menu da conta — o que se abre na silhueta do topo da home.
 *
 * Era o ☰ com quatro linhas (notificações, painel, perfil, sair). Duas coisas
 * mudaram, e as duas por pedido:
 *
 *  1. O ÍCONE. Três barras não dizem o que há atrás delas — cabem
 *     notificações, ajustes, sair, qualquer coisa. A silhueta diz: isto é a
 *     SUA conta. É o desenho que todo app usa nesse canto, então ninguém
 *     precisa aprender nada.
 *  2. O CONTEÚDO. A caixa de notificações continua sendo a primeira coisa (é a
 *     única que muda de um dia para o outro), e abaixo dela entraram os
 *     destinos que são dela: dados, médico, acompanhante, carteirinha,
 *     recompensas. Todos já existiam — estavam espalhados pela grade de
 *     atalhos e pelas fileiras de aba do desktop, e no celular só se chegava
 *     neles por sorte.
 *
 * Emoji virou ícone de traço no caminho: com quatro linhas o emoji passava;
 * com oito, uma coluna de emojis coloridos vira ruído e o olho para de ler os
 * RÓTULOS, que é a única coisa que importa numa lista de navegação.
 */

/* A ordem é de dentro para fora: primeiro você, depois a sua agenda e o que
   você anota nela, depois quem cuida de você, depois quem te acompanha, e por
   fim o que dá para aprender aqui. Sair fica sozinho embaixo de uma linha,
   para ninguém acertar de raspão.

   A CARTEIRINHA VOLTOU (set/2026), e "Estou com um sintoma" (a triagem)
   entrou junto. As duas viviam SÓ dentro do SOS — a paciente só descobria que
   existem uma ficha clínica e uma triagem de sintomas depois de apertar o
   botão de emergência: aprender custava um susto. O caminho do SOS continua
   sendo o principal na hora da mão tremendo; este é o de quem quer conferir
   com calma, ou mostrar a um médico de plantão.

   BEM-ESTAR e MEU CANTINHO também entraram por decisão do estudo de navegação:
   a aba Bem-estar (meditações, sons para dormir, exercícios, humor, apoio) não
   tinha NENHUMA porta no celular fora do Modo Cuidado, e o Cantinho só existia
   num botão flutuante do Jogo que some em dois estados. ⚠️ A grade da Saúde
   NÃO recebeu esses dois: o dono pediu, por escrito, que ela não tivesse
   "alertas nem bem-estar" — o ☰ é a lista completa, a grade é a curta.

   CONSULTAS e REGISTROS vieram da home, onde eram dois cartões grandes acima
   do médico. A home ficou com o bebê e o médico; o que é agenda e caderno
   mora aqui, junto do resto que é dela. */
const MENU_CONTA: {
  tab: AppTab;
  /** Sub-aba em que a linha deve cair — quando a aba tem várias telas. */
  subAba?: string;
  label: string;
  sub: string;
  Icon: LucideIcon;
}[] = [
  {
    tab: "Perfil",
    label: "Meus dados e ajustes",
    sub: "Nome, DUM, cidade e notificações",
    Icon: UserRound,
  },
  {
    /* ⚠️ LOGO DEPOIS DOS DADOS, e antes de tudo que é conteúdo. Dinheiro é o
       assunto que a paciente mais precisa achar rápido quando procura — e o
       que ela mais fica brava de não encontrar. Enterrá-lo no fim da lista é o
       padrão escuro que faz gente pedir chargeback em vez de cancelar. */
    tab: "Assinatura",
    label: "Minha assinatura",
    sub: "Plano, renovação e pagamento",
    Icon: CreditCard,
  },
  {
    tab: "Consultas",
    label: "Consultas",
    sub: "Calendário, exames e marcos",
    Icon: CalendarDays,
  },
  {
    tab: "Registros",
    label: "Registros",
    sub: "Diário, chutes e contrações",
    Icon: NotebookPen,
  },
  {
    tab: "Alertas",
    label: "Estou com um sintoma",
    sub: "Uma triagem rápida, e o que fazer agora",
    Icon: ShieldAlert,
  },
  {
    tab: "Carteirinha",
    label: "Carteirinha de emergência",
    sub: "Sangue, alergias, medicamentos e contato",
    Icon: IdCard,
  },
  {
    tab: "Bem-estar",
    label: "Bem-estar",
    sub: "Meditações, sons para dormir e exercícios",
    Icon: Sparkles,
  },
  {
    /* Some no Modo Cuidado: o Cantinho é a loja de enfeites do jogo, e o
       botão dele no Caminho já se esconde no luto. */
    tab: "Recompensas",
    label: "Meu Cantinho",
    sub: "Enfeites, conquistas e as suas Sementinhas",
    Icon: Sprout,
  },
  { tab: "Médico", label: "Meu médico", sub: "Quem acompanha a sua gestação", Icon: Stethoscope },
  { tab: "Acompanhante", label: "Acompanhante", sub: "Convide quem acompanha você", Icon: Users },
  {
    /* Era "Recompensas", e a linha prometia três coisas das quais duas já
       moram em outro lugar: as Sementinhas aparecem no Cantinho (dentro do
       jogo) e as conquistas vão para lá também. Sobrou a LOJA — e é o que a
       linha diz.

       ⚠️ E hoje ela aponta para um DESTINO PRÓPRIO (`tab: "Loja"`), sem
       `subAba`. Antes era `tab: "Recompensas", subAba: "loja"`, o que fazia a
       linha depender de três elos no meio do caminho (o `onNavegar` repassar a
       sub-aba, o `goToTab` gravá-la, o hub aceitá-la) — e nenhum dos três
       tinha teste. Um destino próprio não tem elo nenhum para quebrar. */
    tab: "Loja",
    label: "Loja de produtos",
    sub: "Suplementos, conforto e enxoval",
    Icon: ShoppingBag,
  },
  {
    tab: "FAQ",
    label: "Dúvidas frequentes",
    sub: "As perguntas que todo mundo faz",
    Icon: CircleHelp,
  },
];

export function MenuDaConta({
  nome,
  saudacao,
  foto,
  gest,
  proximaConsulta,
  naoLidas,
  perfilPendente = false,
  careMode = false,
  onMapa,
  mostrarPainel,
  ehDono = false,
  onNotificacoes,
  onNavegar,
  onSair,
  onFechar,
}: {
  nome: string;
  saudacao: string;
  /** A foto que ela já subiu (`patient_profiles.avatar_url`, uma data URL).
      ⚠️ O cabeçalho desenhava um ícone genérico mesmo com a foto preenchida —
      o mesmo campo que a aba Amigas usa para mostrar o rosto das amigas dela.
      Era a única tela do app que conhecia a pessoa e não a reconhecia. */
  foto?: string | null;
  gest: { weeks: number; days: number } | null;
  /** Vem da home: a linha "Próxima consulta · 12/08" morava no cartão do
      calendário. O cartão saiu da home; a informação não podia sair junto,
      então ela vira o subtítulo da linha de Consultas. */
  proximaConsulta?: string | null;
  naoLidas: number;
  /** Há algo obrigatório por preencher no Perfil (hoje: contato de
      emergência). Acende um ponto vermelho na linha, igual ao das
      notificações — é o mesmo sinal, e ele quer dizer a mesma coisa: isto
      aqui precisa de você. */
  perfilPendente?: boolean;
  /** Modo Cuidado: esconde as linhas que falam do jogo e da chegada do bebê. */
  careMode?: boolean;
  /** Abre "Tudo o que o app faz" — o mapa do app. */
  onMapa?: () => void;
  mostrarPainel: boolean;
  /**
   * O dono da plataforma, não o médico.
   *
   * Sem isto os dois viam o mesmo item — "Painel do médico" — e o dono chegava
   * na agenda de um consultório em vez do console dele. São identidades
   * diferentes e o menu precisa dizer qual é qual.
   */
  ehDono?: boolean;
  onNotificacoes: () => void;
  onNavegar: (t: AppTab, subAba?: string) => void;
  onSair: () => void;
  onFechar: () => void;
}) {
  /* Voltar (Android) e Escape fecham o menu, não o app. */
  useVoltar(true, onFechar);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-label="Perfil"
        onClick={(e) => e.stopPropagation()}
        /* `max-h` + rolagem: com oito linhas o cartão passa da tela num
           iPhone SE, e um menu que vaza pela borda esconde justamente o
           último item — que aqui é "Sair". */
        /* ⚠️ COLUNA COM RODAPÉ FIXO, e não uma caixa que rola inteira.
           Medido com a área segura injetada: com a folha rolando por completo,
           num iPhone SE (375×667) ficavam FORA DA VISTA o Pós-parto, o Painel
           e o **Sair** — e num 320px também as Dúvidas. Sair do app exigia
           descobrir que a lista rolava.

           Agora só a LISTA rola; Painel e Sair vivem num rodapé que não sai da
           tela nunca. É a mesma razão pela qual a fila de trabalho do painel do
           médico ficou fora da `div` que o app nativo esconde: um caminho de
           saída que depende de rolagem é um caminho que alguém não encontra. */
        className="mt-[calc(3.5rem+var(--safe-top))] flex max-h-[calc(100dvh-8rem)] w-[86%] max-w-sm flex-col overflow-hidden rounded-3xl border border-white/70 bg-card/95 p-2 shadow-[var(--shadow-float)] backdrop-blur-xl"
      >
        <div className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-3">
          {foto ? (
            <img
              src={foto}
              alt=""
              className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-primary/20"
              draggable={false}
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 ring-1 ring-primary/20">
              <UserRound className="h-[22px] w-[22px] text-primary" strokeWidth={1.9} />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-serif text-lg leading-tight text-foreground">
              {saudacao}, {nome} 💛
            </p>
            {gest && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {gest.weeks}s {gest.days}d de gestação
              </p>
            )}
          </div>
        </div>

        <div className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {/* Primeiro item da lista: é o que muda de um dia para o outro. O
              resto está sempre lá; só este tem novidade. */}
          <button
            onClick={onNotificacoes}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/8"
          >
            {/* ⚠️ SEM PONTO NO ÍCONE. Ele e o contador da direita apareciam
                pela MESMA condição (`naoLidas > 0`) e diziam a mesma coisa —
                dois sinais para um fato só, e o número já é estritamente mais
                informativo que o ponto. O ponto continua onde ele é a única
                informação possível: a linha do Perfil, que não tem contagem. */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <Inbox className="h-[19px] w-[19px] text-primary" strokeWidth={1.9} />
            </span>
            <span className="flex-1">Notificações</span>
            {naoLidas > 0 && (
              <span className="rounded-full bg-rose-700 px-2 py-0.5 text-xs font-bold text-white">
                {naoLidas}
              </span>
            )}
          </button>

          <div className="mx-4 my-1 h-px bg-border/60" />

          {/* O MAPA vem primeiro: é a única linha que responde "onde fica…?"
              para qualquer coisa, e quem abriu o ☰ procurando algo que não
              está nas dez linhas abaixo precisa dela antes de desistir. */}
          {onMapa && (
            <button
              onClick={onMapa}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-colors hover:bg-primary/8"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <Map className="h-[19px] w-[19px] text-primary" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  Tudo o que o app faz
                </span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  Procure uma função pelo nome
                </span>
              </span>
            </button>
          )}
          {MENU_CONTA.filter(({ tab }) => !(careMode && tab === "Recompensas")).map(
            ({ tab, subAba, label, sub, Icon }) => (
              <button
                key={tab}
                onClick={() => onNavegar(tab, subAba)}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-colors hover:bg-primary/8"
              >
                <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                  <Icon className="h-[19px] w-[19px] text-primary" strokeWidth={1.9} />
                  {perfilPendente && tab === "Perfil" && (
                    <span
                      aria-hidden
                      className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-card"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {label}
                    {perfilPendente && tab === "Perfil" && (
                      <span className="ml-1.5 align-middle text-xs font-bold text-rose-600">
                        • contato de emergência
                      </span>
                    )}
                  </span>
                  <span className="block text-xs leading-snug text-muted-foreground">
                    {tab === "Consultas" && proximaConsulta ? proximaConsulta : sub}
                  </span>
                </span>
              </button>
            ),
          )}

          {/* Pós-parto só existe na reta final. Era um cartão da home que
              aparecia a partir da semana 36; a home ficou com o médico, e sem
              esta linha ele viraria uma aba sem porta no celular. */}
          {gest && gest.weeks >= 36 && (
            <button
              onClick={() => onNavegar("Pós-parto")}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-colors hover:bg-primary/8"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <Heart className="h-[19px] w-[19px] text-rose-500" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Pós-parto</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  Cuidados com você e o bebê depois do parto
                </span>
              </span>
            </button>
          )}
        </div>

        {/* ── O RODAPÉ QUE NUNCA ROLA ──────────────────────────────────────
            Painel e Sair. Ver a classe da folha acima: são os dois destinos
            que não podem depender de a paciente descobrir que a lista rola. */}
        <div className="shrink-0">
          <div className="mx-4 my-1 h-px bg-border/60" />

          {mostrarPainel && (
            <Link
              to={ehDono ? "/admin" : "/painel"}
              onClick={onFechar}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-primary/8"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <LayoutDashboard className="h-[19px] w-[19px] text-primary" strokeWidth={1.9} />
              </span>
              {ehDono ? "Painel Admin" : "Painel do médico"}
            </Link>
          )}
          <button
            onClick={onSair}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-primary/8"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <LogOut className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </span>
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
