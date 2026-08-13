/**
 * Sons de fundo da meditação — gerados no navegador (Web Audio), sem nenhum
 * arquivo de áudio.
 *
 * Por que sintetizar em vez de servir mp3: um app de meditação de mercado
 * carrega dezenas de megabytes de trilha. Aqui a paciente costuma abrir a tela
 * no 4G, à noite, com o celular quase sem bateria — e um som que demora 8s pra
 * começar não acalma ninguém. Ruído filtrado toca no primeiro frame, funciona
 * offline, não pesa no bundle e não tem licença pra pagar.
 *
 * Todos os quatro saem do MESMO gerador de ruído; o que muda é o filtro. Chuva
 * é ruído agudo; mar é o mesmo ruído com o corte varrendo devagar (é isso que
 * o ouvido lê como "onda indo e voltando"); coração é o batimento por cima de
 * um ruído grave e abafado — o som que o bebê de fato escuta lá dentro.
 *
 * Tudo é guardado por try/catch: navegador sem Web Audio simplesmente fica em
 * silêncio, a tela nunca quebra.
 */

export type SoundscapeKey = "silencio" | "chuva" | "mar" | "coracao" | "pad";

export const SOUNDSCAPES: { key: SoundscapeKey; label: string; emoji: string }[] = [
  { key: "pad", label: "Pad calmo", emoji: "🎵" },
  { key: "chuva", label: "Chuva", emoji: "🌧️" },
  { key: "mar", label: "Mar", emoji: "🌊" },
  { key: "coracao", label: "Coração", emoji: "💓" },
  { key: "silencio", label: "Silêncio", emoji: "🔇" },
];

export type Soundscape = {
  /** Sobe o volume até o alvo (0..1 relativo). Idempotente. */
  start: () => void;
  /** Desliga tudo e libera o contexto. Chamar SEMPRE no unmount. */
  stop: () => void;
  /** Volume mestre, 0..1. */
  setVolume: (v: number) => void;
  /** Silencia guardando o estado — para a pausa da sessão e o aparelho bloqueado. */
  pausar: () => void;
  /**
   * Volta a tocar. Devolve `false` quando o navegador recusou (contexto
   * suspenso costuma exigir um gesto novo no iOS) — aí quem chamou recria.
   */
  retomar: () => Promise<boolean>;
};

const SILENCIO: Soundscape = {
  start: () => {},
  stop: () => {},
  setVolume: () => {},
  pausar: () => {},
  retomar: async () => true,
};

/** 2s de ruído branco em loop — a matéria-prima de chuva, mar e útero. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function createSoundscape(kind: SoundscapeKey): Soundscape {
  if (kind === "silencio" || typeof window === "undefined") return SILENCIO;

  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let heart: ReturnType<typeof setInterval> | null = null;
  let alvo = 0.28;
  /* Guardados para a pausa: o batimento é o único som agendado por relógio de
     fora do áudio, então é o único que precisa ser rearmado ao voltar. */
  let bater: (() => void) | null = null;
  let periodoDoCoracao = 0;
  /** Suspensão adiada, para o volume ter tempo de descer. Ver `pausar()`. */
  let adormecer: ReturnType<typeof setTimeout> | null = null;

  function start() {
    if (ctx) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);
      // Fade-in de 1,5s. Som que entra "no talo" assusta — e a tela toda existe
      // pra fazer o contrário disso.
      master.gain.linearRampToValueAtTime(alvo, ctx.currentTime + 1.5);

      if (kind === "pad") montarPad(ctx, master);
      else if (kind === "chuva") montarChuva(ctx, master);
      else if (kind === "mar") montarMar(ctx, master);
      else if (kind === "coracao") {
        const c = montarCoracao(ctx, master);
        bater = c.bater;
        periodoDoCoracao = c.periodoMs;
        heart = setInterval(c.bater, c.periodoMs);
      }
    } catch {
      /* sem áudio */
    }
  }

  /**
   * ⚠️ PAUSAR PRECISA PARAR O RELÓGIO DO CORAÇÃO, não só suspender o áudio.
   *
   * Num contexto suspenso o `currentTime` CONGELA — e o `setInterval` continua
   * correndo, agendando cada batida para o mesmo instante parado. Ao voltar,
   * todas saem juntas: um estouro no ouvido de quem estava meditando. Suspender
   * sem isto troca um defeito silencioso por um barulhento.
   *
   * O volume desce em 150 ms antes de suspender, e sobe em 600 ms ao voltar.
   * `suspend()` corta no ato, e corte seco é o que o fade de entrada de 1,5 s
   * existe para evitar — o mesmo botão não pode ter dois comportamentos.
   */
  function pausar() {
    if (heart) clearInterval(heart);
    heart = null;
    const meu = ctx;
    if (!meu || !master) return;
    try {
      master.gain.cancelScheduledValues(meu.currentTime);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), meu.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, meu.currentTime + 0.15);
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
    /**
     * ⚠️ RECONFERE O CONTEXTO DEPOIS DO `await`.
     *
     * `stop()` pode ter rodado no meio — ela fechou a folha, ou trocou de som.
     * Sem esta linha, `ctx.state` era lido de `null`, o TypeError subia pela
     * promessa, e o recuo de quem chamou criava um `AudioContext` NOVO num
     * componente que já tinha saído da tela: som tocando sem nenhum botão em
     * lugar nenhum que o desligasse.
     */
    if (!ctx || ctx !== meu || meu.state !== "running") return false;
    try {
      master?.gain.cancelScheduledValues(meu.currentTime);
      master?.gain.setValueAtTime(0.0001, meu.currentTime);
      master?.gain.linearRampToValueAtTime(Math.max(0.0001, alvo), meu.currentTime + 0.6);
    } catch {
      /* ignore */
    }
    if (bater && !heart) heart = setInterval(bater, periodoDoCoracao);
    return true;
  }

  function setVolume(v: number) {
    alvo = Math.max(0, Math.min(1, v));
    if (!ctx || !master) return;
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(Math.max(0.0001, alvo), ctx.currentTime + 0.3);
    } catch {
      /* ignore */
    }
  }

  function stop() {
    if (heart) clearInterval(heart);
    heart = null;
    bater = null;
    /* Sem isto, a suspensão adiada acordaria depois do `close()` e chamaria
       `suspend()` num contexto fechado. */
    if (adormecer) clearTimeout(adormecer);
    adormecer = null;
    try {
      ctx?.close();
    } catch {
      /* ignore */
    }
    ctx = null;
    master = null;
  }

  return { start, stop, setVolume, pausar, retomar };
}

