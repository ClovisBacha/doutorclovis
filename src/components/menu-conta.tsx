import { Link } from "@tanstack/react-router";
import {
  Gift,
  IdCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AppTab } from "@/components/app-mobile-shell";

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

/* A ordem é de dentro para fora: primeiro você, depois quem cuida de você,
   depois quem te acompanha, depois os papéis. Sair fica por último, sozinho
   embaixo de uma linha, para ninguém acertar de raspão. */
const MENU_CONTA: { tab: AppTab; label: string; sub: string; Icon: LucideIcon }[] = [
  {
    tab: "Perfil",
    label: "Meus dados e ajustes",
    sub: "Nome, DUM, cidade e notificações",
    Icon: UserRound,
  },
  { tab: "Médico", label: "Meu médico", sub: "Quem acompanha a sua gestação", Icon: Stethoscope },
  { tab: "Acompanhante", label: "Acompanhante", sub: "Convide quem acompanha você", Icon: Users },
  { tab: "Carteirinha", label: "Carteirinha", sub: "Seus dados para levar na bolsa", Icon: IdCard },
  {
    tab: "Recompensas",
    label: "Recompensas",
    sub: "Sementinhas, conquistas e premium",
    Icon: Gift,
  },
];

export function MenuDaConta({
  nome,
  saudacao,
  gest,
  naoLidas,
  mostrarPainel,
  onNotificacoes,
  onNavegar,
  onSair,
  onFechar,
}: {
  nome: string;
  saudacao: string;
  gest: { weeks: number; days: number } | null;
  naoLidas: number;
  mostrarPainel: boolean;
  onNotificacoes: () => void;
  onNavegar: (t: AppTab) => void;
  onSair: () => void;
  onFechar: () => void;
}) {
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
        className="mt-[calc(3.5rem+env(safe-area-inset-top))] max-h-[calc(100dvh-8rem)] w-[86%] max-w-sm overflow-y-auto rounded-3xl border border-white/70 bg-card/95 p-2 shadow-[var(--shadow-float)] backdrop-blur-xl"
      >
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 ring-1 ring-primary/20">
            <UserRound className="h-[22px] w-[22px] text-primary" strokeWidth={1.9} />
          </span>
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

        <div className="mt-1 space-y-0.5">
          {/* Primeiro item da lista: é o que muda de um dia para o outro. O
              resto está sempre lá; só este tem novidade. */}
          <button
            onClick={onNotificacoes}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-primary/8"
          >
            <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
              <Inbox className="h-[19px] w-[19px] text-primary" strokeWidth={1.9} />
              {naoLidas > 0 && (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-card"
                />
              )}
            </span>
            <span className="flex-1">Notificações</span>
            {naoLidas > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
                {naoLidas}
              </span>
            )}
          </button>

          <div className="mx-4 my-1 h-px bg-border/60" />

          {MENU_CONTA.map(({ tab, label, sub, Icon }) => (
            <button
              key={tab}
              onClick={() => onNavegar(tab)}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition-colors hover:bg-primary/8"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <Icon className="h-[19px] w-[19px] text-primary" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{label}</span>
                <span className="block text-[11.5px] leading-snug text-muted-foreground">
                  {sub}
                </span>
              </span>
            </button>
          ))}

          <div className="mx-4 my-1 h-px bg-border/60" />

          {mostrarPainel && (
            <Link
              to="/painel"
              onClick={onFechar}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-primary/8"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                <LayoutDashboard className="h-[19px] w-[19px] text-primary" strokeWidth={1.9} />
              </span>
              Painel do médico
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
