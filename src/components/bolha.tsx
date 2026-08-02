/**
 * O mascote da jornada — a própria bolha do app, viva.
 *
 * Ela existe para resolver o buraco maior da gamificação: não havia
 * personagem. O Duolingo tem o Duo, o Candy Crush tem a Tiffi, e a Obstétrica
 * tinha um ursinho emoji que cada celular desenhava de um jeito. O símbolo já
 * estava em toda tela; faltava dar rosto a ele.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE PRODUZ "PERSONAGEM VIVO" — e não é 3D
 *
 * O Duo é vetor chapado animado com esqueleto; a Tiffi é sprite 3D
 * pré-renderizado. Nenhum dos dois roda motor 3D no celular. O que produz a
 * sensação são princípios de animação, e estes seis estão implementados aqui:
 *
 *  1. ANTECIPAÇÃO — todo movimento começa com um movimento CONTRÁRIO. Antes de
 *     pular ela agacha. É o princípio mais ausente em animação de interface e
 *     o que mais separa "se mexe" de "está viva": sem ele o objeto parece
 *     teletransportado, porque a força que o move nunca aparece.
 *
 *  2. ESMAGA E ESTICA com volume constante — ao achatar ela ALARGA, ao esticar
 *     ela AFINA. Sem isso o objeto parece encolher, não deformar.
 *
 *  3. AMORTECIMENTO — nada para de vez. Cada oscilação é menor que a anterior,
 *     e é essa progressão que o olho lê como matéria. Volta única ao repouso lê
 *     como interpolação de software.
 *
 *  4. PESO — a sombra encolhe e clareia quando ela sobe, espalha e escurece
 *     quando desce. Objeto que flutua com sombra fixa parece adesivo.
 *
 *  5. AÇÃO SECUNDÁRIA — a iridescência desliza sozinha, num período que não
 *     conversa com nenhum outro. É o que uma bolha de sabão faz de verdade.
 *
 *  6. OCIOSIDADE QUE NÃO SE REPETE — dois ciclos de períodos incomensuráveis.
 *     Laço perfeito o olho decora em segundos, e aí passa a ler "GIF".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE QUATRO CAMADAS DE ELEMENTO
 *
 * CSS aplica UMA animação por propriedade: duas animações escrevendo
 * `transform` no mesmo elemento fazem a última declarada vencer, e a outra
 * simplesmente não acontece. Com flutuar, tocar, pular e respirar todos
 * querendo `transform`, empilhar num elemento só é impossível — e foi por isso
 * que, até aqui, cada animação nova exigia desligar outra.
 *
 * Então cada camada carrega UMA transformação, e elas se compõem pela árvore —
 * que é o que um rig de ossos faz num software de animação:
 *
 *   .bolha-viva            gira      (inclinação ociosa · negar)
 *     └ .bolha-palco       translada (flutuar · pular · atenção)
 *         └ .bolha-brilho  filtra    (iridescência)
 *             └ .bolha-corpo escala  (tocar · respirar · chegar)
 *
 * A iridescência ganhou camada própria depois de uma medição: `animation:`
 * substitui a lista inteira MESMO quando as duas animam propriedades
 * diferentes, então ela morria toda vez que uma ação escrevia `animation` no
 * corpo. `getAnimations()` durante o `chegar` não a encontrava — o princípio
 * nº 5 estava desligado em três das cinco interações, em silêncio.
 *
 * A sombra fica FORA das quatro: ela precisa encolher enquanto o corpo estica,
 * e dentro dele herdaria a mesma deformação — o oposto do que dá peso.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import feliz from "@/assets/bolha/feliz.webp";
import comemorando from "@/assets/bolha/comemorando.webp";
import dormindo from "@/assets/bolha/dormindo.webp";
import preocupada from "@/assets/bolha/preocupada.webp";

export type Humor = "feliz" | "comemorando" | "dormindo" | "preocupada";

const ARTE: Record<Humor, string> = { feliz, comemorando, dormindo, preocupada };

/**
 * Que cara ela faz, a partir do estado da jornada.
 *
 * A ordem das perguntas é a prioridade emocional, e ela importa: comemorar
 * ganha de tudo, porque é o único instante que a paciente veio buscar. A cara
 * preocupada só aparece quando a sequência já morreu — nunca como cobrança de
 * quem está em dia, o que seria pressão num público que não precisa de mais.
 */
