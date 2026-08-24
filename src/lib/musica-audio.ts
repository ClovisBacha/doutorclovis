/**
 * A MÚSICA — o grafo. A régua mora em `musica.ts`.
 *
 * O que este arquivo faz é montar, ao vivo, o que o arco descreve: um drone
 * que sustenta a cor da janela, seis vozes de sino entrando em períodos primos,
 * e uma sala em volta. Nenhum arquivo de áudio.
 *
 * ⚠️ **A CAUDA TEM DE SOBREVIVER AO FIM.** A reverberação continua uns segundos
 * depois do último som; derrubar o contexto no instante final CORTA essa cauda.
 * É literalmente o mesmo defeito que o `volta-1.mp3` da meditação já teve e que
 * está registrado no CLAUDE.md — a frase de fechamento aparecia na tela e não
 * era falada porque o canal era cortado no segundo exato em que ela começava.
 * O conserto aqui é o mesmo de lá: o que é PULSO morre na hora; o que é CAUDA
 * termina sozinho.
 */

import { arcoDaMusica, eventosDoTrecho, hzDoGrau, type Trecho } from "./musica";
import { CICLO } from "./meditacao-sessao";

export type Musica = {
  start: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
  pausar: () => void;
  retomar: () => Promise<boolean>;
};

const MUDA: Musica = {
  start: () => {},
  stop: () => {},
  setVolume: () => {},
  pausar: () => {},
  retomar: async () => true,
};

/**
 * ⚠️ NUNCA AGENDAR "AGORA".
 *
 * Um evento marcado para `ctx.currentTime` pode cair no bloco de render que já
 * está sendo processado, e aí o navegador o executa imediatamente, ignorando a
 * rampa de ataque — que é exatamente um clique. Cinquenta milissegundos de
 * folga resolvem e ninguém percebe.
 */
const FOLGA = 0.05;

/** De quanto em quanto tempo se agenda o próximo pedaço. */
const JANELA_SEGS = 12;

/**
 * ⚠️ TUDO É SENOIDE, E ISSO É MEDÍVEL.
 *
 * Um dente de serra a 108 Hz tem o 11º parcial em 1188 Hz; uma voz em dó 5
 * (513,7 Hz) tem o 2º em 1027 Hz. A distância entre os dois é 161 Hz, e a banda
 * crítica perto de 1100 Hz vale ~162 Hz — ou seja, **exatamente o máximo de
 * aspereza**. Ondas ricas fazem vozes consonantes soarem ásperas por trás, e o
 * ouvido não sabe dizer de onde vem o incômodo.
 *
 * A regra: nenhuma voz que possa soar junto de outra passa do 6º parcial.
 */
function ondaDoDrone(ctx: BaseAudioContext): PeriodicWave {
  /* Amplitudes ≈ 1/n^1,4 — cai rápido, então o timbre tem corpo sem brilho. */
  const amps = [0, 1, 0.5, 0.28, 0.16, 0.09];
  const real = new Float32Array(amps.length);
  const imag = new Float32Array(amps);
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
}

/**
 * ⚠️ O SINO: cinco parciais, e DOIS DELES SÃO INARMÔNICOS.
 *
 * 1 · 2 · 3 · 4,2 · 5,4. Os dois últimos não pertencem a harmônico nenhum — é
 * isso que faz o ouvido ler OBJETO PERCUTIDO em vez de nota de sintetizador.
 *
 * ⚠️ E eles morrem antes de virar altura: 0,80 s e 0,50 s contra 7 s da
 * fundamental. Sub-segundo, o ouvido lê como COR DE ATAQUE, não como nota — e
 * por isso eles não entram na conta de dissonância. Se durassem, entrariam, e
 * aí a escala segura deixaria de ser segura.
 *
 * "Os agudos morrem primeiro" é a assinatura de tudo que é percutido.
 */
const PARCIAIS_SINO = [
  { razao: 1, amp: 1, ataque: 0.18, cai: 7 },
  { razao: 2, amp: 0.4, ataque: 0.1, cai: 4 },
  { razao: 3, amp: 0.2, ataque: 0.06, cai: 2.5 },
  { razao: 4.2, amp: 0.12, ataque: 0.03, cai: 0.8 },
  { razao: 5.4, amp: 0.07, ataque: 0.03, cai: 0.5 },
];

