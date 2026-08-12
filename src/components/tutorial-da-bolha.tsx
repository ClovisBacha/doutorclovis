import { useEffect, useRef } from "react";
import { Bolha, type BolhaHandle } from "@/components/bolha";
import { comNome, PASSOS_DO_TUTORIAL } from "@/lib/tutorial-do-mascote";

/**
 * O TUTORIAL DO PRIMEIRO ACESSO — o bebê bolha apresentando a barra de baixo.
 *
 * Os TEXTOS moram em `lib/tutorial-do-mascote.ts`, testados e longe do JSX.
 * Aqui fica só a encenação.
 *
 * ─── POR QUE A BARRA FICA ACESA, E NÃO ESCURECIDA ───────────────────────────
 *
 * O véu para em `z-38`; a barra vive em `z-40`. Isso não é um número
 * arbitrário: é o que produz o holofote SEM recortar máscara nenhuma. O resto
 * da tela apaga, a barra continua acesa, e o item de que ele está falando
 * pulsa (`dc-nav-destaque`).
 *
 * A alternativa seria um `clip-path` com um furo por cima da barra — e aí cada
 * mudança de tamanho da barra (ela encolhe ao rolar) exigiria recalcular o
 * furo. Um tutorial que aponta para o lugar errado é pior que nenhum tutorial.
 *
 * ─── A BARRA CONTINUA CLICÁVEL, E ISSO É DE PROPÓSITO ───────────────────────
 *
 * Se ela tocar em "Saúde" no meio da aula, o tutorial termina e ela vai para a
 * Saúde. Prender a paciente numa sequência de sete telas para poder usar o
 * aplicativo que ela acabou de instalar é a definição de tutorial ruim — e
 * quem toca num ícone durante a explicação dele já aprendeu o que precisava.
 *
 * ─── E POR QUE ELE NÃO VOLTA ────────────────────────────────────────────────
 *
 * Terminar e pular gravam a MESMA marca. Quem pulou não quer ver de novo, e o
 * caminho de rever existe: tocar no mascote no canto da home.
 *
 * ─── ⚠️ O PASSO NÃO MORA AQUI ───────────────────────────────────────────────
 *
 * `passo` é PROP, e isso é um conserto. A barra continua clicável durante a
 * aula (ver acima), e tocar num item troca a aba — o que tira a home do ar e
 * DESMONTA este componente. Com o índice em estado local, voltar para o Bebê
 * remontava tudo do zero: a paciente tocava em "Jogo" no quinto cartão,
 * voltava, e reencontrava a abertura. Foi o que o dono viu.
 *
 * Com o passo na tela de cima, o tutorial sobrevive à ida e volta e continua
 * de onde parou. É o mesmo defeito que o `sub` local do `RegistrosHub` teve, e
 * a mesma solução: o estado sobe para quem não desmonta.
 */

export function TutorialDaBolha({
  nome,
  passo: iPasso,
  onAvancar,
  onPasso,
  onFechar,
}: {
  /** Primeiro nome dela, para a abertura e o fecho. */
  nome?: string | null;
  /** Índice do cartão atual. Mora na tela de cima — ver o bloco acima. */
  passo: number;
  /** Pede o próximo cartão. Quem guarda o número é quem chama. */
  onAvancar: () => void;
  /**
   * Qual item da barra iluminar agora — a tela de cima repassa para o
   * `AppBottomNav`. `null` na abertura e no fecho.
   */
  onPasso: (destaca: string | null) => void;
  /** Terminou ou pulou: os dois gravam a mesma marca. */
  onFechar: () => void;
}) {
  const bolha = useRef<BolhaHandle>(null);
  /* Um índice fora da faixa não pode virar tela em branco: o `localStorage`
     guarda o passo, e uma versão futura com menos cartões o encontraria
     apontando para o vazio. */
  const i = Math.max(0, Math.min(PASSOS_DO_TUTORIAL.length - 1, iPasso));
  const passo = PASSOS_DO_TUTORIAL[i];
  const ultimo = i === PASSOS_DO_TUTORIAL.length - 1;

  /* O destaque é ESTADO DA TELA DE CIMA (a barra mora lá), então o passo
     atual sobe por efeito. Sem o `onPasso` no desmonte, sair no meio deixaria
     um ícone pulsando para sempre. */
  useEffect(() => {
    onPasso(passo.destaca);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  useEffect(
    () => () => onPasso(null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function avancar() {
    if (ultimo) {
      onFechar();
      return;
    }
    onAvancar();
    /* Um cutucão por passo: é ele que faz o texto ter um dono. Sem isso, os
       sete cartões lêem como uma sequência de avisos do sistema. */
    bolha.current?.chamar();
  }

  return (
    <div className="fixed inset-0 z-[38] flex flex-col justify-end bg-black/45 backdrop-blur-[2px]">
      {/* O cartão para ACIMA da barra: `mb` reserva a altura dela mais a área
          segura. Sobrepondo, o tutorial cobriria justamente o que está
          explicando. */}
      <div
        className="dc-fala-entra mx-4 mb-[calc(var(--safe-bottom)+7.5rem)] rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-float)]"
        style={{ transformOrigin: "bottom center" }}
      >
        <div className="flex items-start gap-3.5">
          <Bolha ref={bolha} tamanho={56} entrada="chega" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[17px] leading-tight text-foreground">
              {comNome(passo.titulo, nome)}
            </p>
            <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
              {comNome(passo.corpo, nome)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {/* Os pontinhos dizem QUANTO FALTA. Um tutorial sem fim à vista é o
              que faz alguém pular no segundo cartão. */}
          <div className="flex flex-1 items-center gap-1.5" aria-hidden>
            {PASSOS_DO_TUTORIAL.map((p, k) => (
              <span
                key={p.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  k === i ? "w-4 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="press rounded-full px-3 py-2 text-[13px] font-medium text-muted-foreground"
          >
            Pular
          </button>
          <button
            type="button"
            onClick={avancar}
            className="press rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground"
          >
            {ultimo ? "Vamos lá 💛" : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}