export function humorDaJornada(o: {
  comemorando?: boolean;
  diaFeito?: boolean;
  sequenciaPerdida?: boolean;
  noite?: boolean;
  /**
   * Modo Cuidado — a paciente perdeu a gestação.
   *
   * Entra na ASSINATURA, e não só nos pontos de uso, porque sem ele nenhum
   * chamador *pode* estar certo: quem esquecer de filtrar não recebe erro
   * nenhum, e o sintoma aparece no pior lugar imaginável. Com o campo aqui, o
   * tipo obriga a decisão a ser tomada.
   */
  careMode?: boolean;
}): Humor {
  /* No luto, festa e cobrança somem juntas. "preocupada" seria pior ainda que
     "comemorando": cara triste por sequência quebrada, para quem parou de
     abrir o app porque enterrou um filho. */
  if (o.careMode) return o.noite && o.diaFeito ? "dormindo" : "feliz";
  if (o.comemorando) return "comemorando";
  if (o.sequenciaPerdida) return "preocupada";
  if (o.noite && o.diaFeito) return "dormindo";
  return "feliz";
}

/**
 * Ela respirando junto com a paciente.
 *
 * `fase` é a fase do ciclo e `duracaoMs` é quanto aquela fase dura — a mesma
 * duração que move o som e a vibração. Passar isso faz a bolha inflar e
 * esvaziar NO COMPASSO, em vez de flutuar num laço próprio.
 *
 * O papel dela aqui é CONFIRMAR, não instruir. Quem conduz de olhos fechados é
 * o som (e a vibração, onde existe); ela é o que a paciente encontra quando
 * abre o olho para conferir se ainda está junto.
 */
export type Respiro = { fase: "in" | "hold" | "out"; duracaoMs: number };

/** Quanto ela cresce em cada fase. Cheia no ápice, murcha no fim da expiração. */
const ESCALA: Record<Respiro["fase"], number> = { in: 1.16, hold: 1.16, out: 0.9 };

/**
 * As ações de um disparo só.
 *
 * `pulo`    comemoração — agacha, salta, aterrissa e assenta em três quiques
 * `nao`     erro ou recusa — nega com a cabeça, amortecido
 * `chega`   entrada em cena — surge pequena e passa do ponto antes de assentar
 * `atencao` chamado discreto — um cutucão para quem parou de olhar
 */
export type Acao = "pulo" | "nao" | "chega" | "atencao";

/**
 * Quanto dura cada ação, em milissegundos.
 *
 * Tem que bater com a `animation-duration` do CSS: é este número que decide
 * quando a classe sai. Curto demais e a animação é cortada no meio; longo
 * demais e a bolha fica travada sem flutuar depois de terminar. O teste lê o
 * CSS e compara com esta tabela, porque as duas metades moram em arquivos
 * diferentes e nada além do teste as mantém juntas.
 */
export const DURACAO_ACAO: Record<Acao, number> = {
  pulo: 900,
  nao: 620,
  chega: 720,
  atencao: 800,
};

export type BolhaHandle = {
  /** Comemora: agacha, salta e assenta amortecido. */
  pular(): void;
  /** Nega com a cabeça — para erro, recusa, "ainda não". */
  negar(): void;
  /** Entra em cena passando do ponto. */
  chegar(): void;
  /** Cutuca de leve quem parou de olhar. */
  chamar(): void;
};