/**
 * ⚠️ A SALA É CONVOLUÇÃO, E ISSO CONTRARIA A RECOMENDAÇÃO — POR MEDIÇÃO.
 *
 * O desenho recomendado era o clássico de Schroeder: quatro atrasos
 * realimentados em paralelo, com um passa-baixa dentro do laço para o agudo
 * morrer primeiro. É o desenho certo em quase todo lugar, e aqui ele NÃO
 * FUNCIONA. Medido, com o próprio navegador nomeando o culpado
 * ("BiquadFilterNode: state is bad, probably due to unstable filter"):
 *
 *     Q = 1,00 · realimentação 0,90  →  NaN aos 35,4 s
 *     Q = 0,707 · realimentação 0,85  →  pico 4,5 × 10²⁸ aos 120 s, NaN aos 157
 *     Q = 0,50 · realimentação 0,85  →  pico 2,3 × 10⁸
 *     Q = 0,707 · realimentação 0,70  →  pico 0,567, estável
 *
 * A primeira leitura foi que o Q do passa-baixa era o culpado — um passa-baixa
 * com Q = 1 (o padrão do `BiquadFilterNode`) tem pico de ressonância de ~1,25 dB,
 * e dentro de um laço isso põe o ganho de volta acima de 1. É verdade e não
 * bastou: com Q corrigido, 0,85 ainda diverge. O laço realimentado em float32
 * do Web Audio não sustenta o ganho que uma cauda de seis segundos exige.
 *
 * E baixar a realimentação para 0,70 resolve a estabilidade e mata o recurso:
 * a cauda cai para ~0,6 s, quando o arco pede de 4 a 9 s.
 *
 * ⚠️ **A peça inteira saía em NaN — 73,5% das amostras.** Numa tela cujo
 * trabalho é acalmar, isso seria silêncio absoluto ou ruído digital, nunca um
 * erro na tela.
 *
 * Convolução com resposta GERADA resolve os dois lados de uma vez: é FIR, então
 * **não pode divergir por construção**, e entrega exatamente o RT60 pedido em
 * vez de um que se descobre medindo. O argumento contra era estético — "a cor
 * de uma sala real não existe numa resposta inventada" — e ele perde para
 * "o outro caminho produz NaN".
 */
function respostaDaSala(ctx: BaseAudioContext, rt60: number): AudioBuffer {
  /* Uma cauda além de RT60 não é audível (já passou de −60 dB) e só custa CPU. */
  const segs = Math.min(9, rt60);
  const len = Math.max(1, Math.round(ctx.sampleRate * segs));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const tau = rt60 / 6.908;
  let s = 987654321 >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  /**
   * ⚠️ O AGUDO MORRE PRIMEIRO — e é isso que separa uma SALA de ruído em
   * decaimento. O ar absorve agudo, então o corte do passa-baixa desce ao longo
   * da cauda: começa em 8 kHz e termina em 700 Hz. Sem isso a cauda soa como um
   * chiado que abaixa, e o ouvido não a lê como espaço.
   */
  let y = 0;
  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate;
    const u = t / segs;
    const corte = 8000 * Math.pow(700 / 8000, u);
    const a = Math.exp((-2 * Math.PI * corte) / ctx.sampleRate);
    const w = rnd() * 2 - 1;
    y = a * y + (1 - a) * w;
    /* Os primeiros 15 ms entram em rampa: um degrau no começo da resposta é um
       clique somado a cada som que entra na sala. */
    const entrada = Math.min(1, t / 0.015);
    d[i] = y * Math.exp(-t / tau) * entrada;
  }
  /* Normaliza a energia: sem isto, mudar o RT60 mudaria o VOLUME da sala. */
  let soma = 0;
  for (let i = 0; i < len; i++) soma += d[i] * d[i];
  /* ⚠️ 0,055 saiu da BANCADA, não de estimativa. Com 0,7 o pico da peça de dez
     minutos media 7,64 — oito vezes acima do teto, ou seja distorção do começo
     ao fim. Convolução multiplica energia, e a intuição de "normalizar para
     0,7" vem de sinais, não de respostas impulsivas. */
  const g = soma > 0 ? 0.055 / Math.sqrt(soma / ctx.sampleRate) : 1;
  for (let i = 0; i < len; i++) d[i] *= g;
  return buf;
}

