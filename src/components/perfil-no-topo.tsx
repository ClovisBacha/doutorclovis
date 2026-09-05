import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * O PERFIL NO TOPO — a bolinha do canto direito do painel.
 *
 * ─── POR QUE ELA EXISTE ─────────────────────────────────────────────────────
 *
 * Pedido do dono (ago/2026): "nessa aba onde eu coloquei essa bolinha redonda
 * tem que ter o perfil do médico — as informações dele, o plano que ele paga,
 * o limite de uso, o cartão de cobrança, tudo de maneira clara".
 *
 * Tudo isso já existia, e é justamente esse o ponto: morava numa aba chamada
 * "Meu Perfil", a DÉCIMA QUINTA de uma fita rolável de uma linha só. Quem
 * quisesse trocar o cartão precisava rolar a fita horizontalmente até o fim.
 * Nada aqui é tela nova — é a mesma seção, alcançável de onde as pessoas
 * procuram conta: o canto superior direito.
 *
 * E ao sair da fita, "Meu Perfil" devolve uma vaga na barra, que é a primeira
 * parcela da redução de 15 abas para 5.
 *
 * ─── O QUE ELA MOSTRA ANTES DE ABRIR ────────────────────────────────────────
 *
 * O rótulo do plano fica visível no próprio botão, sem clique. É a informação
 * que muda o que ele pode fazer no produto — e a única forma de descobri-la
 * antes era esbarrar num limite.
 */
export function PerfilNoTopo({
  nome,
  fotoUrl,
  rotuloPlano,
  /** Aviso a atender (teste acabando, cobrança falhando). Vira o ponto vermelho. */
  aviso,
  /**
   * O médico está OLHANDO o perfil agora.
   *
   * Não é enfeite. Ao sair da fita de abas, "Meu Perfil" deixou de ter um
   * botão para ficar sublinhado — e várias idas até ela são programáticas
   * (assinatura inativa manda o médico direto para lá). Sem isto ele
   * aterrissaria numa tela com a fita inteira apagada, sem nada indicando
   * onde está. A bolinha virou o indicador de posição dessa tela.
   */
  ativo = false,
  onAbrirPerfil,
  onAbrirCobranca,
  /**
   * "Minha clínica", quando o plano tem equipe.
   *
   * Ela também saiu da fita das cinco abas — só existe num plano, e não merece
   * um quinto do espaço de todo mundo. Mas sair da fita sem ganhar entrada
   * AQUI a deixaria implementada e inalcançável, que é o defeito que este
   * produto já teve quatro vezes.
   */
  onAbrirClinica,
  onSair,
}: {
  nome?: string | null;
  fotoUrl?: string | null;
  rotuloPlano?: string | null;
  aviso?: string | null;
  ativo?: boolean;
  onAbrirPerfil: () => void;
  onAbrirCobranca: () => void;
  onAbrirClinica?: () => void;
  onSair?: () => void;
}) {
  /* Iniciais quando não há foto. Duas letras no máximo: "Clóvis Bacha" → "CB",
     e um nome só → uma letra, em vez de um quadrado vazio. */
  const iniciais = (nome ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`group flex items-center gap-2.5 rounded-full border bg-card py-1 pl-1 pr-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          ativo ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/50"
        }`}
        aria-current={ativo ? "page" : undefined}
        aria-label={`Conta de ${nome ?? "médico"}${rotuloPlano ? ` · plano ${rotuloPlano}` : ""}`}
      >
        <span className="relative">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
              /* `alt=""` de propósito: o nome já está no `aria-label` do botão
                 e no texto ao lado. Repetir faria o leitor de tela dizer o
                 nome três vezes. */
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
              {iniciais || "👤"}
            </span>
          )}
          {aviso && (
            <span
              className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-amber-500"
              aria-hidden
            />
          )}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[9rem] truncate text-xs font-semibold leading-tight">
            {nome || "Meu perfil"}
          </span>
          {rotuloPlano && (
            <span className="block text-xs leading-tight text-muted-foreground">
              plano {rotuloPlano}
            </span>
          )}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-semibold">{nome || "Meu perfil"}</span>
          {rotuloPlano && (
            <span className="mt-0.5 block text-xs text-muted-foreground">plano {rotuloPlano}</span>
          )}
        </DropdownMenuLabel>
        {aviso && (
          <p className="mx-2 mb-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-snug text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {aviso}
          </p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAbrirPerfil}>
          Meus dados e foto
          <span className="ml-auto text-xs text-muted-foreground">perfil</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAbrirCobranca}>
          Plano, limite e cobrança
          <span className="ml-auto text-xs text-muted-foreground">cartão</span>
        </DropdownMenuItem>
        {onAbrirClinica && (
          <DropdownMenuItem onClick={onAbrirClinica}>
            Minha clínica
            <span className="ml-auto text-xs text-muted-foreground">equipe</span>
          </DropdownMenuItem>
        )}
        {onSair && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSair}>Sair</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