type Props = {
  humor?: Humor;
  tamanho?: number;
  flutua?: boolean;
  respiro?: Respiro;
  /**
   * Desliga a iridescência viva.
   *
   * MEDIDO, porque a versão anterior deste comentário estava errada: eu tinha
   * escrito que `filter` não é composto. É — o Chrome e o Safari compõem
   * animação de filtro quando a lista tem a mesma estrutura em todos os
   * quadros, e `hue-rotate()+saturate()` tem. (O Firefox não, mas é ~1% no
   * Android brasileiro.)
   *
   * O custo é real e é OUTRO: `filter` animado exige uma render surface, então
   * a camada é desenhada fora da tela e a matriz de cor é aplicada a cada
   * quadro. Isso é fill-rate de GPU, não trabalho de main thread — e é caro:
   * medido em 2,2x o custo da bolha inteira sem ele. Com 6 bolhas, +34% de CPU
   * do processo de GPU.
   *
   * O motivo certo importa porque leva à decisão certa: como o gargalo é GPU e
   * não main thread, estrangular a CPU não revela o problema, e o limite não é
   * "aparelho lento" e sim "muitas bolhas". Medido a 6x: com iris cabem ~12–16
   * numa tela, sem iris ~24–32.
   *
   * O app nunca põe mais de duas bolhas na mesma tela, então hoje isto é uma
   * válvula fechada — existe para o dia em que uma lista aparecer.
   */
  semIris?: boolean;
  /**
   * Uma ação disparada uma vez, ao entrar em cena.
   *
   * Existe para o caso mais comum de todos — ela aparece e comemora — sem que
   * cada ponto de uso tenha que montar `ref` + `useEffect`. Trabalho repetido
   * em quatro lugares é trabalho que um deles vai esquecer, e o sintoma seria
   * uma tela de vitória com a personagem parada.
   */
  entrada?: Acao;
  /**
   * Modo Cuidado — a paciente perdeu a gestação.
   *
   * O portão mora AQUI, no componente, e não em cada ponto de uso. A versão
   * anterior confiava no chamador, e o chamador esqueceu: a tela de fim da
   * respiração escrevia `{!careMode && <ConfettiBurst />}` numa linha e
   * `<Bolha humor="comemorando" entrada="pulo" />` na linha seguinte. O app
   * respeitava o luto em oito lugares e falhava no único que tem rosto.
   *
   * Com Modo Cuidado ligado:
   *  · `comemorando` vira `feliz` — e isso importa duas vezes, porque a arte
   *    de comemorar tem CONFETE PINTADO DENTRO DELA. Suprimir o confete do DOM
   *    e desenhá-lo no PNG é o mesmo defeito duas vezes.
   *  · o `pulo` não sai, nem por `entrada` nem pelo `ref`.
   *
   * O que continua: negar, chegar, chamar, o toque, o flutuar. Nada disso é
   * festa — tirar tudo deixaria a personagem morta justamente para quem mais
   * precisa de companhia.
   */
  careMode?: boolean;
  className?: string;
};