function sala(ctx: BaseAudioContext, rt60: number): { entrada: GainNode; saida: GainNode } {
  const entrada = ctx.createGain();
  const saida = ctx.createGain();
  saida.gain.value = 1;
  const conv = ctx.createConvolver();
  conv.normalize = false;
  conv.buffer = respostaDaSala(ctx, rt60);
  /* Pré-atraso: as primeiras reflexões chegam depois do som direto, e são
     esses ~22 ms que dizem ao ouvido o TAMANHO da sala. Sem ele a cauda cola no
     ataque e o sino soa embrulhado. */
  const pre = ctx.createDelay(0.2);
  pre.delayTime.value = 0.022;
  entrada.connect(pre).connect(conv).connect(saida);
  return { entrada, saida };
}

function sorteador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * UM SINO — e ela é de MÓDULO, não um fecho dentro de `criarMusica`.
 *
 * ⚠️ É o que torna a peça MEDÍVEL. `scripts/ouvir.mjs --musica` renderiza a
 * música num `OfflineAudioContext` e mede crista, pico e energia por banda; um
 * fecho preso ao contexto ao vivo não teria como ser chamado de lá, e a música
 * seria a única coisa do app impossível de conferir sem ouvido. É a mesma razão
 * de `montar` aceitar qualquer `BaseAudioContext` em `som-receitas.ts`.
 */
export function sino(
  ctx: BaseAudioContext,
  destino: AudioNode,
  paraSala: AudioNode,
  quando: number,
  hz: number,
  ganho: number,
  ataque: number,
  cai: number,
) {
  const mix = ctx.createGain();
  mix.gain.value = ganho;
  mix.connect(destino);
  /* Um terço do sino vai para a sala. Mandar tudo apagaria o ataque, que é o
       que faz o sino ser sino. */
  const env = ctx.createGain();
  env.gain.value = 0.33;
  mix.connect(env).connect(paraSala);

  let maisLongo = 0;
  for (const p of PARCIAIS_SINO) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = hz * p.razao;
    const g = ctx.createGain();
    const dur = p.cai * (cai / 7);
    maisLongo = Math.max(maisLongo, dur);
    const a = Math.max(0.03, p.ataque * (ataque / 0.18));
    g.gain.setValueAtTime(0.0001, quando);
    g.gain.exponentialRampToValueAtTime(p.amp, quando + a);
    g.gain.exponentialRampToValueAtTime(0.0001, quando + a + dur);
    /**
     * ⚠️ `exponentialRampToValueAtTime` NÃO ACEITA ZERO — daí o 0,0001, que
     * é −80 dB e inaudível. E o `setValueAtTime(0)` depois existe porque
     * parar um oscilador com ganho ainda acima de zero é o clique clássico:
     * a amostra corrente salta para zero de uma vez.
     */
    g.gain.setValueAtTime(0, quando + a + dur);
    osc.connect(g).connect(mix);
    osc.start(quando);
    /* ⚠️ 20 ms DEPOIS do zero, nunca no zero. */
    osc.stop(quando + a + dur + 0.02);
    osc.onended = () => {
      try {
        osc.disconnect();
        g.disconnect();
      } catch {
        /* ignore */
      }
    };
  }
  setTimeout(
    () => {
      try {
        mix.disconnect();
        env.disconnect();
      } catch {
        /* ignore */
      }
    },
    (maisLongo + 2) * 1000,
  );
}

/**
 * ⚠️ O FIM É COMPOSTO, NÃO UM FADE — e esta função é de MÓDULO para o caminho
 * ao vivo e o render offline usarem a MESMA.
 *
 * Fade de amplitude aplicado pelo player é modo de FALHA, não recurso: ele diz
 * "acabou o tempo", e o que a sessão precisa dizer é "chegamos". Vinte e dois
 * segundos antes do fim a peça começa a se recolher, com queda exponencial de
 * τ = 3,2 s — que chega a −60 dB em 3,2 · ln(1000) ≈ 22 s, ou seja exatamente
 * no fim.
 *
 * ⚠️ Ela precisou sair do fecho de `criarMusica` porque a bancada não
 * conseguia medi-la: o render offline montava a peça SEM fecho, então o
 * relatório dizia "o fim não desce" sobre um caminho que simplesmente não tinha
 * fecho nenhum. Uma coisa que só existe ao vivo é uma coisa que ninguém confere.
 */
export function aplicarFecho(param: AudioParam, quando: number, alvo: number) {
  try {
    param.cancelScheduledValues(quando);
    param.setValueAtTime(Math.max(0.0001, alvo), quando);
    param.setTargetAtTime(0.0001, quando, 3.2);
  } catch {
    /* ignore */
  }
}

