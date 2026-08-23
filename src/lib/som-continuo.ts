/**
 * SONS PARA DORMIR — e por que eles NÃO podem ser Web Audio.
 *
 * ─── O DEFEITO QUE ESTE ARQUIVO EXISTE PARA NÃO TER ─────────────────────────
 *
 * `soundscapes.ts` sintetiza chuva, mar, coração e pad no navegador, ao vivo.
 * Isso é perfeito enquanto a tela está acesa — e é exatamente o que não serve
 * para dormir: o iOS SUSPENDE o `AudioContext` quando o aparelho bloqueia.
 * Um player de sons para dormir feito com Web Audio para de tocar no segundo em
 * que ela apoia o celular na mesa de cabeceira. Seria um recurso que só
 * funciona enquanto ninguém precisa dele.
 *
 * O que sobrevive à tela apagada em iPhone é ARQUIVO tocando num `<audio>` —
 * é assim que rádio na web toca no bolso. Então o caminho é: renderizar o
 * mesmo som, uma vez, num `OfflineAudioContext`, empacotar em WAV e entregar a
 * um `<audio loop>`. Nenhum arquivo novo no repositório, nenhum megabyte no
 * bundle, o som é o MESMO que ela já conhece da meditação — e agora toca com o
 * aparelho bloqueado, com controle na tela de bloqueio.
 *
 * ─── A EMENDA DO LOOP É MATEMÁTICA, NÃO CROSSFADE ───────────────────────────
 *
 * Um loop que não fecha dá um "tec" a cada volta — a cada 30 segundos, a noite
 * inteira, para quem está tentando dormir. Em vez de disfarçar com crossfade,
 * o comprimento do trecho é múltiplo EXATO de todo período interno de cada som
 * (ver `periodosDe`, e o teste que cobra isso). Aí o último quadro encosta no
 * primeiro sem costura nenhuma.
 *
 * Foi por isso que a chuva passou de 0,07 Hz para 1/15 Hz e a onda do mar de
 * 9 s para 10 s: diferença inaudível, e é o que faz 30 s fecharem redondo.
 */

/**
 * ⚠️ AS RECEITAS MORAM EM `som-receitas.ts`, e as peças em `som-primitivas.ts`.
 *
 * Eram quatro sons e tudo cabia num arquivo. Com vinte, o arquivo passaria de
 * mil linhas e o MOTOR (WAV, render, tocador, temporizador) ficaria enterrado
 * no meio das receitas. A divisão é por PERGUNTA: aqui é "como isto vira um
 * arquivo que toca"; lá é "como este som é feito".
 *
 * Os nomes antigos seguem re-exportados: quem importava `montar`,
 * `SONS_CONTINUOS` ou `periodosDe` daqui continua funcionando.
 */
export {
  SONS_CONTINUOS,
  FAMILIAS,
  FAMILIA_DO_SOM,
  NIVEL_AO_VIVO,
  ROTULO_DO_SOM,
  ehSomContinuo,
  montar,
  periodosDe,
  type Familia,
  type SomKey,
} from "./som-receitas";

import { montar, periodosDe, type SomKey } from "./som-receitas";

/** O trecho que se repete. 30 s é longo o bastante para não soar como laço. */
export const LOOP_SEGS = 30;
/** A cauda que desliga: fade de 15 s no fim do temporizador. */
export const CAUDA_SEGS = 15;

/* ══════════════════════ WAV: cabeçalho e amostras ══════════════════════════ */

/**
 * Empacota um canal em WAV PCM 16 bits.
 *
 * WAV por dois motivos, e o segundo é o que decide. Primeiro: não há
 * codificador de MP3 no navegador, e não precisa haver — o arquivo nasce na
 * memória, toca, e morre com a tela. Segundo: **MP3 não fecha o loop**. O
 * formato carrega silêncio de codificação no começo e no fim de todo arquivo,
 * então `<audio loop>` de MP3 dá um engasgo a cada volta. WAV é amostra pura:
 * o último quadro encosta no primeiro.
 */
