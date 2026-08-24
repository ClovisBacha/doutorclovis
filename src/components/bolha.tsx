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
import orgulhosa from "@/assets/bolha/orgulhosa.webp";
import surpresa from "@/assets/bolha/surpresa.webp";
import estudiosa from "@/assets/bolha/estudiosa.webp";
import exercicio from "@/assets/bolha/exercicio.webp";
import apaixonado from "@/assets/bolha/apaixonado.webp";

/**
 * ─── "PREOCUPADA" SAIU (ago/2026) ───────────────────────────────────────────
 *
 * Existia um quinto humor, com cara triste e uma gota de suor, que aparecia
 * quando a sequência de dias morria. Foi removido a pedido do dono, e a razão
 * já estava escrita no próprio arquivo antes de ele pedir: este app fala com
 * gestante de alto risco, e uma carinha decepcionada por ela ter faltado dois
 * dias é cobrança disfarçada de fofura.
 *
 * Quem some não é só a arte — é o gatilho. `sequenciaPerdida` saiu da
 * assinatura junto, senão sobraria um parâmetro que ninguém lê e o próximo a
 * mexer aqui acharia que ele ainda faz alguma coisa.
 *
 * ─── "ESTUDIOSA", "EXERCÍCIO" E "APAIXONADO" ENTRARAM (ago/2026) ────────────
 *
 * Óculos+capelo+livro pra Aula, faixa de cabelo+halter+bola de pilates pro
 * Mexer, coração-nos-olhos+corações flutuando pro Bebê. NENHUMA das três
 * entra em `humorDaJornada`: as outras cinco respondem "que cara ela faz
 * pelo estado da jornada?", e estas respondem uma pergunta diferente ("o
 * que ela está fazendo agora?"). Ponto de uso escolhe `humor="estudiosa"`/
 * `humor="exercicio"`/`humor="apaixonado"` direto (via `humorFixo` em
 * `BolhaComBalao`) — mesmo padrão que o placar da Aula já usava pra
 * `comemorando`/`orgulhosa`/`feliz` no resultado do quiz, por nota, sem
 * passar pela régua da jornada.
 */
export type Humor =
  | "feliz"
  | "comemorando"
  | "dormindo"
  | "orgulhosa"
  | "surpresa"
  | "estudiosa"
  | "exercicio"
  | "apaixonado";

/**
 * ─── AS ARTES DO BEBÊ BOLHA (ago/2026) ──────────────────────────────────────
 *
 * Oito expressões. A nona, `preocupada`, foi removida — ver o bloco acima.
 *
 * ─── TODAS PARTEM DA MESMA ESFERA ───────────────────────────────────────────
 *
 * `Bolha` desenha a arte num quadrado de `tamanho` e põe a sombra do chão POR
 * FORA da imagem, então o enquadramento é o que impede o personagem de mudar
 * de tamanho e de altura ao trocar de humor — na mesma tela, na mesma bolha.
 * As cinco foram recortadas casando a ESFERA umas das outras (663px de
 * diâmetro, centro em 459×396 na caixa de 960), e não a caixa da imagem: a
 * caixa inclui faíscas, confete e o ZZZ, que estão em lugares diferentes em
 * cada arte, e casar por ela encolheria a esfera para caber os extras.
 *
 * ─── A GRADE É 960, E NÃO 320 ───────────────────────────────────────────────
 *
 * Elas nasceram em 320 porque era o tamanho das artes anteriores — que só
 * apareciam em 44px e 104px. Hoje a maior aparição é `tamanho={298}`, e num
 * iPhone (dsf 3) isso são 894 pixels reais: a arte de 320 era esticada 2,76×,
 * e a bolha aparecia borrada. Medido, não suposto.
 *
 * Em 960 a mesma geometria vale multiplicada por três, e a esfera de 663px sai
 * por REDUÇÃO das fontes (esferas de 803 a 955px, escalas de 0,69 a 0,83) —
 * que é o que preserva o desenho: ampliar inventa pixel, reduzir só descarta.
 * Se um dia a bolha aparecer maior que 320 CSS, esta conta refaz.
 *
 * Onde os extras não cabiam nesse tamanho — o chapéu de festa do
 * `comemorando`, o ZZZ do `dormindo` —, a escala cedeu o mínimo. Bolha um tico
 * menor num humor é melhor que chapéu cortado ao meio.
 *
 * As artes de `comemorando` e `surpresa` chegaram SEM canal alfa e com o
 * quadriculado de transparência PINTADO dentro (artefato do gerador). Ele saiu
 * por preenchimento a partir das bordas, e não por "todo pixel claro vira
 * transparente" — este último furaria os reflexos brancos dentro da bolha.
 *
 * `estudiosa`, `exercicio` e `apaixonado` vieram do Drive, cada uma na sua
 * folha PRÓPRIA (sem as outras do lado), então ganharam script dedicado:
 * `scripts/bolha-do-drive.mjs` isola o MAIOR componente conexo (descarta
 * brilhos e bolhinhas soltas no fundo sozinho) e AJUSTA A ESFERA por
 * mínimos quadrados sobre a maior faixa vertical em que a largura do
 * componente cresce sem saltos — a faixa onde nenhum acessório grudado
 * (capelo, halter, bola de pilates, corações) está alargando a silhueta.
 * Cai nos mesmos 459×396, mas nem sempre nos mesmos 663px: quando os
 * extras são grandes demais pra caber na tela de 960 no tamanho exato (o
 * halter e a bola de `exercicio` sozinhos já ocupam 92% da largura da arte
 * original; os corações de `apaixonado` nos dois lados, 94%), a escala
 * CEDE o mínimo necessário pra nada cortar — mesma regra que já valia, à
 * mão, pro chapéu de festa do `comemorando` e o ZZZ do `dormindo`.
 *
 * ⚠️ NEM TODA ARTE DO DRIVE CHEGA SEM ALFA. `estudiosa` e `exercicio`
 * vieram em RGB, fundo quase-branco, e precisaram do recorte de fundo
 * (porta de croma + rampa de brilho + conexão com a borda) antes de
 * ajustar a esfera. `apaixonado` já chegou com alfa de verdade — o script
 * detecta isso sozinho (`temAlfaReal`, o mesmo teste de
 * `bebes/do-drive.mjs`) e PULA o recorte: reestimar transparência por cima
 * de uma que já é real trocaria uma verdade por uma aproximação pior.
 */