/**
 * A PEÇA INTEIRA, escrita de uma vez — para render offline e para MEDIR.
 *
 * ⚠️ Existe pela mesma razão que `montar` em `som-receitas.ts` aceita qualquer
 * `BaseAudioContext`: sem isto, a música seria a única coisa do app impossível
 * de conferir sem ouvido. `node scripts/ouvir.mjs --musica` chama daqui.
 *
 * Não é uma segunda implementação: usa `sino` e `sala`, exatamente as mesmas
 * peças do caminho ao vivo. O que muda é só QUANDO os eventos são escritos —
 * offline todos de uma vez, ao vivo por janelas.
 */
export function montarPeca(
  ctx: BaseAudioContext,
  destino: AudioNode,
  o: { minutos: number; luto?: boolean; semente?: number },
) {
  const totalCiclos = Math.max(1, Math.ceil((o.minutos * 60) / CICLO));
  const total = totalCiclos * CICLO;
  const arco = arcoDaMusica(totalCiclos, o.luto);
  const r = sorteador(o.semente ?? 20260824);

  /* Um mestre PRÓPRIO, para o fecho poder acontecer aqui — e para o render
     offline medir exatamente o que a paciente ouve. */
  const mestre = ctx.createGain();
  mestre.gain.value = 1;
  mestre.connect(destino);
  const rev = sala(ctx, arco[0].rt60);
  rev.saida.connect(mestre);

  const onda = ondaDoDrone(ctx);
  const g = ctx.createGain();
  g.gain.value = 0.16;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = hzDoGrau(arco[0].cor.drone, arco[0].cor.oitava, 0) * 3;
  lp.Q.value = 0.707;
  g.connect(lp).connect(mestre);
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(onda);
  const gemeo = ctx.createOscillator();
  gemeo.setPeriodicWave(onda);
  const f0 = hzDoGrau(arco[0].cor.drone, arco[0].cor.oitava, 0);
  osc.frequency.value = f0;
  gemeo.frequency.value = f0 + 0.6;
  osc.connect(g);
  gemeo.connect(g);
  osc.start(0);
  gemeo.start(0);
  osc.stop(total + 3);
  gemeo.stop(total + 3);

  for (const t of arco) {
    const hz = hzDoGrau(t.cor.drone, t.cor.oitava, 0);
    osc.frequency.setTargetAtTime(hz, t.de, 2.5);
    gemeo.frequency.setTargetAtTime(hz + 0.6, t.de, 2.5);
    for (const e of eventosDoTrecho(t, r, total)) {
      sino(ctx, mestre, rev.entrada, e.t, e.hz, e.ganho, t.ataque, t.rt60);
    }
  }
  aplicarFecho(mestre.gain, Math.max(0, total - 22), 1);
  return total;
}