export function wav(amostras: Float32Array, taxa: number): Blob {
  const bytes = amostras.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const txt = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };
  txt(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  v.setUint32(16, 16, true); // tamanho do bloco fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // alinhamento do bloco
  v.setUint16(34, 16, true); // bits por amostra
  txt(36, "data");
  v.setUint32(40, bytes, true);
  for (let i = 0; i < amostras.length; i++) {
    /* Corta em ±1 antes de converter: sem isto, um pico de 1,2 estoura o
       inteiro de 16 bits e volta pelo outro lado — um clique alto no ouvido de
       quem está dormindo. */
    const s = Math.max(-1, Math.min(1, amostras[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/* ══════════════════════════ Render ═════════════════════════════════════════ */

const TAXA_ALVO = 22050;

/**
 * ⚠️ AQUECIMENTO: o trecho guardado NÃO começa no instante zero do render.
 *
 * Medido no Chromium, lendo as amostras do WAV cru (nunca por
 * `decodeAudioData`, que reamostra e inventa um degrau nas bordas que não
 * existe no arquivo): sem aquecimento, o degrau na emenda do CORAÇÃO era
 * 0,0443 — MAIOR que o maior degrau de qualquer outro ponto do arquivo
 * (0,0354). Ou seja, um clique a cada 30 s, a noite inteira, no som que existe
 * para uma mulher se acalmar com o batimento do próprio bebê.
 *
 * A causa não são os osciladores (esses fecham redondo, ver `periodosDe`): é o
 * FILTRO. Um biquad tem memória, e no instante zero ela está zerada — o começo
 * do trecho tinha um transitório que o fim, já em regime, não tinha.
 *
 * O aquecimento tem de ser múltiplo INTEIRO de todo período do som, senão ele
 * desloca a fase e o problema volta com outro nome. Por isso os candidatos são
 * divisores de `LOOP_SEGS`, e o mínimo de 4 s é o que dá aos filtros tempo de
 * entrar em regime. Depois: coração 0,0001 (percentil 1,8% dos degraus do
 * próprio sinal), mar 0,0169, chuva 0,2211 — todos dentro do normal do sinal.
 */
/**
 * ⚠️ UM NÚMERO SÓ, e a regra antiga era falsa.
 *
 * A versão anterior escolhia o aquecimento entre os divisores de `LOOP_SEGS`
 * que fossem múltiplos de todo período do som, com a justificativa de que um
 * aquecimento "fora de fase moveria o problema em vez de resolvê-lo".
 *
 * A medição (registrada em `XFADE_SEGS`) desmentiu: variando SÓ o aquecimento,
 * o degrau da emenda pula sem padrão nenhum — os múltiplos não são melhores
 * que os outros. A conta explica: para um sinal de período p, o trecho
 * [w, w+L] fecha se **L** for múltiplo de p; w não entra.
 *
 * O que o aquecimento faz de verdade, e só isso, é dar aos FILTROS tempo de
 * sair do estado zerado — um biquad tem memória, e no instante zero ela está
 * vazia. Oito segundos cobrem com folga o mais lento que existe aqui, e são
 * baratos: o render passa a durar `8 + 30` segundos de tempo simulado, contra
 * os 40 do pior caso anterior.
 */
const AQUECIMENTO_SEGS = 8;

export function aquecimentoDe(_kind: SomKey): number {
  return AQUECIMENTO_SEGS;
}

/**
 * ⚠️ E O PICO É NORMALIZADO, senão o som SATURA.
 *
 * Medido antes: pico 1,10 na chuva e 1,00 no coração — acima do teto do
 * formato. `soundscapes.ts` nunca teve esse problema porque toca com o volume
 * mestre em 0,28; aqui o arquivo É a saída inteira, e sair a 0,28 deixaria o
 * player baixo demais num iPhone, onde a página não controla volume nenhum.
 * Normalizar pelo pico resolve os dois lados: nada satura e o nível é o mesmo
 * para os quatro sons — o que também mantém a cauda no mesmo volume do trecho
 * que ela desliga.
 */
const PICO_ALVO = 0.89;

/**
 * ⚠️ A EMENDA FECHA POR CROSSFADE — e a prosa antiga daqui estava errada.
 *
 * O arquivo afirmava que o aquecimento "tem de ser múltiplo inteiro de todo
 * período do som, senão ele desloca a fase e o problema volta". Medido no
 * Chromium, o degrau da emenda por aquecimento (4 · 7 · 10 · 11 · 13 · 30 s):
 *
 *     chuva   0,0269  0,0025  0,0068  0,0131  0,0788  0,0841
 *     pad     0,0441  0,0031  0,0509  0,0041  0,0010  0,0463
 *
 * Não há padrão nenhum favorecendo os múltiplos — os valores pulam. A conta
 * explica por quê: para um sinal de período p, o trecho [w, w+L] fecha se **L**
 * for múltiplo de p, e w não entra na conta. O aquecimento serve para os
 * filtros entrarem em regime, e só.
 *
 * E ficou à mostra um defeito que o critério antigo escondia: no PAD, o maior
 * degrau do arquivo inteiro É a emenda (0,0509 contra p99 de 0,0453). Num
 * drone liso, isso é o único evento largo de banda que existe — exatamente o
 * "tec" que a emenda deveria não ter.
 *
 * O conserto é o de sempre em laço de amostra, e não depende de fase nenhuma:
 * renderiza-se 20 ms A MAIS e mistura-se essa sobra na cabeça do trecho. O
 * primeiro quadro passa a ser, por construção, a continuação do último.
 *
 * ⚠️ Isto NÃO é o "fade dentro do trecho" que o comentário do `renderizar`
 * proíbe — aquilo é uma rampa de volume que vira pulso a cada volta. Aqui a
 * amplitude não muda: dois trechos do MESMO som se somam com pesos que fecham
 * 1. Vinte milissegundos é curto o bastante para nenhum ouvido ouvir a
 * mistura, e longo o bastante (441 amostras a 22050) para matar o degrau.
 */
const XFADE_SEGS = 0.02;

/**
 * Mistura a sobra do fim na cabeça do trecho, para o laço fechar sem degrau.
 *
 * Peso LINEAR e não de potência igual: os dois lados são o mesmo som, e no pad
 * são quase idênticos em fase — com peso linear a soma fica de amplitude
 * constante, enquanto potência igual daria um inchaço de 3 dB. Em ruído, a
 * queda de 3 dB do linear dura 20 ms uma vez a cada 30 s, o que é muito abaixo
 * de qualquer degrau audível.
 */
function costurar(x: Float32Array, quadros: number, sobra: number): Float32Array {
  if (sobra <= 0 || sobra >= quadros) return x.subarray(0, quadros);
  const trecho = x.slice(0, quadros);
  for (let i = 0; i < sobra; i++) {
    const w = i / sobra;
    trecho[i] = trecho[i] * w + x[quadros + i] * (1 - w);
  }
  return trecho;
}

function normalizar(amostras: Float32Array): void {
  let pico = 0;
  for (let i = 0; i < amostras.length; i++) {
    const a = Math.abs(amostras[i]);
    if (a > pico) pico = a;
  }
  if (pico <= 0) return;
  const g = PICO_ALVO / pico;
  for (let i = 0; i < amostras.length; i++) amostras[i] *= g;
}

type Offline = new (canais: number, quadros: number, taxa: number) => OfflineAudioContext;

function criarOffline(quadros: number, taxa: number): OfflineAudioContext | null {
  const OAC =
    (globalThis as unknown as { OfflineAudioContext?: Offline }).OfflineAudioContext ??
    (globalThis as unknown as { webkitOfflineAudioContext?: Offline }).webkitOfflineAudioContext;
  if (!OAC) return null;
  return new OAC(1, quadros, taxa);
}

/**
 * Renderiza o trecho e devolve um WAV pronto para o `<audio>`.
 *
 * `cauda` monta o desligamento do temporizador: entra em 30 ms (mata o clique
 * da emenda, seja qual for a fase em que o loop estava) e cai a zero em 15 s.
 *
 * ⚠️ Safari antigo só aceitava `OfflineAudioContext` a 44100 Hz. O recuo para a
 * taxa padrão está aqui porque falhar significaria um player que não toca, e
 * o dobro de memória é preço barato por isso.
 */
export async function renderizar(kind: SomKey, cauda = false): Promise<Blob | null> {
  const segundos = cauda ? CAUDA_SEGS : LOOP_SEGS;
  const aquecimento = aquecimentoDe(kind);
  /* A cauda toca UMA vez e não fecha em nada — ela não precisa da sobra. */
  const sobraSegs = cauda ? 0 : XFADE_SEGS;
  const total = aquecimento + segundos + sobraSegs;
  for (const taxa of [TAXA_ALVO, 44100]) {
    try {
      const ctx = criarOffline(Math.round(total * taxa), taxa);
      if (!ctx) return null;
      const master = ctx.createGain();
      master.connect(ctx.destination);
      if (cauda) {
        /* Entra em 30 ms e cai por todo o resto. A entrada rápida existe para
           matar o clique da emenda: a cauda começa na fase que der, e sem ela
           o salto de amplitude viraria um "toc" — justo no momento em que ela
           está pegando no sono. Os tempos são contados a partir do fim do
           aquecimento, que é onde o trecho guardado começa. */
        master.gain.setValueAtTime(0.0001, aquecimento);
        master.gain.linearRampToValueAtTime(1, aquecimento + 0.03);
        master.gain.linearRampToValueAtTime(0.0001, total);
      } else {
        /* ⚠️ O LOOP NÃO TEM FADE NENHUM, nem no começo. Qualquer rampa dentro
           do trecho vira um pulso a cada volta — a cada 30 s, a noite inteira.
           O som entra direto porque foi ELA quem tocou no botão; o fade de
           1,5 s da meditação existe para som que aparece sem ser pedido. */
        master.gain.value = 1;
      }
      montar(ctx, kind, master, total);
      const buf = await ctx.startRendering();
      /* Descarta o aquecimento: é ele que deixa os filtros em regime, para o
         começo do trecho soar igual ao fim dele. */
      const depoisDoAquecimento = buf
        .getChannelData(0)
        .subarray(Math.round(aquecimento * buf.sampleRate));
      const trecho = costurar(
        depoisDoAquecimento,
        Math.round(segundos * buf.sampleRate),
        Math.round(sobraSegs * buf.sampleRate),
      );
      normalizar(trecho);
      return wav(trecho, buf.sampleRate);
    } catch {
      /* tenta a taxa seguinte */
    }
  }
  return null;
}

/* ══════════════════════════ O tocador ══════════════════════════════════════ */

export type Tocador = {
  elemento: HTMLAudioElement;
  /** Chamar DENTRO do toque da paciente — ver o comentário. */
  destravar: () => void;
  tocar: (kind: SomKey) => Promise<boolean>;
  /** Toca a cauda com fade e resolve quando ela acaba. */
  desligarComFade: (kind: SomKey) => Promise<void>;
  parar: () => void;
};

export function criarTocador(): Tocador {
  const audio = new Audio();
  audio.preload = "auto";
  /* Sem isto o iOS abre o player em tela cheia por cima do app. */
  audio.setAttribute("playsinline", "");
  audio.style.display = "none";
  let url: string | null = null;

  const trocar = (blob: Blob, loop: boolean) => {
    /**
     * ⚠️ O ELEMENTO ENTRA NO DOCUMENTO, mesmo invisível.
     *
     * `new Audio()` cria um elemento SOLTO, e som solto toca — mas é o elemento
     * no documento que o iOS reconhece como mídia da página para manter tocando
     * com a tela apagada e para pendurar o card de "tocando agora". Como é
     * exatamente isso que esta tela existe para fazer, ele não pode ficar de
     * fora do documento por economia de uma linha. Fica aqui, e não na criação,
     * para valer também depois de um `parar()` — que o tira de lá.
     */
    if (typeof document !== "undefined" && !audio.isConnected) document.body.appendChild(audio);
    const nova = URL.createObjectURL(blob);
    audio.loop = loop;
    audio.src = nova;
    if (url) URL.revokeObjectURL(url);
    url = nova;
  };

  return {
    elemento: audio,
    /**
     * ⚠️ DESTRAVAR É O PASSO QUE PARECE SUPÉRFLUO E NÃO É.
     *
     * O iOS só deixa tocar áudio a partir de um gesto — e "a partir de" quer
     * dizer NA MESMA PILHA DE CHAMADA. Renderizar leva uns 200 ms de `await`,
     * e depois do `await` o gesto já passou: o `play()` volta rejeitado e o
     * player fica mudo sem erro visível. Tocar um silêncio de 50 ms dentro do
     * toque destrava o elemento; a partir daí ele aceita trocar de faixa.
     */
    destravar() {
      try {
        const mudo = wav(new Float32Array(1200), 22050);
        trocar(mudo, false);
        void audio.play().catch(() => {});
      } catch {
        /* ignore */
      }
    },
    async tocar(kind) {
      const blob = await renderizar(kind);
      if (!blob) return false;
      trocar(blob, true);
      try {
        await audio.play();
        return true;
      } catch {
        return false;
      }
    },
    async desligarComFade(kind) {
      const blob = await renderizar(kind, true);
      if (!blob) {
        audio.pause();
        return;
      }
      trocar(blob, false);
      try {
        await audio.play();
      } catch {
        audio.pause();
        return;
      }
      await new Promise<void>((ok) => {
        const fim = () => {
          audio.removeEventListener("ended", fim);
          ok();
        };
        audio.addEventListener("ended", fim);
      });
    },
    parar() {
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        /* Sai do documento junto: um elemento de mídia esquecido no `body` é o
           tipo de coisa que sobrevive a navegações e reaparece tocando. */
        audio.remove();
      } catch {
        /* ignore */
      }
      if (url) URL.revokeObjectURL(url);
      url = null;
    },
  };
}

/* ══════════════════════════ O temporizador ═════════════════════════════════ */

export const TEMPOS = [15, 30, 60, 0] as const;
export type Tempo = (typeof TEMPOS)[number];

export function rotuloDoTempo(t: Tempo): string {
  return t === 0 ? "Sem limite" : `${t} min`;
}

/**
 * Quando começar a desligar.
 *
 * O fade come os últimos 15 s do tempo escolhido, e não 15 s a mais: quem pede
 * 30 minutos quer o quarto em silêncio aos 30, não aos 30 e meio.
 */
export function quandoDesligar(minutos: Tempo, agora: number): number | null {
  if (!minutos) return null;
  return agora + minutos * 60_000 - CAUDA_SEGS * 1000;
}

/** "28 min" / "45 s" — o que falta, para a tela. */
export function faltando(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 60) return `${Math.ceil(s / 60)} min`;
  return `${s} s`;
}
