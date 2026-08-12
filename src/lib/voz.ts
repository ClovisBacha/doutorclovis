/**
 * A voz da Obstétrica — arquivos gravados, não a voz do sistema.
 *
 * O que havia antes (`fala.ts`) usava `speechSynthesis`, e ele só toca vozes
 * instaladas no aparelho da paciente. Não dá para escolher, não dá para
 * instalar, e no Android padrão é justamente a robótica — nenhum ajuste de
 * velocidade ou tom conserta, porque o problema não é a configuração e sim que o arquivo
 * de voz não é nosso. Como os textos das telas guiadas são fixos, a saída é
 * gravar uma vez e embarcar.
 *
 * Os MP3 entram por `import`, então o Vite os serve com hash de conteúdo e o
 * navegador só baixa o tema que a paciente abriu — não os 3,6 MB inteiros.
 */

import inspire from "@/assets/audio/inspire.mp3";
import segure from "@/assets/audio/segure.mp3";
import solte from "@/assets/audio/solte.mp3";
import mov0 from "@/assets/audio/mov-ombros.mp3";
import mov1 from "@/assets/audio/mov-pescoco.mp3";
import mov2 from "@/assets/audio/mov-gatocamelo.mp3";
import mov3 from "@/assets/audio/mov-quadril.mp3";
import mov4 from "@/assets/audio/mov-tornozelo.mp3";
import mov5 from "@/assets/audio/mov-pelve.mp3";
import mov6 from "@/assets/audio/mov-bracos.mp3";
import mov7 from "@/assets/audio/mov-torcao.mp3";
import mov8 from "@/assets/audio/mov-balanco.mp3";

/* ─── AS FAIXAS POR TEMA SAÍRAM (ago/2026) ──────────────────────────────────
 *
 * Eram sete arquivos de 30 a 37 segundos, um por tema, mais cinco rechamadas
 * e um fechamento. A auditoria mediu o que isso entregava: numa sessão de dez
 * minutos, 34 segundos de voz — 5,5% —, e o resto eram três palavras repetidas
 * 47 vezes. Pior, a faixa longa não servia às quatro durações da tela: em 1, 2
 * e 5 minutos ela era cortada no meio da frase.
 *
 * O lugar delas é `assets/audio/med`: 149 trechos, um por fala, montados numa
 * linha do tempo por `meditacao-sessao.ts`. Ver `voz-meditacao.ts`.
 */

export const RESPIRACAO = { in: inspire, hold: segure, out: solte } as const;

/**
 * Os nove movimentos, pela `id` de cada um em `MOVIMENTOS`.
 *
 * A chave é a `id`, não o nome. O nome é texto de tela e alguém vai reescrevê-lo
 * um dia; a `id` é identidade e não muda por motivo de redação.
 *
 * Aqui a voz importa tanto quanto na meditação, e pelo mesmo motivo: ela está
 * olhando para o próprio corpo enquanto se move, não para o celular.
 */
const MOVIMENTOS_AUDIO: Record<string, string> = {
  ombros: mov0,
  pescoco: mov1,
  gatocamelo: mov2,
  quadril: mov3,
  tornozelo: mov4,
  pelve: mov5,
  bracos: mov6,
  torcao: mov7,
  balanco: mov8,
};

export function faixaDoMovimento(id: string): string | null {
  return MOVIMENTOS_AUDIO[id] ?? null;
}

/** As ids que têm faixa — o teste compara com as do componente. */
export function movimentosComFaixa(): string[] {
  return Object.keys(MOVIMENTOS_AUDIO);
}

/**
 * DOIS canais, não um.
 *
 * A primeira versão tinha um tocador só, e ela estava errada de um jeito que
 * só apareceu ao ligar na tela: a palavra "Inspire" toca a cada quatro
 * segundos, e um canal único faria cada uma dessas palavras MATAR a meditação
 * guiada que está correndo por baixo. A voz longa nunca passaria da terceira
 * frase.
 *
 * `guia` é a faixa longa do tema — uma por sessão, e começar outra para esta.
 * `pulso` são as palavras curtas e as rechamadas, que se atropelam entre si
 * (duas ao mesmo tempo viram ruído) mas nunca encostam na guia.
 */
type Canal = "guia" | "pulso";

const tocando: Record<Canal, HTMLAudioElement | null> = { guia: null, pulso: null };

export function tocar(
  src: string,
  opts?: { canal?: Canal; volume?: number; aoTerminar?: () => void },
): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const canal = opts?.canal ?? "guia";
  parar(canal);
  try {
    const a = new Audio(src);
    a.volume = opts?.volume ?? 1;
    if (opts?.aoTerminar) a.addEventListener("ended", opts.aoTerminar, { once: true });
    // O navegador bloqueia som sem gesto do usuário. A tela só chama isto
    // depois que ela tocou em "começar", então a promessa costuma resolver —
    // mas se falhar, falha em silêncio em vez de derrubar a sessão.
    void a.play().catch(() => {});
    tocando[canal] = a;
    return a;
  } catch {
    return null;
  }
}

/** Sem argumento, silencia tudo — é o que a tela chama ao fechar. */
export function parar(canal?: Canal) {
  const alvos: Canal[] = canal ? [canal] : ["guia", "pulso"];
  for (const c of alvos) {
    const a = tocando[c];
    if (!a) continue;
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
    tocando[c] = null;
  }
}
