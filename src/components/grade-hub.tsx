import { ChevronLeft, type LucideIcon } from "lucide-react";

/**
 * A grade de quadrados que substitui as fileiras de pílulas roláveis.
 *
 * O problema que ela resolve, e que era o mesmo em todo lugar: numa tela de
 * 390px cabem três ou quatro pílulas. As demais ficam além da borda, sem nada
 * dizendo que existem — na aba Consultas, "Plano de parto", "Teleconsulta" e
 * "Particular" simplesmente não apareciam. E as visíveis eram alvos de 30px de
 * altura espremidos entre o título e o conteúdo.
 *
 * A grade mostra TODAS de uma vez, cada uma com ícone, nome e uma linha
 * dizendo o que tem dentro, num alvo do tamanho do polegar. `aspect-square` é
 * o que garante "dois quadrados grandes por linha" de um iPhone SE a um tablet
 * em retrato.
 *
 * O preço é um toque a mais para trocar de sub-aba (voltar → escolher). É o
 * mesmo preço que o hub da Saúde paga, e a mesma troca: quem perde é quem já
 * sabia onde ficava tudo; quem ganha é quem não sabia que aquilo existia.
 */

export type Ladrilho = {
  key: string;
  label: string;
  /** Uma linha dizendo o que tem lá dentro. É metade do valor da grade. */
  sub: string;
  Icon: LucideIcon;
  /** Borda + gradiente do quadro, em classes do Tailwind. */
  caixa: string;
  /** Cor do ícone. */
  tinta: string;
};

export function GradeHub({
  itens,
  onAbrir,
  preencherTela = false,
}: {
  itens: readonly Ladrilho[];
  onAbrir: (key: string) => void;
  /**
   * Dois por linha PREENCHENDO a tela, em vez de quadrados.
   *
   * Pedido do dono para a aba Saúde depois de ela cair para quatro destinos:
   * "eles vão preencher a tela inteira, esses quatro blocos, dois por linha,
   * maiores". Com `aspect-square` e quatro ladrilhos sobrava meia tela vazia
   * embaixo — o quadrado é o que garante duas colunas quando são seis, e vira
   * desperdício quando são quatro.
   *
   * A altura desconta o que a página já reserva: a folga de topo com a área
   * segura, o cabeçalho da aba e o rodapé da barra flutuante. `min-h` impede
   * que uma tela muito baixa (celular deitado) esmague os ladrilhos até o
   * texto sumir — ali ela volta a rolar, que é o comportamento certo.
   */
  preencherTela?: boolean;
}) {
  return (
    <div
      className={
        preencherTela
          ? "grid auto-rows-fr grid-cols-2 gap-3 h-[calc(100svh-var(--safe-top)-var(--safe-bottom)-15rem)] min-h-[26rem]"
          : "grid grid-cols-2 gap-3"
      }
    >
      {itens.map(({ key, label, sub, Icon, caixa, tinta }) => (
        <button
          key={key}
          onClick={() => onAbrir(key)}
          className={`press flex flex-col justify-between overflow-hidden rounded-[26px] border bg-gradient-to-br p-3 text-left ${
            preencherTela ? "min-h-0 p-4" : "aspect-square"
          } ${caixa}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <Icon className={`h-5 w-5 ${tinta}`} strokeWidth={1.7} />
          </span>
          {/* `overflow-hidden` + `line-clamp` mantêm o QUADRADO quadrado: em
              telas de 320px um rótulo de duas linhas esticaria só aquele bloco
              e desalinharia a grade inteira. */}
          <span className="min-w-0">
            <span className="line-clamp-2 block font-serif text-[15.5px] leading-tight text-foreground">
              {label}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-[1.28] text-muted-foreground">
              {sub}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * A volta para a grade, dentro de uma sub-aba aberta.
 *
 * Fica no topo do conteúdo e diz o NOME de onde se está — a barra de cima do
 * app mostra o nome da aba (Consultas), não o da sub-aba, e sem esta linha a
 * paciente perde a referência de qual das sete telas está vendo.
 */
export function VoltarDaGrade({ rotulo, onVoltar }: { rotulo: string; onVoltar: () => void }) {
  return (
    <div className="flex items-center gap-2.5">
      <button
        onClick={onVoltar}
        aria-label="Voltar"
        className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/8 text-primary transition-colors hover:bg-primary/15"
      >
        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      <p className="min-w-0 truncate font-serif text-lg leading-tight text-foreground">{rotulo}</p>
    </div>
  );
}
