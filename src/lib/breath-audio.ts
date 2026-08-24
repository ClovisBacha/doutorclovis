/**
 * Som ambiente gerado no navegador (Web Audio) — sem arquivos, funciona offline
 * e no iPhone. Um "pad" suave (duas senoides graves) que INCHA ao inspirar e
 * afina ao expirar, dando a sensação de respiração guiada mesmo sem vibração.
 * Também serve de fundo calmo pra meditação. Tudo com guardas: se o navegador
 * não suportar, simplesmente não toca (nunca quebra a tela).
 */
import { tocarPadrao } from "./nativo";

import { nota } from "./afinacao";

export type BreathPhase = "in" | "hold" | "out";

export function createBreathAudio() {
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let osc1: OscillatorNode | null = null;
  let osc2: OscillatorNode | null = null;

  function start() {
    if (ctx) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(ctx.destination);
      /**
       * ⚠️ ERA 174 E 261 Hz, e isso não pertencia a sistema nenhum.
       *
       * O 174 é, por coincidência, a primeira das "frequências Solfeggio" —
       * números inventados nos anos 1970 por redução numerológica, sem nenhuma
       * base histórica ou física (ver `afinacao.ts`). Ninguém escolheu isso aqui
       * por adesão àquilo; foi gosto. Mas deixar o número parado é deixar a
       * coincidência de pé, e o app tinha TRÊS motores em TRÊS afinações.
       *
       * Agora é fá 3 e dó 4 em A = 432, o MESMO par do pad da meditação: a
       * mesma nota, o mesmo intervalo de quinta, o mesmo timbre — só que
       * pertencendo ao sistema do resto do app.
       */
      osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = nota("fa", 3);
      osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = nota("do", 4);
      osc1.connect(gain);
      osc2.connect(gain);
      osc1.start();
      osc2.start();
    } catch {
      /* sem áudio */
    }
  }

  /** Ajusta o volume conforme a fase da respiração (incha ao inspirar). */
  function setPhase(phase: BreathPhase, durMs: number) {
    if (!ctx || !gain) return;
    try {
      const now = ctx.currentTime;
      const target = phase === "in" ? 0.09 : phase === "hold" ? 0.06 : 0.012;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.linearRampToValueAtTime(target, now + durMs / 1000);
    } catch {
      /* ignore */
    }
  }

  /** Fundo calmo constante (meditação). */
  function ambient() {
    if (!ctx || !gain) return;
    try {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(0.05, now + 1.2);
    } catch {
      /* ignore */
    }
  }

  function stop() {
    try {
      osc1?.stop();
      osc2?.stop();
      ctx?.close();
    } catch {
      /* ignore */
    }
    ctx = null;
    gain = null;
    osc1 = null;
    osc2 = null;
  }

  return { start, setPhase, ambient, stop };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * A VIBRAÇÃO QUE CONDUZ DE OLHOS FECHADOS
 *
 * O ponto da respiração guiada é a paciente poder FECHAR OS OLHOS. Se ela
 * precisa olhar a tela para saber em que fase está, o exercício vira outra
 * tarefa visual — e ela já passou o dia inteiro olhando telas.
 *
 * Então a mão tem que saber sozinha. Duas exigências saem disso:
 *
 *  · O padrão precisa DURAR A FASE INTEIRA. A versão anterior era uma lista
 *    fixa que somava 880 ms dentro de uma inspiração de 4000 ms: a paciente
 *    sentia a subida por menos de um segundo e ficava três segundos no escuro,
 *    justo no fim da fase, que é onde a referência mais falta. Por isso o
 *    padrão agora é GERADO a partir de `durMs`.
 *
 *  · A FORMA precisa dizer QUAL fase é. Inspirar CRESCE, expirar DIMINUI. Se
 *    as duas fossem crescentes, a mão sentiria movimento sem saber de qual —
 *    e aí só a tela resolveria, que é exatamente o que se quer evitar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O IPHONE — o que mudou, e o que continua valendo
 *
 * O Safari nunca implementou a Vibration API: pela web, no iPhone, isto é um
 * no-op. Não é bug, não tem polyfill.
 *
 * Dentro do app nativo tem. Mas não do mesmo jeito: o Haptics do iOS NÃO aceita
 * padrão — aceita impactos individuais, com intensidade. Quem faz essa tradução
 * é `tocarPadrao`, em `nativo.ts`, e ela é melhor do que a original: o motor
 * táptico tem `light`, `medium` e `heavy`, que é exatamente a forma que este
 * crescendo já tinha.
 *
 * O que NÃO muda: a vibração continua sendo REFORÇO, nunca o único condutor.
 * Quem guia de olhos fechados nos dois sistemas é o som (`setPhase` acima, que
 * incha ao inspirar e afina ao expirar) — porque pelo navegador, que é como a
 * maioria ainda abre, o iPhone continua mudo.
 */

/**
 * Duração mínima para um pulso ser SENTIDO.
 *
 * Abaixo de ~18 ms o motor mal chega a girar: o comando sai, o aparelho não
 * treme, e some justamente o pulso que deveria marcar o compasso.
 */
const PULSO_MINIMO = 18;

/** Intervalo alvo entre pulsos — a cadência do Respirar do Apple Watch. */
const CADENCIA_ALVO = 500;

/**
 * O padrão de vibração de uma fase, no formato do `navigator.vibrate`:
 * `[liga, desliga, liga, desliga, …]`, em milissegundos.
 *
 * É uma função PURA de propósito. A anterior falava direto com o `navigator`, e
 * por isso o defeito dos 880 ms sobreviveu — não havia como medir o padrão sem
 * um celular na mão. Agora o teste soma o vetor.
 */
export function padraoDaFase(fase: BreathPhase, durMs: number): number[] {
  if (!Number.isFinite(durMs) || durMs <= 0) return [];

  /* Segurar é a AUSÊNCIA de comando: um toque marca a virada e o resto é
     silêncio. Encher esta fase de pulsos diria "faça alguma coisa" bem onde a
     instrução é não fazer nada — e ainda competiria com as outras duas, que
     precisam ser as únicas com movimento para serem distinguíveis. */
  if (fase === "hold") return [28];

  const n = Math.max(3, Math.min(12, Math.round(durMs / CADENCIA_ALVO)));
  const fatia = durMs / n;
  const padrao: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    /* 22% a 72% da fatia. O teto fica longe de 100% porque pulso colado no
       seguinte vira zumbido contínuo, e aí some o compasso. */
    const fracao = fase === "in" ? 0.22 + t * 0.5 : 0.72 - t * 0.5;
    const pulso = Math.max(PULSO_MINIMO, Math.round(fatia * fracao));
    padrao.push(pulso, Math.max(0, Math.round(fatia - pulso)));
  }
  padrao.pop(); // a pausa depois do último pulso não faz nada
  return padrao;
}

/**
 * Vibra a fase inteira. `durMs` é a duração daquela fase no ciclo em curso —
 * sem ela o padrão não teria como durar o que precisa durar.
 */
export function vibratePhase(phase: BreathPhase, durMs: number) {
  /* A escolha do canal — impactos no iPhone nativo, padrão inteiro no Android,
     silêncio onde não há nada — mora em `tocarPadrao`. Aqui só entra a forma. */
  tocarPadrao(padraoDaFase(phase, durMs));
}