const ARTE: Record<Humor, string> = {
  feliz,
  comemorando,
  dormindo,
  orgulhosa,
  surpresa,
  estudiosa,
  exercicio,
  apaixonado,
};

/**
 * Que cara ela faz, a partir do estado da jornada.
 *
 * A ordem das perguntas é a prioridade emocional, e ela importa: comemorar
 * ganha de tudo, porque é o único instante que a paciente veio buscar.
 *
 * Depois da saída de `preocupada`, NENHUMA cara desta lista é negativa. Isso é
 * a regra e não uma coincidência: o app não tem nada a ganhar fazendo cara
 * feia para uma gestante de alto risco que abriu o aplicativo.
 */
export function humorDaJornada(o: {
  comemorando?: boolean;
  diaFeito?: boolean;
  noite?: boolean;
  /**
   * Ela abriu de MADRUGADA (0h–5h).
   *
   * Não é rotina, e por isso vira surpresa e não preocupação: a bolha se
   * espanta de bom ("olha quem apareceu!"), em vez de estranhar. Quem está
   * acordada às 3h numa gestação de risco não precisa de mais ninguém achando
   * aquilo ruim.
   */
  madrugada?: boolean;
  /** Ela fez muito mais coisa num dia só do que a rotina pede. */
  ritmoIncomum?: boolean;
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
  /* No luto a bolha fica NEUTRA, e é a primeira pergunta de todas.
     Festa não sai, e nem a surpresa da madrugada: às 3h da manhã, para quem
     perdeu a gestação, "olha quem apareceu!" é a última coisa a se dizer. */
  if (o.careMode) return o.noite && o.diaFeito ? "dormindo" : "feliz";
  if (o.comemorando) return "comemorando";
  if (o.noite && o.diaFeito) return "dormindo";
  /* ORGULHOSA — a piscadinha. Fica entre a festa e o repouso: o dia está
     fechado, mas não é o instante da comemoração nem a hora de dormir. É o que
     ela encontra quando VOLTA à tela depois de ter feito tudo. Antes caía em
     `feliz`, a mesma cara de quem ainda não começou — e a bolha deixava de
     reparar no dia dela. */
  if (o.diaFeito) return "orgulhosa";
  /* SURPRESA — o fora do comum, e sempre para o BEM.
     Vem DEPOIS de `diaFeito` de propósito: quem fechou o dia merece a
     piscadinha, que é reconhecimento; a surpresa é para o que ainda está
     acontecendo. Um dia com muita coisa feita ainda em andamento, ou uma
     visita de madrugada, são as duas coisas que fogem da rotina — e nas duas a
     cara certa é o espanto bom, não o estranhamento. */
  if (o.madrugada || o.ritmoIncomum) return "surpresa";
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

/**
 * Quanto ela cresce em cada fase. Cheia no ápice, murcha no fim da expiração.
 *
 * EXPORTADA porque os anéis que a cercam na meditação precisam usar os MESMOS
 * números. Eles tinham amplitude própria (1,00 → 1,34 contra 0,90 → 1,16) e
 * curva própria (suavizada contra linear): medido, aos 13,1 s a bolha tinha
 * andado 26% do percurso e o anel 19%. São dois círculos concêntricos, então
 * qualquer diferença entre eles é vista como um deslizando dentro do outro.
 */
export const ESCALA_RESPIRO: Record<Respiro["fase"], number> = {
  in: 1.16,
  hold: 1.16,
  out: 0.9,
};
const ESCALA = ESCALA_RESPIRO;

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
  /* ─── AS EXPRESSÕES QUE NÃO PODEM APARECER NO LUTO ───────────────────────
     A arte de comemorar tem confete DESENHADO nela: no Modo Cuidado ela não
     pode aparecer nem parada — não é a animação que ofende, é a imagem.

     ⚠️ E `apaixonado` (coração nos olhos) entrou na lista. Ela é usada com
     `humorFixo` na abertura de "Momento com o bebê", e `humorFixo` pula
     `humorJornada` — que é onde o portão de luto mora. Resultado medido: com o
     Modo Cuidado ligado, a bolha aparecia de coração nos olhos sobre "Pra você,
     que eu ainda não vi 💛".

     O comentário do próprio `humorFixo` promete que "mesmo um uso indevido não
     quebra o Modo Cuidado", e a promessa não cobria o único `humorFixo` numa
     tela sobre o bebê. Agora cobre: quem decide o rebaixamento é ESTE
     componente, que é por onde toda arte passa. */
  const PROIBIDAS_NO_LUTO: readonly Humor[] = ["comemorando", "apaixonado"];
  const humorSeguro: Humor = careMode && PROIBIDAS_NO_LUTO.includes(humor) ? "feliz" : humor;

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