export const Bolha = forwardRef<BolhaHandle, Props>(function Bolha(
  {
    humor = "feliz",
    tamanho = 64,
    flutua = true,
    respiro,
    semIris = false,
    entrada,
    careMode = false,
    className = "",
  },
  ref,
) {
  const [apertada, setApertada] = useState(false);
  const [acao, setAcao] = useState<Acao | null>(null);
  const solta = useRef<number | null>(null);
  const fimAcao = useRef<number | null>(null);
  const quadro = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (solta.current) clearTimeout(solta.current);
      if (fimAcao.current) clearTimeout(fimAcao.current);
      if (quadro.current) cancelAnimationFrame(quadro.current);
    },
    [],
  );

  /**
   * Dispara uma ação, reiniciando se ela já estiver rodando.
   *
   * O `setAcao(null)` seguido de `requestAnimationFrame` existe porque CSS não
   * reinicia uma animação quando a classe continua a mesma: pedir "pula" duas
   * vezes seguidas não faria nada na segunda — e "de novo!" é justamente o que
   * uma criança (e uma gestante ansiosa) faz com um personagem que responde.
   * Tirar a classe, deixar o navegador desenhar um quadro, e pôr de volta é o
   * que força o reinício.
   */
  const disparar = useCallback(
    (qual: Acao) => {
      /* O pulo é a comemoração. No luto ele não sai — nem por `entrada`, nem
         pelo `ref`, nem por um ponto de uso novo que ninguém revisou. */
      if (careMode && qual === "pulo") return;
      if (fimAcao.current) clearTimeout(fimAcao.current);
      /* Cancelar o QUADRO pendente, e não só o timer.
         `fimAcao.current` só é escrito dentro do `rAF`. Numa rajada síncrona —
         toques rápidos, que é o que se faz com um personagem que responde — os
         N `clearTimeout` rodam antes de qualquer quadro e não cancelam nada;
         depois os N callbacks criam N timers dos quais só o último fica
         rastreado. Medido: 200 cliques numa tarefa só deixaram 201 timers
         órfãos, cada um disparando um `setState` na sequência. Não vazava (todos
         morriam em ~940ms) mas engasgava celular fraco, e a limpeza de
         desmontagem cancelava só um. */
      if (quadro.current) cancelAnimationFrame(quadro.current);
      setAcao(null);
      quadro.current = requestAnimationFrame(() => {
        quadro.current = null;
        setAcao(qual);
        fimAcao.current = window.setTimeout(() => setAcao(null), DURACAO_ACAO[qual] + 40);
      });
    },
    [careMode],
  );

  /* Só na montagem. A dependência é `[]` de propósito: trocar `entrada` no meio
     da vida do componente não deve redisparar — quem quer disparar de novo tem
     o `ref`, que é explícito. */
  useEffect(() => {
    if (entrada) disparar(entrada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      pular: () => disparar("pulo"),
      negar: () => disparar("nao"),
      chegar: () => disparar("chega"),
      chamar: () => disparar("atencao"),
    }),
    [disparar],
  );

  /** O toque só existe para dar retorno físico — quem navega é o pai. */
  function tocar() {
    setApertada(true);
    if (solta.current) clearTimeout(solta.current);
    solta.current = window.setTimeout(() => setApertada(false), 520);
  }

  /* Respirando, o flutuar SAI: os dois transladam, e o compasso tem que mandar.
     Pulo e atenção também transladam, então tiram o flutuar enquanto duram. */
  /* A arte de comemorar tem confete DESENHADO nela. No Modo Cuidado ela não
     pode aparecer nem parada — não é a animação que ofende, é a imagem. */
  const humorSeguro: Humor = careMode && humor === "comemorando" ? "feliz" : humor;

  const respirando = !!respiro;
  const escala = respiro ? ESCALA[respiro.fase] : 1;
  const flutuando = flutua && !respirando && acao !== "pulo" && acao !== "atencao";

  const classes = [
    "bolha-viva",
    flutuando ? "bolha-flutua" : "",
    respirando ? "bolha-respira" : "",
    /* Respirando, o toque não deforma: um esmagamento de meio segundo por cima
       de uma inspiração de quatro quebraria a única referência visual que a
       paciente tem quando abre o olho para conferir. */
    apertada && !respirando ? "bolha-apertada" : "",
    acao ? `bolha-${acao}` : "",
    semIris ? "" : "bolha-iris",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  /**
   * A respiração sai por VARIÁVEIS, não por `transform` inline.
   *
   * O motivo é um defeito medido. `styles.css` tem uma regra universal
   * `*{ transition-duration: 0.001ms !important }` sob
   * `prefers-reduced-motion`, e estilo inline NÃO vence `!important` de folha.
   * Com a preferência ligada, a escala de 0,9 a 1,16 continuava acontecendo
   * POR INTEIRO — só que num quadro só: 27 px de salto seco numa bolha de
   * 104 px, três vezes por ciclo, cinco ciclos = 15 cortes por sessão.
   *
   * Ou seja: quem ligou "menos movimento" por causa de enjoo recebia o
   * ESTÍMULO MAIS AGRESSIVO da tela inteira. Perdia a guia (o inchar contínuo
   * que ela acompanha) e ganhava um susto.
   *
   * Com o valor numa variável, a folha decide — e pode reafirmar a duração com
   * `!important` e trocar a amplitude por uma menor. A respiração guiada é
   * CONTEÚDO, não enfeite: ela tem que sobreviver ao "menos movimento" com
   * amplitude reduzida, não sumir nem virar corte.
   */
  const varsRespiro = respiro
    ? ({
        "--respiro-ms": `${respiro.duracaoMs}ms`,
        "--respiro-escala": escala,
        /* 35% do curso: ~9px em 4s numa bolha de 104. Legível como respiração,
           invisível como movimento. */
        "--respiro-escala-suave": 1 + (escala - 1) * 0.35,
        /* A sombra acompanha MENOS que o corpo (0,45 do excesso). Uma sombra
           que cresce igual ao objeto lê como zoom da câmera; crescer menos lê
           como o objeto inchando sobre o mesmo chão. */
        "--respiro-sombra": 1 + (escala - 1) * 0.45,
        "--respiro-sombra-op": 0.5 + (escala - 0.9) * 0.5,
      } as React.CSSProperties)
    : undefined;

  return (
    <span
      className={classes}
      style={{ width: tamanho, height: tamanho, ...varsRespiro }}
      onPointerDown={tocar}
      aria-hidden
    >
      {/* A sombra é irmã das três camadas, não filha: precisa encolher enquanto
          o corpo estica, e dentro dele herdaria a mesma deformação. */}
      <span className="bolha-sombra" />
      <span className="bolha-palco">
        {/* Quarta camada, só para a iridescência.
            `animation:` substitui a LISTA INTEIRA, mesmo quando as duas animam
            propriedades diferentes — então a iridescência (que anima `filter`)
            morria toda vez que uma ação escrevia `animation` no corpo. Medido
            com `getAnimations()`: durante o `chegar` ela simplesmente não
            estava lá. Uma camada própria é a única forma de as duas coexistirem,
            e é a mesma regra das outras três: uma animação por elemento. */}
        <span className="bolha-brilho">
          <img className="bolha-corpo" src={ARTE[humorSeguro]} alt="" draggable={false} />
        </span>
      </span>
    </span>
  );
});
