/**
 * Momentos de celebração — confete + som + vibração, tudo offline e sem
 * dependência externa. Usado para marcar conquistas alegres (nova semana de
 * gestação, etc.).
 *
 * Regras do produto:
 * - NUNCA chamar em Modo Cuidado (quem chama decide) — celebração é alegria,
 *   não pode aparecer pra quem está em luto.
 * - Confete respeita `prefers-reduced-motion` (não dispara).
 * - Som e vibração dependem de gesto do usuário no navegador; por isso o ideal
 *   é dispará-los no clique de um botão (senão a política de autoplay bloqueia,
 *   e degradam em silêncio).
 */
import { tocarPadrao } from "@/lib/nativo";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Explosão de confete no viewport inteiro. Some sozinha em ~2,2s. */
/**
 * O tamanho da festa cresce com a sequência.
 *
 * Antes o dia 3 e o dia 30 disparavam exatamente a mesma coisa — 140 confetes,
 * quatro notas, uma vibração. Recompensa que não cresce ensina que continuar
 * não vale nada, e é justamente na terceira semana que a paciente decide se o
 * app faz parte da rotina ou não.
 *
 * Os degraus não são lineares: o salto grande está no 7 e no 30, que são as
 * marcas que ela conta sozinha ("uma semana seguida", "um mês seguido"). Entre
 * elas o crescimento é discreto, para o degrau seguinte ainda surpreender.
 */
export function nivelDaSequencia(streak: number): 1 | 2 | 3 | 4 | 5 {
  if (streak >= 30) return 5;
  if (streak >= 14) return 4;
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  return 1;
}

export function fireConfetti(nivel: 1 | 2 | 3 | 4 | 5 = 1): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (prefersReducedMotion()) return;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const colors = ["#f43f5e", "#fb7185", "#f59e0b", "#34d399", "#a855f7", "#fbbf24"];
  const N = 90 + nivel * 55;
  const parts = Array.from({ length: N }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.35,
    y: H * 0.32 + (Math.random() - 0.5) * 40,
    vx: (Math.random() - 0.5) * 11,
    vy: Math.random() * -12 - 4,
    size: 5 + Math.random() * 7,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.32,
    color: colors[Math.floor(Math.random() * colors.length)],
    round: Math.random() < 0.5,
  }));

  const gravity = 0.32;
  const DURATION = 1900 + nivel * 340;
  const start = performance.now();

  function frame(now: number) {
    const t = now - start;
    ctx!.clearRect(0, 0, W, H);
    const alpha = Math.max(0, 1 - t / DURATION);
    for (const p of parts) {
      p.vy += gravity;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.globalAlpha = alpha;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      if (p.round) {
        ctx!.beginPath();
        ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      ctx!.restore();
    }
    if (t < DURATION) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

/** Toque sonoro alegre (arpejo C-E-G-C). Precisa de gesto do usuário. */
export function celebrateChime(nivel: 1 | 2 | 3 | 4 | 5 = 1): void {
  if (typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    /* Dó–mi–sol–dó sempre; do nível 3 em diante a escala continua subindo,
       e é a ALTURA que o ouvido lê como "foi maior", não o volume. */
    const escala = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];
    const notes = escala.slice(0, Math.min(escala.length, 3 + nivel));
    const now = ctx.currentTime;
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = f;
      const t0 = now + i * 0.09;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.42);
    });
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    /* sem áudio disponível */
  }
}

/**
 * Vibração curta e festiva.
 *
 * Vai por `tocarPadrao` (`nativo.ts`). Ia direto no `navigator.vibrate`, que
 * no iPhone não existe — então a celebração, que é o momento de recompensa do
 * jogo inteiro, era muda em todo iOS. A ponte traduz o padrão nos impactos do
 * Haptics; no Android e no navegador ela cai no próprio `navigator.vibrate`.
 */
export function celebrateHaptic(nivel: 1 | 2 | 3 | 4 | 5 = 1): void {
  /* Um par de batidas por nível, e a última mais longa. O padrão fica
     reconhecível pelo COMPRIMENTO — no bolso ela sente que hoje foi maior
     sem precisar olhar a tela. */
  const padrao: number[] = [];
  for (let i = 0; i < 1 + nivel; i++) padrao.push(30, 40);
  padrao.push(40 + nivel * 30);
  tocarPadrao(padrao);
}

/** Dispara os três (ideal dentro de um clique). */
export function celebrate(opts?: { confetti?: boolean; sound?: boolean; haptics?: boolean }): void {
  const o = { confetti: true, sound: true, haptics: true, ...opts };
  if (o.confetti) fireConfetti();
  if (o.sound) celebrateChime();
  if (o.haptics) celebrateHaptic();
}