/** Duas senoides graves em quinta — o mesmo pad que a respiração guiada usa. */
function montarPad(ctx: AudioContext, out: GainNode) {
  const g = ctx.createGain();
  g.gain.value = 0.5;
  g.connect(out);
  for (const f of [174, 261]) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(g);
    o.start();
  }
}

/** Ruído com o grave cortado + um leve balanço de volume = chuva miúda. */
function montarChuva(ctx: AudioContext, out: GainNode) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6500;

  const g = ctx.createGain();
  g.gain.value = 0.5;

  // Respiração lenta do volume: chuva real nunca é uma parede constante.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.12;
  lfo.connect(lfoG).connect(g.gain);
  lfo.start();

  src.connect(hp).connect(lp).connect(g).connect(out);
  src.start();
}

/** O MESMO ruído, mas com o corte varrendo devagar — o ouvido lê como onda. */
function montarMar(ctx: AudioContext, out: GainNode) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  lp.Q.value = 0.8;

  // Varredura de ~9s: é a duração de uma onda quebrando e voltando.
  const sweep = ctx.createOscillator();
  sweep.frequency.value = 1 / 9;
  const sweepG = ctx.createGain();
  sweepG.gain.value = 380;
  sweep.connect(sweepG).connect(lp.frequency);
  sweep.start();

  const g = ctx.createGain();
  g.gain.value = 0.75;
  const vol = ctx.createOscillator();
  vol.frequency.value = 1 / 9;
  const volG = ctx.createGain();
  volG.gain.value = 0.3;
  vol.connect(volG).connect(g.gain);
  vol.start();

  src.connect(lp).connect(g).connect(out);
  src.start();
}

/**
 * Útero: ruído grave e abafado (o "shhh" que o bebê ouve o tempo todo) com o
 * batimento por cima, a 140 bpm — a frequência cardíaca fetal típica. Cada
 * batida é "lub-dub": dois toques, o segundo mais curto e mais baixo.
 */
function montarCoracao(ctx: AudioContext, out: GainNode) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 320;
  const shh = ctx.createGain();
  shh.gain.value = 0.45;
  src.connect(lp).connect(shh).connect(out);
  src.start();

  function toque(t: number, f0: number, pico: number, dur: number) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f0 * 0.45), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const periodo = 60 / 140; // ≈ 0,43 s
  function bater() {
    if (ctx.state !== "running") return;
    const t = ctx.currentTime + 0.02;
    toque(t, 62, 0.9, 0.16); // lub
    toque(t + 0.16, 54, 0.55, 0.13); // dub
  }
  bater();
  /* Quem arma o relógio é quem sabe pausá-lo — ver `pausar()` lá em cima. */
  return { bater, periodoMs: periodo * 1000 };
}
