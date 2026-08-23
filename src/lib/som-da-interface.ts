/**
 * SOM DE INTERFACE — e por que ele nasce DESLIGADO.
 *
 * ─── A DECISÃO, E QUEM PAGA O ERRO ──────────────────────────────────────────
 *
 * A favor de nascer LIGADO há um argumento bom: ninguém liga o que nunca ouviu,
 * e recurso desligado por padrão vira código morto — este repositório já tem
 * histórico disso (`proximoDesbloqueio` e `escadaDeTrofeus` escritas e sem
 * chamador, as três conquistas da Escola apontando para uma tabela que nada
 * escrevia). Som também dá confirmação sem olhar, o que serve baixa visão e mão
 * ocupada com o bebê.
 *
 * O que decide é a ASSIMETRIA DE CUSTO. Ligar custa **um toque**. O erro custa
 * **um incidente**, e o incidente é irreversível na prática: um som às 3h da
 * manhã num quarto de hospital compartilhado não produz "ela desliga o som de
 * interface" — produz **"ela silencia o app inteiro nas Configurações do
 * iPhone"**, e esse é o mesmo canal por onde chega o aviso de emergência e o
 * lembrete de consulta.
 *
 *     Quando o custo do falso positivo cai sobre uma pessoa internada e o do
 *     falso negativo cai sobre a métrica de engajamento, o padrão é o silêncio.
 *
 * Três coisas tornam isso não-covarde:
 *
 * • **O HÁPTICO NASCE LIGADO.** Ele é silencioso por natureza, respeita o
 *   interruptor do sistema, e a ponte já existe (`nativo.ts` → `tocarPadrao`).
 *   Ele carrega toda a carga de feedback que o som carregaria, com zero risco
 *   acústico.
 * • **São TRÊS estados, não dois.** Um booleano obrigaria quem quer a deixa da
 *   respiração a aceitar também o toque de botão.
 * • **O SOS não obedece a preferência** — ver `ALARME`.
 *
 * ─── ⚠️ O CRITÉRIO DO QUE MERECE SOM NÃO É IMPORTÂNCIA ──────────────────────
 *
 *     **Som só onde os olhos NÃO estão.**
 *
 * Se a informação já está na tela que ela está olhando, o som é redundância — e
 * redundância repetida é a definição de fadiga. Isso descarta de uma vez a
 * categoria inteira que quase todo app sonoriza: confirmação de toque. Toque de
 * botão, navegação, abrir aba, curtir, salvar, publicar, emblema subindo —
 * nenhum entra, e a razão não é gosto: é que a resposta visual já é instantânea
 * e o som seria o app pedindo atenção para si.
 *
 * ⚠️ **E ERRO NÃO MERECE SOM.** Três razões: o erro já está na tela, em
 * vermelho, no campo; som de erro é PUNITIVO (o buzz descendente é a gramática
 * universal de "você errou", e numa base onde a paciente já está sendo medida
 * clinicamente o app não repreende); e erro é o evento que mais se repete num
 * formulário. Vai para o háptico, que ela sente e ninguém ouve.
 */

import { nota } from "./afinacao";

export type NivelDeSom = "desligado" | "essencial" | "completo";

/** ⚠️ Nasce desligado. Ver a abertura do arquivo. */
export const NIVEL_PADRAO: NivelDeSom = "desligado";

export const CHAVE_NIVEL = "dc-som-ui";

/**
 * As espécies de som que existem. É uma LISTA FECHADA de propósito: cada uma
 * teve de justificar por que os olhos não estão nela.
 */