export function criarMusica(o: { minutos: number; luto?: boolean; semente?: number }): Musica {
  if (typeof window === "undefined") return MUDA;
  const totalCiclos = Math.max(1, Math.ceil((o.minutos * 60) / CICLO));
  const total = totalCiclos * CICLO;
  const arco = arcoDaMusica(totalCiclos, o.luto);
  const r = sorteador(o.semente ?? 20260824);

  let ctx: AudioContext | null = null;
  let mestre: GainNode | null = null;
  let reverb: { entrada: GainNode; saida: GainNode } | null = null;
  let drone: { osc: OscillatorNode; gemeo: OscillatorNode; g: GainNode } | null = null;
  let relogio: ReturnType<typeof setInterval> | null = null;
  let adormecer: ReturnType<typeof setTimeout> | null = null;
  let t0 = 0;
  let ateOnde = 0;
  let alvo = 0.6;

  function trechoEm(t: number): Trecho {
    for (const x of arco) if (t >= x.de && t < x.ate) return x;
    return arco[arco.length - 1];
  }

  function tocarSino(quando: number, hz: number, ganho: number, ataque: number, cai: number) {
    if (!ctx || !mestre || !reverb) return;
    sino(ctx, mestre, reverb.entrada, quando, hz, ganho, ataque, cai);
  }

  function moverDrone(quando: number, hz: number) {
    if (!drone) return;
    /* `setTargetAtTime` nunca chega ao alvo — 63% em τ. Para um drone isso é
       exatamente o certo: ele DESLIZA de uma cor para a outra em vez de trocar. */
    drone.osc.frequency.setTargetAtTime(hz, quando, 2.5);
    drone.gemeo.frequency.setTargetAtTime(hz + 0.6, quando, 2.5);
  }

  function agendar() {
    if (!ctx || ctx.state !== "running") return;
    const agora = ctx.currentTime - t0;
    while (ateOnde < agora + JANELA_SEGS && ateOnde < total) {
      const fim = Math.min(total, ateOnde + JANELA_SEGS);
      /* Um trecho por janela: o arco é grosso o bastante para uma janela de
         12 s cair inteira dentro de uma fase, salvo na fronteira. */
      const t = trechoEm(ateOnde);
      moverDrone(t0 + ateOnde + FOLGA, hzDoGrau(t.cor.drone, t.cor.oitava, 0));
      const recorte: Trecho = { ...t, de: ateOnde, ate: fim };
      for (const e of eventosDoTrecho(recorte, r, total)) {
        tocarSino(t0 + e.t, e.hz, e.ganho, t.ataque, t.rt60);
      }
      ateOnde = fim;
    }
    /* ⚠️ Fecha assim que o instante do fecho entra na janela agendada, e não
       depois que a última janela foi escrita — senão ele nasce atrasado. */
    if (ctx.currentTime - t0 >= total - 22 - JANELA_SEGS || ateOnde >= total) fecharComposto();
  }

  /**
   * ⚠️ O FIM É COMPOSTO, NÃO UM FADE.
   *
   * Fade de amplitude aplicado pelo player é modo de FALHA, não recurso: ele
   * diz "acabou o tempo", e o que a sessão precisa dizer é "chegamos". Vinte e
   * dois segundos antes do fim o drone larga tudo acima da oitava e desce para
   * a cor do começo, e a queda é exponencial com τ de 3,2 s — que chega a
   * −60 dB em 22 s, ou seja exatamente no fim.
   *
   * A única exceção é o ✕: quando ela sai antes, não há final a compor, e aí
   * 1,2 s de fade é o certo. Isso é `stop()`.
   */
  let fechou = false;
  function fecharComposto() {
    if (fechou || !ctx || !mestre) return;
    fechou = true;
    /**
     * ⚠️ O FECHO ERA SEMPRE AGENDADO NO PASSADO, e virava um DEGRAU.
     *
     * `agendar()` roda a cada 4 s com janela de 12 s, e só chamava
     * `fecharComposto` depois de escrever a última janela — ou seja, DEPOIS de
     * `total − 22` já ter passado. `setTargetAtTime` com tempo no passado é
     * legal e o valor no instante da chamada vira `alvo · e^(−Δ/3,2)`. Medido
     * no navegador, com o agendador de verdade:
     *
     *     1 min → atraso 10 s → o ganho cai para 4,4% NA HORA (−27 dB)
     *     3 min → atraso  2 s → 53,5%
     *    10 min → atraso  6 s → 15,3% (−16,3 dB)
     *
     * Um paredão instantâneo, que é exatamente o "fade de amplitude aplicado
     * pelo player" que o comentário desta função diz existir para evitar.
     *
     * ⚠️ E `--musica` NUNCA PODERIA VER: a bancada mede `montarPeca`, que
     * agenda tudo de uma vez, no tempo certo. Ela media o único caminho que
     * estava correto.
     *
     * O conserto: agendar cedo (é `setTargetAtTime`, então marcar no futuro é
     * exato) e nunca no passado.
     */
    const quando = Math.max(ctx.currentTime + FOLGA, t0 + Math.max(0, total - 22));
    aplicarFecho(mestre.gain, quando, alvo);
  }

  function start() {
    if (ctx) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      void ctx.resume().catch(() => {});
      mestre = ctx.createGain();
      mestre.gain.value = 0.0001;
      mestre.connect(ctx.destination);
      mestre.gain.linearRampToValueAtTime(alvo, ctx.currentTime + 2.5);

      const t = arco[0];
      reverb = sala(ctx, t.rt60);
      reverb.saida.connect(mestre);

      const onda = ondaDoDrone(ctx);
      const g = ctx.createGain();
      g.gain.value = 0.16;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = hzDoGrau(t.cor.drone, t.cor.oitava, 0) * 3;
      lp.Q.value = 0.707;
      g.connect(lp).connect(mestre);
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(onda);
      osc.frequency.value = hzDoGrau(t.cor.drone, t.cor.oitava, 0);
      const gemeo = ctx.createOscillator();
      gemeo.setPeriodicWave(onda);
      /* ±0,6 Hz é o mesmo batimento que `som-continuo.ts` já mediu como o que
         o ouvido lê como respiração do som. */
      gemeo.frequency.value = osc.frequency.value + 0.6;
      osc.connect(g);
      gemeo.connect(g);
      osc.start();
      gemeo.start();
      drone = { osc, gemeo, g };

      t0 = ctx.currentTime + FOLGA;
      ateOnde = 0;
      agendar();
      relogio = setInterval(agendar, 4000);
    } catch {
      /* sem áudio: a tela nunca quebra */
    }
  }

  function pausar() {
    if (relogio) clearInterval(relogio);
    relogio = null;
    const meu = ctx;
    if (!meu || !mestre) return;
    try {
      mestre.gain.cancelScheduledValues(meu.currentTime);
      mestre.gain.setValueAtTime(Math.max(0.0001, mestre.gain.value), meu.currentTime);
      mestre.gain.linearRampToValueAtTime(0.0001, meu.currentTime + 0.15);
    } catch {
      /* ignore */
    }
    if (adormecer) clearTimeout(adormecer);
    adormecer = setTimeout(() => {
      adormecer = null;
      try {
        void meu.suspend();
      } catch {
        /* ignore */
      }
    }, 200);
  }

  async function retomar(): Promise<boolean> {
    const meu = ctx;
    if (!meu) return false;
    if (adormecer) {
      clearTimeout(adormecer);
      adormecer = null;
    }
    try {
      await meu.resume();
    } catch {
      return false;
    }
    /* Reconfere depois do `await`: `stop()` pode ter rodado no meio, e aí ler
       `ctx.state` de um contexto nulo estoura e quem chamou cria outro. */
    if (!ctx || ctx !== meu || meu.state !== "running") return false;
    try {
      mestre?.gain.cancelScheduledValues(meu.currentTime);
      mestre?.gain.setValueAtTime(0.0001, meu.currentTime);
      mestre?.gain.linearRampToValueAtTime(alvo, meu.currentTime + 0.6);
    } catch {
      /* ignore */
    }
    if (!relogio) relogio = setInterval(agendar, 4000);
    return true;
  }

  function setVolume(v: number) {
    alvo = Math.max(0, Math.min(1, v));
    try {
      if (ctx && mestre && !fechou) {
        /**
         * ⚠️ A ÂNCORA — `cancelScheduledValues` NÃO segura o valor corrente.
         *
         * Ele reverte ao último evento anterior ao corte, e durante o fade de
         * entrada não existe nenhum: só o `value` intrínseco, 0,0001. Sem o
         * `setValueAtTime`, mexer no volume nos primeiros 2,5 s fazia o som
         * CAIR A ZERO e subir de novo. `pausar`, `retomar` e `stop` já
         * ancoravam; só o volume não.
         */
        mestre.gain.cancelScheduledValues(ctx.currentTime);
        mestre.gain.setValueAtTime(Math.max(0.0001, mestre.gain.value), ctx.currentTime);
        mestre.gain.linearRampToValueAtTime(alvo, ctx.currentTime + 0.2);
      }
    } catch {
      /* ignore */
    }
  }

  function stop() {
    if (relogio) clearInterval(relogio);
    relogio = null;
    if (adormecer) clearTimeout(adormecer);
    adormecer = null;
    const meu = ctx;
    const meuMestre = mestre;
    ctx = null;
    mestre = null;
    reverb = null;
    drone = null;
    if (!meu) return;
    /**
     * ⚠️ 1,2 s de fade — e este é o ÚNICO lugar em que fade é o certo.
     *
     * Ela tocou no ✕: não há final a compor, e cortar seco é um clique. Nos
     * outros caminhos quem termina a peça é `fecharComposto`.
     */
    try {
      if (meuMestre) {
        meuMestre.gain.cancelScheduledValues(meu.currentTime);
        meuMestre.gain.setValueAtTime(Math.max(0.0001, meuMestre.gain.value), meu.currentTime);
        meuMestre.gain.linearRampToValueAtTime(0.0001, meu.currentTime + 1.2);
      }
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      try {
        void meu.close();
      } catch {
        /* ignore */
      }
    }, 1300);
  }

  return { start, stop, setVolume, pausar, retomar };
}
