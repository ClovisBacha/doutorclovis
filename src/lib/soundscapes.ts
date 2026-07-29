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
};

const SILENCIO: Soundscape = { start: () => {}, stop: () => {}, setVolume: () => {} };

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
      else if (kind === "coracao") heart = montarCoracao(ctx, master);
    } catch {
      /* sem áudio */
    }
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
    try {
      ctx?.close();
    } catch {
      /* ignore */
    }
    ctx = null;
    master = null;
  }

  return { start, stop, setVolume };
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
    if (ctx.state === "closed") return;
    const t = ctx.currentTime + 0.02;
    toque(t, 62, 0.9, 0.16); // lub
    toque(t + 0.16, 54, 0.55, 0.13); // dub
  }
  bater();
  return setInterval(bater, periodo * 1000);
}
