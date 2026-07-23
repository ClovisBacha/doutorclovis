/**
 * Som ambiente gerado no navegador (Web Audio) — sem arquivos, funciona offline
 * e no iPhone. Um "pad" suave (duas senoides graves) que INCHA ao inspirar e
 * afina ao expirar, dando a sensação de respiração guiada mesmo sem vibração.
 * Também serve de fundo calmo pra meditação. Tudo com guardas: se o navegador
 * não suportar, simplesmente não toca (nunca quebra a tela).
 */
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
      // Tom base calmo (~174Hz) + uma quinta suave por cima.
      osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 174;
      osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 261;
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
 * Padrão de vibração por fase (Apple-like): pulsos crescentes ao inspirar,
 * leve ao expirar. Só funciona onde a Vibration API existe (Android / app
 * nativo); no iPhone via web é ignorado silenciosamente.
 */
export function vibratePhase(phase: BreathPhase) {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (phase === "in") navigator.vibrate([40, 120, 60, 120, 80, 120, 100, 120, 120]);
    else if (phase === "hold") navigator.vibrate(25);
    else navigator.vibrate([140, 200, 80]);
  } catch {
    /* sem haptics */
  }
}