export type EspecieDeSom =
  /** A deixa da respiração e a troca de fase da meditação. Olhos FECHADOS, por
   *  instrução do próprio app — é o caso mais defensável que existe aqui. */
  | "compasso"
  /** Fim de sessão (meditação, exercício, história). Ela pode estar deitada e
   *  longe da tela, e a alternativa é ficar em dúvida se acabou. */
  | "fim"
  /** Fim de um intervalo do cronômetro de contrações. Mão ocupada,
   *  cronometrando dor: olhar a tela é o que ela menos consegue fazer. */
  | "intervalo"
  /** Dia fechado, troféu, conquista grande. É a recompensa que o jogo constrói. */
  | "conquista"
  /**
   * O TROFÉU — a única animação de cinco segundos e meio do app, e ela era
   * MUDA. O chime do dia toca cerca de um segundo antes e já acabou quando o
   * troféu aparece: a paciente via o clímax em silêncio.
   */
  | "trofeu"
  /**
   * Ganhar Sementinhas. ⚠️ Tem teto agressivo: a moeda cai em seis ou mais
   * pontos por dia, e sem limite isto vira caixa registradora.
   */
  | "moeda"
  /**
   * Guardar — a gratidão do dia, um registro, uma consulta marcada. Um selo,
   * não uma festa: fecha o gesto sem comemorar.
   */
  | "guardado"
  /** ⚠️ SOS enviado. Não é som de interface: é ALARME. Ver `ALARME`. */
  | "sos"
  /** ⚠️ SOS que FALHOU. O único erro do app cuja consequência é clínica. */
  | "sos-falhou";

/**
 * ⚠️ AS DUAS ESPÉCIES QUE IGNORAM A PREFERÊNCIA.
 *
 * O SOS é o único ponto do app em que a confirmação é clínica e a destinatária
 * pode estar em pânico, sem ler a tela. E a FALHA do SOS é o único erro cuja
 * consequência é clínica. Os dois são alarme, não interface — e alarme não
 * pergunta se o som está ligado.
 *
 * ⚠️ Eles também são os únicos que tocam em Modo Cuidado: quem perdeu a
 * gestação continua podendo passar mal.
 */
export const ALARME: readonly EspecieDeSom[] = ["sos", "sos-falhou"];

export function ehAlarme(e: EspecieDeSom): boolean {
  return ALARME.includes(e);
}

/** As espécies que entram no nível `essencial`. As outras pedem `completo`. */
const ESSENCIAIS: readonly EspecieDeSom[] = [
  "compasso",
  "fim",
  "intervalo",
  "guardado",
  "sos",
  "sos-falhou",
];

/**
 * ⚠️ TETO DE FADIGA, e ele é por ESPÉCIE.
 *
 * O mesmo som repetido perde significado e vira incômodo. A conquista é a mais
 * exposta: num dia bom a paciente fecha o dia, ganha troféu e completa um
 * conjunto — três festas. A quarta não acrescenta nada e começa a tirar.
 */
export const TETO_POR_DIA: Partial<Record<EspecieDeSom, number>> = {
  conquista: 3,
  trofeu: 3,
  /**
   * ⚠️ A MOEDA É A MAIS EXPOSTA DE TODAS.
   *
   * A Sementinha cai na aula, nas quatro atividades, no fechamento do dia, no
   * bônus da dupla, no presente, na conquista — seis ou mais vezes por dia. Sem
   * teto, o app vira uma caixa registradora, e a décima moeda não acrescenta
   * nada à nona: acrescenta irritação. Cinco cobre a manhã de uma paciente
   * engajada e cala antes de virar ruído.
   */
  moeda: 5,
  /* Guardar é um gesto que ela repete: diário, registros, gratidão. */
  guardado: 8,
};

export type Contexto = {
  nivel: NivelDeSom;
  careMode: boolean;
  /** `document.visibilityState === "visible"` */
  visivel: boolean;
  /** Quantos milissegundos desde o último toque dela. */
  desdeOGesto: number;
  /** Quantas vezes esta espécie já tocou hoje. */
  jaTocouHoje: number;
  /**
   * ⚠️ ESTÁ DENTRO DE UMA SESSÃO QUE ELA COMEÇOU?
   *
   * Sem isto, `compasso` e `fim` NUNCA TOCAVAM. A deixa da respiração sai de um
   * `setTimeout` catorze a dezesseis segundos depois do último toque, e o fim
   * da sessão sai minutos depois — os dois batiam no portão de gesto e eram
   * barrados, sempre. Os dois sons mais defensáveis do arquivo eram os únicos
   * inalcançáveis, e nenhum teste pegava porque `podeSoar` estava certa: era o
   * CONTEXTO que estava errado.
   *
   * O portão de gesto existe para impedir som vindo de push, de cron ou de
   * temporizador que ela não pediu. Dentro de uma sessão de meditação que ela
   * abriu e está ouvindo de olhos fechados, o som É esperado — e exigir um
   * toque recente seria exigir que ela abrisse os olhos para poder ouvir a
   * deixa que existe para ela não precisar abrir.
   */
  emSessao?: boolean;
  /** A hora local, 0 a 23. Sem ela, o portão da noite não se aplica. */
  hora?: number;
};

