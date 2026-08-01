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

import calma from "@/assets/audio/calma.mp3";
import conexao from "@/assets/audio/conexao.mp3";
import descanso from "@/assets/audio/descanso.mp3";
import gratidao from "@/assets/audio/gratidao.mp3";
import sono from "@/assets/audio/sono.mp3";
import coragem from "@/assets/audio/coragem.mp3";
import agora from "@/assets/audio/agora.mp3";
import inspire from "@/assets/audio/inspire.mp3";
import segure from "@/assets/audio/segure.mp3";
import solte from "@/assets/audio/solte.mp3";
import fechamento from "@/assets/audio/fechamento.mp3";
import rech1 from "@/assets/audio/rechamada-1.mp3";
import rech2 from "@/assets/audio/rechamada-2.mp3";
import rech3 from "@/assets/audio/rechamada-3.mp3";
import rech4 from "@/assets/audio/rechamada-4.mp3";
import rech5 from "@/assets/audio/rechamada-5.mp3";

/**
 * As faixas guiadas, na ordem em que os temas aparecem em `MEDITACOES`.
 *
 * A chave é o tema exato daquele array. Se alguém renomear um tema lá e
 * esquecer daqui, `faixaDoTema` devolve `null` e a tela simplesmente roda sem
 * voz — nunca com a voz errada, que seria pior.
 */
const FAIXAS: Record<string, string> = {
  Calma: calma,
  "Conexão com o bebê": conexao,
  Descanso: descanso,
  Gratidão: gratidao,
  "Sono tranquilo": sono,
  "Coragem pro parto": coragem,
  "Aqui e agora": agora,
};

export function faixaDoTema(tema: string): string | null {
  return FAIXAS[tema] ?? null;
}

/**
 * As três palavras da respiração.
 *
 * Este era o buraco maior das telas guiadas, e ele estava escondido à vista:
 * a voz dizia a poesia e calava justamente no comando. O anel mostra "inspire
 * / segure / solte" na tela — mas o propósito inteiro de ter voz é ela poder
 * FECHAR OS OLHOS, e de olhos fechados ela não sabia quando respirar.
 *
 * Cada faixa é mais curta que a fase que anuncia (0,9s no inspirar de 4s;
 * 1,4s no segurar de 2s; 2,1s no soltar de 6s), então a palavra termina e
 * sobra silêncio para a respiração acontecer — em vez de a voz atravessar a
 * fase seguinte.
 */
export const RESPIRACAO = { in: inspire, hold: segure, out: solte } as const;

/** Fecha a sessão. Antes ela simplesmente parava, sem nada marcar o fim. */
export const FECHAMENTO = fechamento;

/**
 * As interjeições do meio da sessão.
 *
 * Só fazem sentido depois que a faixa guiada acabou: são para quando a cabeça
 * dela já foi embora, o que não acontece no primeiro minuto.
 */
export const RECHAMADAS_AUDIO = [rech1, rech2, rech3, rech4, rech5];

/** Existe faixa para todos os temas? Usado no teste que trava o descasamento. */
export function temasComFaixa(): string[] {
  return Object.keys(FAIXAS);
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

/** Quanto já tocou da faixa guiada, em segundos. */
export function decorrido(): number {
  return tocando.guia?.currentTime ?? 0;
}

/** Duração da faixa guiada — 0 enquanto os metadados não chegaram. */
export function duracao(): number {
  const d = tocando.guia?.duration;
  return Number.isFinite(d) ? (d as number) : 0;
}

/** A faixa guiada já terminou? É o que libera as rechamadas. */
export function guiaTerminou(): boolean {
  const a = tocando.guia;
  return !a || a.ended;
}
