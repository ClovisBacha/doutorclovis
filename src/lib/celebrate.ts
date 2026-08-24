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
import { tocarConquistaComPortoes } from "./tocar-som-de-ui";

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

/**
 * O TOQUE DA CONQUISTA — afinado, e com os portões que faltavam.
 *
 * ⚠️ **Ele NÃO passa pela preferência de som de interface, e isso é decisão.**
 * Este som já existia e já tocava; a preferência nasceu desligada para o que é
 * NOVO, e aplicar "desligado por padrão" a ele seria TIRAR uma coisa que o app
 * tem — o que ninguém pediu. Nada é retirado; o que muda é a afinação e o que
 * o impede de tocar na hora errada.
 *
 * ⚠️ **A escala era Dó–mi–sol–dó de A = 440**, ou seja de sistema nenhum: o
 * pad tocava outro, o marco semanal tocava um terceiro. Agora é a pentatônica
 * de lá em A = 432, a mesma do resto do som do app — e a mesma cuja propriedade
 * (nenhum par forma segunda menor nem trítono) garante que dois sons que se
 * sobreponham por acidente continuem consonantes.
 *
 * ⚠️ **E ele ganhou TRÊS portões que não tinha**, todos de `podeSoar`:
 *
 * • **aba escondida** — a festa tocava com o app em segundo plano, ou seja no
 *   quarto e não para ela;
 * • **sem gesto recente** — o app tem push e cron capazes de disparar sozinhos;
 * • **teto de três por dia** — num dia bom ela fecha o dia, ganha troféu e
 *   completa um conjunto: três festas. A quarta não acrescenta e começa a
 *   tirar.
 *
 * O Modo Cuidado continua sendo responsabilidade de quem chama, como sempre
 * foi — `humorDaJornada` e os blocos de `careMode` já o resolvem antes daqui.
 */
export function celebrateChime(nivel: 1 | 2 | 3 | 4 | 5 = 1, careMode = false): void {
  if (typeof window === "undefined") return;
  /* A ALTURA é o que o ouvido lê como "foi maior", não o volume — então o
     nível acrescenta degraus na escada em vez de subir o ganho.

     ⚠️ `careMode` é o SEGUNDO cinto. A regra do arquivo sempre foi "quem chama
     decide", e a revisão achou um chamador que não decidia: o toque em
     "Resgatar" da aba de conquistas chamava `celebrateChime(1)` sem nenhuma
     checagem, ao contrário do vizinho dele. Passar aqui custa um argumento e
     fecha a porta de dentro. */
  /**
   * ⚠️ E ELE PASSOU A RESPEITAR `prefers-reduced-motion`.
   *
   * `fireConfetti` já respeitava e o chime não — então quem pediu ao sistema
   * MENOS estímulo continuava levando o arpejo, com a tela quieta. A
   * preferência é de "movimento" no nome e de ESTÍMULO no uso; é assim que
   * todo sistema operacional a trata.
   */
  if (prefersReducedMotion()) return;
  tocarConquistaComPortoes(Math.min(6, 3 + nivel), { careMode });
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
/**
 * ⚠️ AQUI HAVIA UM `celebrate(opts)` que juntava confete, som e vibração — e
 * ele tinha ZERO CHAMADORES no repositório inteiro.
 *
 * Pior que código morto: era uma porta ABERTA. Ele chamava `celebrateChime()`
 * sem `careMode`, então o primeiro chamador que alguém escrevesse herdaria uma
 * celebração que toca no luto — e herdaria em silêncio, porque a assinatura não
 * pede nada.
 *
 * É a mesma família de `proximoDesbloqueio` e `escadaDeTrofeus`, que este
 * projeto já pagou três vezes. Quem quiser as três coisas juntas chama as três,
 * passando `careMode` — que é o que os nove chamadores reais já fazem.
 */