/**
 * ⚠️ SEM GESTO RECENTE, NÃO SOA. Som que ela não provocou é som que aparece do
 * nada — e o app tem push, cron e temporizadores que podem disparar sozinhos.
 */
const JANELA_DO_GESTO_MS = 2000;

/**
 * ⚠️ O SILÊNCIO NOTURNO — e ele não é o mesmo que "ela desligou".
 *
 * O argumento central deste arquivo é o quarto de hospital às três da manhã. A
 * primeira versão tinha uma proteção só contra isso: "ela não ligou o som". Mas
 * quem liga de DIA, num momento em que o som faz sentido, leva o som de
 * MADRUGADA junto — e é justamente ali que o estrago acontece.
 *
 * Das 22h às 7h, só o alarme passa. Não é uma preferência a mais: é a hora do
 * dia, que o app já sabe e ela não precisa gerenciar.
 */
const NOITE_COMECA = 22;
const NOITE_ACABA = 7;

export function ehNoite(hora: number): boolean {
  return hora >= NOITE_COMECA || hora < NOITE_ACABA;
}

/**
 * A régua. Pura, e é ela que os testes cobram — nunca o sintetizador.
 */
export function podeSoar(especie: EspecieDeSom, ctx: Contexto): boolean {
  /* O alarme atravessa quase tudo: preferência, Modo Cuidado e o teto. */
  if (ehAlarme(especie)) return true;

  if (ctx.nivel === "desligado") return false;
  if (ctx.careMode) return false;
  /* Das 22h às 7h, só o alarme. Ver `ehNoite`. */
  if (ctx.hora !== undefined && ehNoite(ctx.hora)) return false;
  /* Aba em segundo plano: ela não está aqui, e o som iria para o quarto. */
  if (!ctx.visivel) return false;
  /* Dentro de uma sessão que ela abriu, o relógio do gesto não se aplica —
     ver `emSessao`. */
  if (!ctx.emSessao && ctx.desdeOGesto > JANELA_DO_GESTO_MS) return false;
  if (ctx.nivel === "essencial" && !ESSENCIAIS.includes(especie)) return false;
  const teto = TETO_POR_DIA[especie];
  if (teto !== undefined && ctx.jaTocouHoje >= teto) return false;
  return true;
}

/* ═══════════════════════ Os números ════════════════════════════════════════ */

/**
 * ⚠️ O ATAQUE É O PARÂMETRO MAIS IMPORTANTE DA LISTA.
 *
 * A resposta de sobressalto cai monotonicamente com o tempo de subida entre 2 e
 * 100 ms. **Ataque abaixo de ~15 ms é a diferença entre informar e assustar** —
 * e assustar uma gestante de alto risco é o oposto do trabalho de todo este
 * arquivo. Nenhum som daqui sobe em menos de 20 ms.
 */
const ATAQUE_MINIMO = 0.02;

/**
 * ⚠️ E A FAIXA DE 2–4 kHz É RESERVADA AO ALARME.
 *
 * O pico de sensibilidade do ouvido está entre 2 e 5 kHz (ressonância do canal
 * auditivo), e é por isso que a IEC 60601-1-8 exige que um alarme médico tenha
 * harmônicos ali. Som de interface que colocar energia nessa faixa está tomando
 * emprestado o timbre de emergência — e este app tem um alarme de verdade.
 *
 * ⚠️ Também não se desce demais: o alto-falante do iPhone cai forte abaixo de
 * ~500 Hz, então um som "escuro" com fundamental em 200 Hz fica quase inaudível
 * no viva-voz e ALTO no fone. **A escuridão vem do filtro, não do fundamental.**
 */
export const TETO_HZ = 1100;

