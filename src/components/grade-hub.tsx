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
  /**
   * Ícone 3D (arte importada) no lugar do Lucide. Quando presente, o desenho É
   * o objeto — não vai dentro do círculo branco, que existe para dar corpo a
   * um traço de 1,7px e só atrapalharia uma peça com volume próprio.
   */
  imagem?: string;
  /** Borda + gradiente do quadro, em classes do Tailwind. */
  caixa: string;
  /** Cor do ícone. */
  tinta: string;
  /**
   * O NÚMERO DELA, no meio do bloco grande — o último peso, os chutes de hoje.
   * É o que faz o tamanho de `preencherTela` ter sentido: o dono pediu blocos
   * que "preencham a tela inteira", e um bloco de 300px com ícone e rótulo é
   * 180px de gradiente vazio. ⚠️ `null`/ausente NÃO DESENHA NADA — falha de
   * leitura e "ela nunca registrou" caem os dois aqui, porque um "0" afirmaria
   * um fato que a tela não tem como saber (a régua de `estado-das-portas`).
   */
  dado?: { valor: string; legenda?: string } | null;
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
      {itens.map(({ key, label, sub, Icon, imagem, caixa, tinta, dado }) => (
        <button
          key={key}
          onClick={() => onAbrir(key)}
          className={`press relative flex flex-col justify-between overflow-hidden rounded-[26px] border bg-gradient-to-br p-3 text-left ${
            preencherTela ? "min-h-0 p-4" : "aspect-square"
          } ${caixa}`}
        >
          {/* Luz de cima: um brilho branco radial no topo do bloco, por cima do
              degradê da família. É o que separa "cartão colorido" de "bloco
              com profundidade" — e é decoração, fora do fluxo e do toque. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(255,255,255,0.75),transparent_70%)]"
          />
          {/* ⚠️ O ÍCONE CRESCE COM O LADRILHO, e isto não desfaz o pedido do
              dono — ele pediu os blocos GRANDES ("vão preencher a tela
              inteira"), e o que estava errado era o que havia DENTRO deles.
              Medido a 393px: o ladrilho de `preencherTela` mede 175×300 e o
              ícone media 40×40 — 2,6% da área, com ~180px de gradiente vazio
              entre ele e o texto do rodapé. Um bloco grande com um ícone de
              bloco pequeno lê como o lugar onde a ilustração ainda não chegou.
              ⚠️ E o quadrado NÃO muda: ali o ícone de 40px está na proporção
              certa, e crescer os dois juntos quebraria a grade de seis. */}
          {/* ⚠️ A ARTE NO QUADRADO É 64px, e não os 44 do traço. O círculo
              branco do Lucide mede 40px porque um traço de 1,7px preenche a
              caixa; a peça 3D tem volume, sombra e perspectiva, e a 44px num
              quadrado de 175px ela saía como um selo perdido no canto —
              medido na foto da grade do Bebê. 64px é a proporção que o
              ícone-no-círculo já tinha (40 de 175) aplicada a uma peça que
              não preenche a própria caixa. */}
          {imagem ? (
            /* ⚠️ A ARTE FICA CENTRADA, COM UM HALO ATRÁS — pedido do dono
               ("cada ícone centralizado e com um efeito atrás gradiente mais
               bonito, está muito básico"). O halo são dois discos desfocados:
               um na COR DA FAMÍLIA do bloco (`tinta`, via `currentColor` —
               verde no Saúde, azul nos Chutes) e um branco menor, que dá a
               sensação de luz vindo de trás da peça. Nada é imagem: é a
               mesma cor que o traço usava, então a família do bloco continua
               sendo uma decisão só. */
            <span
              className={`relative flex w-full shrink-0 items-center justify-center ${tinta} ${
                preencherTela ? "min-h-36 flex-1" : "h-[4.75rem]"
              }`}
            >
              {/* brilho grande na cor da família (desfocado) */}
              <span
                aria-hidden
                className={`absolute rounded-full bg-current opacity-[0.28] blur-2xl ${
                  preencherTela ? "h-36 w-36" : "h-20 w-20"
                }`}
              />
              {/* o "pratinho": um disco branco nítido sob a peça, com um anel de
                  luz — é ele que dá ao ícone um lugar para pousar */}
              <span
                aria-hidden
                className={`absolute rounded-full bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_6px_18px_-6px_rgba(0,0,0,0.12)] ring-1 ring-white/80 ${
                  preencherTela ? "h-28 w-28" : "h-[4.25rem] w-[4.25rem]"
                }`}
              />
              <img
                src={imagem}
                alt=""
                draggable={false}
                className={`relative object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.16)] ${
                  preencherTela ? "h-24 w-24" : "h-14 w-14"
                }`}
              />
            </span>
          ) : (
            <span
              className={`flex shrink-0 items-center justify-center rounded-2xl bg-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${
                preencherTela ? "h-16 w-16 rounded-[22px]" : "h-10 w-10"
              }`}
            >
              <Icon
                className={`${preencherTela ? "h-8 w-8" : "h-5 w-5"} ${tinta}`}
                strokeWidth={1.7}
              />
            </span>
          )}
          {/* O dado dela ocupa o meio do bloco grande. `justify-between` com três
              filhos distribui: ícone em cima, número no meio, rótulo embaixo. */}
          {/* ⚠️ VALOR grande e LEGENDA pequena, em vez de uma frase só. Medido:
              "3 hoje · última 14:20" em serif 22px quebrava em TRÊS linhas numa
              coluna de 175px, e o número — que é o que ela veio ver — ficava
              do mesmo tamanho que "última". Separando, o número tem a linha
              inteira e a legenda explica embaixo. */}
          {preencherTela && dado ? (
            <span className="mb-3 block">
              <span className="block font-serif text-[26px] leading-none text-foreground">
                {dado.valor}
              </span>
              {dado.legenda ? (
                <span className="mt-1 block text-[12px] leading-tight text-muted-foreground">
                  {dado.legenda}
                </span>
              ) : null}
            </span>
          ) : null}
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
 * A volta para a grade, dentro de uma sub-aba aberta — e o CABEÇALHO da
 * sub-tela, no desenho do bloco que a abriu.
 *
 * Pedido do dono: "dentro de cada aba, ver como mudar para ficar no design
 * daquela aba — a da Saúde é um coração com fundo verde; lá dentro tem de
 * estar similar". A forma de garantir isso em TODAS as sub-telas é uma peça
 * só, alimentada pelos MESMOS dados do bloco (`ladrilho`: a arte, o degradê
 * da família, a cor, o rótulo e a linha de baixo). Quem abriu um bloco verde
 * com o coração chega numa tela que começa com o mesmo coração sobre o mesmo
 * verde — a continuidade não depende de ninguém lembrar de pintar a tela.
 *
 * Sem `ladrilho` ela é só a seta com o nome (o formato antigo). Sem
 * `onVoltar` não há seta: é o caso das abas que a barra de cima já sabe
 * voltar (Saúde, Nutrição, Saúde da mulher), onde o cabeçalho é só a
 * identidade do bloco.
 */
export function VoltarDaGrade({
  rotulo,
  onVoltar,
  ladrilho,
}: {
  rotulo: string;
  onVoltar?: () => void;
  ladrilho?: Pick<Ladrilho, "label" | "sub" | "imagem" | "caixa" | "tinta"> & { Icon?: LucideIcon };
}) {
  const seta = onVoltar ? (
    <button
      onClick={onVoltar}
      aria-label="Voltar"
      className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-white/70 text-primary transition-colors hover:bg-white"
    >
      <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2} />
    </button>
  ) : null;
  if (!ladrilho) {
    return (
      <div className="flex items-center gap-2.5">
        {seta}
        <p className="min-w-0 truncate font-serif text-lg leading-tight text-foreground">
          {rotulo}
        </p>
      </div>
    );
  }
  const { imagem, caixa, tinta, sub, Icon } = ladrilho;
  return (
    <div
      className={`relative flex items-center gap-3 overflow-hidden rounded-[26px] border bg-gradient-to-br p-3 pr-4 ${caixa}`}
    >
      {/* a mesma luz de cima do bloco */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(255,255,255,0.75),transparent_70%)]"
      />
      <span className="relative">{seta}</span>
      {/* a mesma peça, no mesmo pratinho, menor */}
      <span className={`relative flex h-16 w-16 shrink-0 items-center justify-center ${tinta}`}>
        <span
          aria-hidden
          className="absolute h-16 w-16 rounded-full bg-current opacity-[0.28] blur-xl"
        />
        <span
          aria-hidden
          className="absolute h-14 w-14 rounded-full bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_6px_18px_-6px_rgba(0,0,0,0.12)] ring-1 ring-white/80"
        />
        {imagem ? (
          <img
            src={imagem}
            alt=""
            draggable={false}
            className="relative h-11 w-11 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.16)]"
          />
        ) : Icon ? (
          <Icon className="relative h-6 w-6" strokeWidth={1.7} />
        ) : null}
      </span>
      <div className="relative min-w-0">
        <p className="truncate font-serif text-lg leading-tight text-foreground">{rotulo}</p>
        <p className="mt-0.5 truncate text-[13px] leading-snug text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}
