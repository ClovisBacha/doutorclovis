import { useEffect, useRef, useState } from "react";
import { Bolha, type BolhaHandle, type Humor } from "@/components/bolha";
import { emblemaDeRecados, oQueOMascoteDiz, type FalaDoMascote } from "@/lib/fala-do-mascote";

/**
 * O BEBÊ BOLHA NO CANTO DA HOME — a voz do app.
 *
 * Pedido do dono: "adicione no canto superior direito o bebê bolha; ele será o
 * personagem que vai ficar falando as notificações que tem, entre outras
 * interações com a paciente, e vai introduzir o app através de um tutorial no
 * primeiro acesso".
 *
 * A personagem já existia inteira (`bolha.tsx`: humores, ações, `ref` com
 * pular/negar/chegar/chamar, portão de Modo Cuidado). O que faltava era ela ter
 * ONDE morar na tela principal e COMO falar. É isso que este arquivo é: o lugar
 * e a boca. Nada de arte nova, nada de segunda personagem.
 *
 * ─── DUAS BOLHAS NA MESMA TELA, E POR QUE ISSO FUNCIONA ────────────────────
 *
 * A home já tem uma bolha no centro, e ela é O BEBÊ DELA. Pôr uma segunda
 * bolha na mesma tela é o risco real desta mudança: se as duas lerem como a
 * mesma coisa, o app passa a ter dois filhos, e o do canto fala.
 *
 * Três coisas separam as duas, e nenhuma é acidental:
 *
 *  · **Tamanho.** 44px contra ~236px. A do centro é o assunto; esta é uma
 *    ferramenta, e ferramenta em app se reconhece por caber no polegar.
 *  · **Rosto.** A do centro tem um FETO — sem olhos, sem expressão, do tamanho
 *    da semana dela. Esta tem cara e pisca. Ninguém confunde um feto de 20
 *    semanas com um desenho que sorri.
 *  · **Lugar.** Esta vive na barra de topo, na fileira do menu e do nome —
 *    a faixa de FERRAMENTAS. A do centro flutua no céu, sozinha.
 *
 * ─── A FALA É O PONTO, E ELA NÃO É ENFEITE ─────────────────────────────────
 *
 * Um personagem que só flutua no canto é adesivo. Este começa a vida já com
 * uma função: quando há recado não lido, ele DIZ quantos e leva à central com
 * um toque. Sem recado, ele fica quieto — e ficar quieto é metade do valor,
 * porque é o que faz a fala significar alguma coisa quando ela aparece.
 *
 * `fala` é prop, e é por ela que o tutorial vai entrar: quem conduzir o
 * primeiro acesso passa o texto e o personagem fala. O balão não sabe se está
 * anunciando um recado ou ensinando a usar o app.
 */

/** Quanto o balão espera antes de aparecer, para não brotar junto com a tela. */
const ESPERA_DA_FALA = 900;

/* A régua de O QUE ele diz mora em `lib/fala-do-mascote.ts`, testada e longe
   do JSX. Aqui fica só o COMO: onde ele senta, como o balão nasce e quando o
   personagem cutuca. */
export type { FalaDoMascote };

export function MascoteDaHome({
  humor = "feliz",
  recados = 0,
  fala,
  onAbrir,
  careMode = false,
  calado = false,
  tamanho = 44,
}: {
  humor?: Humor;
  /** Recados não lidos. Zero = ele fica quieto. */
  recados?: number;
  /**
   * Fala explícita, que VENCE a dos recados.
   *
   * É a porta do tutorial: quem conduz o primeiro acesso manda o texto por
   * aqui. Enquanto ele estiver falando, o número de recados não o interrompe —
   * um personagem que muda de assunto no meio da frase não ensina nada.
   */
  fala?: FalaDoMascote | null;
  onAbrir?: () => void;
  careMode?: boolean;
  /**
   * Segura o balão — o emblema continua.
   *
   * ⚠️ Existe por um defeito que o dono fotografou: com o TUTORIAL aberto, o
   * personagem do canto também estava falando ("Estou aqui do seu lado…") por
   * trás do véu. Dois balões do mesmo personagem na mesma tela, dizendo coisas
   * diferentes — e um deles atrás de um vidro escurecido.
   *
   * O emblema fica de propósito: ele é informação (há recado), não fala. Quem
   * cala é a boca.
   */
  calado?: boolean;
  tamanho?: number;
}) {
  const bolha = useRef<BolhaHandle>(null);
  const [mostrarFala, setMostrarFala] = useState(false);

  const oQueEleDiz = oQueOMascoteDiz(fala, recados);
  const emblema = emblemaDeRecados(recados);

  /* O balão espera, e o personagem CUTUCA no mesmo instante em que fala.
     Sem o cutucão o balão aparece sozinho e lê como aviso de sistema; com ele,
     a fala tem origem — foi ele que chamou. `chamar()` é a ação mais discreta
     das quatro, e é a certa: as outras três são comemoração, negativa e
     entrada em cena. */
  useEffect(() => {
    if (!oQueEleDiz) {
      setMostrarFala(false);
      return;
    }
    const t = setTimeout(() => {
      setMostrarFala(true);
      bolha.current?.chamar();
    }, ESPERA_DA_FALA);
    return () => clearTimeout(t);
  }, [oQueEleDiz?.texto]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative z-20 shrink-0">
      <button
        type="button"
        onClick={onAbrir}
        aria-label={oQueEleDiz?.aria ?? "Falar com a bolha"}
        className="press relative flex items-center justify-center"
        style={{ width: tamanho, height: tamanho }}
      >
        <Bolha ref={bolha} humor={humor} tamanho={tamanho} careMode={careMode} />
        {/* O ponto fica FORA do corpo, encostado na borda: dentro dele
            competiria com a carinha, que é o que dá vida ao canto. O anel
            branco o descola de qualquer céu — a mesma solução do ponto do
            menu, do outro lado da barra. */}
        {emblema && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white/85"
          >
            {emblema}
          </span>
        )}
      </button>

      {/* ─── O BALÃO ──────────────────────────────────────────────────────
          `absolute` e ancorado à DIREITA: o mascote mora no canto direito, e um
          balão centrado nele vazaria a tela. `right-0` prende a borda direita
          do balão na borda direita do mascote, e ele cresce para a esquerda.

          `max-w` em vw e não em rem: o que limita aqui é a largura da TELA, não
          o corpo do texto — num iPhone SE um balão de 18rem sairia por baixo do
          nome do bebê, que fica no eixo da tela.

          ⚠️ `w-max` é obrigatório, e o motivo não é estético. Um absoluto com
          `right` e sem `left` tem a largura decidida por shrink-to-fit, e o
          espaço disponível para essa conta é o do CONTAINER — que aqui mede
          44px, o tamanho do mascote. Sem `w-max` o balão encolhia até a maior
          palavra e "Tenho 3 recados 💌" saía em três linhas, com o emoji
          sozinho na última. `max-w` não resolvia: ele limita o teto, e o
          problema era o piso. */}
      {oQueEleDiz && mostrarFala && !calado && (
        <button
          type="button"
          onClick={onAbrir}
          className="dc-fala-entra absolute right-0 top-[calc(100%+0.5rem)] w-max max-w-[min(66vw,17rem)] rounded-2xl rounded-tr-md border border-border bg-card px-3.5 py-2.5 text-left text-[13px] font-medium leading-snug text-foreground shadow-[var(--shadow-card)]"
        >
          {oQueEleDiz.texto}
        </button>
      )}
    </div>
  );
}