/**
 * As notas, na grade de A = 432 e na pentatônica menor de lá.
 *
 * ⚠️ A escala não é decoração: é a única em que nenhum par forma segunda menor
 * nem trítono (ver o teorema em `musica.ts`), então dois sons que se sobreponham
 * por acidente continuam consonantes. Num app, sobreposição acidental é o caso
 * comum, não o raro.
 */
const N = {
  la4: nota("la", 4),
  do5: nota("do", 5),
  re5: nota("re", 5),
  mi5: nota("mi", 5),
  sol5: nota("sol", 5),
  la5: nota("la", 5),
  do6: nota("do", 6),
};

export type Desenho = {
  /** Cada passo: frequência, quando começa, quanto dura. */
  passos: { hz: number; em: number; dur: number }[];
  ataque: number;
  /** Corte do passa-baixa — é ele que dá a cor, não o fundamental. */
  corte: number;
  ganho: number;
};

/**
 * O desenho de cada espécie.
 *
 * Três classes, e a duração é o que as separa: **tique** (uso frequente, 50 a
 * 80 ms, uma nota), **confirmação** (160 a 240 ms, duas notas) e **conquista**
 * (600 a 900 ms, escada de três a quatro).
 */
export const DESENHOS: Record<EspecieDeSom, Desenho> = {
  compasso: {
    passos: [{ hz: N.la4, em: 0, dur: 0.09 }],
    ataque: 0.025,
    corte: 900,
    ganho: 0.16,
  },
  intervalo: {
    passos: [{ hz: N.mi5, em: 0, dur: 0.05 }],
    ataque: ATAQUE_MINIMO,
    corte: 1100,
    ganho: 0.2,
  },
  fim: {
    /* Descendente: o gesto universal de "chegamos", e o oposto do alarme, que
       sobe. */
    passos: [
      { hz: N.sol5, em: 0, dur: 0.12 },
      { hz: N.do5, em: 0.09, dur: 0.16 },
    ],
    ataque: 0.025,
    corte: 1000,
    ganho: 0.18,
  },
  conquista: {
    passos: [
      { hz: N.do5, em: 0, dur: 0.2 },
      { hz: N.mi5, em: 0.09, dur: 0.2 },
      { hz: N.sol5, em: 0.18, dur: 0.24 },
      { hz: N.do6, em: 0.27, dur: 0.38 },
    ],
    ataque: 0.03,
    corte: 1100,
    ganho: 0.2,
  },
  /**
   * ⚠️ O SOS É O ÚNICO QUE SOBE, e o que o separa do resto é o BRILHO — não o
   * fundamental.
   *
   * A prosa anterior dizia que ele era "o único acima do teto de 1100 Hz", e a
   * bancada desmentiu na primeira foto: as notas dele são 432 e 864 Hz, as duas
   * bem abaixo do teto. O que atravessa a faixa reservada ao alarme é o CORTE
   * do filtro (2600 Hz contra 900–1100 dos outros), que deixa passar os
   * harmônicos — exatamente a faixa de 2 a 4 kHz onde o ouvido é mais sensível
   * e onde a IEC 60601-1-8 manda um alarme médico ter energia.
   *
   * E a direção é o outro sinal: SOBE. Descer é o vocabulário de "pronto";
   * subir é o de "chegou". Trocar os dois faria a confirmação do socorro soar
   * como o fim de um exercício de alongamento.
   */
  /**
   * O TROFÉU: quatro degraus subindo mais lentos e mais longos que a conquista.
   *
   * ⚠️ Ele é mais LENTO de propósito. A animação dura 5,5 s e constrói o troféu
   * quadro a quadro; um arpejo rápido acabaria antes do desenho e deixaria os
   * últimos quatro segundos em silêncio — que é o defeito que ele veio
   * consertar, só que menor.
   */
  trofeu: {
    passos: [
      { hz: N.la4, em: 0, dur: 0.5 },
      { hz: N.do5, em: 0.28, dur: 0.5 },
      { hz: N.mi5, em: 0.56, dur: 0.55 },
      { hz: N.la5, em: 0.84, dur: 0.9 },
    ],
    ataque: 0.04,
    corte: 1100,
    ganho: 0.2,
  },
  /**
   * A MOEDA: um tique curtíssimo, duas notas, quase sem cauda.
   *
   * ⚠️ Curto porque ele repete. Tudo que soa muitas vezes por dia tem de caber
   * embaixo da atenção — a nota informa e some, sem pedir nada.
   */
  moeda: {
    passos: [
      { hz: N.mi5, em: 0, dur: 0.05 },
      { hz: N.la5, em: 0.04, dur: 0.09 },
    ],
    ataque: 0.02,
    corte: 1100,
    ganho: 0.13,
  },
  /**
   * GUARDADO: uma nota só, grave, com cauda. É um selo, não uma festa.
   *
   * ⚠️ E ela DESCE em relação ao compasso, não sobe: guardar é fechar. Se
   * subisse, leria como "conseguiu!", e a paciente que escreveu uma gratidão
   * difícil não conseguiu nada — ela guardou.
   */
  guardado: {
    passos: [{ hz: N.do5, em: 0, dur: 0.28 }],
    ataque: 0.03,
    corte: 850,
    ganho: 0.15,
  },
  sos: {
    passos: [
      { hz: N.la4, em: 0, dur: 0.16 },
      { hz: N.la5, em: 0.14, dur: 0.3 },
    ],
    ataque: 0.025,
    corte: 2600,
    ganho: 0.28,
  },
  "sos-falhou": {
    /* Descendente, repetido, e mais grave. Não é punição: é "não chegou, tente
       de novo", e precisa ser distinguível do sucesso sem olhar. */
    passos: [
      { hz: N.re5, em: 0, dur: 0.18 },
      { hz: N.la4, em: 0.16, dur: 0.22 },
      { hz: N.re5, em: 0.42, dur: 0.18 },
      { hz: N.la4, em: 0.58, dur: 0.28 },
    ],
    ataque: 0.025,
    corte: 1800,
    ganho: 0.26,
  },
};

