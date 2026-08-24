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
import { emConteudo } from "./sessao-de-audio";
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

/**
 * ⚠️ AS FAIXAS PRECISAM SER BUSCADAS ANTES DA HORA DE TOCAR.
 *
 * Medido no Chromium com 3G lento (400 kbps, 300 ms de latência — a rede de
 * quem está no ônibus): entre criar o `Audio` e ele COMEÇAR a soar passavam
 * de 0,97 a 1,80 segundo. A pior era a primeira fala da sessão, logo depois
 * de ela tocar em "Começar": 1,8 s de nada, que lê como app quebrado.
 *
 * O ciclo tem 12 segundos, então um atraso desses não perde a respiração —
 * mas desloca cada fala um segundo para dentro do ciclo, e numa tela cujo
 * assunto é ritmo isso se sente.
 *
 * `preparar` busca a faixa enquanto a anterior ainda toca. O cache é pequeno
 * de propósito: guardar 149 elementos de áudio seria carregar 11 MB na
 * memória de um celular para usar 24 deles.
 */
const PRONTAS_MAX = 4;
const prontas = new Map<string, HTMLAudioElement>();

export function preparar(src: string): void {
  if (typeof window === "undefined" || !src || prontas.has(src)) return;
  try {
    const a = new Audio();
    a.preload = "auto";
    a.src = src;
    a.load();
    prontas.set(src, a);
    /* O mais antigo sai quando o cache enche — e nunca o que está tocando,
       que seria pará-lo no meio da frase. */
    for (const [k, v] of prontas) {
      if (prontas.size <= PRONTAS_MAX) break;
      if (v === tocando.guia || v === tocando.pulso) continue;
      prontas.delete(k);
    }
  } catch {
    /* sem áudio no ambiente: `tocar` cria na hora, como antes */
  }
}

/**
 * ⚠️ A VOZ SOBE A SESSÃO DE ÁUDIO — e ela era a que faltava.
 *
 * `sessao-de-audio.ts` enumera quatro telas que tocam `<audio>` e diz que todas
 * devolvem a sessão ao repouso no desmonte. Três devolviam; a VOZ da meditação,
 * a primeira da lista, não chamava nenhuma das duas — e é ela que toca em toda
 * sessão guiada.
 *
 * Ela SOBE aqui (a fala precisa ser ouvida mesmo com o botão de silêncio, como
 * qualquer conteúdo que a paciente pediu) e QUEM DEVOLVE é o desmonte do bloco
 * de meditação, pelo mesmo retorno de efeito das outras três. Devolver aqui, no
 * `parar()`, seria errado: `parar` roda entre uma frase e a próxima.
 */
export function tocar(
  src: string,
  opts?: { canal?: Canal; volume?: number; aoTerminar?: () => void },
): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const canal = opts?.canal ?? "guia";
  parar(canal);
  try {
    /* Reaproveita o que `preparar` já baixou. `currentTime = 0` porque o
       elemento pode ter sido usado antes — sem isso a segunda vez que uma
       rechamada tocasse começaria do fim dela. */
    const pronta = prontas.get(src);
    emConteudo();
    const a = pronta ?? new Audio(src);
    if (pronta) {
      try {
        a.currentTime = 0;
      } catch {
        /* metadados ainda não chegaram: toca do começo de qualquer jeito */
      }
    }
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