/* ═══════════════════════ O sintetizador ════════════════════════════════════ */

let ctxCache: AudioContext | null = null;
let dormir: ReturnType<typeof setTimeout> | null = null;

/**
 * ⚠️ O CONTEXTO DE INTERFACE FECHA SOZINHO — e antes ele vivia para sempre.
 *
 * Ele nascia na primeira notinha e ficava aberto pela vida da aba. Um
 * `AudioContext` vivo mantém a sessão de áudio do sistema ATIVA, que é
 * exatamente o que `sessao-de-audio.ts` existe para não deixar acontecer — o
 * arquivo inteiro fala em devolver a sessão ao repouso, e este contexto a
 * segurava por baixo. E nenhum `stop()` o alcançava: ele não pertence a tela
 * nenhuma.
 *
 * Oito segundos de folga cobrem qualquer sequência de sons de interface (o mais
 * longo tem 0,9 s) e são curtos o bastante para o aparelho voltar ao repouso
 * logo depois. Reabrir custa poucos milissegundos.
 */
const OCIOSO_MS = 8000;

function adiarFechamento() {
  if (dormir) clearTimeout(dormir);
  dormir = setTimeout(() => {
    dormir = null;
    const meu = ctxCache;
    ctxCache = null;
    try {
      void meu?.close();
    } catch {
      /* ignore */
    }
  }, OCIOSO_MS);
}

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctxCache && ctxCache.state !== "closed") {
    adiarFechamento();
    return ctxCache;
  }
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctxCache = new AC();
    adiarFechamento();
    return ctxCache;
  } catch {
    return null;
  }
}

/**
 * Cria e acorda o contexto AGORA, sem tocar nada.
 *
 * ⚠️ Serve para ser chamada no prefixo síncrono de um toque que só vai produzir
 * som depois de esperas — o SOS é o caso. Depois de um `await` o gesto já
 * passou, e o iOS recusa o contexto em silêncio.
 */
export function destravar(): void {
  const ctx = contexto();
  if (!ctx) return;
  try {
    void ctx.resume().catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Toca. Quem decide SE toca é `podeSoar` — esta função só desenha.
 *
 * ⚠️ **Sempre Web Audio, nunca `<audio>`.** Elemento de mídia ignora o botão de
 * silêncio do iPhone e faz a sessão de áudio escalar para `playback`, que
 * contamina tudo o que vier depois. Ver `sessao-de-audio.ts`.
 */
export function desenhar(especie: EspecieDeSom): void {
  const ctx = contexto();
  if (!ctx) return;
  try {
    void ctx.resume().catch(() => {});
    const d = DESENHOS[especie];
    const t0 = ctx.currentTime + 0.02;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = d.corte;
    /* Butterworth: sem pico de ressonância. Um filtro com Q = 1 (o padrão)
       levantaria justamente a banda logo abaixo do corte. */
    lp.Q.value = 0.707;
    const mestre = ctx.createGain();
    mestre.gain.value = d.ganho;
    lp.connect(mestre).connect(ctx.destination);

    for (const p of d.passos) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = p.hz;
      /* A segunda harmônica a −18 dB dá corpo sem brilho. Mais que isso põe
         energia na faixa do alarme. */
      const h = ctx.createOscillator();
      h.type = "sine";
      h.frequency.value = p.hz * 2;
      const hg = ctx.createGain();
      hg.gain.value = 0.125;
      const g = ctx.createGain();
      const em = t0 + p.em;
      g.gain.setValueAtTime(0.0001, em);
      g.gain.linearRampToValueAtTime(1, em + d.ataque);
      g.gain.exponentialRampToValueAtTime(0.0001, em + p.dur);
      g.gain.setValueAtTime(0, em + p.dur);
      o.connect(g);
      h.connect(hg).connect(g);
      g.connect(lp);
      o.start(em);
      /* ⚠️ 20 ms depois do zero: parar um oscilador com ganho ainda acima de
         zero é o clique clássico. */
      o.stop(em + p.dur + 0.02);
      h.start(em);
      h.stop(em + p.dur + 0.02);
      o.onended = () => {
        try {
          o.disconnect();
          h.disconnect();
          g.disconnect();
        } catch {
          /* ignore */
        }
      };
    }
  } catch {
    /* sem áudio: a tela nunca quebra */
  }
}

/**
 * A ESCADA DA CONQUISTA, com o número de degraus pedido.
 *
 * ⚠️ Vive aqui, e não em `celebrate.ts`, porque a AFINAÇÃO tem de ser uma só —
 * era exatamente a divergência que este trabalho veio consertar. `celebrate.ts`
 * desenha confete e vibra; a nota é assunto daqui.
 */
export function tocarConquista(degraus: number): void {
  const ctx = contexto();
  if (!ctx) return;
  try {
    void ctx.resume().catch(() => {});
    /* A pentatônica de lá, subindo. Cinco degraus cobrem uma oitava e meia —
       além disso a escada passaria do teto de 1100 Hz e entraria na faixa
       reservada ao alarme. */
    const escada = [N.la4, N.do5, N.re5, N.mi5, N.sol5, N.la5];
    const passos = escada.slice(0, Math.max(2, Math.min(escada.length, degraus)));
    const d = DESENHOS.conquista;
    const t0 = ctx.currentTime + 0.02;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = d.corte;
    lp.Q.value = 0.707;
    const mestre = ctx.createGain();
    mestre.gain.value = d.ganho;
    lp.connect(mestre).connect(ctx.destination);
    passos.forEach((hz, i) => {
      const o = ctx.createOscillator();
      /* Triângulo, como era antes: harmônicos ímpares fracos, que o filtro
         molda. O timbre da festa não mudou — mudou a afinação dele. */
      o.type = "triangle";
      o.frequency.value = hz;
      const g = ctx.createGain();
      const em = t0 + i * 0.09;
      const dur = i === passos.length - 1 ? 0.42 : 0.3;
      g.gain.setValueAtTime(0.0001, em);
      g.gain.linearRampToValueAtTime(1, em + d.ataque);
      g.gain.exponentialRampToValueAtTime(0.0001, em + dur);
      g.gain.setValueAtTime(0, em + dur);
      o.connect(g).connect(lp);
      o.start(em);
      o.stop(em + dur + 0.02);
      o.onended = () => {
        try {
          o.disconnect();
          g.disconnect();
        } catch {
          /* ignore */
        }
      };
    });
  } catch {
    /* sem áudio */
  }
}
